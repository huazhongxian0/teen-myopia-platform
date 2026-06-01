package com.example.server.ws;

import com.example.server.service.AuthService;
import com.example.server.service.YoloDetectionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class RawWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(RawWebSocketHandler.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AuthService authService;
    private final YoloDetectionService yoloDetectionService;
    private final ConcurrentMap<String, WebSocketSession> sessionsById = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, RealtimeSessionState> realtimeStates = new ConcurrentHashMap<>();

    public RawWebSocketHandler(AuthService authService, YoloDetectionService yoloDetectionService) {
        this.authService = authService;
        this.yoloDetectionService = yoloDetectionService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessionsById.put(session.getId(), session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessionsById.remove(session.getId());
        closeRealtimeState(session.getId());
    }

    public void broadcastTestCommand() {
        ObjectNode cmd = objectMapper.createObjectNode();
        cmd.put("key", "test");
        cmd.put("ts", System.currentTimeMillis());
        String payload = cmd.toString();

        for (WebSocketSession session : sessionsById.values()) {
            if (session == null) {
                continue;
            }
            if (!session.isOpen()) {
                sessionsById.remove(session.getId());
                continue;
            }
            try {
                session.sendMessage(new TextMessage(payload));
            } catch (Exception ignored) {
                sessionsById.remove(session.getId());
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.info("[DEBUG] 收到 WebSocket 消息 sessionId={} payload前50字符={}", session.getId(), payload.length() > 50 ? payload.substring(0, 50) + "..." : payload);
        
        if ("ping".equals(payload)) {
            session.sendMessage(new TextMessage("pong"));
            return;
        }

        try {
            JsonNode node = objectMapper.readTree(payload);
            if (node.isObject()) {
                String type = node.path("type").asText("");
                if ("heartbeat".equals(type)) {
                    return;
                }
                if ("ping".equals(type)) {
                    ObjectNode resp = objectMapper.createObjectNode();
                    resp.put("type", "pong");
                    resp.put("ts", System.currentTimeMillis());
                    session.sendMessage(new TextMessage(resp.toString()));
                    return;
                }
                if ("yolo.realtime.start".equals(type)) {
                    handleRealtimeStart(session, node);
                    return;
                }
                if ("yolo.realtime.stop".equals(type)) {
                    handleRealtimeStop(session, node);
                    return;
                }
                if ("yolo.realtime.frame".equals(type)) {
                    handleRealtimeFrame(session, node);
                    return;
                }
            }
        } catch (Exception ignored) {
        }

        session.sendMessage(new TextMessage(payload));
    }

    private void handleRealtimeStart(WebSocketSession session, JsonNode node) {
        try {
            // #region debug-point model-path-missing-6
            log.info("[DEBUG][realtime-start] 收到启动请求 sessionId={} classId={} className={} tokenExists={}",
                    session.getId(),
                    node.path("classId").isMissingNode() || node.path("classId").isNull() ? null : node.path("classId").asLong(),
                    textOrNull(node.path("className")),
                    textOrNull(node.path("token")) != null);
            // #endregion
            AuthService.AuthResult auth = verifyLogin(node);
            Long classId = node.path("classId").isMissingNode() || node.path("classId").isNull() ? null : node.path("classId").asLong();
            String className = textOrNull(node.path("className"));
            YoloDetectionService.DetectVideoCommand command = YoloDetectionService.DetectVideoCommand.from(
                    node.path("conf").isMissingNode() ? null : node.path("conf").asDouble(),
                    node.path("iou").isMissingNode() ? null : node.path("iou").asDouble(),
                    node.path("imgsz").isMissingNode() ? null : node.path("imgsz").asInt()
            );
            YoloDetectionService.RealtimeWorkerSession workerSession = yoloDetectionService.openRealtimeWorker(command);
            closeRealtimeState(session.getId());
            RealtimeSessionState nextState = new RealtimeSessionState(new RealtimeFrameProcessor(
                    workerSession,
                    (result) -> sendRealtimeUpdate(session, classId, className, result),
                    (error) -> {
                        log.error("[DEBUG][realtime-stream] sessionId={} message={}", session.getId(), error.getMessage(), error);
                        sendError(session, error.getMessage() == null ? "实时检测失败" : error.getMessage());
                    }
            ));
            realtimeStates.put(session.getId(), nextState);
            // #region debug-point model-path-missing-7
            log.info("[DEBUG][realtime-start] 启动成功 sessionId={} accountId={} realtimeStateSize={}",
                    session.getId(),
                    auth.accountId(),
                    realtimeStates.size());
            // #endregion

            ObjectNode props = objectMapper.createObjectNode();
            if (classId != null) {
                props.put("classId", classId);
            }
            if (className != null) {
                props.put("className", className);
            }
            props.put("running", true);
            props.put("message", "实时检测已启动");
            props.put("detectedAt", System.currentTimeMillis());
            sendKey(session, "yolo:realtime:status", props);
        } catch (IllegalArgumentException e) {
            // #region debug-point model-path-missing-8
            log.warn("[DEBUG][realtime-start] 启动失败 sessionId={} message={}", session.getId(), e.getMessage());
            // #endregion
            sendError(session, e.getMessage());
        } catch (Exception e) {
            log.error("[DEBUG][realtime-start] 启动异常 sessionId={}", session.getId(), e);
            sendError(session, e.getMessage() == null ? "实时检测启动失败" : e.getMessage());
        }
    }

    private void handleRealtimeStop(WebSocketSession session, JsonNode node) {
        closeRealtimeState(session.getId());
        ObjectNode props = objectMapper.createObjectNode();
        if (!node.path("classId").isMissingNode() && !node.path("classId").isNull()) {
            props.put("classId", node.path("classId").asLong());
        }
        props.put("running", false);
        props.put("message", "实时检测已停止");
        props.put("detectedAt", System.currentTimeMillis());
        sendKey(session, "yolo:realtime:status", props);
    }

    private void handleRealtimeFrame(WebSocketSession session, JsonNode node) {
        log.info("[DEBUG] handleRealtimeFrame 被调用 sessionId={}", session.getId());
        
        RealtimeSessionState state = realtimeStates.get(session.getId());
        if (state == null) {
            log.warn("[DEBUG] 帧被拒绝: realtimeStates 中没有该会话的状态! sessionId={} (可能未先调用 yolo.realtime.start)", session.getId());
            sendError(session, "实时检测尚未启动");
            return;
        }
        String frameDataUrl = textOrNull(node.path("frameDataUrl"));
        if (frameDataUrl == null) {
            sendError(session, "缺少图像帧数据");
            return;
        }
        state.processor().submit(frameDataUrl);
    }

    private AuthService.AuthResult verifyLogin(JsonNode node) {
        String token = textOrNull(node.path("token"));
        if (token == null) {
            throw new IllegalArgumentException("UNAUTHORIZED");
        }
        return authService.verifyToken(token);
    }

    private void sendError(WebSocketSession session, String message) {
        // #region debug-point model-path-missing-9
        log.warn("[DEBUG][ws-error] sessionId={} message={}", session != null ? session.getId() : null, message);
        // #endregion
        ObjectNode props = objectMapper.createObjectNode();
        props.put("message", message == null ? "实时检测失败" : message);
        props.put("detectedAt", System.currentTimeMillis());
        sendKey(session, "yolo:realtime:error", props);
    }

    private void sendKey(WebSocketSession session, String key, JsonNode props) {
        if (session == null || !session.isOpen()) {
            return;
        }
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("key", key);
        payload.set("props", props);
        try {
            session.sendMessage(new TextMessage(payload.toString()));
        } catch (Exception ignored) {
            sessionsById.remove(session.getId());
            closeRealtimeState(session.getId());
        }
    }

    private void sendRealtimeUpdate(
            WebSocketSession session,
            Long classId,
            String className,
            YoloDetectionService.RealtimeDetectResult result
    ) {
        ObjectNode props = objectMapper.createObjectNode();
        if (classId != null) {
            props.put("classId", classId);
        }
        if (className != null) {
            props.put("className", className);
        }
        props.put("requestId", result.requestId());
        props.put("count", result.count());
        props.put("totalDetections", result.totalDetections());
        props.put("detectedAt", result.detectedAt());
        props.set("classCounts", toObjectNode(result.classCounts()));
        props.set("detections", objectMapper.valueToTree(result.detections()));
        sendKey(session, "yolo:realtime:update", props);
    }

    private void closeRealtimeState(String sessionId) {
        RealtimeSessionState removed = realtimeStates.remove(sessionId);
        if (removed != null) {
            removed.close();
        }
    }

    private ObjectNode toObjectNode(Map<String, Integer> values) {
        ObjectNode node = objectMapper.createObjectNode();
        if (values == null || values.isEmpty()) {
            return node;
        }
        for (Map.Entry<String, Integer> entry : values.entrySet()) {
            if (entry.getKey() == null) {
                continue;
            }
            node.put(entry.getKey(), entry.getValue() == null ? 0 : entry.getValue());
        }
        return node;
    }

    private String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String value = node.asText(null);
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static final class RealtimeSessionState implements AutoCloseable {
        private final RealtimeFrameProcessor processor;

        private RealtimeSessionState(RealtimeFrameProcessor processor) {
            this.processor = processor;
        }

        public RealtimeFrameProcessor processor() {
            return processor;
        }

        @Override
        public void close() {
            processor.close();
        }
    }

    private static final class RealtimeFrameProcessor implements AutoCloseable {
        private final YoloDetectionService.RealtimeWorkerSession workerSession;
        private final java.util.function.Consumer<YoloDetectionService.RealtimeDetectResult> onResult;
        private final java.util.function.Consumer<Exception> onError;
        private final AtomicReference<String> latestFrameDataUrlRef = new AtomicReference<>();
        private final AtomicBoolean draining = new AtomicBoolean(false);
        private final AtomicBoolean closed = new AtomicBoolean(false);

        private RealtimeFrameProcessor(
                YoloDetectionService.RealtimeWorkerSession workerSession,
                java.util.function.Consumer<YoloDetectionService.RealtimeDetectResult> onResult,
                java.util.function.Consumer<Exception> onError
        ) {
            this.workerSession = workerSession;
            this.onResult = onResult;
            this.onError = onError;
        }

        public void submit(String frameDataUrl) {
            if (closed.get()) {
                return;
            }
            latestFrameDataUrlRef.set(frameDataUrl);
            drainAsync();
        }

        private void drainAsync() {
            if (!draining.compareAndSet(false, true)) {
                return;
            }
            CompletableFuture.runAsync(() -> {
                try {
                    while (!closed.get()) {
                        String frameDataUrl = latestFrameDataUrlRef.getAndSet(null);
                        if (frameDataUrl == null) {
                            return;
                        }
                        try {
                            YoloDetectionService.RealtimeDetectResult result = workerSession.detectFrameDataUrl(frameDataUrl);
                            if (!closed.get()) {
                                onResult.accept(result);
                            }
                        } catch (Exception e) {
                            if (!closed.get()) {
                                onError.accept(e instanceof Exception ? e : new IllegalStateException("实时检测失败"));
                            }
                            return;
                        }
                    }
                } finally {
                    draining.set(false);
                    if (!closed.get() && latestFrameDataUrlRef.get() != null) {
                        drainAsync();
                    }
                }
            });
        }

        @Override
        public void close() {
            if (!closed.compareAndSet(false, true)) {
                return;
            }
            latestFrameDataUrlRef.set(null);
            workerSession.close();
        }
    }
}
