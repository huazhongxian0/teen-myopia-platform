package com.example.server.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "visit_history")
public class VisitHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "registration_id")
    private Long registrationId;

    @Column(name = "doctor_account_id", nullable = false)
    private Long doctorAccountId;

    @Column(name = "patient_account_id", nullable = false)
    private Long patientAccountId;

    @Column(name = "visit_date", nullable = false)
    private Long visitDate;

    @Column(name = "od", nullable = false)
    private Long od;

    @Column(name = "os", nullable = false)
    private Long os;

    @Column(name = "created_at", nullable = false)
    private Long createdAt;

    public VisitHistory() {
    }

    public VisitHistory(
            Long id,
            Long registrationId,
            Long doctorAccountId,
            Long patientAccountId,
            Long visitDate,
            Long od,
            Long os,
            Long createdAt
    ) {
        this.id = id;
        this.registrationId = registrationId;
        this.doctorAccountId = doctorAccountId;
        this.patientAccountId = patientAccountId;
        this.visitDate = visitDate;
        this.od = od;
        this.os = os;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getRegistrationId() {
        return registrationId;
    }

    public void setRegistrationId(Long registrationId) {
        this.registrationId = registrationId;
    }

    public Long getDoctorAccountId() {
        return doctorAccountId;
    }

    public void setDoctorAccountId(Long doctorAccountId) {
        this.doctorAccountId = doctorAccountId;
    }

    public Long getPatientAccountId() {
        return patientAccountId;
    }

    public void setPatientAccountId(Long patientAccountId) {
        this.patientAccountId = patientAccountId;
    }

    public Long getVisitDate() {
        return visitDate;
    }

    public void setVisitDate(Long visitDate) {
        this.visitDate = visitDate;
    }

    public Long getOd() {
        return od;
    }

    public void setOd(Long od) {
        this.od = od;
    }

    public Long getOs() {
        return os;
    }

    public void setOs(Long os) {
        this.os = os;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }
}
