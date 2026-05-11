package com.example.server.service;

import com.example.server.dto.SchoolDto.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.Statement;
import java.util.List;

@Service
public class SchoolService {
    private final JdbcTemplate jdbcTemplate;

    public SchoolService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
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

    public void ensureSchoolTable() {
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

    private record SchoolInfo(Long schoolId, String schoolTableName) {}

    private SchoolInfo findSchoolInfoByClassId(Long classId) {
        ensureSchoolTable();
        List<SchoolInfo> schools = jdbcTemplate.query(
                "SELECT id, table_name FROM school",
                (rs, rowNum) -> new SchoolInfo(
                        rs.getLong("id"),
                        rs.getString("table_name")
                )
        );

        for (SchoolInfo school : schools) {
            if (school.schoolTableName == null || school.schoolTableName.isEmpty()) {
                continue;
            }
            try {
                Integer count = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM `" + school.schoolTableName + "` WHERE id = ?",
                        Integer.class,
                        classId
                );
                if (count != null && count > 0) {
                    return school;
                }
            } catch (Exception e) {
                continue;
            }
        }
        throw new IllegalArgumentException("Class not found");
    }

    public ListSchoolsResponse listSchools(ListSchoolsRequest req) {
        ensureSchoolTable();
        int pageNo = normalizePageNo(req.pageNo());
        int pageSize = normalizePageSize(req.pageSize());
        int offset = (pageNo - 1) * pageSize;

        String keyword = normalize(req.keyword());
        String where = "";
        Object[] countArgs = new Object[]{};
        Object[] listArgs = new Object[]{pageSize, offset};
        if (keyword != null) {
            where = " WHERE name LIKE ? ";
            String like = "%" + escapeLike(keyword) + "%";
            countArgs = new Object[]{like};
            listArgs = new Object[]{like, pageSize, offset};
        }

        Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM school" + where, Long.class, countArgs);
        if (total == null) {
            total = 0L;
        }

        List<SchoolItem> list = jdbcTemplate.query(
                "SELECT id, name, created_at FROM school" + where + " ORDER BY id DESC LIMIT ? OFFSET ?",
                (rs, rowNum) -> new SchoolItem(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getLong("created_at")
                ),
                listArgs
        );
        return new ListSchoolsResponse(total, list);
    }

    public SchoolItem createSchool(CreateSchoolRequest req) {
        ensureSchoolTable();
        String name = normalize(req.name());
        if (name == null) {
            throw new IllegalArgumentException("Name is required");
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();
        long now = System.currentTimeMillis();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("INSERT INTO school (name, table_name, created_at) VALUES (?, ?, ?)", Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, name);
            ps.setString(2, "");
            ps.setLong(3, now);
            return ps;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new RuntimeException("Failed to create school");
        }

        String schoolTableName = "school" + id.longValue();
        jdbcTemplate.update("UPDATE school SET table_name = ? WHERE id = ?", schoolTableName, id);

        ensureSchoolClassTable(schoolTableName);

        return new SchoolItem(id.longValue(), name, now);
    }

    public SchoolItem updateSchool(UpdateSchoolRequest req) {
        ensureSchoolTable();
        Long id = req.id();
        if (id == null) {
            throw new IllegalArgumentException("Id is required");
        }
        String name = normalize(req.name());
        if (name == null) {
            throw new IllegalArgumentException("Name is required");
        }

        int updated = jdbcTemplate.update("UPDATE school SET name = ? WHERE id = ?", name, id);
        if (updated == 0) {
            throw new IllegalArgumentException("School not found");
        }

        Long createdAt = jdbcTemplate.queryForObject("SELECT created_at FROM school WHERE id = ?", Long.class, id);
        return new SchoolItem(id, name, createdAt != null ? createdAt : 0);
    }

    public void deleteSchool(DeleteSchoolRequest req) {
        ensureSchoolTable();
        Long id = req.id();
        if (id == null) {
            throw new IllegalArgumentException("Id is required");
        }

        String schoolTableName = jdbcTemplate.queryForObject("SELECT table_name FROM school WHERE id = ?", String.class, id);
        if (schoolTableName == null) {
            throw new IllegalArgumentException("School not found");
        }

        List<ClassInfoItem> classes = jdbcTemplate.query(
                "SELECT id, class_table_name FROM `" + schoolTableName + "`",
                (rs, rowNum) -> new ClassInfoItem(
                        rs.getLong("id"),
                        null,
                        null,
                        rs.getString("class_table_name"),
                        null,
                        null,
                        null
                )
        );

        for (ClassInfoItem clazz : classes) {
            if (clazz.className() != null) {
                jdbcTemplate.execute("DROP TABLE IF EXISTS `" + clazz.className() + "`");
            }
        }

        jdbcTemplate.execute("DROP TABLE IF EXISTS `" + schoolTableName + "`");
        jdbcTemplate.update("DELETE FROM school WHERE id = ?", id);
    }

