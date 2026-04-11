package com.example.server;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.File;
import java.io.IOException;

@SpringBootApplication
public class ServerApplication {

    public static void main(String[] args) {
        loadSharedConfig();
        SpringApplication.run(ServerApplication.class, args);
    }

    private static void loadSharedConfig() {
        try {
            String[] candidates = new String[] {
                    "../shared-config.json",
                    "shared-config.json",
                    "../../shared-config.json"
            };

            File configFile = null;
            for (String candidate : candidates) {
                File f = new File(candidate);
                if (f.exists()) {
                    configFile = f;
                    break;
                }
            }
            
            if (configFile != null && configFile.exists()) {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode root = mapper.readTree(configFile);
                
                JsonNode server = root.path("server");
                if (server.has("port")) {
                    System.setProperty("server.port", String.valueOf(server.get("port").asInt()));
                }
                
                JsonNode endpoints = root.path("endpoints");
                if (endpoints.has("wsStomp")) {
                    System.setProperty("app.endpoints.wsStomp", endpoints.get("wsStomp").asText());
                } else if (endpoints.has("ws")) {
                    System.setProperty("app.endpoints.wsStomp", endpoints.get("ws").asText());
                }
                if (endpoints.has("wsNative")) {
                    System.setProperty("app.endpoints.wsNative", endpoints.get("wsNative").asText());
                }
                
                System.out.println("Loaded shared configuration from: " + configFile.getAbsolutePath());
            } else {
                System.out.println("Shared configuration file not found. Using default properties.");
            }
        } catch (IOException e) {
            System.err.println("Failed to load shared configuration: " + e.getMessage());
        }
    }

}
