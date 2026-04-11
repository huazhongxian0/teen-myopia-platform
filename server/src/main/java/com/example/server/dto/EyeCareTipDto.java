package com.example.server.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.List;

public class EyeCareTipDto {
    public record EyeCareTipItem(Long id, String title, String content, @JsonAlias({"createdAt", "created_at"}) Long createdAt) {
    }

    public record ListEyeCareTipsRequest(Integer pageNo, Integer pageSize) {
    }

    public record ListEyeCareTipsResponse(Long total, List<EyeCareTipItem> list) {
    }

    public record CreateEyeCareTipRequest(String title, String content) {
    }

    public record CreateEyeCareTipResponse(Long id) {
    }

    public record DeleteEyeCareTipRequest(Long id) {
    }

    public record DeleteEyeCareTipResponse(boolean success) {
    }
}

