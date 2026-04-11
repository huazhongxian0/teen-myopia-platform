package com.example.server.controller;

import com.fasterxml.jackson.annotation.JsonAlias;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.web.bind.annotation.*;

import java.sql.Statement;
import java.util.List;

@RestController
@RequestMapping("/api/role")
public class RoleController {
    private final JdbcTemplate jdbcTemplate;

    public RoleController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping("/list")
    public ResponseEntity<ListRolesResponse> listRoles(@RequestBody ListRolesRequest req) {
        ensureRoleTable();
        int pageNo = normalizePageNo(req.pageNo());
        int pageSize = normalizePageSize(req.pageSize());
        int offset = (pageNo - 1) * pageSize;

        String roleIdLike = normalize(req.roleId());
        String where = "";
        Object[] countArgs = new Object[]{};
        Object[] listArgs = new Object[]{pageSize, offset};
        if (roleIdLike != null) {
            where = " WHERE table_id LIKE ? ";
            String like = "%" + escapeLike(roleIdLike) + "%";
            countArgs = new Object[]{like};
            listArgs = new Object[]{like, pageSize, offset};
        }

        Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM role" + where, Long.class, countArgs);
        if (total == null) {
            total = 0L;
        }

        List<RoleItem> list = jdbcTemplate.query(
                "SELECT id, table_id FROM role" + where + " ORDER BY id DESC LIMIT ? OFFSET ?",
                (rs, rowNum) -> new RoleItem(rs.getLong("id"), rs.getString("table_id")),
                listArgs
        );
        return new ResponseEntity<>(new ListRolesResponse(total, list), HttpStatus.OK);
    }

    @PostMapping("/create")
    public ResponseEntity<RoleItem> createRole(@RequestBody CreateRoleRequest req) {
        ensureRoleTable();
        ensureAuthTable();
        String roleId = normalize(req.roleId());
        if (roleId == null) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        if (!isSafeIdentifier(roleId)) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        if (roleExists(roleId)) {
            return new ResponseEntity<>(HttpStatus.CONFLICT);
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("INSERT INTO role (table_id) VALUES (?)", Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, roleId);
            return ps;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        ensureRolePermissionTable(roleId);
        ensureRoleHasBasePermission(roleId);
        return new ResponseEntity<>(new RoleItem(id.longValue(), roleId), HttpStatus.CREATED);
    }

    @PostMapping("/updateRoleId")
    public ResponseEntity<SuccessResponse> updateRoleId(@RequestBody UpdateRoleIdRequest req) {
        ensureRoleTable();
        ensureAuthTable();
        String fromRoleId = normalize(req.fromRoleId());
        String toRoleId = normalize(req.toRoleId());
        if (fromRoleId == null || toRoleId == null) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        if (!isSafeIdentifier(fromRoleId) || !isSafeIdentifier(toRoleId)) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        if (!roleExists(fromRoleId)) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        if (roleExists(toRoleId)) {
            return new ResponseEntity<>(HttpStatus.CONFLICT);
        }

        ensureRolePermissionTable(fromRoleId);
        jdbcTemplate.update("UPDATE role SET table_id = ? WHERE table_id = ?", toRoleId, fromRoleId);
        jdbcTemplate.execute("RENAME TABLE `%s` TO `%s`".formatted(rolePermissionTableName(fromRoleId), rolePermissionTableName(toRoleId)));
        ensureRolePermissionTable(toRoleId);
        ensureRoleHasBasePermission(toRoleId);
        return new ResponseEntity<>(new SuccessResponse(true), HttpStatus.OK);
    }

    @PostMapping("/delete")
    public ResponseEntity<SuccessResponse> deleteRole(@RequestBody DeleteRoleRequest req) {
        ensureRoleTable();
        String roleId = normalize(req.roleId());
        if (roleId == null) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        if (!isSafeIdentifier(roleId)) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        if (!roleExists(roleId)) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }

        jdbcTemplate.update("DELETE FROM role WHERE table_id = ?", roleId);
        jdbcTemplate.execute("DROP TABLE IF EXISTS `%s`".formatted(rolePermissionTableName(roleId)));
        return new ResponseEntity<>(new SuccessResponse(true), HttpStatus.OK);
    }

