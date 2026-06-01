package com.example.server.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "risk_warning")
public class RiskWarning {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_account_id", nullable = false)
    private Long studentAccountId;

    @Column(nullable = false)
    private String level;

    @Column(name = "trigger_type", nullable = false)
    private String triggerType;

    @Column(name = "trigger_reason", nullable = false)
    private String triggerReason;

    @Column(nullable = false)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Long createdAt;

    @Column(name = "resolved_at")
    private Long resolvedAt;

    @Column(name = "resolver_account_id")
    private Long resolverAccountId;

    @Column(name = "resolution_note")
    private String resolutionNote;

    public RiskWarning() {
    }

    public RiskWarning(
            Long id,
            Long studentAccountId,
            String level,
            String triggerType,
            String triggerReason,
            String status,
            Long createdAt,
            Long resolvedAt,
            Long resolverAccountId,
            String resolutionNote
    ) {
        this.id = id;
        this.studentAccountId = studentAccountId;
        this.level = level;
        this.triggerType = triggerType;
        this.triggerReason = triggerReason;
        this.status = status;
        this.createdAt = createdAt;
        this.resolvedAt = resolvedAt;
        this.resolverAccountId = resolverAccountId;
        this.resolutionNote = resolutionNote;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getStudentAccountId() {
        return studentAccountId;
    }

    public void setStudentAccountId(Long studentAccountId) {
        this.studentAccountId = studentAccountId;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public String getTriggerType() {
        return triggerType;
    }

    public void setTriggerType(String triggerType) {
        this.triggerType = triggerType;
    }

    public String getTriggerReason() {
        return triggerReason;
    }

    public void setTriggerReason(String triggerReason) {
        this.triggerReason = triggerReason;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }

    public Long getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Long resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public Long getResolverAccountId() {
        return resolverAccountId;
    }

    public void setResolverAccountId(Long resolverAccountId) {
        this.resolverAccountId = resolverAccountId;
    }

    public String getResolutionNote() {
        return resolutionNote;
    }

    public void setResolutionNote(String resolutionNote) {
        this.resolutionNote = resolutionNote;
    }
}
