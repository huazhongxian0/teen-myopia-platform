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
@RequestMapping("/api/visitRegistration")
public class VisitRegistrationController {
    private final AuthService authService;
    private final VisitService visitService;

    public VisitRegistrationController(AuthService authService, VisitService visitService) {
        this.authService = authService;
        this.visitService = visitService;
    }

    @PostMapping("/create")
    public ResponseEntity<VisitDto.CreateVisitRegistrationResponse> create(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.CreateVisitRegistrationRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireDoctor(authorization);
            return new ResponseEntity<>(visitService.createVisitRegistration(auth.accountId(), req), HttpStatus.CREATED);
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
    public ResponseEntity<VisitDto.ListMyVisitRegistrationsResponse> listMine(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.ListMyVisitRegistrationsRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireDoctor(authorization);
            return new ResponseEntity<>(visitService.listMyVisitRegistrations(auth.accountId(), req), HttpStatus.OK);
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

    @PostMapping("/listMineRange")
    public ResponseEntity<VisitDto.ListMyVisitRegistrationsRangeResponse> listMineRange(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.ListMyVisitRegistrationsRangeRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireDoctor(authorization);
            return new ResponseEntity<>(visitService.listMyVisitRegistrationsRange(auth.accountId(), req), HttpStatus.OK);
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

    @PostMapping("/updateVisitDate")
    public ResponseEntity<VisitDto.UpdateVisitRegistrationVisitDateResponse> updateVisitDate(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.UpdateVisitRegistrationVisitDateRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireDoctor(authorization);
            return new ResponseEntity<>(visitService.updateVisitRegistrationVisitDate(auth.accountId(), req), HttpStatus.OK);
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
            if ("CONFLICT".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.CONFLICT);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/createByPatient")
    public ResponseEntity<VisitDto.CreateVisitRegistrationResponse> createByPatient(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.CreateVisitRegistrationByPatientRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireStudent(authorization);
            return new ResponseEntity<>(visitService.createVisitRegistrationByPatient(auth.accountId(), req), HttpStatus.CREATED);
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

    @PostMapping("/listMineByPatient")
    public ResponseEntity<VisitDto.ListMyVisitRegistrationsByPatientResponse> listMineByPatient(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody VisitDto.ListMyVisitRegistrationsByPatientRequest req
    ) {
        try {
            AuthService.AuthResult auth = requireStudent(authorization);
            return new ResponseEntity<>(visitService.listMyVisitRegistrationsByPatient(auth.accountId(), req), HttpStatus.OK);
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
