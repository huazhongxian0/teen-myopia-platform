package com.example.server.ws;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
public class RawWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ConcurrentMap<String, WebSocketSession> sessionsById = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessionsById.put(session.getId(), session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessionsById.remove(session.getId());
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
            }
        } catch (Exception ignored) {
        }

        session.sendMessage(new TextMessage(payload));
    }
}
