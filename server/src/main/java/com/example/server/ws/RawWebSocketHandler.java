package com.example.server.ws;

import com.example.server.service.AuthService;
import com.example.server.service.YoloDetectionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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

@Component
public class RawWebSocketHandler extends TextWebSocketHandler {

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
        realtimeStates.remove(session.getId());
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
            AuthService.AuthResult auth = verifyLogin(node);
            Long classId = node.path("classId").isMissingNode() || node.path("classId").isNull() ? null : node.path("classId").asLong();
            String className = textOrNull(node.path("className"));
            YoloDetectionService.DetectVideoCommand command = YoloDetectionService.DetectVideoCommand.from(
                    node.path("conf").isMissingNode() ? null : node.path("conf").asDouble(),
                    node.path("iou").isMissingNode() ? null : node.path("iou").asDouble(),
                    node.path("imgsz").isMissingNode() ? null : node.path("imgsz").asInt()
            );
            realtimeStates.put(session.getId(), new RealtimeSessionState(auth.accountId(), classId, className, command));

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
            sendError(session, e.getMessage());
        }
    }

    private void handleRealtimeStop(WebSocketSession session, JsonNode node) {
        realtimeStates.remove(session.getId());
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
        RealtimeSessionState state = realtimeStates.get(session.getId());
        if (state == null) {
            sendError(session, "实时检测尚未启动");
            return;
        }
        if (!state.processing().compareAndSet(false, true)) {
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                verifyLogin(node);
                String frameDataUrl = textOrNull(node.path("frameDataUrl"));
                if (frameDataUrl == null) {
                    throw new IllegalArgumentException("缺少图像帧数据");
                }

                YoloDetectionService.RealtimeDetectResult result = yoloDetectionService.detectFrameDataUrl(frameDataUrl, state.command());
                ObjectNode props = objectMapper.createObjectNode();
                if (state.classId() != null) {
                    props.put("classId", state.classId());
                }
                if (state.className() != null) {
                    props.put("className", state.className());
                }
                props.put("requestId", result.requestId());
                props.put("count", result.count());
                props.put("totalDetections", result.totalDetections());
                props.put("detectedAt", result.detectedAt());
                props.set("classCounts", toObjectNode(result.classCounts()));
                sendKey(session, "yolo:realtime:update", props);
            } catch (IllegalArgumentException e) {
                sendError(session, e.getMessage());
            } catch (Exception e) {
                sendError(session, "实时检测失败");
            } finally {
                state.processing().set(false);
            }
        });
    }

    private AuthService.AuthResult verifyLogin(JsonNode node) {
        String token = textOrNull(node.path("token"));
        if (token == null) {
            throw new IllegalArgumentException("UNAUTHORIZED");
        }
        return authService.verifyToken(token);
    }

    private void sendError(WebSocketSession session, String message) {
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
            realtimeStates.remove(session.getId());
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

    private record RealtimeSessionState(
            Long accountId,
            Long classId,
            String className,
            YoloDetectionService.DetectVideoCommand command,
            AtomicBoolean processing
    ) {
        private RealtimeSessionState(Long accountId, Long classId, String className, YoloDetectionService.DetectVideoCommand command) {
            this(accountId, classId, className, command, new AtomicBoolean(false));
        }
    }
}
