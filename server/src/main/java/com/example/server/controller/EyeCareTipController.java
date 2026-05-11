package com.example.server.controller;

import com.example.server.dto.EyeCareTipDto;
import com.example.server.service.AuthService;
import com.example.server.service.EyeCareTipService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/eyeCareTip")
public class EyeCareTipController {
    private final AuthService authService;
    private final EyeCareTipService eyeCareTipService;

    public EyeCareTipController(AuthService authService, EyeCareTipService eyeCareTipService) {
        this.authService = authService;
        this.eyeCareTipService = eyeCareTipService;
    }

    @PostMapping("/list")
    public ResponseEntity<EyeCareTipDto.ListEyeCareTipsResponse> list(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody EyeCareTipDto.ListEyeCareTipsRequest req
    ) {
        try {
            requireLogin(authorization);
            return new ResponseEntity<>(eyeCareTipService.list(req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            if ("UNAUTHORIZED".equals(e.getMessage())) {
                return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
            }
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/create")
    public ResponseEntity<EyeCareTipDto.CreateEyeCareTipResponse> create(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody EyeCareTipDto.CreateEyeCareTipRequest req
    ) {
        try {
            requireDoctor(authorization);
            return new ResponseEntity<>(eyeCareTipService.create(req), HttpStatus.CREATED);
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

    @PostMapping("/delete")
    public ResponseEntity<EyeCareTipDto.DeleteEyeCareTipResponse> delete(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody EyeCareTipDto.DeleteEyeCareTipRequest req
    ) {
        try {
            requireDoctor(authorization);
            return new ResponseEntity<>(eyeCareTipService.delete(req), HttpStatus.OK);
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

    private void requireLogin(String authorization) {
        String token = extractBearerToken(authorization);
        if (token == null) {
            throw new IllegalArgumentException("UNAUTHORIZED");
        }
        authService.verifyToken(token);
    }

    private void requireDoctor(String authorization) {
        String token = extractBearerToken(authorization);
        if (token == null) {
            throw new IllegalArgumentException("UNAUTHORIZED");
        }
        AuthService.AuthResult auth = authService.verifyToken(token);
        if (auth.roleId() == null || !"doctor".equalsIgnoreCase(auth.roleId())) {
            throw new IllegalArgumentException("FORBIDDEN");
        }
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
