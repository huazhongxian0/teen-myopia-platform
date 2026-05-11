package com.example.server.controller;

import com.example.server.dto.YoloDetectionDto;
import com.example.server.service.AuthService;
import com.example.server.service.YoloDetectionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/yoloDetection")
public class YoloDetectionController {
    private final AuthService authService;
    private final YoloDetectionService yoloDetectionService;

    public YoloDetectionController(AuthService authService, YoloDetectionService yoloDetectionService) {
        this.authService = authService;
        this.yoloDetectionService = yoloDetectionService;
    }

    @PostMapping(value = "/detect", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<YoloDetectionDto.DetectVideoResponse> detect(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestParam("video") MultipartFile video,
            @RequestParam(name = "conf", required = false) Double confidence,
            @RequestParam(name = "iou", required = false) Double iouThreshold,
            @RequestParam(name = "imgsz", required = false) Integer imageSize
    ) {
        try {
            requireLogin(authorization);
            YoloDetectionDto.DetectVideoResponse response = yoloDetectionService.detect(
                    video,
                    YoloDetectionService.DetectVideoCommand.from(confidence, iouThreshold, imageSize)
            );
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            String message = e.getMessage();
            if ("UNAUTHORIZED".equals(message) || "INVALID_TOKEN".equals(message) || "TOKEN_EXPIRED".equals(message)) {
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
