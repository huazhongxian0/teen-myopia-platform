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
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final JdbcTemplate jdbcTemplate;

    public AuthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public ResponseEntity<List<AuthItem>> list() {
        ensureAuthTable();
        List<AuthItem> items = jdbcTemplate.query(
                "SELECT id, `key`, description FROM auth ORDER BY id ASC",
                (rs, rowNum) -> new AuthItem(rs.getLong("id"), rs.getString("key"), rs.getString("description"))
        );
        return new ResponseEntity<>(items, HttpStatus.OK);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AuthItem> getById(@PathVariable Long id) {
        ensureAuthTable();
        List<AuthItem> items = jdbcTemplate.query(
                "SELECT id, `key`, description FROM auth WHERE id = ?",
                (rs, rowNum) -> new AuthItem(rs.getLong("id"), rs.getString("key"), rs.getString("description")),
                id
        );
        if (items.isEmpty()) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        return new ResponseEntity<>(items.get(0), HttpStatus.OK);
    }

    @PostMapping
    public ResponseEntity<AuthItem> create(@RequestBody CreateAuthRequest req) {
        ensureAuthTable();
        String key = normalize(req.key());
        String description = normalize(req.description());
        if (key == null) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
        if (existsByKey(key)) {
            return new ResponseEntity<>(HttpStatus.CONFLICT);
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var ps = connection.prepareStatement("INSERT INTO auth (`key`, description) VALUES (?, ?)", Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, key);
            ps.setString(2, description);
            return ps;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
        ensureAdminPermissionTable();
        ensureAdminHasPermission(id.longValue(), key);
        return new ResponseEntity<>(new AuthItem(id.longValue(), key, description), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AuthItem> update(@PathVariable Long id, @RequestBody UpdateAuthRequest req) {
        ensureAuthTable();
        String key = normalize(req.key());
        String description = normalize(req.description());
        if (key == null) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        Optional<AuthItem> existing = findById(id);
        if (existing.isEmpty()) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        if ("base".equals(existing.get().key())) {
            return new ResponseEntity<>(HttpStatus.CONFLICT);
        }
        if (existsByKeyExcludingId(key, id)) {
            return new ResponseEntity<>(HttpStatus.CONFLICT);
        }

        int updated = jdbcTemplate.update("UPDATE auth SET `key` = ?, description = ? WHERE id = ?", key, description, id);
        if (updated == 0) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        return new ResponseEntity<>(new AuthItem(id, key, description), HttpStatus.OK);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        ensureAuthTable();
        Optional<AuthItem> existing = findById(id);
        if (existing.isEmpty()) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        if ("base".equals(existing.get().key())) {
            return new ResponseEntity<>(HttpStatus.CONFLICT);
        }

        int deleted = jdbcTemplate.update("DELETE FROM auth WHERE id = ?", id);
        if (deleted == 0) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    private Optional<AuthItem> findById(Long id) {
        List<AuthItem> items = jdbcTemplate.query(
                "SELECT id, `key`, description FROM auth WHERE id = ?",
                (rs, rowNum) -> new AuthItem(rs.getLong("id"), rs.getString("key"), rs.getString("description")),
                id
        );
        return items.isEmpty() ? Optional.empty() : Optional.of(items.get(0));
    }

    private boolean existsByKey(String key) {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM auth WHERE `key` = ?", Long.class, key);
        return count != null && count > 0;
    }

    private boolean existsByKeyExcludingId(String key, Long id) {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM auth WHERE `key` = ? AND id <> ?", Long.class, key, id);
        return count != null && count > 0;
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

    private void ensureAdminPermissionTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `user_admin` (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  name VARCHAR(255) NOT NULL,
                  auth_code BIGINT NOT NULL,
                  PRIMARY KEY (id)
                )
                """);
    }

    private void ensureAdminHasPermission(Long authId, String authKey) {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM `user_admin` WHERE auth_code = ?", Long.class, authId);
        if (count != null && count == 0) {
            jdbcTemplate.update("INSERT INTO `user_admin` (name, auth_code) VALUES (?, ?)", authKey, authId);
        }
    }

    private static String normalize(String v) {
        if (v == null) return null;
        String s = v.trim();
        return s.isEmpty() ? null : s;
    }

    public record AuthItem(Long id, String key, String description) {
    }

    public record CreateAuthRequest(@JsonAlias({"key", "authKey"}) String key, @JsonAlias({"description", "desription"}) String description) {
    }

    public record UpdateAuthRequest(@JsonAlias({"key", "authKey"}) String key, @JsonAlias({"description", "desription"}) String description) {
    }
}
