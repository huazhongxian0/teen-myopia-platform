package com.example.server.service;

import com.example.server.dto.YoloDetectionDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class YoloDetectionService {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicReference<Path> extractedScriptPath = new AtomicReference<>();
    private final String pythonExecutable;
    private final String modelPath;
    private final String workDir;
    private final String scriptResourcePath;
    private final long timeoutSeconds;

    public YoloDetectionService(
            @Value("${app.yolo.python-executable:python3}") String pythonExecutable,
            @Value("${app.yolo.model-path:}") String modelPath,
            @Value("${app.yolo.work-dir:${java.io.tmpdir}/vision-guard-yolo}") String workDir,
            @Value("${app.yolo.script-resource:python/yolo_detect.py}") String scriptResourcePath,
            @Value("${app.yolo.request-timeout-seconds:1800}") long timeoutSeconds
    ) {
        this.pythonExecutable = pythonExecutable;
        this.modelPath = modelPath;
        this.workDir = workDir;
        this.scriptResourcePath = scriptResourcePath;
        this.timeoutSeconds = timeoutSeconds;
    }

    public YoloDetectionDto.DetectVideoResponse detect(MultipartFile video, DetectVideoCommand command) {
        if (video == null || video.isEmpty()) {
            throw new IllegalArgumentException("EMPTY_VIDEO");
        }

        String requestId = UUID.randomUUID().toString().replace("-", "");
        String originalFilename = safeFileName(video.getOriginalFilename());
        if (originalFilename == null) {
            originalFilename = requestId + ".mp4";
        }

        try {
            Path requestRoot = Files.createDirectories(resolveAbsolutePath(this.workDir).resolve(requestId));
            Path inputPath = requestRoot.resolve(originalFilename);
            Path outputDir = Files.createDirectories(requestRoot.resolve("output"));
            video.transferTo(inputPath);
            JsonNode root = runDetection(inputPath, outputDir, requestId, command);

            return new YoloDetectionDto.DetectVideoResponse(
                    requestId,
                    originalFilename,
                    video.getSize(),
                    "success",
                    root.path("message").asText("检测完成"),
                    new YoloDetectionDto.DetectionSummary(
                            root.path("summary").path("totalFrames").asInt(0),
                            root.path("summary").path("totalDetections").asInt(0),
                            readClassCounts(root.path("summary").path("classCounts"))
                    ),
                    new YoloDetectionDto.DetectionArtifact(
                            root.path("artifact").path("inputPath").asText(inputPath.toString()),
                            root.path("artifact").path("outputDir").asText(outputDir.toString()),
                            readNullableText(root.path("artifact").path("annotatedVideoPath"))
                    )
            );
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("DETECTION_INTERRUPTED");
        } catch (IOException e) {
            throw new IllegalStateException("DETECTION_IO_ERROR: " + e.getMessage(), e);
        }
    }

    public RealtimeDetectResult detectFrameDataUrl(String frameDataUrl, DetectVideoCommand command) {
        String normalizedPayload = normalize(frameDataUrl);
        if (normalizedPayload == null) {
            throw new IllegalArgumentException("EMPTY_FRAME");
        }

        String requestId = UUID.randomUUID().toString().replace("-", "");
        try {
            byte[] frameBytes = decodeFrameData(normalizedPayload);
            String extension = detectImageExtension(normalizedPayload);
            Path requestRoot = Files.createDirectories(resolveAbsolutePath(this.workDir).resolve("realtime").resolve(requestId));
            Path inputPath = requestRoot.resolve("frame." + extension);
            Path outputDir = Files.createDirectories(requestRoot.resolve("output"));
            Files.write(inputPath, frameBytes);

            JsonNode root = runDetection(inputPath, outputDir, requestId, command);
            Map<String, Integer> classCounts = readClassCounts(root.path("summary").path("classCounts"));
            int totalDetections = root.path("summary").path("totalDetections").asInt(0);
            int targetCount = resolvePrimaryCount(classCounts, totalDetections);

            return new RealtimeDetectResult(
                    requestId,
                    targetCount,
                    totalDetections,
                    classCounts,
                    System.currentTimeMillis()
            );
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("DETECTION_INTERRUPTED");
        } catch (IOException e) {
            throw new IllegalStateException("DETECTION_IO_ERROR: " + e.getMessage(), e);
        }
    }

    private Path ensureScriptExtracted() throws IOException {
        Path existing = extractedScriptPath.get();
        if (existing != null && Files.exists(existing)) {
            return existing;
        }

        synchronized (extractedScriptPath) {
            Path cached = extractedScriptPath.get();
            if (cached != null && Files.exists(cached)) {
                return cached;
            }

            ClassPathResource resource = new ClassPathResource(scriptResourcePath);
            if (!resource.exists()) {
                throw new IllegalStateException("SCRIPT_RESOURCE_NOT_FOUND");
            }

            Path scriptDir = Files.createDirectories(resolveAbsolutePath(workDir).resolve("_runtime"));
            Path scriptPath = scriptDir.resolve("yolo_detect.py");
            try (InputStream inputStream = resource.getInputStream()) {
                Files.copy(inputStream, scriptPath, StandardCopyOption.REPLACE_EXISTING);
            }
            extractedScriptPath.set(scriptPath);
            return scriptPath;
        }
    }

    private JsonNode readLastJsonLine(String output) throws IOException {
        if (output == null || output.isBlank()) {
            return null;
        }
        String[] lines = output.split("\\R");
        for (int i = lines.length - 1; i >= 0; i--) {
            String line = lines[i].trim();
            if (line.isEmpty()) {
                continue;
            }
            if (line.startsWith("{") && line.endsWith("}")) {
                return objectMapper.readTree(line);
            }
        }
        return null;
    }

    private JsonNode runDetection(Path inputPath, Path outputDir, String requestId, DetectVideoCommand command) throws IOException, InterruptedException {
        Path modelFile = resolveConfiguredModelPath();
        Path scriptPath = ensureScriptExtracted();

        List<String> processCommand = new ArrayList<>();
        processCommand.add(pythonExecutable);
        processCommand.add(scriptPath.toString());
        processCommand.add("--input");
        processCommand.add(inputPath.toString());
        processCommand.add("--output-dir");
        processCommand.add(outputDir.toString());
        processCommand.add("--model");
        processCommand.add(modelFile.toString());
        processCommand.add("--request-id");
        processCommand.add(requestId);
        processCommand.add("--conf");
        processCommand.add(String.valueOf(command.confidence()));
        processCommand.add("--iou");
        processCommand.add(String.valueOf(command.iouThreshold()));
        processCommand.add("--imgsz");
        processCommand.add(String.valueOf(command.imageSize()));

        ProcessBuilder builder = new ProcessBuilder(processCommand);
        builder.redirectErrorStream(true);
        builder.directory(outputDir.getParent().toFile());
        builder.environment().put("PYTHONIOENCODING", StandardCharsets.UTF_8.name());

        Process process = builder.start();
        boolean finished = process.waitFor(Duration.ofSeconds(timeoutSeconds).toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new IllegalStateException("DETECTION_TIMEOUT");
        }

        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        if (process.exitValue() != 0) {
            throw new IllegalStateException("DETECTION_PROCESS_FAILED: " + output);
        }

        JsonNode root = readLastJsonLine(output);
        if (root == null || !root.path("success").asBoolean(false)) {
            String message = root != null ? root.path("message").asText("模型推理失败") : output;
            throw new IllegalStateException("DETECTION_FAILED: " + message);
        }
        return root;
    }

    private Path resolveConfiguredModelPath() {
        String configuredModelPath = normalize(this.modelPath);
        if (configuredModelPath == null) {
            throw new IllegalArgumentException("MODEL_PATH_NOT_CONFIGURED");
        }
        Path modelFile = resolveAbsolutePath(configuredModelPath);
        if (!Files.exists(modelFile)) {
            throw new IllegalArgumentException("MODEL_FILE_NOT_FOUND");
        }
        return modelFile;
    }

    private Map<String, Integer> readClassCounts(JsonNode node) {
        Map<String, Integer> result = new LinkedHashMap<>();
        if (node == null || !node.isObject()) {
            return result;
        }
        Iterator<Map.Entry<String, JsonNode>> iterator = node.properties().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, JsonNode> entry = iterator.next();
            result.put(entry.getKey(), entry.getValue().asInt(0));
        }
        return result;
    }

    private String readNullableText(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        String text = node.asText(null);
        return normalize(text);
    }

    private byte[] decodeFrameData(String frameDataUrl) {
        String payload = frameDataUrl;
        int commaIndex = frameDataUrl.indexOf(',');
        if (frameDataUrl.startsWith("data:") && commaIndex >= 0) {
            payload = frameDataUrl.substring(commaIndex + 1);
        }
        try {
            return Base64.getDecoder().decode(payload);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("INVALID_FRAME_DATA");
        }
    }

    private String detectImageExtension(String frameDataUrl) {
        if (frameDataUrl.startsWith("data:image/png")) {
            return "png";
        }
        if (frameDataUrl.startsWith("data:image/webp")) {
            return "webp";
        }
        return "jpg";
    }

    private int resolvePrimaryCount(Map<String, Integer> classCounts, int totalDetections) {
        for (Map.Entry<String, Integer> entry : classCounts.entrySet()) {
            String key = entry.getKey();
            if (key == null) {
                continue;
            }
            String normalizedKey = key.trim().toLowerCase();
            if ("glasses".equals(normalizedKey)
                    || "glass".equals(normalizedKey)
                    || "wearing_glasses".equals(normalizedKey)
                    || "wearing-glasses".equals(normalizedKey)
                    || "eyeglasses".equals(normalizedKey)) {
                return Math.max(entry.getValue(), 0);
            }
        }
        return Math.max(totalDetections, 0);
    }

    private Path resolveAbsolutePath(String value) {
        Path path = Path.of(value);
        if (path.isAbsolute()) {
            return path.normalize();
        }
        return Path.of("").toAbsolutePath().resolve(path).normalize();
    }

    private String safeFileName(String rawFileName) {
        String normalized = normalize(rawFileName);
        if (normalized == null) {
            return null;
        }
        String fileName = Path.of(normalized).getFileName().toString();
        fileName = fileName.replaceAll("[^A-Za-z0-9._-]", "_");
        return fileName.isBlank() ? null : fileName;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record DetectVideoCommand(double confidence, double iouThreshold, int imageSize) {
        public DetectVideoCommand {
            if (confidence <= 0 || confidence > 1) {
                throw new IllegalArgumentException("INVALID_CONFIDENCE");
            }
            if (iouThreshold <= 0 || iouThreshold > 1) {
                throw new IllegalArgumentException("INVALID_IOU_THRESHOLD");
            }
            if (imageSize <= 0) {
                throw new IllegalArgumentException("INVALID_IMAGE_SIZE");
            }
        }

        public static DetectVideoCommand from(Double confidence, Double iouThreshold, Integer imageSize) {
            double confValue = confidence == null ? 0.25d : confidence;
            double iouValue = iouThreshold == null ? 0.45d : iouThreshold;
            int imageSizeValue = imageSize == null ? 640 : imageSize;
            return new DetectVideoCommand(confValue, iouValue, imageSizeValue);
        }
    }

    public record RealtimeDetectResult(
            String requestId,
            int count,
            int totalDetections,
            Map<String, Integer> classCounts,
            long detectedAt
    ) {
    }
}
