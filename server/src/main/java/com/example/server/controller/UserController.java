package com.example.server.controller;

import com.example.server.model.Account;
import com.example.server.model.User;
import com.example.server.repository.AccountRepository;
import com.example.server.service.AuthService;
import com.example.server.service.UserService;
import com.fasterxml.jackson.annotation.JsonAlias;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import org.springframework.web.bind.annotation.GetMapping;


@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    private final AuthService authService;
    private final AccountRepository accountRepository;
    private final JdbcTemplate jdbcTemplate;

    public UserController(UserService userService, AuthService authService, AccountRepository accountRepository, JdbcTemplate jdbcTemplate) {
        this.userService = userService;
        this.authService = authService;
        this.accountRepository = accountRepository;
        this.jdbcTemplate = jdbcTemplate;
    }
    @GetMapping("/test")
    public String getMethodName() {
        return new String("test successfully");
    }
    
    public ResponseEntity<User> test(@RequestBody User user) {
        User createdUser = userService.createUser(user);
        return new ResponseEntity<>(createdUser, HttpStatus.CREATED);
    }
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest req) {
        try {
            String defaultRoleId = "user";
            AuthService.AuthResult result = authService.register(new AuthService.RegisterInput(
                    req.accountName(),
                    req.password(),
                    req.name(),
                    req.phoneNumber(),
                    req.avatorUrl(),
                    defaultRoleId
            ));
            return new ResponseEntity<AuthResponse>(
                    new AuthResponse(
                            result.token(),
                            result.accountId(),
                            result.accountName(),
                            result.name(),
                            result.roleId(),
                            mapPermissions(result.permissionPoints())
                    ),
                    HttpStatus.CREATED
            );
        } catch (IllegalStateException e) {
            if ("ACCOUNT_EXISTS".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.CONFLICT);
            }
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest req) {
        try {
            AuthService.AuthResult result = authService.login(new AuthService.LoginInput(req.accountName(), req.password()));
            return new ResponseEntity<AuthResponse>(
                    new AuthResponse(
                            result.token(),
                            result.accountId(),
                            result.accountName(),
                            result.name(),
                            result.roleId(),
                            mapPermissions(result.permissionPoints())
                    ),
                    HttpStatus.OK
            );
        } catch (IllegalArgumentException e) {
            if ("INVALID_CREDENTIALS".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/token/verify")
    public ResponseEntity<AuthResponse> verifyToken(@RequestHeader(name = "Authorization", required = false) String authorization) {
        try {
            String token = extractBearerToken(authorization);
            if (token == null) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            AuthService.AuthResult result = authService.verifyToken(token);
            return new ResponseEntity<>(
                    new AuthResponse(
                            result.token(),
                            result.accountId(),
                            result.accountName(),
                            result.name(),
                            result.roleId(),
                            mapPermissions(result.permissionPoints())
                    ),
                    HttpStatus.OK
            );
        } catch (IllegalArgumentException e) {
            if ("TOKEN_EXPIRED".equals(e.getMessage()) || "INVALID_TOKEN".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/eyesight/getMine")
    public ResponseEntity<EyeSightResponse> getMyEyeSight(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody(required = false) GetMyEyeSightRequest req
    ) {
        try {
            String token = extractBearerToken(authorization);
            if (token == null) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            AuthService.AuthResult result = authService.verifyToken(token);
            ensureEyeSightTable();

            List<EyeSightRow> rows = jdbcTemplate.query(
                    "SELECT od, os, eyes_time, has_glasses, people_id FROM eyessight WHERE people_id = ? LIMIT 1",
                    (rs, rowNum) -> new EyeSightRow(
                            rs.getLong("od"),
                            rs.getLong("os"),
                            rs.getLong("eyes_time"),
                            rs.getBoolean("has_glasses"),
                            rs.getLong("people_id")
                    ),
                    result.accountId()
            );
            if (rows.isEmpty()) {
                return new ResponseEntity<>(new EyeSightResponse(false, null, null, null, null, null), HttpStatus.OK);
            }
            EyeSightRow row = rows.get(0);
            return new ResponseEntity<>(
                    new EyeSightResponse(true, row.od(), row.os(), row.eyesTime(), row.hasGlasses(), row.peopleId()),
                    HttpStatus.OK
            );
        } catch (IllegalArgumentException e) {
            if ("TOKEN_EXPIRED".equals(e.getMessage()) || "INVALID_TOKEN".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping
    public ResponseEntity<List<User>> getAllUsers() {
        List<User> users = userService.getAllUsers();
        return new ResponseEntity<>(users, HttpStatus.OK);
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        Optional<User> user = userService.getUserById(id);
        return user.map(value -> new ResponseEntity<>(value, HttpStatus.OK))
                .orElseGet(() -> new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }
    
    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody User user) {
        User createdUser = userService.createUser(user);
        return new ResponseEntity<>(createdUser, HttpStatus.CREATED);
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @RequestBody User user) {
        user.setId(id);
        User updatedUser = userService.updateUser(user);
        return new ResponseEntity<>(updatedUser, HttpStatus.OK);
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    @GetMapping("/accounts")
    public ResponseEntity<List<AccountResponse>> getAllAccounts(
            @RequestParam(name = "roleId", required = false) String roleId,
            @RequestParam(name = "accountName", required = false) String accountName,
            @RequestParam(name = "id", required = false) Long id,
            @RequestParam(name = "phoneNumber", required = false) String phoneNumber
    ) {
        Specification<Account> spec = (root, query, cb) -> cb.conjunction();

        String roleIdNorm = normalize(roleId);
        if (roleIdNorm != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("roleId"), roleIdNorm));
        }

        String accountNameNorm = normalize(accountName);
        if (accountNameNorm != null) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("accountName"), "%" + escapeLike(accountNameNorm) + "%", '\\'));
        }

        if (id != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("id"), id));
        }

        String phoneNumberNorm = normalize(phoneNumber);
        if (phoneNumberNorm != null) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("phoneNumber"), "%" + escapeLike(phoneNumberNorm) + "%", '\\'));
        }

        List<AccountResponse> accounts = accountRepository.findAll(spec).stream()
                .map(UserController::mapAccount)
                .collect(java.util.stream.Collectors.toList());
        return new ResponseEntity<>(accounts, HttpStatus.OK);
    }

    @GetMapping("/accounts/{id}")
    public ResponseEntity<AccountResponse> getAccountById(@PathVariable Long id) {
        Optional<Account> account = accountRepository.findById(id);
        return account
                .map(value -> new ResponseEntity<>(mapAccount(value), HttpStatus.OK))
                .orElseGet(() -> new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }

    @PostMapping("/accounts")
    public ResponseEntity<AccountResponse> createAccount(@RequestBody CreateAccountRequest req) {
        try {
            String accountName = normalize(req.accountName());
            String password = normalize(req.password());
            if (accountName == null || password == null) {
                return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
            }
            if (accountRepository.findByAccountName(accountName).isPresent()) {
                return new ResponseEntity<>(HttpStatus.CONFLICT);
            }

            AuthService.AuthResult result = authService.register(new AuthService.RegisterInput(
                    accountName,
                    password,
                    req.name(),
                    req.phoneNumber(),
                    req.avatorUrl(),
                    req.roleId()
            ));

            Account saved = accountRepository.findById(result.accountId())
                    .orElseThrow(() -> new IllegalStateException("ACCOUNT_CREATE_FAILED"));
            return new ResponseEntity<>(mapAccount(saved), HttpStatus.CREATED);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            if ("ACCOUNT_EXISTS".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.CONFLICT);
            }
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PutMapping("/accounts/{id}")
    public ResponseEntity<AccountResponse> updateAccount(@PathVariable Long id, @RequestBody UpdateAccountRequest req) {
        Optional<Account> existingOpt = accountRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        Account existing = existingOpt.get();

        String roleId = normalize(req.roleId());
        if (roleId != null) {
            existing.setRoleId(roleId);
        }

        String name = normalize(req.name());
        if (name != null) {
            existing.setName(name);
        }

        String accountName = normalize(req.accountName());
        if (accountName != null && !accountName.equals(existing.getAccountName())) {
            Optional<Account> conflict = accountRepository.findByAccountName(accountName);
            if (conflict.isPresent() && !conflict.get().getId().equals(existing.getId())) {
                return new ResponseEntity<>(HttpStatus.CONFLICT);
            }
            existing.setAccountName(accountName);
        }

        String phoneNumber = normalize(req.phoneNumber());
        if (phoneNumber != null) {
            existing.setPhoneNumber(phoneNumber);
        }

        String avatorUrl = normalize(req.avatorUrl());
        if (avatorUrl != null) {
            existing.setAvatorUrl(avatorUrl);
        }

        String password = normalize(req.password());
        if (password != null) {
            existing.setPassword(authService.hashPasswordIfNeeded(password));
        }

        Account saved = accountRepository.save(existing);
        authService.provisionAccountPermissions(saved.getId());
        return new ResponseEntity<>(mapAccount(saved), HttpStatus.OK);
    }

    @DeleteMapping("/accounts/{id}")
    public ResponseEntity<Void> deleteAccount(@PathVariable Long id) {
        if (!accountRepository.existsById(id)) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        accountRepository.deleteById(id);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    public record RegisterRequest(
            @JsonAlias({"accountName", "account_name"}) String accountName,
            String password,
            String name,
            @JsonAlias({"phoneNumber", "phone_number"}) String phoneNumber,
            @JsonAlias({"avatorUrl", "avator_url"}) String avatorUrl,
            @JsonAlias({"roleId", "role_id"}) String roleId
    ) {
    }

    public record LoginRequest(
            @JsonAlias({"accountName", "account_name"}) String accountName,
            String password
    ) {
    }

    public record PermissionPoint(String name, String authCode) {
    }

    public record AuthResponse(String token, Long accountId, String accountName, String name, String roleId, List<PermissionPoint> permissionPoints) {
    }

    private static List<PermissionPoint> mapPermissions(List<AuthService.PermissionPoint> permissionPoints) {
        if (permissionPoints == null || permissionPoints.isEmpty()) {
            return List.of();
        }
        return permissionPoints.stream()
                .map(p -> new PermissionPoint(p.name(), p.authCode()))
                .collect(java.util.stream.Collectors.toList());
    }

    private static AccountResponse mapAccount(Account account) {
        return new AccountResponse(
                account.getId(),
                account.getRoleId(),
                account.getName(),
                account.getAccountName(),
                account.getPhoneNumber(),
                account.getAvatorUrl()
        );
    }

    private static String normalize(String v) {
        if (v == null) return null;
        String s = v.trim();
        return s.isEmpty() ? null : s;
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String extractBearerToken(String authorization) {
        if (authorization == null) return null;
        String s = authorization.trim();
        if (s.isEmpty()) return null;
        if (s.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String token = s.substring(7).trim();
            return token.isEmpty() ? null : token;
        }
        return null;
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

    public record GetMyEyeSightRequest() {
    }

    public record EyeSightResponse(boolean exists, Long od, Long os, Long eyesTime, Boolean hasGlasses, Long peopleId) {
    }

    private record EyeSightRow(long od, long os, long eyesTime, boolean hasGlasses, long peopleId) {
    }

    public record CreateAccountRequest(
            @JsonAlias({"roleId", "role_id"}) String roleId,
            String name,
            @JsonAlias({"accountName", "account_name"}) String accountName,
            String password,
            @JsonAlias({"phoneNumber", "phone_number"}) String phoneNumber,
            @JsonAlias({"avatorUrl", "avator_url"}) String avatorUrl
    ) {
    }

    public record UpdateAccountRequest(
            @JsonAlias({"roleId", "role_id"}) String roleId,
            String name,
            @JsonAlias({"accountName", "account_name"}) String accountName,
            String password,
            @JsonAlias({"phoneNumber", "phone_number"}) String phoneNumber,
            @JsonAlias({"avatorUrl", "avator_url"}) String avatorUrl
    ) {
    }

    public record AccountResponse(
            Long id,
            @JsonAlias({"roleId", "role_id"}) String roleId,
            String name,
            @JsonAlias({"accountName", "account_name"}) String accountName,
            @JsonAlias({"phoneNumber", "phone_number"}) String phoneNumber,
            @JsonAlias({"avatorUrl", "avator_url"}) String avatorUrl
    ) {
    }
}
