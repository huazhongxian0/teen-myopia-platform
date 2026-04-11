package com.example.server.service;

import com.example.server.dto.VisitDto;
import com.example.server.model.Account;
import com.example.server.model.VisitHistory;
import com.example.server.model.VisitRegistration;
import com.example.server.repository.AccountRepository;
import com.example.server.repository.VisitHistoryRepository;
import com.example.server.repository.VisitRegistrationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class VisitService {
    private final VisitRegistrationRepository visitRegistrationRepository;
    private final VisitHistoryRepository visitHistoryRepository;
    private final AccountRepository accountRepository;
    private final JdbcTemplate jdbcTemplate;

    public VisitService(
            VisitRegistrationRepository visitRegistrationRepository,
            VisitHistoryRepository visitHistoryRepository,
            AccountRepository accountRepository,
            JdbcTemplate jdbcTemplate
    ) {
        this.visitRegistrationRepository = visitRegistrationRepository;
        this.visitHistoryRepository = visitHistoryRepository;
        this.accountRepository = accountRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public VisitDto.CreateVisitRegistrationResponse createVisitRegistration(Long doctorAccountId, VisitDto.CreateVisitRegistrationRequest req) {
        Long patientAccountId = req == null ? null : req.patientAccountId();
        Long visitDate = req == null ? null : req.visitDate();
        if (doctorAccountId == null || doctorAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_DOCTOR");
        }
        if (patientAccountId == null || patientAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_PATIENT");
        }
        if (visitDate == null || visitDate <= 0) {
            throw new IllegalArgumentException("INVALID_VISIT_DATE");
        }

        ensureAccountExists(patientAccountId);
        ensureAccountExists(doctorAccountId);

        Optional<VisitRegistration> existing = visitRegistrationRepository.findByDoctorAccountIdAndPatientAccountIdAndVisitDate(
                doctorAccountId,
                patientAccountId,
                visitDate
        );
        if (existing.isPresent()) {
            return new VisitDto.CreateVisitRegistrationResponse(existing.get().getId());
        }

        long now = System.currentTimeMillis();
        VisitRegistration saved = visitRegistrationRepository.save(new VisitRegistration(null, doctorAccountId, patientAccountId, visitDate, now));
        return new VisitDto.CreateVisitRegistrationResponse(saved.getId());
    }

    @Transactional
    public VisitDto.CreateVisitRegistrationResponse createVisitRegistrationByPatient(Long patientAccountId, VisitDto.CreateVisitRegistrationByPatientRequest req) {
        Long doctorAccountId = req == null ? null : req.doctorAccountId();
        Long visitDate = req == null ? null : req.visitDate();
        if (patientAccountId == null || patientAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_PATIENT");
        }
        if (doctorAccountId == null || doctorAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_DOCTOR");
        }
        if (visitDate == null || visitDate <= 0) {
            throw new IllegalArgumentException("INVALID_VISIT_DATE");
        }

        ensureAccountExists(patientAccountId);
        ensureAccountExists(doctorAccountId);

        Optional<VisitRegistration> existing = visitRegistrationRepository.findByDoctorAccountIdAndPatientAccountIdAndVisitDate(
                doctorAccountId,
                patientAccountId,
                visitDate
        );
        if (existing.isPresent()) {
            return new VisitDto.CreateVisitRegistrationResponse(existing.get().getId());
        }

        long now = System.currentTimeMillis();
        VisitRegistration saved = visitRegistrationRepository.save(new VisitRegistration(null, doctorAccountId, patientAccountId, visitDate, now));
        return new VisitDto.CreateVisitRegistrationResponse(saved.getId());
    }

    public VisitDto.ListMyVisitRegistrationsResponse listMyVisitRegistrations(Long doctorAccountId, VisitDto.ListMyVisitRegistrationsRequest req) {
        Long visitDate = req == null ? null : req.visitDate();
        if (doctorAccountId == null || doctorAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_DOCTOR");
        }
        if (visitDate == null || visitDate <= 0) {
            throw new IllegalArgumentException("INVALID_VISIT_DATE");
        }

        int pageNo = Math.max(1, req.pageNo() == null ? 1 : req.pageNo());
        int pageSize = Math.min(100, Math.max(1, req.pageSize() == null ? 20 : req.pageSize()));
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);

        long total = visitRegistrationRepository.countByDoctorAccountIdAndVisitDate(doctorAccountId, visitDate);
        List<VisitRegistration> rows = visitRegistrationRepository
                .findByDoctorAccountIdAndVisitDateOrderByIdDesc(doctorAccountId, visitDate, pageable)
                .getContent();

        Map<Long, String> patientNameMap = loadAccountNameMap(rows.stream().map(VisitRegistration::getPatientAccountId).collect(Collectors.toSet()));

        List<VisitDto.VisitRegistrationItem> list = rows.stream()
                .map(r -> new VisitDto.VisitRegistrationItem(
                        r.getId(),
                        r.getDoctorAccountId(),
                        r.getPatientAccountId(),
                        patientNameMap.getOrDefault(r.getPatientAccountId(), "-"),
                        r.getVisitDate(),
                        r.getCreatedAt()
                ))
                .collect(Collectors.toList());

        return new VisitDto.ListMyVisitRegistrationsResponse(total, list);
    }

    public VisitDto.ListMyVisitRegistrationsRangeResponse listMyVisitRegistrationsRange(Long doctorAccountId, VisitDto.ListMyVisitRegistrationsRangeRequest req) {
        if (doctorAccountId == null || doctorAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_DOCTOR");
        }
        int pageNo = Math.max(1, req == null || req.pageNo() == null ? 1 : req.pageNo());
        int pageSize = Math.min(100, Math.max(1, req == null || req.pageSize() == null ? 20 : req.pageSize()));
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);

        Long startVisitDate = req == null ? null : req.startVisitDate();
        Long endVisitDate = req == null ? null : req.endVisitDate();

        long total;
        List<VisitRegistration> rows;
        if (startVisitDate != null && startVisitDate > 0 && endVisitDate != null && endVisitDate > 0) {
            if (startVisitDate > endVisitDate) {
                throw new IllegalArgumentException("INVALID_RANGE");
            }
            total = visitRegistrationRepository.countByDoctorAccountIdAndVisitDateBetween(doctorAccountId, startVisitDate, endVisitDate);
            rows = visitRegistrationRepository
                    .findByDoctorAccountIdAndVisitDateBetweenOrderByIdDesc(doctorAccountId, startVisitDate, endVisitDate, pageable)
                    .getContent();
        } else {
            total = visitRegistrationRepository.countByDoctorAccountId(doctorAccountId);
            rows = visitRegistrationRepository.findByDoctorAccountIdOrderByIdDesc(doctorAccountId, pageable).getContent();
        }

        Map<Long, String> patientNameMap = loadAccountNameMap(rows.stream().map(VisitRegistration::getPatientAccountId).collect(Collectors.toSet()));

        List<VisitDto.VisitRegistrationItem> list = rows.stream()
                .map(r -> new VisitDto.VisitRegistrationItem(
                        r.getId(),
                        r.getDoctorAccountId(),
                        r.getPatientAccountId(),
                        patientNameMap.getOrDefault(r.getPatientAccountId(), "-"),
                        r.getVisitDate(),
                        r.getCreatedAt()
                ))
                .collect(Collectors.toList());

        return new VisitDto.ListMyVisitRegistrationsRangeResponse(total, list);
    }

    @Transactional
    public VisitDto.UpdateVisitRegistrationVisitDateResponse updateVisitRegistrationVisitDate(Long doctorAccountId, VisitDto.UpdateVisitRegistrationVisitDateRequest req) {
        Long id = req == null ? null : req.id();
        Long newVisitDate = req == null ? null : req.newVisitDate();
        if (doctorAccountId == null || doctorAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_DOCTOR");
        }
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("INVALID_ID");
        }
        if (newVisitDate == null || newVisitDate <= 0) {
            throw new IllegalArgumentException("INVALID_VISIT_DATE");
        }

        VisitRegistration reg = visitRegistrationRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("NOT_FOUND"));
        if (!Objects.equals(reg.getDoctorAccountId(), doctorAccountId)) {
            throw new IllegalArgumentException("FORBIDDEN");
        }

        Optional<VisitRegistration> conflict = visitRegistrationRepository.findByDoctorAccountIdAndPatientAccountIdAndVisitDate(
                doctorAccountId,
                reg.getPatientAccountId(),
                newVisitDate
        );
        if (conflict.isPresent() && !Objects.equals(conflict.get().getId(), id)) {
            throw new IllegalArgumentException("CONFLICT");
        }

        reg.setVisitDate(newVisitDate);
        visitRegistrationRepository.save(reg);
        return new VisitDto.UpdateVisitRegistrationVisitDateResponse(true);
    }

    public VisitDto.ListMyVisitRegistrationsByPatientResponse listMyVisitRegistrationsByPatient(Long patientAccountId, VisitDto.ListMyVisitRegistrationsByPatientRequest req) {
        if (patientAccountId == null || patientAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_PATIENT");
        }
        int pageNo = Math.max(1, req == null || req.pageNo() == null ? 1 : req.pageNo());
        int pageSize = Math.min(100, Math.max(1, req == null || req.pageSize() == null ? 20 : req.pageSize()));
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);

        Long visitDate = req == null ? null : req.visitDate();
        long total;
        List<VisitRegistration> rows;
        if (visitDate != null && visitDate > 0) {
            total = visitRegistrationRepository.countByPatientAccountIdAndVisitDate(patientAccountId, visitDate);
            rows = visitRegistrationRepository.findByPatientAccountIdAndVisitDateOrderByIdDesc(patientAccountId, visitDate, pageable).getContent();
        } else {
            total = visitRegistrationRepository.countByPatientAccountId(patientAccountId);
            rows = visitRegistrationRepository.findByPatientAccountIdOrderByIdDesc(patientAccountId, pageable).getContent();
        }

        Map<Long, String> doctorNameMap = loadAccountNameMap(rows.stream().map(VisitRegistration::getDoctorAccountId).collect(Collectors.toSet()));

        List<VisitDto.VisitRegistrationPatientItem> list = rows.stream()
                .map(r -> new VisitDto.VisitRegistrationPatientItem(
                        r.getId(),
                        r.getDoctorAccountId(),
                        doctorNameMap.getOrDefault(r.getDoctorAccountId(), "-"),
                        r.getVisitDate(),
                        r.getCreatedAt()
                ))
                .collect(Collectors.toList());

        return new VisitDto.ListMyVisitRegistrationsByPatientResponse(total, list);
    }

    @Transactional
    public VisitDto.CreateVisitHistoryResponse createVisitHistory(Long doctorAccountId, VisitDto.CreateVisitHistoryRequest req) {
        Long registrationId = req == null ? null : req.registrationId();
        Long patientAccountId = req == null ? null : req.patientAccountId();
        Long visitDate = req == null ? null : req.visitDate();
        Long od = req == null ? null : req.od();
        Long os = req == null ? null : req.os();

        if (doctorAccountId == null || doctorAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_DOCTOR");
        }
        if (patientAccountId == null || patientAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_PATIENT");
        }
        if (visitDate == null || visitDate <= 0) {
            throw new IllegalArgumentException("INVALID_VISIT_DATE");
        }
        if (od == null || od < 0) {
            throw new IllegalArgumentException("INVALID_OD");
        }
        if (os == null || os < 0) {
            throw new IllegalArgumentException("INVALID_OS");
        }

        ensureAccountExists(patientAccountId);
        ensureAccountExists(doctorAccountId);

        if (registrationId != null) {
            VisitRegistration reg = visitRegistrationRepository.findById(registrationId).orElseThrow(() -> new IllegalArgumentException("REGISTRATION_NOT_FOUND"));
            if (!Objects.equals(reg.getDoctorAccountId(), doctorAccountId)
                    || !Objects.equals(reg.getPatientAccountId(), patientAccountId)
                    || !Objects.equals(reg.getVisitDate(), visitDate)
            ) {
                throw new IllegalArgumentException("REGISTRATION_MISMATCH");
            }
        }

        long now = System.currentTimeMillis();
        VisitHistory saved = visitHistoryRepository.save(new VisitHistory(null, registrationId, doctorAccountId, patientAccountId, visitDate, od, os, now));
        upsertEyeSight(patientAccountId, od, os, now);
        return new VisitDto.CreateVisitHistoryResponse(saved.getId());
    }

    public VisitDto.ListMyVisitHistoriesResponse listMyVisitHistories(Long patientAccountId, VisitDto.ListMyVisitHistoriesRequest req) {
        if (patientAccountId == null || patientAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_PATIENT");
        }
        int pageNo = Math.max(1, req.pageNo() == null ? 1 : req.pageNo());
        int pageSize = Math.min(100, Math.max(1, req.pageSize() == null ? 20 : req.pageSize()));
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);

        long total = visitHistoryRepository.countByPatientAccountId(patientAccountId);
        List<VisitHistory> rows = visitHistoryRepository.findByPatientAccountIdOrderByIdDesc(patientAccountId, pageable).getContent();

        Map<Long, String> doctorNameMap = loadAccountNameMap(rows.stream().map(VisitHistory::getDoctorAccountId).collect(Collectors.toSet()));

        List<VisitDto.VisitHistoryItem> list = rows.stream()
                .map(h -> new VisitDto.VisitHistoryItem(
                        h.getId(),
                        h.getRegistrationId(),
                        h.getDoctorAccountId(),
                        doctorNameMap.getOrDefault(h.getDoctorAccountId(), "-"),
                        h.getPatientAccountId(),
                        h.getVisitDate(),
                        h.getOd(),
                        h.getOs(),
                        h.getCreatedAt()
                ))
                .collect(Collectors.toList());

        return new VisitDto.ListMyVisitHistoriesResponse(total, list);
    }

    public VisitDto.ListVisitHistoriesByPatientResponse listVisitHistoriesByPatient(Long doctorAccountId, VisitDto.ListVisitHistoriesByPatientRequest req) {
        Long patientAccountId = req == null ? null : req.patientAccountId();
        if (doctorAccountId == null || doctorAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_DOCTOR");
        }
        if (patientAccountId == null || patientAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_PATIENT");
        }

        int pageNo = Math.max(1, req.pageNo() == null ? 1 : req.pageNo());
        int pageSize = Math.min(100, Math.max(1, req.pageSize() == null ? 20 : req.pageSize()));
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);

        long total = visitHistoryRepository.countByDoctorAccountIdAndPatientAccountId(doctorAccountId, patientAccountId);
        List<VisitHistory> rows = visitHistoryRepository
                .findByDoctorAccountIdAndPatientAccountIdOrderByIdDesc(doctorAccountId, patientAccountId, pageable)
                .getContent();

        Map<Long, String> doctorNameMap = loadAccountNameMap(rows.stream().map(VisitHistory::getDoctorAccountId).collect(Collectors.toSet()));

        List<VisitDto.VisitHistoryItem> list = rows.stream()
                .map(h -> new VisitDto.VisitHistoryItem(
                        h.getId(),
                        h.getRegistrationId(),
                        h.getDoctorAccountId(),
                        doctorNameMap.getOrDefault(h.getDoctorAccountId(), "-"),
                        h.getPatientAccountId(),
                        h.getVisitDate(),
                        h.getOd(),
                        h.getOs(),
                        h.getCreatedAt()
                ))
                .collect(Collectors.toList());

        return new VisitDto.ListVisitHistoriesByPatientResponse(total, list);
    }

    public VisitDto.VisitHistoryItem getVisitHistoryByIdForDoctor(Long doctorAccountId, VisitDto.GetVisitHistoryByIdForDoctorRequest req) {
        Long id = req == null ? null : req.id();
        if (doctorAccountId == null || doctorAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_DOCTOR");
        }
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("INVALID_ID");
        }
        VisitHistory h = visitHistoryRepository.findByIdAndDoctorAccountId(id, doctorAccountId).orElseThrow(() -> new IllegalArgumentException("NOT_FOUND"));
        String doctorName = accountRepository.findById(h.getDoctorAccountId()).map(Account::getName).orElse("-");
        return new VisitDto.VisitHistoryItem(
                h.getId(),
                h.getRegistrationId(),
                h.getDoctorAccountId(),
                doctorName,
                h.getPatientAccountId(),
                h.getVisitDate(),
                h.getOd(),
                h.getOs(),
                h.getCreatedAt()
        );
    }

    public VisitDto.ListMyPatientsResponse listMyPatients(Long doctorAccountId, VisitDto.ListMyPatientsRequest req) {
        if (doctorAccountId == null || doctorAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_DOCTOR");
        }
        String patientNameKeyword = req == null ? null : req.patientNameKeyword();
        String keyword = patientNameKeyword == null ? null : patientNameKeyword.trim();
        if (keyword != null && keyword.isEmpty()) {
            keyword = null;
        }
        int pageNo = Math.max(1, req == null || req.pageNo() == null ? 1 : req.pageNo());
        int pageSize = Math.min(100, Math.max(1, req == null || req.pageSize() == null ? 20 : req.pageSize()));
        int offset = (pageNo - 1) * pageSize;

        Long total;
        if (keyword != null) {
            String like = "%" + keyword + "%";
            total = jdbcTemplate.queryForObject(
                    """
                            SELECT COUNT(DISTINCT vh.patient_account_id)
                            FROM visit_history vh
                            JOIN account a ON a.id = vh.patient_account_id
                            WHERE vh.doctor_account_id = ? AND a.name LIKE ?
                            """,
                    Long.class,
                    doctorAccountId,
                    like
            );
        } else {
            total = jdbcTemplate.queryForObject(
                    """
                            SELECT COUNT(DISTINCT vh.patient_account_id)
                            FROM visit_history vh
                            WHERE vh.doctor_account_id = ?
                            """,
                    Long.class,
                    doctorAccountId
            );
        }
        if (total == null) total = 0L;

        List<Map<String, Object>> rows;
        if (keyword != null) {
            String like = "%" + keyword + "%";
            rows = jdbcTemplate.queryForList(
                    """
                            SELECT
                              vh.patient_account_id,
                              MAX(vh.visit_date) AS latest_visit_date,
                              MAX(vh.id) AS max_id,
                              MAX(a.name) AS patient_name,
                              MAX(a.role_id) AS patient_role_id
                            FROM visit_history vh
                            JOIN account a ON a.id = vh.patient_account_id
                            WHERE vh.doctor_account_id = ? AND a.name LIKE ?
                            GROUP BY vh.patient_account_id
                            ORDER BY max_id DESC
                            LIMIT ? OFFSET ?
                            """,
                    doctorAccountId,
                    like,
                    pageSize,
                    offset
            );
        } else {
            rows = jdbcTemplate.queryForList(
                    """
                            SELECT
                              vh.patient_account_id,
                              MAX(vh.visit_date) AS latest_visit_date,
                              MAX(vh.id) AS max_id,
                              MAX(a.name) AS patient_name,
                              MAX(a.role_id) AS patient_role_id
                            FROM visit_history vh
                            JOIN account a ON a.id = vh.patient_account_id
                            WHERE vh.doctor_account_id = ?
                            GROUP BY vh.patient_account_id
                            ORDER BY max_id DESC
                            LIMIT ? OFFSET ?
                            """,
                    doctorAccountId,
                    pageSize,
                    offset
            );
        }

        List<VisitDto.DoctorPatientArchiveItem> list = rows.stream()
                .map(r -> {
                    Long patientAccountId = r.get("patient_account_id") instanceof Number ? ((Number) r.get("patient_account_id")).longValue() : null;
                    Long latestVisitDate = r.get("latest_visit_date") instanceof Number ? ((Number) r.get("latest_visit_date")).longValue() : null;
                    String patientName = r.get("patient_name") == null ? "-" : String.valueOf(r.get("patient_name"));
                    String patientRoleId = r.get("patient_role_id") == null ? "-" : String.valueOf(r.get("patient_role_id"));
                    return new VisitDto.DoctorPatientArchiveItem(patientAccountId, patientName, patientRoleId, latestVisitDate);
                })
                .collect(Collectors.toList());

        return new VisitDto.ListMyPatientsResponse(total, list);
    }

    public VisitDto.VisitHistoryItem getMyVisitHistoryById(Long patientAccountId, VisitDto.GetMyVisitHistoryByIdRequest req) {
        Long id = req == null ? null : req.id();
        if (patientAccountId == null || patientAccountId <= 0) {
            throw new IllegalArgumentException("INVALID_PATIENT");
        }
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("INVALID_ID");
        }
        VisitHistory h = visitHistoryRepository.findByIdAndPatientAccountId(id, patientAccountId).orElseThrow(() -> new IllegalArgumentException("NOT_FOUND"));
        String doctorName = accountRepository.findById(h.getDoctorAccountId()).map(Account::getName).orElse("-");
        return new VisitDto.VisitHistoryItem(
                h.getId(),
                h.getRegistrationId(),
                h.getDoctorAccountId(),
                doctorName,
                h.getPatientAccountId(),
                h.getVisitDate(),
                h.getOd(),
                h.getOs(),
                h.getCreatedAt()
        );
    }

    private void ensureAccountExists(Long accountId) {
        if (accountId == null || accountId <= 0) {
            throw new IllegalArgumentException("INVALID_ACCOUNT_ID");
        }
        if (accountRepository.findById(accountId).isEmpty()) {
            throw new IllegalArgumentException("ACCOUNT_NOT_FOUND");
        }
    }

    private Map<Long, String> loadAccountNameMap(Set<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        List<Account> accounts = accountRepository.findAllById(ids);
        Map<Long, String> map = new HashMap<>();
        for (Account a : accounts) {
            if (a.getId() != null) {
                map.put(a.getId(), a.getName() == null ? "-" : a.getName());
            }
        }
        return map;
    }

    private void ensureEyeSightTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS eyessight (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  od BIGINT NOT NULL,
                  os BIGINT NOT NULL,
                  eyes_time BIGINT NOT NULL,
                  has_glasses BOOLEAN NOT NULL DEFAULT 0,
                  people_id BIGINT NOT NULL,
                  PRIMARY KEY (id),
                  UNIQUE KEY uk_eyessight_people_id (people_id)
                )
                """);
    }

    private void upsertEyeSight(Long peopleId, Long od, Long os, Long eyesTime) {
        ensureEyeSightTable();
        int updated = jdbcTemplate.update(
                "UPDATE eyessight SET od = ?, os = ?, eyes_time = ? WHERE people_id = ?",
                od,
                os,
                eyesTime,
                peopleId
        );
        if (updated > 0) {
            return;
        }
        jdbcTemplate.update(
                "INSERT INTO eyessight (od, os, eyes_time, has_glasses, people_id) VALUES (?, ?, ?, ?, ?)",
                od,
                os,
                eyesTime,
                false,
                peopleId
        );
    }
}
