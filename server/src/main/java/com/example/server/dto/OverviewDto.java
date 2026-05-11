package com.example.server.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.List;

public class OverviewDto {
    public record DashboardRequest(
            @JsonAlias({"topSchoolLimit", "top_school_limit"}) Integer topSchoolLimit
    ) {
    }

    public record SummaryItem(
            @JsonAlias({"schoolCount", "school_count"}) Long schoolCount,
            @JsonAlias({"classCount", "class_count"}) Long classCount,
            @JsonAlias({"studentCount", "student_count"}) Long studentCount,
            @JsonAlias({"avgDegree", "avg_degree"}) Double avgDegree,
            @JsonAlias({"glassesRate", "glasses_rate"}) Double glassesRate,
            @JsonAlias({"todayVisitCount", "today_visit_count"}) Long todayVisitCount,
            @JsonAlias({"highRiskCount", "high_risk_count"}) Long highRiskCount
    ) {
    }

    public record SchoolRankingItem(
            @JsonAlias({"schoolId", "school_id"}) Long schoolId,
            @JsonAlias({"schoolName", "school_name"}) String schoolName,
            @JsonAlias({"avgDegree", "avg_degree"}) Double avgDegree,
            @JsonAlias({"studentCount", "student_count"}) Long studentCount,
            @JsonAlias({"checkedCount", "checked_count"}) Long checkedCount,
            @JsonAlias({"highRiskCount", "high_risk_count"}) Long highRiskCount,
            @JsonAlias({"glassesCount", "glasses_count"}) Long glassesCount
    ) {
    }

    public record NameValueItem(String name, Long value) {
    }

    public record CoverageItem(
            @JsonAlias({"schoolId", "school_id"}) Long schoolId,
            @JsonAlias({"schoolName", "school_name"}) String schoolName,
            @JsonAlias({"studentCount", "student_count"}) Long studentCount,
            @JsonAlias({"checkedCount", "checked_count"}) Long checkedCount,
            @JsonAlias({"coverageRate", "coverage_rate"}) Double coverageRate
    ) {
    }

    public record TrendItem(
            String date,
            @JsonAlias({"registrationCount", "registration_count"}) Long registrationCount,
            @JsonAlias({"visitCount", "visit_count"}) Long visitCount
    ) {
    }

    public record GlassesDistributionItem(
            @JsonAlias({"schoolId", "school_id"}) Long schoolId,
            @JsonAlias({"schoolName", "school_name"}) String schoolName,
            @JsonAlias({"glassesCount", "glasses_count"}) Long glassesCount,
            @JsonAlias({"noGlassesCount", "no_glasses_count"}) Long noGlassesCount
    ) {
    }

    public record DashboardResponse(
            SummaryItem summary,
            @JsonAlias({"schoolRanking", "school_ranking"}) List<SchoolRankingItem> schoolRanking,
            @JsonAlias({"riskDistribution", "risk_distribution"}) List<NameValueItem> riskDistribution,
            @JsonAlias({"schoolCoverage", "school_coverage"}) List<CoverageItem> schoolCoverage,
            @JsonAlias({"visitTrend", "visit_trend"}) List<TrendItem> visitTrend,
            @JsonAlias({"glassesDistribution", "glasses_distribution"}) List<GlassesDistributionItem> glassesDistribution,
            @JsonAlias({"updatedAt", "updated_at"}) Long updatedAt
    ) {
    }

    public record StudentListRequest(
            String keyword,
            @JsonAlias({"schoolId", "school_id"}) Long schoolId,
            @JsonAlias({"classId", "class_id"}) Long classId,
            Integer pageNo,
            Integer pageSize
    ) {
    }

    public record StudentListItem(
            @JsonAlias({"schoolId", "school_id"}) Long schoolId,
            @JsonAlias({"schoolName", "school_name"}) String schoolName,
            @JsonAlias({"classId", "class_id"}) Long classId,
            @JsonAlias({"className", "class_name"}) String className,
            @JsonAlias({"studentAccountId", "student_account_id"}) Long studentAccountId,
            @JsonAlias({"studentName", "student_name"}) String studentName,
            @JsonAlias({"accountName", "account_name"}) String accountName,
            @JsonAlias({"phoneNumber", "phone_number"}) String phoneNumber,
            Long od,
            Long os,
            @JsonAlias({"avgDegree", "avg_degree"}) Double avgDegree,
            @JsonAlias({"hasGlasses", "has_glasses"}) Boolean hasGlasses,
            @JsonAlias({"eyesTime", "eyes_time"}) Long eyesTime,
            @JsonAlias({"riskLevel", "risk_level"}) String riskLevel
    ) {
    }

    public record StudentListResponse(Long total, List<StudentListItem> list) {
    }
}
