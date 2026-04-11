package com.example.server.service;

import com.example.server.model.Account;
import com.example.server.repository.AccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {
    private final AccountRepository accountRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String tokenSecret;
    private final long tokenTtlSeconds;

    public AuthService(
            AccountRepository accountRepository,
            JdbcTemplate jdbcTemplate,
            @Value("${app.auth.tokenSecret:dev-secret-change-me}") String tokenSecret,
            @Value("${app.auth.tokenTtlSeconds:3600}") long tokenTtlSeconds
    ) {
        this.accountRepository = accountRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.tokenSecret = tokenSecret;
        this.tokenTtlSeconds = tokenTtlSeconds;
    }

    @Transactional
    public AuthResult register(RegisterInput input) {
        String accountName = normalize(input.accountName());
        String password = normalize(input.password());
        if (accountName == null || password == null) {
            throw new IllegalArgumentException("INVALID_INPUT");
        }

        Optional<Account> existing = accountRepository.findByAccountName(accountName);
        if (existing.isPresent()) {
            throw new IllegalStateException("ACCOUNT_EXISTS");
        }

        String roleId = normalize(input.roleId());
        if (roleId == null) {
            roleId = "user";
        }

        String name = normalize(input.name());
        if (name == null) {
            name = accountName;
        }

        String phoneNumber = normalize(input.phoneNumber());
        if (phoneNumber == null) {
            phoneNumber = "18800000000";
        }

        String avatorUrl = normalize(input.avatorUrl());

        Account account = new Account(
                null,
                roleId,
                name,
                accountName,
                hashPassword(password),
                phoneNumber,
                avatorUrl
        );

        Account saved = accountRepository.save(account);
        ensureAuthTableAndBaseKey();
        ensureAccountAuthTableAndBasePermission(saved.getId());
        ensureEyeSightTableAndInitRow(saved.getId());
        List<PermissionPoint> permissionPoints = loadRolePermissionPoints(saved.getRoleId());
        String token = createToken(saved.getId(), saved.getAccountName());
        return new AuthResult(token, saved.getId(), saved.getAccountName(), saved.getName(), saved.getRoleId(), permissionPoints);
    }

    public AuthResult login(LoginInput input) {
        String accountName = normalize(input.accountName());
        String password = normalize(input.password());
        if (accountName == null || password == null) {
            throw new IllegalArgumentException("INVALID_INPUT");
        }

        Account account = accountRepository.findByAccountName(accountName).orElseThrow(() -> new IllegalArgumentException("INVALID_CREDENTIALS"));
        if (!verifyPassword(password, account.getPassword())) {
            throw new IllegalArgumentException("INVALID_CREDENTIALS");
        }

        if (!isHashedPassword(account.getPassword())) {
            account.setPassword(hashPassword(password));
            accountRepository.save(account);
        }

        List<PermissionPoint> permissionPoints = loadRolePermissionPoints(account.getRoleId());
        String token = createToken(account.getId(), account.getAccountName());
        return new AuthResult(token, account.getId(), account.getAccountName(), account.getName(), account.getRoleId(), permissionPoints);
    }

    public AuthResult verifyToken(String token) {
        String raw = normalize(token);
        if (raw == null) {
            throw new IllegalArgumentException("INVALID_TOKEN");
        }

        DecodedToken decoded = decodeAndVerifyToken(raw);
        Long accountId;
        try {
            accountId = Long.valueOf(decoded.subject());
        } catch (Exception e) {
            throw new IllegalArgumentException("INVALID_TOKEN");
        }

        Account account = accountRepository.findById(accountId).orElseThrow(() -> new IllegalArgumentException("INVALID_TOKEN"));
        List<PermissionPoint> permissionPoints = loadRolePermissionPoints(account.getRoleId());
        return new AuthResult(raw, account.getId(), account.getAccountName(), account.getName(), account.getRoleId(), permissionPoints);
    }

    private List<PermissionPoint> loadRolePermissionPoints(String roleId) {
        String roleIdNorm = normalize(roleId);
        if (roleIdNorm == null) {
            roleIdNorm = "user";
        }
        if (!isSafeIdentifier(roleIdNorm)) {
            throw new IllegalArgumentException("INVALID_ROLE_ID");
        }

        ensureAuthTableAndBaseKey();
        ensureRolePermissionTable(roleIdNorm);
        ensureRoleHasBasePermission(roleIdNorm);

        return jdbcTemplate.query(
                "SELECT name, auth_code FROM `%s` ORDER BY id ASC".formatted(rolePermissionTableName(roleIdNorm)),
                (rs, rowNum) -> new PermissionPoint(rs.getString("name"), String.valueOf(rs.getLong("auth_code")))
        );
    }

    private List<PermissionPoint> loadAccountPermissionPoints(Long accountId) {
        ensureAccountAuthTableAndBasePermission(accountId);
        String tableName = accountAuthTableName(accountId);
        return jdbcTemplate.query(
                "SELECT name, auth_code FROM `%s`".formatted(tableName),
                (rs, rowNum) -> new PermissionPoint(rs.getString("name"), rs.getString("auth_code"))
        );
    }

    private void ensureAuthTableAndBaseKey() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS auth (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  `key` VARCHAR(255) NOT NULL,
                  description VARCHAR(1024) NULL,
                  PRIMARY KEY (id)
                )
                """);
        ensureAuthDescriptionColumn();

        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM auth WHERE `key` = ?",
                Long.class,
                "base"
        );
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

    private void ensureAccountAuthTableAndBasePermission(Long accountId) {
        if (accountId == null) {
            throw new IllegalStateException("ACCOUNT_ID_MISSING");
        }

        String tableName = accountAuthTableName(accountId);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `%s` (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  name VARCHAR(255) NOT NULL,
                  auth_code VARCHAR(255) NOT NULL,
                  PRIMARY KEY (id)
                )
                """.formatted(tableName));

        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM `%s` WHERE auth_code = ?".formatted(tableName),
                Long.class,
                "base"
        );
        if (count != null && count == 0) {
            jdbcTemplate.update(
                    "INSERT INTO `%s` (name, auth_code) VALUES (?, ?)".formatted(tableName),
                    "base",
                    "base"
            );
        }
    }

    private static String accountAuthTableName(Long accountId) {
        if (accountId == null || accountId <= 0) {
            throw new IllegalArgumentException("INVALID_ACCOUNT_ID");
        }
        return "account_auth_" + accountId;
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

    private void ensureEyeSightTableAndInitRow(Long accountId) {
        if (accountId == null) {
            throw new IllegalStateException("ACCOUNT_ID_MISSING");
        }

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

        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM eyessight WHERE people_id = ?",
                Long.class,
                accountId
        );
        if (count != null && count == 0) {
            jdbcTemplate.update(
                    "INSERT INTO eyessight (od, os, eyes_time, has_glasses, people_id) VALUES (?, ?, ?, ?, ?)",
                    0L,
                    0L,
                    Instant.now().toEpochMilli(),
                    false,
                    accountId
            );
        }
    }

    private static String rolePermissionTableName(String roleId) {
        return "user_" + roleId;
    }

    private static boolean isSafeIdentifier(String v) {
        for (int i = 0; i < v.length(); i++) {
            char c = v.charAt(i);
            boolean ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_';
            if (!ok) return false;
        }
        return true;
    }

    private String createToken(Long accountId, String accountName) {
        try {
            String headerJson = objectMapper.writeValueAsString(Map.of("alg", "HS256", "typ", "JWT"));

            long now = Instant.now().getEpochSecond();
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("sub", String.valueOf(accountId));
            payload.put("account_name", accountName);
            payload.put("iat", now);
            payload.put("exp", now + tokenTtlSeconds);
            String payloadJson = objectMapper.writeValueAsString(payload);

            String headerB64 = base64Url(headerJson.getBytes(StandardCharsets.UTF_8));
            String payloadB64 = base64Url(payloadJson.getBytes(StandardCharsets.UTF_8));
            String signingInput = headerB64 + "." + payloadB64;
            String signatureB64 = base64Url(hmacSha256(signingInput.getBytes(StandardCharsets.UTF_8), tokenSecret.getBytes(StandardCharsets.UTF_8)));
            return signingInput + "." + signatureB64;
        } catch (Exception e) {
            throw new IllegalStateException("TOKEN_CREATE_FAILED");
        }
    }

    private DecodedToken decodeAndVerifyToken(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                throw new IllegalArgumentException("INVALID_TOKEN");
            }

            String signingInput = parts[0] + "." + parts[1];
            byte[] expectedSig = hmacSha256(signingInput.getBytes(StandardCharsets.UTF_8), tokenSecret.getBytes(StandardCharsets.UTF_8));
            String expectedSigB64 = base64Url(expectedSig);
            if (!MessageDigest.isEqual(expectedSigB64.getBytes(StandardCharsets.UTF_8), parts[2].getBytes(StandardCharsets.UTF_8))) {
                throw new IllegalArgumentException("INVALID_TOKEN");
            }

            byte[] payloadBytes = Base64.getUrlDecoder().decode(parts[1]);
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = objectMapper.readValue(payloadBytes, Map.class);
            Object subObj = payload.get("sub");
            Object expObj = payload.get("exp");
            if (subObj == null || expObj == null) {
                throw new IllegalArgumentException("INVALID_TOKEN");
            }

            long exp;
            if (expObj instanceof Number n) {
                exp = n.longValue();
            } else {
                exp = Long.parseLong(String.valueOf(expObj));
            }
            long now = Instant.now().getEpochSecond();
            if (now >= exp) {
                throw new IllegalArgumentException("TOKEN_EXPIRED");
            }

            return new DecodedToken(String.valueOf(subObj), exp);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("INVALID_TOKEN");
        }
    }

    private static String normalize(String v) {
        if (v == null) return null;
        String s = v.trim();
        return s.isEmpty() ? null : s;
    }

    private static String hashPassword(String rawPassword) {
        try {
            byte[] salt = new byte[16];
            new SecureRandom().nextBytes(salt);
            byte[] rawBytes = rawPassword.getBytes(StandardCharsets.UTF_8);
            byte[] combined = new byte[salt.length + rawBytes.length];
            System.arraycopy(salt, 0, combined, 0, salt.length);
            System.arraycopy(rawBytes, 0, combined, salt.length, rawBytes.length);

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(combined);
            return "sha256$" + Base64.getEncoder().encodeToString(salt) + "$" + Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new IllegalStateException("PASSWORD_HASH_FAILED");
        }
    }

    private static boolean verifyPassword(String rawPassword, String storedPassword) {
        if (storedPassword == null) return false;
        if (!isHashedPassword(storedPassword)) {
            return rawPassword.equals(storedPassword);
        }

        try {
            String[] parts = storedPassword.split("\\$");
            if (parts.length != 3) return false;
            byte[] salt = Base64.getDecoder().decode(parts[1]);
            byte[] storedHash = Base64.getDecoder().decode(parts[2]);

            byte[] rawBytes = rawPassword.getBytes(StandardCharsets.UTF_8);
            byte[] combined = new byte[salt.length + rawBytes.length];
            System.arraycopy(salt, 0, combined, 0, salt.length);
            System.arraycopy(rawBytes, 0, combined, salt.length, rawBytes.length);

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] computedHash = digest.digest(combined);
            return MessageDigest.isEqual(storedHash, computedHash);
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isHashedPassword(String storedPassword) {
        return storedPassword.startsWith("sha256$");
    }

    public String hashPasswordIfNeeded(String rawOrHashedPassword) {
        String password = normalize(rawOrHashedPassword);
        if (password == null) {
            return null;
        }
        if (isHashedPassword(password)) {
            return password;
        }
        return hashPassword(password);
    }

    public void provisionAccountPermissions(Long accountId) {
        ensureAuthTableAndBaseKey();
        ensureAccountAuthTableAndBasePermission(accountId);
    }

    private static byte[] hmacSha256(byte[] data, byte[] secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private static String base64Url(byte[] data) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }

    public record RegisterInput(
            String accountName,
            String password,
            String name,
            String phoneNumber,
            String avatorUrl,
            String roleId
    ) {
    }

    public record LoginInput(String accountName, String password) {
    }

    public record PermissionPoint(String name, String authCode) {
    }

    public record AuthResult(String token, Long accountId, String accountName, String name, String roleId, List<PermissionPoint> permissionPoints) {
    }

    private record DecodedToken(String subject, long exp) {
    }
}