    public ListClassesResponse listClasses(ListClassesRequest req) {
        ensureSchoolTable();
        Long schoolId = req.schoolId();
        if (schoolId == null) {
            throw new IllegalArgumentException("SchoolId is required");
        }

        String schoolTableName = jdbcTemplate.queryForObject("SELECT table_name FROM school WHERE id = ?", String.class, schoolId);
        if (schoolTableName == null) {
            throw new IllegalArgumentException("School not found");
        }

        ensureSchoolClassTable(schoolTableName);

        int pageNo = normalizePageNo(req.pageNo());
        int pageSize = normalizePageSize(req.pageSize());
        int offset = (pageNo - 1) * pageSize;

        String keyword = normalize(req.keyword());
        String where = "";
        Object[] countArgs = new Object[]{};
        Object[] listArgs = new Object[]{pageSize, offset};
        if (keyword != null) {
            where = " WHERE name LIKE ? ";
            String like = "%" + escapeLike(keyword) + "%";
            countArgs = new Object[]{like};
            listArgs = new Object[]{like, pageSize, offset};
        }

        Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM `" + schoolTableName + "`" + where, Long.class, countArgs);
        if (total == null) {
            total = 0L;
        }

        List<ClassInfoItem> list = jdbcTemplate.query(
                "SELECT id, name, class_table_name, head_teacher_account_id, created_at FROM `" + schoolTableName + "`" + where + " ORDER BY id DESC LIMIT ? OFFSET ?",
                (rs, rowNum) -> new ClassInfoItem(
                        rs.getLong("id"),
                        schoolId,
                        rs.getString("name"),
                        rs.getString("class_table_name"),
                        null,
                        (Long) rs.getObject("head_teacher_account_id"),
                        rs.getLong("created_at")
                ),
                listArgs
        );
        return new ListClassesResponse(total, list);
    }

    public ClassInfoItem createClass(CreateClassRequest req) {
        ensureSchoolTable();
        Long schoolId = req.schoolId();
        String name = normalize(req.name());
        if (schoolId == null || name == null) {
            throw new IllegalArgumentException("SchoolId and name are required");
        }

        String schoolTableName = jdbcTemplate.queryForObject("SELECT table_name FROM school WHERE id = ?", String.class, schoolId);
        if (schoolTableName == null) {
            throw new IllegalArgumentException("School not found");
        }

        ensureSchoolClassTable(schoolTableName);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        long now = System.currentTimeMillis();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement(
                    "INSERT INTO `" + schoolTableName + "` (name, class_table_name, created_at) VALUES (?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, name);
            ps.setString(2, "");
            ps.setLong(3, now);
            return ps;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new RuntimeException("Failed to create class");
        }

        String classTableName = "school" + schoolId + "class" + id.longValue();
        jdbcTemplate.update("UPDATE `" + schoolTableName + "` SET class_table_name = ? WHERE id = ?", classTableName, id);

        ensureClassStudentTable(classTableName);

        return new ClassInfoItem(
                id.longValue(), schoolId, name, classTableName, null, null, now
        );
    }

    public ClassInfoItem updateClass(UpdateClassRequest req) {
        ensureSchoolTable();
        Long id = req.id();
        if (id == null) {
            throw new IllegalArgumentException("Id is required");
        }
        String name = normalize(req.name());
        Long headTeacherAccountId = req.headTeacherAccountId();

        if (name == null && headTeacherAccountId == null) {
            throw new IllegalArgumentException("Name or headTeacherAccountId is required");
        }

        SchoolInfo schoolInfo = findSchoolInfoByClassId(id);
        Long schoolId = schoolInfo.schoolId;
        String schoolTableName = schoolInfo.schoolTableName;

        ensureSchoolClassTable(schoolTableName);

        if (name != null) {
            jdbcTemplate.update("UPDATE `" + schoolTableName + "` SET name = ? WHERE id = ?", name, id);
        }
        if (headTeacherAccountId != null) {
            jdbcTemplate.update("UPDATE `" + schoolTableName + "` SET head_teacher_account_id = ? WHERE id = ?", headTeacherAccountId, id);
        }

        return jdbcTemplate.queryForObject(
                "SELECT id, name, class_table_name, head_teacher_account_id, created_at FROM `" + schoolTableName + "` WHERE id = ?",
                (rs, rowNum) -> new ClassInfoItem(
                        rs.getLong("id"),
                        schoolId,
                        rs.getString("name"),
                        rs.getString("class_table_name"),
                        null,
                        (Long) rs.getObject("head_teacher_account_id"),
                        rs.getLong("created_at")
                ),
                id
        );
    }

