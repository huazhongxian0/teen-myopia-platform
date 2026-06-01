package com.example.server.service;

import com.example.server.dto.YoloDetectionDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
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
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class YoloDetectionService {
    private static final Logger log = LoggerFactory.getLogger(YoloDetectionService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicReference<Path> extractedScriptPath = new AtomicReference<>();
    private final AtomicReference<Path> extractedRealtimeWorkerScriptPath = new AtomicReference<>();
    private final Set<RealtimeWorkerSession> realtimeWorkerSessions = ConcurrentHashMap.newKeySet();
    private final String pythonExecutable;
    private final String modelPath;
    private final String workDir;
    private final String scriptResourcePath;
    private final String realtimeScriptResourcePath;
    private final long timeoutSeconds;

    public YoloDetectionService(
            @Value("${app.yolo.python-executable:python3}") String pythonExecutable,
            @Value("${app.yolo.model-path:}") String modelPath,
            @Value("${app.yolo.work-dir:${java.io.tmpdir}/vision-guard-yolo}") String workDir,
            @Value("${app.yolo.script-resource:python/yolo_detect.py}") String scriptResourcePath,
            @Value("${app.yolo.realtime-script-resource:python/yolo_realtime_worker.py}") String realtimeScriptResourcePath,
            @Value("${app.yolo.request-timeout-seconds:1800}") long timeoutSeconds
    ) {
        this.pythonExecutable = pythonExecutable;
        this.modelPath = modelPath;
        this.workDir = workDir;
        this.scriptResourcePath = scriptResourcePath;
        this.realtimeScriptResourcePath = realtimeScriptResourcePath;
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
            Map<String, Integer> classCounts = readClassCounts(root.path("summary").path("classCounts"));
            int totalFrames = root.path("summary").path("totalFrames").asInt(0);
            int totalDetections = root.path("summary").path("totalDetections").asInt(0);

            log.info("上传检测完成 requestId={} fileName={} totalFrames={} totalDetections={} glassesCount={} classCounts={}",
                    requestId,
                    originalFilename,
                    totalFrames,
                    totalDetections,
                    resolvePrimaryCount(classCounts, totalDetections),
                    classCounts);

            return new YoloDetectionDto.DetectVideoResponse(
                    requestId,
                    originalFilename,
                    video.getSize(),
                    "success",
                    root.path("message").asText("检测完成"),
                    new YoloDetectionDto.DetectionSummary(
                            totalFrames,
                            totalDetections,
                            classCounts
                    ),
                    new YoloDetectionDto.DetectionArtifact(
                            root.path("artifact").path("inputPath").asText(inputPath.toString()),
                            root.path("artifact").path("outputDir").asText(outputDir.toString()),
                            readNullableText(root.path("artifact").path("annotatedVideoPath"))
                    )
            );
        } catch (IllegalArgumentException e) {
            log.error("[DEBUG] detectFrameDataUrl IllegalArgumentException: {}", e.getMessage());
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("[DEBUG] detectFrameDataUrl 中断异常");
            throw new IllegalStateException("DETECTION_INTERRUPTED");
        } catch (IOException e) {
            log.error("[DEBUG] detectFrameDataUrl IO异常: ", e);
            throw new IllegalStateException("DETECTION_IO_ERROR: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("[DEBUG] detectFrameDataUrl 未知异常: ", e);
            throw e;
        }
    }

    public RealtimeDetectResult detectFrameDataUrl(String frameDataUrl, DetectVideoCommand command) {
        log.info("[DEBUG] detectFrameDataUrl 入口 frameDataUrl长度={}", frameDataUrl != null ? frameDataUrl.length() : "null");
        
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

            log.info("[DEBUG] 帧已写入文件 准备调用 runDetection requestId={} inputPath={}", requestId, inputPath);

            JsonNode root = runDetection(inputPath, outputDir, requestId, command);
            
            log.info("[DEBUG] runDetection 返回成功 开始解析结果");
            
            Map<String, Integer> classCounts = readClassCounts(root.path("summary").path("classCounts"));
            List<DetectionBox> detections = readDetections(root.path("summary").path("detections"));
            int totalDetections = root.path("summary").path("totalDetections").asInt(0);
            int targetCount = resolvePrimaryCount(classCounts, totalDetections);

            log.info("实时检测完成 requestId={} totalDetections={} glassesCount={} classCounts={}",
                    requestId,
                    totalDetections,
                    targetCount,
                    classCounts);

            return new RealtimeDetectResult(
                    requestId,
                    targetCount,
                    totalDetections,
                    classCounts,
                    detections,
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

    public RealtimeWorkerSession openRealtimeWorker(DetectVideoCommand command) throws IOException {
        Path modelFile = resolveConfiguredModelPath();
        Path realtimeScriptPath = ensureRealtimeWorkerScriptExtracted();

        List<String> processCommand = new ArrayList<>();
        processCommand.add(pythonExecutable);
        processCommand.add(realtimeScriptPath.toString());
        processCommand.add("--model");
        processCommand.add(modelFile.toString());
        processCommand.add("--conf");
        processCommand.add(String.valueOf(command.confidence()));
        processCommand.add("--iou");
        processCommand.add(String.valueOf(command.iouThreshold()));
        processCommand.add("--imgsz");
        processCommand.add(String.valueOf(command.imageSize()));

        ProcessBuilder builder = new ProcessBuilder(processCommand);
        builder.directory(resolveAbsolutePath(workDir).toFile());
        builder.environment().put("PYTHONIOENCODING", StandardCharsets.UTF_8.name());

        Process process = builder.start();
        RealtimeWorkerSession session = new RealtimeWorkerSession(process);
        try {
            session.awaitReady();
            realtimeWorkerSessions.add(session);
            return session;
        } catch (RuntimeException | IOException e) {
            session.close();
            throw e;
        }
    }

    private Path ensureScriptExtracted() throws IOException {
        return ensureScriptExtracted(
                extractedScriptPath,
                scriptResourcePath,
                "yolo_detect.py",
                "SCRIPT_RESOURCE_NOT_FOUND"
        );
    }

    private Path ensureRealtimeWorkerScriptExtracted() throws IOException {
        return ensureScriptExtracted(
                extractedRealtimeWorkerScriptPath,
                realtimeScriptResourcePath,
                "yolo_realtime_worker.py",
                "REALTIME_SCRIPT_RESOURCE_NOT_FOUND"
        );
    }

    private Path ensureScriptExtracted(
            AtomicReference<Path> cacheRef,
            String resourcePath,
            String targetFileName,
            String missingResourceCode
    ) throws IOException {
        Path existing = cacheRef.get();
        if (existing != null && Files.exists(existing)) {
            return existing;
        }

        synchronized (cacheRef) {
            Path cached = cacheRef.get();
            if (cached != null && Files.exists(cached)) {
                return cached;
            }

            ClassPathResource resource = new ClassPathResource(resourcePath);
            if (!resource.exists()) {
                throw new IllegalStateException(missingResourceCode);
            }

            Path scriptDir = Files.createDirectories(resolveAbsolutePath(workDir).resolve("_runtime"));
            Path scriptPath = scriptDir.resolve(targetFileName);
            try (InputStream inputStream = resource.getInputStream()) {
                Files.copy(inputStream, scriptPath, StandardCopyOption.REPLACE_EXISTING);
            }
            cacheRef.set(scriptPath);
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

    private RealtimeDetectResult parseRealtimeDetectResult(JsonNode root, String fallbackRequestId) {
        if (root == null) {
            throw new IllegalStateException("DETECTION_FAILED: 空响应");
        }
        if (!root.path("success").asBoolean(false)) {
            String message = root.path("message").asText("模型推理失败");
            throw new IllegalStateException("DETECTION_FAILED: " + message);
        }

        JsonNode summary = root.path("summary");
        Map<String, Integer> classCounts = readClassCounts(summary.path("classCounts"));
        List<DetectionBox> detections = readDetections(summary.path("detections"));
        int totalDetections = summary.path("totalDetections").asInt(0);
        int targetCount = resolvePrimaryCount(classCounts, totalDetections);

        return new RealtimeDetectResult(
                readNullableText(root.path("requestId")) != null ? readNullableText(root.path("requestId")) : fallbackRequestId,
                targetCount,
                totalDetections,
                classCounts,
                detections,
                System.currentTimeMillis()
        );
    }

    private Path resolveConfiguredModelPath() {
        // #region debug-point model-path-missing-1
        log.info("[DEBUG][model-path] 原始配置 modelPath={} env.YOLO_MODEL_PATH={}",
                this.modelPath,
                System.getenv("YOLO_MODEL_PATH"));
        // #endregion
        String configuredModelPath = normalize(this.modelPath);
        // #region debug-point model-path-missing-2
        log.info("[DEBUG][model-path] 归一化后 configuredModelPath={}", configuredModelPath);
        // #endregion
        if (configuredModelPath == null) {
            // #region debug-point model-path-missing-3
            log.warn("[DEBUG][model-path] 模型路径为空，准备抛出 MODEL_PATH_NOT_CONFIGURED");
            // #endregion
            throw new IllegalArgumentException("MODEL_PATH_NOT_CONFIGURED");
        }
        Path modelFile = resolveAbsolutePath(configuredModelPath);
        // #region debug-point model-path-missing-4
        log.info("[DEBUG][model-path] 解析后 modelFile={} exists={} readable={}",
                modelFile,
                Files.exists(modelFile),
                Files.isReadable(modelFile));
        // #endregion
        if (!Files.exists(modelFile)) {
            // #region debug-point model-path-missing-5
            log.warn("[DEBUG][model-path] 模型文件不存在，准备抛出 MODEL_FILE_NOT_FOUND modelFile={}", modelFile);
            // #endregion
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

    private List<DetectionBox> readDetections(JsonNode node) {
        List<DetectionBox> result = new ArrayList<>();
        if (node == null || !node.isArray()) {
            return result;
        }
        for (JsonNode item : node) {
            if (item == null || !item.isObject()) {
                continue;
            }
            result.add(new DetectionBox(
                    readNullableText(item.path("className")),
                    item.path("classId").asInt(-1),
                    item.path("confidence").asDouble(0),
                    item.path("x1").asDouble(0),
                    item.path("y1").asDouble(0),
                    item.path("x2").asDouble(0),
                    item.path("y2").asDouble(0),
                    item.path("imageWidth").asInt(0),
                    item.path("imageHeight").asInt(0)
            ));
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
            String normalizedKey = normalizeClassKey(key);
            if (isPositiveGlassesKey(normalizedKey)) {
                return Math.max(entry.getValue(), 0);
            }
        }
        return Math.max(totalDetections, 0);
    }

    private String normalizeClassKey(String value) {
        return value == null ? "" : value.trim().toLowerCase().replaceAll("[\\s_-]+", "");
    }

    private boolean isPositiveGlassesKey(String normalizedKey) {
        if (normalizedKey == null || normalizedKey.isEmpty() || isNegativeGlassesKey(normalizedKey)) {
            return false;
        }
        return normalizedKey.contains("glasses")
                || normalizedKey.contains("glass")
                || normalizedKey.contains("eyeglasses")
                || normalizedKey.contains("wearingglasses")
                || normalizedKey.contains("wearglasses")
                || normalizedKey.contains("withglasses")
                || normalizedKey.contains("戴眼镜")
                || normalizedKey.contains("佩戴眼镜")
                || normalizedKey.contains("戴镜")
                || normalizedKey.contains("眼镜");
    }

    private boolean isNegativeGlassesKey(String normalizedKey) {
        return normalizedKey.contains("noglasses")
                || normalizedKey.contains("withoutglasses")
                || normalizedKey.contains("notwearingglasses")
                || normalizedKey.contains("nowearingglasses")
                || normalizedKey.contains("未戴眼镜")
                || normalizedKey.contains("未佩戴眼镜")
                || normalizedKey.contains("不戴眼镜")
                || normalizedKey.contains("无眼镜")
                || normalizedKey.contains("未戴镜");
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

    @PreDestroy
    public void shutdownRealtimeWorkers() {
        for (RealtimeWorkerSession session : List.copyOf(realtimeWorkerSessions)) {
            try {
                session.close();
            } catch (Exception ignored) {
            }
        }
        realtimeWorkerSessions.clear();
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
            List<DetectionBox> detections,
            long detectedAt
    ) {
    }

    public record DetectionBox(
            String className,
            int classId,
            double confidence,
            double x1,
            double y1,
            double x2,
            double y2,
            int imageWidth,
            int imageHeight
    ) {
    }

    public final class RealtimeWorkerSession implements AutoCloseable {
        private final Process process;
        private final BufferedWriter stdinWriter;
        private final BufferedReader stdoutReader;
        private final Thread stderrDrainThread;
        private volatile boolean closed;

        private RealtimeWorkerSession(Process process) {
            this.process = process;
            this.stdinWriter = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
            this.stdoutReader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
            this.stderrDrainThread = createStderrDrainThread(process);
            this.stderrDrainThread.start();
        }

        private void awaitReady() throws IOException {
            JsonNode readyPayload = readJsonLine();
            if (readyPayload == null) {
                throw new IllegalStateException("REALTIME_WORKER_START_FAILED");
            }
            if (!readyPayload.path("success").asBoolean(false)) {
                throw new IllegalStateException(readyPayload.path("message").asText("REALTIME_WORKER_START_FAILED"));
            }
        }

        public synchronized RealtimeDetectResult detectFrameDataUrl(String frameDataUrl) throws IOException {
            ensureOpen();
            String requestId = UUID.randomUUID().toString().replace("-", "");
            String payload = objectMapper.createObjectNode()
                    .put("type", "detect")
                    .put("requestId", requestId)
                    .put("frameDataUrl", frameDataUrl)
                    .toString();
            stdinWriter.write(payload);
            stdinWriter.newLine();
            stdinWriter.flush();

            JsonNode response = readJsonLine();
            return parseRealtimeDetectResult(response, requestId);
        }

        private JsonNode readJsonLine() throws IOException {
            String line = stdoutReader.readLine();
            if (line == null) {
                throw new IllegalStateException("REALTIME_WORKER_CLOSED");
            }
            String content = line.trim();
            if (content.isEmpty()) {
                throw new IllegalStateException("REALTIME_WORKER_EMPTY_RESPONSE");
            }
            return objectMapper.readTree(content);
        }

        private void ensureOpen() {
            if (closed || !process.isAlive()) {
                throw new IllegalStateException("REALTIME_WORKER_UNAVAILABLE");
            }
        }

        @Override
        public synchronized void close() {
            if (closed) {
                return;
            }
            closed = true;
            realtimeWorkerSessions.remove(this);
            try {
                if (process.isAlive()) {
                    stdinWriter.write("{\"type\":\"shutdown\"}");
                    stdinWriter.newLine();
                    stdinWriter.flush();
                }
            } catch (Exception ignored) {
            }
            try {
                stdinWriter.close();
            } catch (Exception ignored) {
            }
            try {
                stdoutReader.close();
            } catch (Exception ignored) {
            }
            try {
                if (process.isAlive()) {
                    process.destroy();
                    if (!process.waitFor(Duration.ofSeconds(2).toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS)) {
                        process.destroyForcibly();
                    }
                }
            } catch (Exception ignored) {
                process.destroyForcibly();
            }
        }

        private Thread createStderrDrainThread(Process process) {
            Thread thread = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (!line.isBlank()) {
                            log.warn("[DEBUG][realtime-worker] {}", line);
                        }
                    }
                } catch (IOException ignored) {
                }
            }, "yolo-realtime-worker-stderr-" + Integer.toHexString(System.identityHashCode(process)));
            thread.setDaemon(true);
            return thread;
        }
    }
}
