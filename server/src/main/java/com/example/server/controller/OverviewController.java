package com.example.server.controller;

import com.example.server.dto.OverviewDto;
import com.example.server.service.AuthService;
import com.example.server.service.OverviewService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/overview")
public class OverviewController {
    private final AuthService authService;
    private final OverviewService overviewService;

    public OverviewController(AuthService authService, OverviewService overviewService) {
        this.authService = authService;
        this.overviewService = overviewService;
    }

    @PostMapping("/dashboard")
    public ResponseEntity<OverviewDto.DashboardResponse> dashboard(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody(required = false) OverviewDto.DashboardRequest req
    ) {
        try {
            requireLogin(authorization);
            return new ResponseEntity<>(overviewService.getDashboard(req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            if ("UNAUTHORIZED".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/student/list")
    public ResponseEntity<OverviewDto.StudentListResponse> listStudents(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody(required = false) OverviewDto.StudentListRequest req
    ) {
        try {
            requireLogin(authorization);
            return new ResponseEntity<>(overviewService.listStudents(req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            if ("UNAUTHORIZED".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private void requireLogin(String authorization) {
        String token = extractBearerToken(authorization);
        if (token == null) {
            throw new IllegalArgumentException("UNAUTHORIZED");
        }
        authService.verifyToken(token);
    }

    private static String extractBearerToken(String authorization) {
        if (authorization == null) {
            return null;
        }
        String value = authorization.trim();
        if (value.isEmpty()) {
            return null;
        }
        if (!value.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }
        String token = value.substring(7).trim();
        return token.isEmpty() ? null : token;
    }
}