    public void deleteClass(DeleteClassRequest req) {
        ensureSchoolTable();
        Long id = req.id();
        if (id == null) {
            throw new IllegalArgumentException("Id is required");
        }

        SchoolInfo schoolInfo = findSchoolInfoByClassId(id);
        String schoolTableName = schoolInfo.schoolTableName;

        ensureSchoolClassTable(schoolTableName);

        String classTableName = jdbcTemplate.queryForObject("SELECT class_table_name FROM `" + schoolTableName + "` WHERE id = ?", String.class, id);
        if (classTableName != null && !classTableName.isEmpty()) {
            jdbcTemplate.execute("DROP TABLE IF EXISTS `" + classTableName + "`");
        }
        jdbcTemplate.update("DELETE FROM `" + schoolTableName + "` WHERE id = ?", id);
    }

    public ListStudentsResponse listStudents(ListStudentsRequest req) {
        ensureSchoolTable();
        Long classId = req.classId();
        if (classId == null) {
            throw new IllegalArgumentException("ClassId is required");
        }

        SchoolInfo schoolInfo = findSchoolInfoByClassId(classId);
        String schoolTableName = schoolInfo.schoolTableName;

        ensureSchoolClassTable(schoolTableName);

        String classTableName = jdbcTemplate.queryForObject("SELECT class_table_name FROM `" + schoolTableName + "` WHERE id = ?", String.class, classId);
        if (classTableName == null || classTableName.isEmpty()) {
            throw new IllegalArgumentException("Class not found");
        }

        ensureClassStudentTable(classTableName);

        int pageNo = normalizePageNo(req.pageNo());
        int pageSize = normalizePageSize(req.pageSize());
        int offset = (pageNo - 1) * pageSize;

        Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM `" + classTableName + "`", Long.class);
        if (total == null) {
            total = 0L;
        }

        List<StudentItem> list = jdbcTemplate.query(
                "SELECT id, account_id FROM `" + classTableName + "` ORDER BY id DESC LIMIT ? OFFSET ?",
                (rs, rowNum) -> new StudentItem(
                        rs.getLong("id"),
                        rs.getLong("account_id")
                ),
                pageSize, offset
        );
        return new ListStudentsResponse(total, list);
    }

    public StudentItem createStudent(CreateStudentRequest req) {
        ensureSchoolTable();
        Long classId = req.classId();
        Long accountId = req.accountId();
        if (classId == null || accountId == null) {
            throw new IllegalArgumentException("ClassId and accountId are required");
        }

        SchoolInfo schoolInfo = findSchoolInfoByClassId(classId);
        String schoolTableName = schoolInfo.schoolTableName;

        ensureSchoolClassTable(schoolTableName);

        String classTableName = jdbcTemplate.queryForObject("SELECT class_table_name FROM `" + schoolTableName + "` WHERE id = ?", String.class, classId);
        if (classTableName == null || classTableName.isEmpty()) {
            throw new IllegalArgumentException("Class not found");
        }

        ensureClassStudentTable(classTableName);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement(
                    "INSERT INTO `" + classTableName + "` (account_id) VALUES (?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setLong(1, accountId);
            return ps;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new RuntimeException("Failed to create student");
        }
        return new StudentItem(id.longValue(), accountId);
    }

    public void deleteStudent(DeleteStudentRequest req) {
        ensureSchoolTable();
        Long classId = req.classId();
        Long studentId = req.studentId();
        if (classId == null || studentId == null) {
            throw new IllegalArgumentException("ClassId and studentId are required");
        }

        SchoolInfo schoolInfo = findSchoolInfoByClassId(classId);
        String schoolTableName = schoolInfo.schoolTableName;

        ensureSchoolClassTable(schoolTableName);

        String classTableName = jdbcTemplate.queryForObject("SELECT class_table_name FROM `" + schoolTableName + "` WHERE id = ?", String.class, classId);
        if (classTableName == null || classTableName.isEmpty()) {
            throw new IllegalArgumentException("Class not found");
        }

        ensureClassStudentTable(classTableName);

        jdbcTemplate.update("DELETE FROM `" + classTableName + "` WHERE id = ?", studentId);
    }

