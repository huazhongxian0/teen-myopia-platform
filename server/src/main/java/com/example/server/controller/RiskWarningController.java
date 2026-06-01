package com.example.server.controller;

import com.example.server.dto.RiskWarningDto;
import com.example.server.service.AuthService;
import com.example.server.service.RiskWarningService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/riskWarning")
public class RiskWarningController {
    private final AuthService authService;
    private final RiskWarningService riskWarningService;

    public RiskWarningController(AuthService authService, RiskWarningService riskWarningService) {
        this.authService = authService;
        this.riskWarningService = riskWarningService;
    }

    @PostMapping("/evaluate")
    public ResponseEntity<RiskWarningDto.EvaluateResponse> evaluate(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody RiskWarningDto.EvaluateRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireAny(authorization);
            return new ResponseEntity<>(riskWarningService.evaluateAndWarn(req.studentAccountId()), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            if ("UNAUTHORIZED".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            if ("FORBIDDEN".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/batchEvaluate")
    public ResponseEntity<RiskWarningDto.BatchEvaluateResponse> batchEvaluate(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody RiskWarningDto.BatchEvaluateRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireTeacherOrManager(authorization);
            return new ResponseEntity<>(riskWarningService.batchEvaluate(req.classId()), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            if ("UNAUTHORIZED".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            if ("FORBIDDEN".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/listMine")
    public ResponseEntity<RiskWarningDto.ListMyWarningsResponse> listMine(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody RiskWarningDto.ListMyWarningsRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireStudent(authorization);
            return new ResponseEntity<>(riskWarningService.listMyWarnings(auth.accountId(), req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            if ("UNAUTHORIZED".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            if ("FORBIDDEN".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/listMyMessages")
    public ResponseEntity<RiskWarningDto.ListMyMessagesResponse> listMyMessages(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody RiskWarningDto.ListMyMessagesRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireAny(authorization);
            return new ResponseEntity<>(riskWarningService.listMyMessages(auth.accountId(), req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            if ("UNAUTHORIZED".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            if ("FORBIDDEN".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/readMessage")
    public ResponseEntity<RiskWarningDto.ReadMessageResponse> readMessage(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody RiskWarningDto.ReadMessageRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireAny(authorization);
            return new ResponseEntity<>(riskWarningService.readMessage(auth.accountId(), req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            if ("UNAUTHORIZED".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            if ("FORBIDDEN".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
            if ("NOT_FOUND".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.NOT_FOUND);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/resolve")
    public ResponseEntity<RiskWarningDto.ResolveWarningResponse> resolve(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody RiskWarningDto.ResolveWarningRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireAny(authorization);
            return new ResponseEntity<>(riskWarningService.resolveWarning(auth.accountId(), req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            if ("UNAUTHORIZED".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            if ("FORBIDDEN".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
            if ("NOT_FOUND".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.NOT_FOUND);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/listByClass")
    public ResponseEntity<RiskWarningDto.ClassWarningListResponse> listByClass(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody RiskWarningDto.ClassWarningListRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireTeacherOrManager(authorization);
            return new ResponseEntity<>(riskWarningService.listClassWarnings(auth.accountId(), req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            if ("UNAUTHORIZED".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            if ("FORBIDDEN".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/adminOverview")
    public ResponseEntity<RiskWarningDto.AdminOverviewResponse> adminOverview(
            @RequestHeader(name = "Authorization", required = false) String authorization
    ) {
        try {
            AuthService.AuthResult auth = requireManager(authorization);
            return new ResponseEntity<>(riskWarningService.adminOverview(), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            if ("UNAUTHORIZED".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            if ("FORBIDDEN".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private AuthService.AuthResult requireAny(String authorization) {
        String token = extractBearerToken(authorization);
        if (token == null) {
            throw new IllegalArgumentException("UNAUTHORIZED");
        }
        return authService.verifyToken(token);
    }

    private AuthService.AuthResult requireStudent(String authorization) {
        String token = extractBearerToken(authorization);
        if (token == null) {
            throw new IllegalArgumentException("UNAUTHORIZED");
        }
        AuthService.AuthResult auth = authService.verifyToken(token);
        if (auth.roleId() == null || !"student".equalsIgnoreCase(auth.roleId())) {
            throw new IllegalArgumentException("FORBIDDEN");
        }
        return auth;
    }

    private AuthService.AuthResult requireTeacherOrManager(String authorization) {
        String token = extractBearerToken(authorization);
        if (token == null) {
            throw new IllegalArgumentException("UNAUTHORIZED");
        }
        AuthService.AuthResult auth = authService.verifyToken(token);
        if (auth.roleId() == null || !("teacher".equalsIgnoreCase(auth.roleId()) || "manager".equalsIgnoreCase(auth.roleId()))) {
            throw new IllegalArgumentException("FORBIDDEN");
        }
        return auth;
    }

    private AuthService.AuthResult requireManager(String authorization) {
        String token = extractBearerToken(authorization);
        if (token == null) {
            throw new IllegalArgumentException("UNAUTHORIZED");
        }
        AuthService.AuthResult auth = authService.verifyToken(token);
        if (auth.roleId() == null || !("manager".equalsIgnoreCase(auth.roleId()) || "admin".equalsIgnoreCase(auth.roleId()))) {
            throw new IllegalArgumentException("FORBIDDEN");
        }
        return auth;
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
}
