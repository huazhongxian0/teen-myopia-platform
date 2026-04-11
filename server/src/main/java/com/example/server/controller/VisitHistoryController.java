package com.example.server.controller;

import com.example.server.dto.VisitDto;
import com.example.server.service.AuthService;
import com.example.server.service.VisitService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/visitHistory")
public class VisitHistoryController {
    private final AuthService authService;
    private final VisitService visitService;

    public VisitHistoryController(AuthService authService, VisitService visitService) {
        this.authService = authService;
        this.visitService = visitService;
    }

    @PostMapping("/create")
    public ResponseEntity<VisitDto.CreateVisitHistoryResponse> create(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.CreateVisitHistoryRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireDoctor(authorization);
            return new ResponseEntity<>(visitService.createVisitHistory(auth.accountId(), req), HttpStatus.CREATED);
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
    public ResponseEntity<VisitDto.ListMyVisitHistoriesResponse> listMine(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.ListMyVisitHistoriesRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireStudent(authorization);
            return new ResponseEntity<>(visitService.listMyVisitHistories(auth.accountId(), req), HttpStatus.OK);
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

    @PostMapping("/getMineById")
    public ResponseEntity<VisitDto.VisitHistoryItem> getMineById(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.GetMyVisitHistoryByIdRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireStudent(authorization);
            return new ResponseEntity<>(visitService.getMyVisitHistoryById(auth.accountId(), req), HttpStatus.OK);
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

    @PostMapping("/listByPatient")
    public ResponseEntity<VisitDto.ListVisitHistoriesByPatientResponse> listByPatient(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.ListVisitHistoriesByPatientRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireDoctor(authorization);
            return new ResponseEntity<>(visitService.listVisitHistoriesByPatient(auth.accountId(), req), HttpStatus.OK);
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

    @PostMapping("/getByIdForDoctor")
    public ResponseEntity<VisitDto.VisitHistoryItem> getByIdForDoctor(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.GetVisitHistoryByIdForDoctorRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireDoctor(authorization);
            return new ResponseEntity<>(visitService.getVisitHistoryByIdForDoctor(auth.accountId(), req), HttpStatus.OK);
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

    @PostMapping("/listMyPatients")
    public ResponseEntity<VisitDto.ListMyPatientsResponse> listMyPatients(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.ListMyPatientsRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireDoctor(authorization);
            return new ResponseEntity<>(visitService.listMyPatients(auth.accountId(), req), HttpStatus.OK);
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

    private AuthService.AuthResult requireDoctor(String authorization) {
        String token = extractBearerToken(authorization);
        if (token == null) {
            throw new IllegalArgumentException("UNAUTHORIZED");
        }
        AuthService.AuthResult auth = authService.verifyToken(token);
        if (!"doctor".equals(auth.roleId())) {
            throw new IllegalArgumentException("FORBIDDEN");
        }
        return auth;
    }

    private AuthService.AuthResult requireStudent(String authorization) {
        String token = extractBearerToken(authorization);
        if (token == null) {
            throw new IllegalArgumentException("UNAUTHORIZED");
        }
        AuthService.AuthResult auth = authService.verifyToken(token);
        if (!"student".equals(auth.roleId())) {
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
