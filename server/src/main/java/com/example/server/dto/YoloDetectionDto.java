package com.example.server.dto;

import java.util.Map;

public final class YoloDetectionDto {
    private YoloDetectionDto() {
    }

    public record DetectVideoResponse(
            String requestId,
            String originalFilename,
            long fileSize,
            String status,
            String message,
            DetectionSummary summary,
            DetectionArtifact artifact
    ) {
    }

    public record DetectionSummary(
            int totalFrames,
            int totalDetections,
            Map<String, Integer> classCounts
    ) {
    }

    public record DetectionArtifact(
            String inputPath,
            String outputDir,
            String annotatedVideoPath
    ) {
    }
}