    public ListTeacherClassesResponse listTeacherClasses(ListTeacherClassesRequest req) {
        ensureSchoolTable();
        Long teacherAccountId = req.teacherAccountId();
        if (teacherAccountId == null) {
            throw new IllegalArgumentException("teacherAccountId is required");
        }

        List<SchoolInfo> schools = jdbcTemplate.query(
                "SELECT id, table_name FROM school",
                (rs, rowNum) -> new SchoolInfo(
                        rs.getLong("id"),
                        rs.getString("table_name")
                )
        );

        java.util.List<ClassInfoItem> allClasses = new java.util.ArrayList<>();

        for (SchoolInfo school : schools) {
            if (school.schoolTableName == null || school.schoolTableName.isEmpty()) {
                continue;
            }
            try {
                List<ClassInfoItem> classes = jdbcTemplate.query(
                        "SELECT id, name, class_table_name, head_teacher_account_id, created_at FROM `" + school.schoolTableName + "` WHERE head_teacher_account_id = ?",
                        (rs, rowNum) -> new ClassInfoItem(
                                rs.getLong("id"),
                                school.schoolId,
                                rs.getString("name"),
                                rs.getString("class_table_name"),
                                null,
                                (Long) rs.getObject("head_teacher_account_id"),
                                rs.getLong("created_at")
                        ),
                        teacherAccountId
                );
                allClasses.addAll(classes);
            } catch (Exception e) {
                continue;
            }
        }

        return new ListTeacherClassesResponse(allClasses);
    }

    private record AccountRow(long id, String name, String accountName) {
    }

    private record EyeSightRow(long peopleId, long od, long os, long eyesTime) {
    }

    public ListTeacherEyeSightResponse listTeacherEyeSight(ListTeacherEyeSightRequest req) {
        ensureSchoolTable();
        ensureEyeSightTable();

        Long teacherAccountId = req.teacherAccountId();
        if (teacherAccountId == null) {
            throw new IllegalArgumentException("teacherAccountId is required");
        }

        Long classIdFilter = req.classId();
        java.util.List<ClassInfoItem> classes = listTeacherClasses(new ListTeacherClassesRequest(teacherAccountId)).list();
        if (classIdFilter != null) {
            classes = classes.stream().filter(c -> classIdFilter.equals(c.id())).toList();
        }

        java.util.List<TeacherEyeSightItem> items = new java.util.ArrayList<>();

        for (ClassInfoItem clazz : classes) {
            String classTableName = clazz.className();
            if (classTableName == null || classTableName.isEmpty()) {
                continue;
            }

            ensureClassStudentTable(classTableName);
            List<Long> studentAccountIds = jdbcTemplate.query(
                    "SELECT account_id FROM `" + classTableName + "`",
                    (rs, rowNum) -> rs.getLong("account_id")
            );
            if (studentAccountIds.isEmpty()) {
                continue;
            }

            String placeholders = String.join(",", studentAccountIds.stream().map(_id -> "?").toList());
            Object[] idArgs = studentAccountIds.toArray();

            List<AccountRow> accountRows = jdbcTemplate.query(
                    "SELECT id, name, account_name FROM account WHERE id IN (" + placeholders + ")",
                    (rs, rowNum) -> new AccountRow(
                            rs.getLong("id"),
                            rs.getString("name"),
                            rs.getString("account_name")
                    ),
                    idArgs
            );
            java.util.Map<Long, String> idToName = new java.util.HashMap<>();
            for (AccountRow a : accountRows) {
                String n = a.name();
                if (n == null || n.isBlank()) {
                    n = a.accountName();
                }
                idToName.put(a.id(), n != null && !n.isBlank() ? n : String.valueOf(a.id()));
            }

            List<EyeSightRow> eyeRows = jdbcTemplate.query(
                    "SELECT people_id, od, os, eyes_time FROM eyessight WHERE people_id IN (" + placeholders + ")",
                    (rs, rowNum) -> new EyeSightRow(
                            rs.getLong("people_id"),
                            rs.getLong("od"),
                            rs.getLong("os"),
                            rs.getLong("eyes_time")
                    ),
                    idArgs
            );
            java.util.Map<Long, EyeSightRow> idToEye = new java.util.HashMap<>();
            for (EyeSightRow e : eyeRows) {
                idToEye.put(e.peopleId(), e);
            }

            for (Long studentAccountId : studentAccountIds) {
                EyeSightRow e = idToEye.get(studentAccountId);
                items.add(new TeacherEyeSightItem(
                        clazz.id(),
                        clazz.name(),
                        studentAccountId,
                        idToName.getOrDefault(studentAccountId, String.valueOf(studentAccountId)),
                        e == null ? null : e.od(),
                        e == null ? null : e.os(),
                        e == null ? null : e.eyesTime()
                ));
            }
        }

        return new ListTeacherEyeSightResponse(items);
    }

    private static int normalizePageNo(Integer v) {
        if (v == null || v < 1) return 1;
        return v;
    }

    private static int normalizePageSize(Integer v) {
        if (v == null || v < 1) return 20;
        return Math.min(v, 200);
    }

    private static String normalize(String v) {
        if (v == null) return null;
        String s = v.trim();
        return s.isEmpty() ? null : s;
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
