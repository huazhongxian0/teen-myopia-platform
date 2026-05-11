package com.example.server.service;

import com.example.server.dto.OverviewDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class OverviewService {
    private static final ZoneId ZONE_ID = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MM-dd");

    private final JdbcTemplate jdbcTemplate;

    public OverviewService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public OverviewDto.DashboardResponse getDashboard(OverviewDto.DashboardRequest req) {
        OverviewDataset dataset = loadDataset();
        int topLimit = normalizeTopLimit(req == null ? null : req.topSchoolLimit());

        List<OverviewDto.SchoolRankingItem> schoolRanking = buildSchoolRanking(dataset, topLimit);
        List<OverviewDto.NameValueItem> riskDistribution = buildRiskDistribution(dataset.students());
        List<OverviewDto.CoverageItem> schoolCoverage = buildSchoolCoverage(dataset);
        List<OverviewDto.TrendItem> visitTrend = buildVisitTrend();
        List<OverviewDto.GlassesDistributionItem> glassesDistribution = buildGlassesDistribution(dataset, topLimit);

        long todayVisitCount = visitTrend.isEmpty()
                ? 0L
                : visitTrend.get(visitTrend.size() - 1).visitCount();

        return new OverviewDto.DashboardResponse(
                buildSummary(dataset, todayVisitCount),
                schoolRanking,
                riskDistribution,
                schoolCoverage,
                visitTrend,
                glassesDistribution,
                System.currentTimeMillis()
        );
    }

    public OverviewDto.StudentListResponse listStudents(OverviewDto.StudentListRequest req) {
        OverviewDataset dataset = loadDataset();
        String keyword = normalize(req == null ? null : req.keyword());
        Long schoolId = req == null ? null : req.schoolId();
        Long classId = req == null ? null : req.classId();
        int pageNo = normalizePageNo(req == null ? null : req.pageNo());
        int pageSize = normalizePageSize(req == null ? null : req.pageSize());

        List<OverviewDto.StudentListItem> filtered = dataset.students().stream()
                .filter(item -> schoolId == null || schoolId.equals(item.schoolId()))
                .filter(item -> classId == null || classId.equals(item.classId()))
                .filter(item -> keyword == null || containsKeyword(item, keyword))
                .sorted(
                        Comparator.comparing(OverviewDto.StudentListItem::avgDegree, Comparator.nullsLast(Comparator.reverseOrder()))
                                .thenComparing(OverviewDto.StudentListItem::studentName, Comparator.nullsLast(String::compareTo))
                                .thenComparing(OverviewDto.StudentListItem::studentAccountId, Comparator.nullsLast(Long::compareTo))
                )
                .toList();

        int total = filtered.size();
        int fromIndex = Math.min((pageNo - 1) * pageSize, total);
        int toIndex = Math.min(fromIndex + pageSize, total);
        return new OverviewDto.StudentListResponse((long) total, filtered.subList(fromIndex, toIndex));
    }

    private OverviewDto.SummaryItem buildSummary(OverviewDataset dataset, long todayVisitCount) {
        double avgDegree = safeAverage(
                dataset.students().stream()
                        .map(OverviewDto.StudentListItem::avgDegree)
                        .filter(v -> v != null && v > 0)
                        .mapToDouble(Double::doubleValue)
                        .average()
                        .orElse(0)
        );
        long glassesCount = dataset.students().stream().filter(item -> Boolean.TRUE.equals(item.hasGlasses())).count();
        double glassesRate = dataset.students().isEmpty() ? 0 : safePercent(glassesCount, dataset.students().size());
        long highRiskCount = dataset.students().stream().filter(item -> isHighRisk(item.riskLevel())).count();
        return new OverviewDto.SummaryItem(
                (long) dataset.schools().size(),
                (long) dataset.classes().size(),
                (long) dataset.students().size(),
                avgDegree,
                glassesRate,
                todayVisitCount,
                highRiskCount
        );
    }

    private List<OverviewDto.SchoolRankingItem> buildSchoolRanking(OverviewDataset dataset, int topLimit) {
        List<OverviewDto.SchoolRankingItem> list = new ArrayList<>();
        for (SchoolRow school : dataset.schools()) {
            List<OverviewDto.StudentListItem> students = dataset.students().stream()
                    .filter(item -> school.id().equals(item.schoolId()))
                    .toList();
            long studentCount = students.size();
            long checkedCount = students.stream().filter(item -> item.eyesTime() != null).count();
            long highRiskCount = students.stream().filter(item -> isHighRisk(item.riskLevel())).count();
            long glassesCount = students.stream().filter(item -> Boolean.TRUE.equals(item.hasGlasses())).count();
            double avgDegree = safeAverage(
                    students.stream()
                            .map(OverviewDto.StudentListItem::avgDegree)
                            .filter(v -> v != null && v > 0)
                            .mapToDouble(Double::doubleValue)
                            .average()
                            .orElse(0)
            );
            list.add(new OverviewDto.SchoolRankingItem(
                    school.id(),
                    school.name(),
                    avgDegree,
                    studentCount,
                    checkedCount,
                    highRiskCount,
                    glassesCount
            ));
        }
        return list.stream()
                .sorted(Comparator.comparing(OverviewDto.SchoolRankingItem::avgDegree, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(topLimit)
                .toList();
    }

    private List<OverviewDto.NameValueItem> buildRiskDistribution(List<OverviewDto.StudentListItem> students) {
        Map<String, Long> counter = new LinkedHashMap<>();
        counter.put("正常关注", 0L);
        counter.put("轻度预警", 0L);
        counter.put("中度预警", 0L);
        counter.put("高度预警", 0L);

        for (OverviewDto.StudentListItem student : students) {
            String riskLevel = normalizeRiskLevel(student.riskLevel());
            counter.put(riskLevel, counter.getOrDefault(riskLevel, 0L) + 1L);
        }

        return counter.entrySet().stream()
                .map(entry -> new OverviewDto.NameValueItem(entry.getKey(), entry.getValue()))
                .toList();
    }

    private List<OverviewDto.CoverageItem> buildSchoolCoverage(OverviewDataset dataset) {
        return dataset.schools().stream()
                .map(school -> {
                    List<OverviewDto.StudentListItem> students = dataset.students().stream()
                            .filter(item -> school.id().equals(item.schoolId()))
                            .toList();
                    long studentCount = students.size();
                    long checkedCount = students.stream().filter(item -> item.eyesTime() != null).count();
                    return new OverviewDto.CoverageItem(
                            school.id(),
                            school.name(),
                            studentCount,
                            checkedCount,
                            safePercent(checkedCount, studentCount)
                    );
                })
                .sorted(Comparator.comparing(OverviewDto.CoverageItem::coverageRate, Comparator.reverseOrder()))
                .toList();
    }

    private List<OverviewDto.TrendItem> buildVisitTrend() {
        ensureVisitTables();

        LocalDate today = LocalDate.now(ZONE_ID);
        LocalDate startDate = today.minusDays(6);
        long startTs = startDate.atStartOfDay(ZONE_ID).toInstant().toEpochMilli();
        long endTs = today.plusDays(1).atStartOfDay(ZONE_ID).toInstant().toEpochMilli();

        Map<LocalDate, Long> registrationCounter = initDateCounter(startDate, today);
        Map<LocalDate, Long> visitCounter = initDateCounter(startDate, today);

        List<Long> registrationDates = jdbcTemplate.query(
                "SELECT visit_date FROM visit_registration WHERE visit_date >= ? AND visit_date < ?",
                (rs, rowNum) -> rs.getLong("visit_date"),
                startTs,
                endTs
        );
        for (Long ts : registrationDates) {
            accumulateByDate(registrationCounter, ts);
        }

        List<Long> visitDates = jdbcTemplate.query(
                "SELECT visit_date FROM visit_history WHERE visit_date >= ? AND visit_date < ?",
                (rs, rowNum) -> rs.getLong("visit_date"),
                startTs,
                endTs
        );
        for (Long ts : visitDates) {
            accumulateByDate(visitCounter, ts);
        }

        List<OverviewDto.TrendItem> trend = new ArrayList<>();
        for (LocalDate day = startDate; !day.isAfter(today); day = day.plusDays(1)) {
            trend.add(new OverviewDto.TrendItem(
                    DATE_FORMATTER.format(day),
                    registrationCounter.getOrDefault(day, 0L),
                    visitCounter.getOrDefault(day, 0L)
            ));
        }
        return trend;
    }

    private List<OverviewDto.GlassesDistributionItem> buildGlassesDistribution(OverviewDataset dataset, int topLimit) {
        return dataset.schools().stream()
                .map(school -> {
                    List<OverviewDto.StudentListItem> students = dataset.students().stream()
                            .filter(item -> school.id().equals(item.schoolId()))
                            .toList();
                    long glassesCount = students.stream().filter(item -> Boolean.TRUE.equals(item.hasGlasses())).count();
                    long noGlassesCount = Math.max(students.size() - glassesCount, 0);
                    return new OverviewDto.GlassesDistributionItem(
                            school.id(),
                            school.name(),
                            glassesCount,
                            noGlassesCount
                    );
                })
                .sorted(Comparator.comparingLong(OverviewDto.GlassesDistributionItem::glassesCount).reversed())
                .limit(topLimit)
                .toList();
    }

    private OverviewDataset loadDataset() {
        ensureSchoolTable();
        ensureEyeSightTable();

        List<SchoolRow> schools = jdbcTemplate.query(
                "SELECT id, name, table_name FROM school ORDER BY id ASC",
                (rs, rowNum) -> new SchoolRow(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getString("table_name")
                )
        );

        List<ClassRow> classes = new ArrayList<>();
        List<StudentLink> links = new ArrayList<>();

        for (SchoolRow school : schools) {
            if (school.tableName() == null || school.tableName().isBlank()) {
                continue;
            }
            ensureSchoolClassTable(school.tableName());

            List<ClassRow> schoolClasses = jdbcTemplate.query(
                    "SELECT id, name, class_table_name FROM `" + school.tableName() + "` ORDER BY id ASC",
                    (rs, rowNum) -> new ClassRow(
                            rs.getLong("id"),
                            school.id(),
                            school.name(),
                            rs.getString("name"),
                            rs.getString("class_table_name")
                    )
            );
            classes.addAll(schoolClasses);

            for (ClassRow clazz : schoolClasses) {
                if (clazz.classTableName() == null || clazz.classTableName().isBlank()) {
                    continue;
                }
                ensureClassStudentTable(clazz.classTableName());
                List<Long> accountIds = jdbcTemplate.query(
                        "SELECT account_id FROM `" + clazz.classTableName() + "` ORDER BY id ASC",
                        (rs, rowNum) -> rs.getLong("account_id")
                );
                for (Long accountId : accountIds) {
                    links.add(new StudentLink(
                            clazz.schoolId(),
                            clazz.schoolName(),
                            clazz.id(),
                            clazz.name(),
                            accountId
                    ));
                }
            }
        }

        Set<Long> accountIds = new LinkedHashSet<>();
        for (StudentLink link : links) {
            accountIds.add(link.accountId());
        }

        Map<Long, AccountRow> accountMap = loadAccounts(accountIds);
        Map<Long, EyeSightRow> eyeSightMap = loadEyeSight(accountIds);

        List<OverviewDto.StudentListItem> students = new ArrayList<>();
        for (StudentLink link : links) {
            AccountRow account = accountMap.get(link.accountId());
            EyeSightRow eye = eyeSightMap.get(link.accountId());
            Long od = eye == null ? null : eye.od();
            Long os = eye == null ? null : eye.os();
            Boolean hasGlasses = eye == null ? null : eye.hasGlasses();
            Long eyesTime = eye == null ? null : eye.eyesTime();
            Double avgDegree = calculateAvgDegree(od, os);
            students.add(new OverviewDto.StudentListItem(
                    link.schoolId(),
                    link.schoolName(),
                    link.classId(),
                    link.className(),
                    link.accountId(),
                    pickStudentName(account, link.accountId()),
                    account == null ? null : account.accountName(),
                    account == null ? null : account.phoneNumber(),
                    od,
                    os,
                    avgDegree,
                    hasGlasses,
                    eyesTime,
                    resolveRiskLevel(avgDegree)
            ));
        }

        return new OverviewDataset(schools, classes, students);
    }

    private Map<Long, AccountRow> loadAccounts(Set<Long> accountIds) {
        if (accountIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, AccountRow> result = new LinkedHashMap<>();
        for (List<Long> batch : partition(accountIds, 200)) {
            String placeholders = String.join(",", batch.stream().map(id -> "?").toList());
            List<AccountRow> rows = jdbcTemplate.query(
                    "SELECT id, name, account_name, phone_number FROM account WHERE id IN (" + placeholders + ")",
                    (rs, rowNum) -> new AccountRow(
                            rs.getLong("id"),
                            rs.getString("name"),
                            rs.getString("account_name"),
                            rs.getString("phone_number")
                    ),
                    batch.toArray()
            );
            for (AccountRow row : rows) {
                result.put(row.id(), row);
            }
        }
        return result;
    }

    private Map<Long, EyeSightRow> loadEyeSight(Set<Long> accountIds) {
        if (accountIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, EyeSightRow> result = new LinkedHashMap<>();
        for (List<Long> batch : partition(accountIds, 200)) {
            String placeholders = String.join(",", batch.stream().map(id -> "?").toList());
            List<EyeSightRow> rows = jdbcTemplate.query(
                    "SELECT people_id, od, os, eyes_time, has_glasses FROM eyessight WHERE people_id IN (" + placeholders + ")",
                    (rs, rowNum) -> new EyeSightRow(
                            rs.getLong("people_id"),
                            rs.getLong("od"),
                            rs.getLong("os"),
                            rs.getLong("eyes_time"),
                            rs.getBoolean("has_glasses")
                    ),
                    batch.toArray()
            );
            for (EyeSightRow row : rows) {
                result.put(row.peopleId(), row);
            }
        }
        return result;
    }

    private static Map<LocalDate, Long> initDateCounter(LocalDate start, LocalDate end) {
        Map<LocalDate, Long> map = new LinkedHashMap<>();
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            map.put(day, 0L);
        }
        return map;
    }

    private static void accumulateByDate(Map<LocalDate, Long> counter, Long timestamp) {
        if (timestamp == null || timestamp <= 0) {
            return;
        }
        LocalDate day = Instant.ofEpochMilli(timestamp).atZone(ZONE_ID).toLocalDate();
        if (counter.containsKey(day)) {
            counter.put(day, counter.get(day) + 1L);
        }
    }

    private static boolean containsKeyword(OverviewDto.StudentListItem item, String keyword) {
        String lower = keyword.toLowerCase();
        return contains(item.schoolName(), lower)
                || contains(item.className(), lower)
                || contains(item.studentName(), lower)
                || contains(item.accountName(), lower)
                || contains(item.phoneNumber(), lower);
    }

    private static boolean contains(String value, String keyword) {
        return value != null && value.toLowerCase().contains(keyword);
    }

    private static String pickStudentName(AccountRow account, Long accountId) {
        if (account == null) {
            return String.valueOf(accountId);
        }
        if (account.name() != null && !account.name().isBlank()) {
            return account.name();
        }
        if (account.accountName() != null && !account.accountName().isBlank()) {
            return account.accountName();
        }
        return String.valueOf(accountId);
    }

    private static Double calculateAvgDegree(Long od, Long os) {
        if (od == null && os == null) {
            return null;
        }
        if (od == null) {
            return safeAverage(os);
        }
        if (os == null) {
            return safeAverage(od);
        }
        return safeAverage((od + os) / 2.0);
    }

    private static String resolveRiskLevel(Double avgDegree) {
        if (avgDegree == null || avgDegree <= 0) {
            return "正常关注";
        }
        if (avgDegree >= 500) {
            return "高度预警";
        }
        if (avgDegree >= 300) {
            return "中度预警";
        }
        if (avgDegree >= 150) {
            return "轻度预警";
        }
        return "正常关注";
    }

    private static String normalizeRiskLevel(String riskLevel) {
        if (riskLevel == null || riskLevel.isBlank()) {
            return "正常关注";
        }
        return riskLevel;
    }

    private static boolean isHighRisk(String riskLevel) {
        return "中度预警".equals(riskLevel) || "高度预警".equals(riskLevel);
    }

    private static double safePercent(long numerator, long denominator) {
        if (denominator <= 0) {
            return 0;
        }
        return safeAverage((numerator * 100.0) / denominator);
    }

    private static double safeAverage(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private static int normalizePageNo(Integer value) {
        if (value == null || value < 1) {
            return 1;
        }
        return value;
    }

    private static int normalizePageSize(Integer value) {
        if (value == null || value < 1) {
            return 10;
        }
        return Math.min(value, 100);
    }

    private static int normalizeTopLimit(Integer value) {
        if (value == null || value < 1) {
            return 8;
        }
        return Math.min(value, 12);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static <T> List<List<T>> partition(Set<T> source, int batchSize) {
        List<List<T>> result = new ArrayList<>();
        List<T> current = new ArrayList<>(batchSize);
        for (T item : source) {
            current.add(item);
            if (current.size() >= batchSize) {
                result.add(List.copyOf(current));
                current.clear();
            }
        }
        if (!current.isEmpty()) {
            result.add(List.copyOf(current));
        }
        return result;
    }

    private void ensureSchoolTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS school (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  name VARCHAR(255) NOT NULL,
                  table_name VARCHAR(255) NOT NULL,
                  created_at BIGINT NOT NULL,
                  PRIMARY KEY (id)
                )
                """);
    }

    private void ensureSchoolClassTable(String schoolTableName) {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `%s` (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  class_table_name VARCHAR(255) NOT NULL,
                  name VARCHAR(255) NOT NULL,
                  head_teacher_account_id BIGINT NULL,
                  created_at BIGINT NOT NULL,
                  PRIMARY KEY (id)
                )
                """.formatted(schoolTableName));
    }

    private void ensureClassStudentTable(String classTableName) {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `%s` (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  account_id BIGINT NOT NULL,
                  PRIMARY KEY (id)
                )
                """.formatted(classTableName));
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

    private void ensureVisitTables() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS visit_registration (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  doctor_account_id BIGINT NOT NULL,
                  patient_account_id BIGINT NOT NULL,
                  visit_date BIGINT NOT NULL,
                  created_at BIGINT NOT NULL,
                  PRIMARY KEY (id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS visit_history (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  registration_id BIGINT NULL,
                  doctor_account_id BIGINT NOT NULL,
                  patient_account_id BIGINT NOT NULL,
                  visit_date BIGINT NOT NULL,
                  od BIGINT NOT NULL,
                  os BIGINT NOT NULL,
                  created_at BIGINT NOT NULL,
                  PRIMARY KEY (id)
                )
                """);
    }

    private record SchoolRow(Long id, String name, String tableName) {
    }

    private record ClassRow(Long id, Long schoolId, String schoolName, String name, String classTableName) {
    }

    private record StudentLink(Long schoolId, String schoolName, Long classId, String className, Long accountId) {
    }

    private record AccountRow(Long id, String name, String accountName, String phoneNumber) {
    }

    private record EyeSightRow(Long peopleId, Long od, Long os, Long eyesTime, Boolean hasGlasses) {
    }

    private record OverviewDataset(
            List<SchoolRow> schools,
            List<ClassRow> classes,
            List<OverviewDto.StudentListItem> students
    ) {
    }
}
