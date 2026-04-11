package com.example.server.controller;

import com.example.server.model.ChatMessage;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ChatWsController {
    @MessageMapping("/chat")
    @SendTo("/topic/chat")
    public ChatMessage chat(@Payload ChatMessage message) {
        return message;
    }
}

