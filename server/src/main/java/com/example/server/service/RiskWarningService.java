package com.example.server.service;

import com.example.server.dto.RiskWarningDto;
import com.example.server.model.Account;
import com.example.server.model.RiskWarning;
import com.example.server.model.RiskWarningMessage;
import com.example.server.model.VisitHistory;
import com.example.server.repository.AccountRepository;
import com.example.server.repository.RiskWarningMessageRepository;
import com.example.server.repository.RiskWarningRepository;
import com.example.server.repository.VisitHistoryRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class RiskWarningService {

    private static final long SIX_MONTHS_MILLIS = 180L * 24 * 60 * 60 * 1000;
    private static final long TREND_DROP_THRESHOLD = 20;

    private final RiskWarningRepository riskWarningRepository;
    private final RiskWarningMessageRepository riskWarningMessageRepository;
    private final AccountRepository accountRepository;
    private final VisitHistoryRepository visitHistoryRepository;
    private final JdbcTemplate jdbcTemplate;

    public RiskWarningService(
            RiskWarningRepository riskWarningRepository,
            RiskWarningMessageRepository riskWarningMessageRepository,
            AccountRepository accountRepository,
            VisitHistoryRepository visitHistoryRepository,
            JdbcTemplate jdbcTemplate
    ) {
        this.riskWarningRepository = riskWarningRepository;
        this.riskWarningMessageRepository = riskWarningMessageRepository;
        this.accountRepository = accountRepository;
        this.visitHistoryRepository = visitHistoryRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public RiskWarningDto.EvaluateResponse evaluateAndWarn(Long studentAccountId) {
        if (studentAccountId == null || studentAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_STUDENT");
        }
        Account student = accountRepository.findById(studentAccountId)
                .orElseThrow(() -> new IllegalArgumentException("STUDENT_NOT_FOUND"));
        if (!"student".equalsIgnoreCase(student.getRoleId())) {
        }

        ensureTables();
        EyeSightInfo eye = loadEyeSight(studentAccountId);
        List<VisitHistory> histories = visitHistoryRepository
                .findByPatientAccountIdOrderByIdDesc(studentAccountId, Pageable.unpaged())
                .getContent();

        TriggerResult result = computeTrigger(eye, histories);
        if (result == null) {
            return new RiskWarningDto.EvaluateResponse(null, "正常关注", "无", "当前视力数据正常，未触发预警规则", false);
        }

        RiskWarning warning = new RiskWarning(
                null,
                studentAccountId,
                result.level,
                result.triggerType,
                result.triggerReason,
                "未处置",
                System.currentTimeMillis(),
                null,
                null,
                null
        );
        RiskWarning saved = riskWarningRepository.save(warning);

        pushWarningMessages(saved, studentAccountId);

        return new RiskWarningDto.EvaluateResponse(
                saved.getId(), saved.getLevel(), saved.getTriggerType(), saved.getTriggerReason(), true
        );
    }

    @Transactional
    public RiskWarningDto.BatchEvaluateResponse batchEvaluate(Long classId) {
        if (classId == null || classId <= 0) {
            throw new IllegalArgumentException("INVALID_CLASS_ID");
        }
        ensureTables();

        List<Long> studentIds = findStudentAccountIdsByClassId(classId);
        int triggered = 0;
        for (Long studentId : studentIds) {
            RiskWarningDto.EvaluateResponse resp = evaluateAndWarn(studentId);
            if (resp.triggered()) {
                triggered++;
            }
        }
        return new RiskWarningDto.BatchEvaluateResponse(studentIds.size(), triggered);
    }

    public RiskWarningDto.ListMyWarningsResponse listMyWarnings(Long studentAccountId, RiskWarningDto.ListMyWarningsRequest req) {
        if (studentAccountId == null || studentAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_STUDENT");
        }
        int pageNo = Math.max(1, req == null || req.pageNo() == null ? 1 : req.pageNo());
        int pageSize = Math.min(100, Math.max(1, req == null || req.pageSize() == null ? 20 : req.pageSize()));
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);

        long total = riskWarningRepository.countByStudentAccountId(studentAccountId);
        List<RiskWarning> rows = riskWarningRepository
                .findByStudentAccountIdOrderByIdDesc(studentAccountId, pageable)
                .getContent();

        List<RiskWarningDto.RiskWarningItem> list = rows.stream()
                .map(r -> buildWarningItem(r, Map.of()))
                .collect(Collectors.toList());
        return new RiskWarningDto.ListMyWarningsResponse(total, list);
    }

    public RiskWarningDto.ListMyMessagesResponse listMyMessages(Long receiverAccountId, RiskWarningDto.ListMyMessagesRequest req) {
        if (receiverAccountId == null || receiverAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_ACCOUNT");
        }
        int pageNo = Math.max(1, req == null || req.pageNo() == null ? 1 : req.pageNo());
        int pageSize = Math.min(100, Math.max(1, req == null || req.pageSize() == null ? 20 : req.pageSize()));

        List<RiskWarningMessage> messages = riskWarningMessageRepository
                .findByReceiverAccountIdOrderByIdDesc(receiverAccountId);

        List<Long> warningIds = messages.stream().map(RiskWarningMessage::getWarningId).distinct().toList();
        Map<Long, RiskWarning> warningMap = riskWarningRepository.findAllById(warningIds)
                .stream().collect(Collectors.toMap(RiskWarning::getId, w -> w));

        Map<Long, String> studentNameMap = loadStudentNames(warningMap.values().stream()
                .map(RiskWarning::getStudentAccountId).filter(Objects::nonNull).collect(Collectors.toSet()));

        List<RiskWarningDto.RiskWarningMessageItem> all = messages.stream()
                .map(m -> {
                    RiskWarning w = warningMap.get(m.getWarningId());
                    return new RiskWarningDto.RiskWarningMessageItem(
                            m.getId(),
                            m.getWarningId(),
                            m.getReceiverAccountId(),
                            m.getReceiverRole(),
                            m.getReadStatus(),
                            m.getCreatedAt(),
                            w == null ? null : studentNameMap.getOrDefault(w.getStudentAccountId(), "-"),
                            w == null ? null : w.getLevel(),
                            w == null ? null : w.getTriggerReason()
                    );
                })
                .toList();

        int total = all.size();
        int from = Math.min((pageNo - 1) * pageSize, total);
        int to = Math.min(from + pageSize, total);
        return new RiskWarningDto.ListMyMessagesResponse((long) total, all.subList(from, to));
    }

    @Transactional
    public RiskWarningDto.ReadMessageResponse readMessage(Long receiverAccountId, RiskWarningDto.ReadMessageRequest req) {
        Long id = req == null ? null : req.id();
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("INVALID_ID");
        }
        RiskWarningMessage msg = riskWarningMessageRepository
                .findByIdAndReceiverAccountId(id, receiverAccountId)
                .orElseThrow(() -> new IllegalArgumentException("NOT_FOUND"));
        msg.setReadStatus(true);
        riskWarningMessageRepository.save(msg);
        return new RiskWarningDto.ReadMessageResponse(true);
    }

    @Transactional
    public RiskWarningDto.ResolveWarningResponse resolveWarning(Long resolverAccountId, RiskWarningDto.ResolveWarningRequest req) {
        Long id = req == null ? null : req.id();
        String note = req == null ? null : req.resolutionNote();
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("INVALID_ID");
        }
        RiskWarning warning = riskWarningRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("NOT_FOUND"));
        warning.setStatus("已处置");
        warning.setResolvedAt(System.currentTimeMillis());
        warning.setResolverAccountId(resolverAccountId);
        warning.setResolutionNote(note);
        riskWarningRepository.save(warning);
        return new RiskWarningDto.ResolveWarningResponse(true);
    }

    public RiskWarningDto.ClassWarningListResponse listClassWarnings(Long teacherAccountId, RiskWarningDto.ClassWarningListRequest req) {
        Long classId = req == null ? null : req.classId();
        if (classId == null || classId <= 0) {
            throw new IllegalArgumentException("INVALID_CLASS_ID");
        }
        List<Long> studentIds = findStudentAccountIdsByClassId(classId);
        if (studentIds.isEmpty()) {
            return new RiskWarningDto.ClassWarningListResponse(List.of());
        }

        List<RiskWarning> warnings = riskWarningRepository.findByStudentAccountIdInOrderByIdDesc(studentIds);
        Map<Long, String> studentNameMap = loadStudentNames(studentIds.stream().collect(Collectors.toSet()));
        Map<Long, String> resolverNameMap = loadStudentNames(warnings.stream()
                .map(RiskWarning::getResolverAccountId).filter(Objects::nonNull).collect(Collectors.toSet()));

        List<RiskWarningDto.RiskWarningItem> list = warnings.stream()
                .map(w -> buildWarningItem(w, resolverNameMap))
                .peek(item -> {
                    if (item.studentName() == null || "-".equals(item.studentName())) {
                    }
                })
                .map(w -> new RiskWarningDto.RiskWarningItem(
                        w.id(), w.studentAccountId(),
                        studentNameMap.getOrDefault(w.studentAccountId(), "-"),
                        w.level(), w.triggerType(), w.triggerReason(), w.status(),
                        w.createdAt(), w.resolvedAt(), w.resolverAccountId(), w.resolverName(), w.resolutionNote()
                ))
                .toList();
        return new RiskWarningDto.ClassWarningListResponse(list);
    }

    public RiskWarningDto.AdminOverviewResponse adminOverview() {
        ensureTables();
        long total = riskWarningRepository.count();
        long unresolved = riskWarningRepository.countByStatus("未处置");
        long highRisk = riskWarningRepository.countByLevel("高度预警");
        long midRisk = riskWarningRepository.countByLevel("中度预警");
        long lowRisk = riskWarningRepository.countByLevel("轻度预警");
        long normal = riskWarningRepository.countByLevel("正常关注");

        double responseRate = total == 0 ? 0.0 : Math.round(((total - unresolved) * 1000.0 / total)) / 10.0;

        List<RiskWarningDto.NameValueItem> levelDistribution = List.of(
                new RiskWarningDto.NameValueItem("正常关注", normal),
                new RiskWarningDto.NameValueItem("轻度预警", lowRisk),
                new RiskWarningDto.NameValueItem("中度预警", midRisk),
                new RiskWarningDto.NameValueItem("高度预警", highRisk)
        );

        Map<String, Long> triggerMap = new LinkedHashMap<>();
        triggerMap.put("阈值触发", 0L);
        triggerMap.put("趋势触发", 0L);
        triggerMap.put("超期触发", 0L);
        List<RiskWarning> all = riskWarningRepository.findAll();
        for (RiskWarning w : all) {
            triggerMap.merge(w.getTriggerType(), 1L, Long::sum);
        }
        List<RiskWarningDto.NameValueItem> triggerDistribution = triggerMap.entrySet().stream()
                .map(e -> new RiskWarningDto.NameValueItem(e.getKey(), e.getValue()))
                .toList();

        List<RiskWarning> recent = all.stream()
                .sorted(Comparator.comparing(RiskWarning::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(10)
                .toList();
        Map<Long, String> resolverNameMap = loadStudentNames(recent.stream()
                .map(RiskWarning::getResolverAccountId).filter(Objects::nonNull).collect(Collectors.toSet()));
        Map<Long, String> studentNameMap = loadStudentNames(recent.stream()
                .map(RiskWarning::getStudentAccountId).filter(Objects::nonNull).collect(Collectors.toSet()));

        List<RiskWarningDto.RiskWarningItem> recentItems = recent.stream()
                .map(r -> new RiskWarningDto.RiskWarningItem(
                        r.getId(), r.getStudentAccountId(),
                        studentNameMap.getOrDefault(r.getStudentAccountId(), "-"),
                        r.getLevel(), r.getTriggerType(), r.getTriggerReason(), r.getStatus(),
                        r.getCreatedAt(), r.getResolvedAt(), r.getResolverAccountId(),
                        resolverNameMap.getOrDefault(r.getResolverAccountId(), null),
                        r.getResolutionNote()
                ))
                .toList();

        return new RiskWarningDto.AdminOverviewResponse(
                total, unresolved, highRisk, midRisk, lowRisk, normal, responseRate,
                levelDistribution, triggerDistribution, recentItems
        );
    }

    private TriggerResult computeTrigger(EyeSightInfo eye, List<VisitHistory> histories) {
        TriggerResult thresholdResult = checkThreshold(eye);
        if (thresholdResult != null) {
            return thresholdResult;
        }
        TriggerResult trendResult = checkTrend(histories);
        if (trendResult != null) {
            return trendResult;
        }
        TriggerResult overdueResult = checkOverdue(histories);
        if (overdueResult != null) {
            return overdueResult;
        }
        return null;
    }

    private TriggerResult checkThreshold(EyeSightInfo eye) {
        if (eye == null || eye.od == null || eye.os == null) {
            return null;
        }
        double avg = (eye.od + eye.os) / 2.0;
        if (avg >= 500) {
            return new TriggerResult("高度预警", "阈值触发", "单次检测平均度数达到高度预警标准（" + formatDegree(avg) + "）");
        }
        if (avg >= 300) {
            return new TriggerResult("中度预警", "阈值触发", "单次检测平均度数达到中度预警标准（" + formatDegree(avg) + "）");
        }
        if (avg >= 150) {
            return new TriggerResult("轻度预警", "阈值触发", "单次检测平均度数达到轻度预警标准（" + formatDegree(avg) + "）");
        }
        return null;
    }

    private TriggerResult checkTrend(List<VisitHistory> histories) {
        if (histories == null || histories.size() < 2) {
            return null;
        }
        VisitHistory latest = histories.get(0);
        VisitHistory previous = histories.get(1);
        long odDrop = previous.getOd() - latest.getOd();
        long osDrop = previous.getOs() - latest.getOs();
        if (odDrop >= TREND_DROP_THRESHOLD || osDrop >= TREND_DROP_THRESHOLD) {
            String reason = "近两次检测视力下降明显（OD下降" + formatDegree(odDrop) + "，OS下降" + formatDegree(osDrop) + "）";
            return new TriggerResult("中度预警", "趋势触发", reason);
        }
        return null;
    }

    private TriggerResult checkOverdue(List<VisitHistory> histories) {
        if (histories == null || histories.isEmpty()) {
            return new TriggerResult("轻度预警", "超期触发", "从未进行复查，已超过建议周期");
        }
        VisitHistory latest = histories.get(0);
        long elapsed = System.currentTimeMillis() - latest.getVisitDate();
        if (elapsed > SIX_MONTHS_MILLIS) {
            long days = elapsed / (24 * 60 * 60 * 1000);
            return new TriggerResult("轻度预警", "超期触发", "距离上次复查已超过" + days + "天，建议尽快复查");
        }
        return null;
    }

    private void pushWarningMessages(RiskWarning warning, Long studentAccountId) {
        long now = System.currentTimeMillis();
        List<RiskWarningMessage> messages = new ArrayList<>();

        messages.add(new RiskWarningMessage(null, warning.getId(), studentAccountId, "student", false, now));

        List<Long> doctorIds = findRelatedDoctorIds(studentAccountId);
        for (Long doctorId : doctorIds) {
            messages.add(new RiskWarningMessage(null, warning.getId(), doctorId, "doctor", false, now));
        }

        List<Long> teacherIds = findRelatedTeacherIds(studentAccountId);
        for (Long teacherId : teacherIds) {
            messages.add(new RiskWarningMessage(null, warning.getId(), teacherId, "teacher", false, now));
        }

        riskWarningMessageRepository.saveAll(messages);
    }

    private List<Long> findRelatedDoctorIds(Long studentAccountId) {
        return visitHistoryRepository.findByPatientAccountIdOrderByIdDesc(studentAccountId, Pageable.unpaged())
                .getContent().stream()
                .map(VisitHistory::getDoctorAccountId)
                .distinct()
                .collect(Collectors.toList());
    }

    private List<Long> findRelatedTeacherIds(Long studentAccountId) {
        try {
            List<Long> classIds = findClassIdsByStudentId(studentAccountId);
            List<Long> teacherIds = new ArrayList<>();
            for (Long classId : classIds) {
                Long headTeacher = findHeadTeacherByClassId(classId);
                if (headTeacher != null) {
                    teacherIds.add(headTeacher);
                }
            }
            return teacherIds;
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<Long> findClassIdsByStudentId(Long studentAccountId) {
        List<Long> result = new ArrayList<>();
        List<Map<String, Object>> schools = jdbcTemplate.queryForList("SELECT table_name FROM school");
        for (Map<String, Object> s : schools) {
            String schoolTable = (String) s.get("table_name");
            if (schoolTable == null || schoolTable.isBlank()) continue;
            try {
                List<Map<String, Object>> classes = jdbcTemplate.queryForList(
                        "SELECT id, class_table_name FROM `" + schoolTable + "`"
                );
                for (Map<String, Object> c : classes) {
                    String classTable = (String) c.get("class_table_name");
                    if (classTable == null || classTable.isBlank()) continue;
                    try {
                        Integer count = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM `" + classTable + "` WHERE account_id = ?",
                                Integer.class, studentAccountId
                        );
                        if (count != null && count > 0) {
                            Number idNum = (Number) c.get("id");
                            if (idNum != null) result.add(idNum.longValue());
                        }
                    } catch (Exception ignored) {
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return result;
    }

    private Long findHeadTeacherByClassId(Long classId) {
        List<Map<String, Object>> schools = jdbcTemplate.queryForList("SELECT table_name FROM school");
        for (Map<String, Object> s : schools) {
            String schoolTable = (String) s.get("table_name");
            if (schoolTable == null || schoolTable.isBlank()) continue;
            try {
                Map<String, Object> row = jdbcTemplate.queryForMap(
                        "SELECT head_teacher_account_id FROM `" + schoolTable + "` WHERE id = ?",
                        classId
                );
                Object val = row.get("head_teacher_account_id");
                if (val instanceof Number n) {
                    return n.longValue();
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private List<Long> findStudentAccountIdsByClassId(Long classId) {
        List<Map<String, Object>> schools = jdbcTemplate.queryForList("SELECT table_name FROM school");
        for (Map<String, Object> s : schools) {
            String schoolTable = (String) s.get("table_name");
            if (schoolTable == null || schoolTable.isBlank()) continue;
            try {
                String classTable = jdbcTemplate.queryForObject(
                        "SELECT class_table_name FROM `" + schoolTable + "` WHERE id = ?",
                        String.class, classId
                );
                if (classTable == null || classTable.isBlank()) continue;
                return jdbcTemplate.query(
                        "SELECT account_id FROM `" + classTable + "`",
                        (rs, rowNum) -> rs.getLong("account_id")
                );
            } catch (Exception ignored) {
            }
        }
        return List.of();
    }

    private EyeSightInfo loadEyeSight(Long peopleId) {
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap(
                    "SELECT od, os, eyes_time, has_glasses FROM eyessight WHERE people_id = ?",
                    peopleId
            );
            Object odObj = row.get("od");
            Object osObj = row.get("os");
            Long od = odObj instanceof Number ? ((Number) odObj).longValue() : null;
            Long os = osObj instanceof Number ? ((Number) osObj).longValue() : null;
            return new EyeSightInfo(od, os);
        } catch (Exception e) {
            return null;
        }
    }

    private Map<Long, String> loadStudentNames(Set<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> map = new HashMap<>();
        for (Long id : ids) {
            accountRepository.findById(id).ifPresent(a -> {
                String name = a.getName();
                if (name == null || name.isBlank()) {
                    name = a.getAccountName();
                }
                map.put(id, name != null ? name : "-");
            });
        }
        return map;
    }

    private RiskWarningDto.RiskWarningItem buildWarningItem(RiskWarning r, Map<Long, String> resolverNameMap) {
        Long resolverId = r.getResolverAccountId();
        String resolverName = resolverId == null ? null : resolverNameMap.getOrDefault(resolverId, null);
        return new RiskWarningDto.RiskWarningItem(
                r.getId(),
                r.getStudentAccountId(),
                null,
                r.getLevel(),
                r.getTriggerType(),
                r.getTriggerReason(),
                r.getStatus(),
                r.getCreatedAt(),
                r.getResolvedAt(),
                resolverId,
                resolverName,
                r.getResolutionNote()
        );
    }

    private void ensureTables() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS risk_warning (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  student_account_id BIGINT NOT NULL,
                  level VARCHAR(32) NOT NULL,
                  trigger_type VARCHAR(32) NOT NULL,
                  trigger_reason VARCHAR(1024) NOT NULL,
                  status VARCHAR(32) NOT NULL DEFAULT '未处置',
                  created_at BIGINT NOT NULL,
                  resolved_at BIGINT NULL,
                  resolver_account_id BIGINT NULL,
                  resolution_note VARCHAR(1024) NULL,
                  PRIMARY KEY (id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS risk_warning_message (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  warning_id BIGINT NOT NULL,
                  receiver_account_id BIGINT NOT NULL,
                  receiver_role VARCHAR(32) NOT NULL,
                  read_status BOOLEAN NOT NULL DEFAULT 0,
                  created_at BIGINT NOT NULL,
                  PRIMARY KEY (id)
                )
                """);
    }

    private static String formatDegree(double value) {
        return String.valueOf(Math.round(value * 10.0) / 10.0);
    }

    private record EyeSightInfo(Long od, Long os) {
    }

    private record TriggerResult(String level, String triggerType, String triggerReason) {
    }
}
