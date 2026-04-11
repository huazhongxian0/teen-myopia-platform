package com.example.server.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "visit_registration")
public class VisitRegistration {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "doctor_account_id", nullable = false)
    private Long doctorAccountId;

    @Column(name = "patient_account_id", nullable = false)
    private Long patientAccountId;

    @Column(name = "visit_date", nullable = false)
    private Long visitDate;

    @Column(name = "created_at", nullable = false)
    private Long createdAt;

    public VisitRegistration() {
    }

    public VisitRegistration(Long id, Long doctorAccountId, Long patientAccountId, Long visitDate, Long createdAt) {
        this.id = id;
        this.doctorAccountId = doctorAccountId;
        this.patientAccountId = patientAccountId;
        this.visitDate = visitDate;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }
}
