package com.example.server.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.List;

public class RiskWarningDto {

    public record RiskWarningItem(
            Long id,
            @JsonAlias({"studentAccountId", "student_account_id"}) Long studentAccountId,
            @JsonAlias({"studentName", "student_name"}) String studentName,
            String level,
            @JsonAlias({"triggerType", "trigger_type"}) String triggerType,
            @JsonAlias({"triggerReason", "trigger_reason"}) String triggerReason,
            String status,
            @JsonAlias({"createdAt", "created_at"}) Long createdAt,
            @JsonAlias({"resolvedAt", "resolved_at"}) Long resolvedAt,
            @JsonAlias({"resolverAccountId", "resolver_account_id"}) Long resolverAccountId,
            @JsonAlias({"resolverName", "resolver_name"}) String resolverName,
            @JsonAlias({"resolutionNote", "resolution_note"}) String resolutionNote
    ) {
    }

    public record RiskWarningMessageItem(
            Long id,
            @JsonAlias({"warningId", "warning_id"}) Long warningId,
            @JsonAlias({"receiverAccountId", "receiver_account_id"}) Long receiverAccountId,
            @JsonAlias({"receiverRole", "receiver_role"}) String receiverRole,
            @JsonAlias({"readStatus", "read_status"}) Boolean readStatus,
            @JsonAlias({"createdAt", "created_at"}) Long createdAt,
            @JsonAlias({"studentName", "student_name"}) String studentName,
            String level,
            @JsonAlias({"triggerReason", "trigger_reason"}) String triggerReason
    ) {
    }

    public record EvaluateRequest(
            @JsonAlias({"studentAccountId", "student_account_id"}) Long studentAccountId
    ) {
    }

    public record EvaluateResponse(
            Long id,
            String level,
            @JsonAlias({"triggerType", "trigger_type"}) String triggerType,
            @JsonAlias({"triggerReason", "trigger_reason"}) String triggerReason,
            boolean triggered
    ) {
    }

    public record ListMyWarningsRequest(Integer pageNo, Integer pageSize) {
    }

    public record ListMyWarningsResponse(Long total, List<RiskWarningItem> list) {
    }

    public record ListMyMessagesRequest(Integer pageNo, Integer pageSize) {
    }

    public record ListMyMessagesResponse(Long total, List<RiskWarningMessageItem> list) {
    }

    public record ReadMessageRequest(Long id) {
    }

    public record ReadMessageResponse(boolean success) {
    }

    public record ResolveWarningRequest(
            Long id,
            @JsonAlias({"resolutionNote", "resolution_note"}) String resolutionNote
    ) {
    }

    public record ResolveWarningResponse(boolean success) {
    }

    public record ClassWarningListRequest(
            @JsonAlias({"classId", "class_id"}) Long classId
    ) {
    }

    public record ClassWarningListResponse(List<RiskWarningItem> list) {
    }

    public record AdminOverviewResponse(
            @JsonAlias({"totalWarningCount", "total_warning_count"}) Long totalWarningCount,
            @JsonAlias({"unresolvedCount", "unresolved_count"}) Long unresolvedCount,
            @JsonAlias({"highRiskCount", "high_risk_count"}) Long highRiskCount,
            @JsonAlias({"midRiskCount", "mid_risk_count"}) Long midRiskCount,
            @JsonAlias({"lowRiskCount", "low_risk_count"}) Long lowRiskCount,
            @JsonAlias({"normalCount", "normal_count"}) Long normalCount,
            @JsonAlias({"responseRate", "response_rate"}) Double responseRate,
            @JsonAlias({"levelDistribution", "level_distribution"}) List<NameValueItem> levelDistribution,
            @JsonAlias({"triggerDistribution", "trigger_distribution"}) List<NameValueItem> triggerDistribution,
            @JsonAlias({"recentWarnings", "recent_warnings"}) List<RiskWarningItem> recentWarnings
    ) {
    }

    public record NameValueItem(String name, Long value) {
    }

    public record BatchEvaluateRequest(
            @JsonAlias({"classId", "class_id"}) Long classId
    ) {
    }

    public record BatchEvaluateResponse(
            @JsonAlias({"evaluatedCount", "evaluated_count"}) int evaluatedCount,
            @JsonAlias({"triggeredCount", "triggered_count"}) int triggeredCount
    ) {
    }
}