    @PostMapping("/permission/list")
    public ResponseEntity<ListRolePermissionsResponse> listRolePermissions(@RequestBody ListRolePermissionsRequest req) {
        ensureAuthTable();
        String roleId = normalize(req.roleId());
        if (roleId == null || !isSafeIdentifier(roleId)) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        ensureRolePermissionTable(roleId);

        int pageNo = normalizePageNo(req.pageNo());
        int pageSize = normalizePageSize(req.pageSize());
        int offset = (pageNo - 1) * pageSize;

        String keyword = normalize(req.keyword());
        String where = "";
        Object[] countArgs = new Object[]{};
        Object[] listArgs = new Object[]{pageSize, offset};
        if (keyword != null) {
            where = " WHERE a.`key` LIKE ? OR a.description LIKE ? ";
            String like = "%" + escapeLike(keyword) + "%";
            countArgs = new Object[]{like, like};
            listArgs = new Object[]{like, like, pageSize, offset};
        }

        String table = rolePermissionTableName(roleId);
        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM `%s` rp LEFT JOIN auth a ON a.id = rp.auth_code".formatted(table) + where,
                Long.class,
                countArgs
        );
        if (total == null) {
            total = 0L;
        }

        List<RolePermissionItem> list = jdbcTemplate.query(
                """
                        SELECT rp.id, rp.auth_code, a.`key` AS auth_key, a.description AS auth_description
                        FROM `%s` rp
                        LEFT JOIN auth a ON a.id = rp.auth_code
                        """.formatted(table) + where + " ORDER BY rp.id DESC LIMIT ? OFFSET ?",
                (rs, rowNum) -> new RolePermissionItem(
                        rs.getLong("id"),
                        rs.getLong("auth_code"),
                        rs.getString("auth_key"),
                        rs.getString("auth_description")
                ),
                listArgs
        );
        return new ResponseEntity<>(new ListRolePermissionsResponse(total, list), HttpStatus.OK);
    }

    @PostMapping("/permission/create")
    public ResponseEntity<RolePermissionItem> createRolePermission(@RequestBody CreateRolePermissionRequest req) {
        ensureAuthTable();
        String roleId = normalize(req.roleId());
        if (roleId == null || !isSafeIdentifier(roleId)) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        ensureRolePermissionTable(roleId);
        Long authCode = req.authCode();
        if (authCode == null || !authExists(authCode)) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        String table = rolePermissionTableName(roleId);
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM `%s` WHERE auth_code = ?".formatted(table), Long.class, authCode);
        if (count != null && count > 0) {
            return new ResponseEntity<>(HttpStatus.CONFLICT);
        }

        String authKey = jdbcTemplate.queryForObject("SELECT `key` FROM auth WHERE id = ?", String.class, authCode);
        String authDescription = jdbcTemplate.queryForObject("SELECT description FROM auth WHERE id = ?", String.class, authCode);
        String name = authKey == null ? String.valueOf(authCode) : authKey;

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("INSERT INTO `%s` (name, auth_code) VALUES (?, ?)".formatted(table), Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, name);
            ps.setLong(2, authCode);
            return ps;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return new ResponseEntity<>(new RolePermissionItem(id.longValue(), authCode, name, authDescription), HttpStatus.CREATED);
    }

    @PostMapping("/permission/update")
    public ResponseEntity<RolePermissionItem> updateRolePermission(@RequestBody UpdateRolePermissionRequest req) {
        ensureAuthTable();
        String roleId = normalize(req.roleId());
        if (roleId == null || !isSafeIdentifier(roleId)) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        ensureRolePermissionTable(roleId);
        Long permissionId = req.permissionId();
        if (permissionId == null) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        Long authCode = req.authCode();
        if (authCode == null || !authExists(authCode)) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        String authKey = jdbcTemplate.queryForObject("SELECT `key` FROM auth WHERE id = ?", String.class, authCode);
        String authDescription = jdbcTemplate.queryForObject("SELECT description FROM auth WHERE id = ?", String.class, authCode);
        String name = authKey == null ? String.valueOf(authCode) : authKey;

        int updated = jdbcTemplate.update(
                "UPDATE `%s` SET name = ?, auth_code = ? WHERE id = ?".formatted(rolePermissionTableName(roleId)),
                name,
                authCode,
                permissionId
        );
        if (updated == 0) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        return new ResponseEntity<>(new RolePermissionItem(permissionId, authCode, name, authDescription), HttpStatus.OK);
    }

    @PostMapping("/permission/delete")
    public ResponseEntity<SuccessResponse> deleteRolePermission(@RequestBody DeleteRolePermissionRequest req) {
        String roleId = normalize(req.roleId());
        Long permissionId = req.permissionId();
        if (roleId == null || permissionId == null || !isSafeIdentifier(roleId)) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        ensureRolePermissionTable(roleId);
        int deleted = jdbcTemplate.update(
                "DELETE FROM `%s` WHERE id = ?".formatted(rolePermissionTableName(roleId)),
                permissionId
        );
        if (deleted == 0) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        return new ResponseEntity<>(new SuccessResponse(true), HttpStatus.OK);
    }

    private void ensureRoleTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS role (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  table_id VARCHAR(255) NOT NULL,
                  PRIMARY KEY (id)
                )
                """);
    }

    private void ensureAuthTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS auth (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  `key` VARCHAR(255) NOT NULL,
                  description VARCHAR(1024) NULL,
                  PRIMARY KEY (id)
                )
                """);
        ensureAuthDescriptionColumn();

        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM auth WHERE `key` = ?", Long.class, "base");
        if (count != null && count == 0) {  
            jdbcTemplate.update("INSERT INTO auth (`key`) VALUES (?)", "base");
        }
    }

    private void ensureAuthDescriptionColumn() {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth' AND COLUMN_NAME = 'description'",
                Long.class
        );
        if (count != null && count == 0) {
            jdbcTemplate.execute("ALTER TABLE auth ADD COLUMN description VARCHAR(1024) NULL");
        }
    }

    private boolean roleExists(String roleId) {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM role WHERE table_id = ?", Long.class, roleId);
        return count != null && count > 0;
    }

    private boolean authExists(Long authId) {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM auth WHERE id = ?", Long.class, authId);
        return count != null && count > 0;
    }

    private void ensureRolePermissionTable(String roleId) {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `%s` (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  name VARCHAR(255) NOT NULL,
                  auth_code BIGINT NOT NULL,
                  PRIMARY KEY (id)
                )
                """.formatted(rolePermissionTableName(roleId)));
    }

    private void ensureRoleHasBasePermission(String roleId) {
        Long baseAuthId = jdbcTemplate.queryForObject("SELECT id FROM auth WHERE `key` = ?", Long.class, "base");
        if (baseAuthId == null) {
            jdbcTemplate.update("INSERT INTO auth (`key`) VALUES (?)", "base");
            baseAuthId = jdbcTemplate.queryForObject("SELECT id FROM auth WHERE `key` = ?", Long.class, "base");
        }
        if (baseAuthId == null) {
            return;
        }

        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM `%s` WHERE auth_code = ?".formatted(rolePermissionTableName(roleId)),
                Long.class,
                baseAuthId
        );
        if (count != null && count == 0) {
            jdbcTemplate.update(
                    "INSERT INTO `%s` (name, auth_code) VALUES (?, ?)".formatted(rolePermissionTableName(roleId)),
                    "base",
                    baseAuthId
            );
        }
    }

    private static String rolePermissionTableName(String roleId) {
        return "user_" + roleId;
    }

    private static int normalizePageNo(Integer v) {
        if (v == null || v < 1) return 1;
        return v;
    }

    private static int normalizePageSize(Integer v) {
        if (v == null || v < 1) return 20;
        return Math.min(v, 200);
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static boolean isSafeIdentifier(String v) {
        for (int i = 0; i < v.length(); i++) {
            char c = v.charAt(i);
            boolean ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_';
            if (!ok) return false;
        }
        return true;
    }

    private static String normalize(String v) {
        if (v == null) return null;
        String s = v.trim();
        return s.isEmpty() ? null : s;
    }

    public record RoleItem(Long id, @JsonAlias({"roleId", "role_id"}) String roleId) {
    }

    public record CreateRoleRequest(@JsonAlias({"roleId", "role_id"}) String roleId) {
    }

    public record RolePermissionItem(Long id, @JsonAlias({"authCode", "auth_code"}) Long authCode, String name, String description) {
    }

    public record ListRolesRequest(Integer pageNo, Integer pageSize, @JsonAlias({"roleId", "role_id"}) String roleId) {
    }

    public record ListRolesResponse(Long total, List<RoleItem> list) {
    }

    public record DeleteRoleRequest(@JsonAlias({"roleId", "role_id"}) String roleId) {
    }

    public record UpdateRoleIdRequest(@JsonAlias({"fromRoleId", "from_role_id"}) String fromRoleId, @JsonAlias({"toRoleId", "to_role_id"}) String toRoleId) {
    }

    public record SuccessResponse(boolean success) {
    }

    public record ListRolePermissionsRequest(@JsonAlias({"roleId", "role_id"}) String roleId, Integer pageNo, Integer pageSize, String keyword) {
    }

    public record ListRolePermissionsResponse(Long total, List<RolePermissionItem> list) {
    }

    public record CreateRolePermissionRequest(@JsonAlias({"roleId", "role_id"}) String roleId, @JsonAlias({"authCode", "auth_code"}) Long authCode) {
    }

    public record UpdateRolePermissionRequest(@JsonAlias({"roleId", "role_id"}) String roleId, Long permissionId, @JsonAlias({"authCode", "auth_code"}) Long authCode) {
    }

    public record DeleteRolePermissionRequest(@JsonAlias({"roleId", "role_id"}) String roleId, Long permissionId) {
    }
}
