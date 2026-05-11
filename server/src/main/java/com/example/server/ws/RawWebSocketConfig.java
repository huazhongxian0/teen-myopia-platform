package com.example.server.ws;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class RawWebSocketConfig implements WebSocketConfigurer {

    private final RawWebSocketHandler rawWebSocketHandler;

    @Value("${app.endpoints.wsNative:/ws-raw}")
    private String wsNativeEndpoint;

    private static final int WS_TEXT_MESSAGE_BUFFER_SIZE = 1024 * 1024;
    private static final int WS_BINARY_MESSAGE_BUFFER_SIZE = 1024 * 1024;

    public RawWebSocketConfig(RawWebSocketHandler rawWebSocketHandler) {
        this.rawWebSocketHandler = rawWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(rawWebSocketHandler, wsNativeEndpoint).setAllowedOriginPatterns("*");
    }

    @Bean
    public ServletServerContainerFactoryBean webSocketContainerCustomizer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(WS_TEXT_MESSAGE_BUFFER_SIZE);
        container.setMaxBinaryMessageBufferSize(WS_BINARY_MESSAGE_BUFFER_SIZE);
        container.setMaxSessionIdleTimeout(120000L);
        return container;
    }
}
