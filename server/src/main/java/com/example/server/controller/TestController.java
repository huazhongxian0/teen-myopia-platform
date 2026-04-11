package com.example.server.controller;

import com.example.server.ws.RawWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TestController {

    private final RawWebSocketHandler rawWebSocketHandler;
    private final ObjectProvider<SimpMessagingTemplate> simpMessagingTemplateProvider;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public TestController(
            RawWebSocketHandler rawWebSocketHandler,
            ObjectProvider<SimpMessagingTemplate> simpMessagingTemplateProvider
    ) {
        this.rawWebSocketHandler = rawWebSocketHandler;
        this.simpMessagingTemplateProvider = simpMessagingTemplateProvider;
    }

    @GetMapping("/ping")
    public String ping() {
        rawWebSocketHandler.broadcastTestCommand();

        SimpMessagingTemplate simpMessagingTemplate = simpMessagingTemplateProvider.getIfAvailable();
        if (simpMessagingTemplate != null) {
            ObjectNode cmd = objectMapper.createObjectNode();
            cmd.put("key", "test");
            cmd.put("props", System.currentTimeMillis());
            simpMessagingTemplate.convertAndSend("/topic/commands", cmd.toString());
        }
        return "ok";
    }
}
