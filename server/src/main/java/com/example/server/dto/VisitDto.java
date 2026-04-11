package com.example.server.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.List;

public class VisitDto {
    public record VisitRegistrationItem(
            Long id,
            @JsonAlias({"doctorAccountId", "doctor_account_id"}) Long doctorAccountId,
            @JsonAlias({"patientAccountId", "patient_account_id"}) Long patientAccountId,
            @JsonAlias({"patientName", "patient_name"}) String patientName,
            @JsonAlias({"visitDate", "visit_date"}) Long visitDate,
            @JsonAlias({"createdAt", "created_at"}) Long createdAt
    ) {
    }

    public record VisitRegistrationPatientItem(
            Long id,
            @JsonAlias({"doctorAccountId", "doctor_account_id"}) Long doctorAccountId,
            @JsonAlias({"doctorName", "doctor_name"}) String doctorName,
            @JsonAlias({"visitDate", "visit_date"}) Long visitDate,
            @JsonAlias({"createdAt", "created_at"}) Long createdAt
    ) {
    }

    public record CreateVisitRegistrationRequest(
            @JsonAlias({"patientAccountId", "patient_account_id"}) Long patientAccountId,
            @JsonAlias({"visitDate", "visit_date"}) Long visitDate
    ) {
    }

    public record CreateVisitRegistrationByPatientRequest(
            @JsonAlias({"doctorAccountId", "doctor_account_id"}) Long doctorAccountId,
            @JsonAlias({"visitDate", "visit_date"}) Long visitDate
    ) {
    }

    public record CreateVisitRegistrationResponse(Long id) {
    }

    public record ListMyVisitRegistrationsRequest(
            @JsonAlias({"visitDate", "visit_date"}) Long visitDate,
            Integer pageNo,
            Integer pageSize
    ) {
    }

    public record ListMyVisitRegistrationsResponse(Long total, List<VisitRegistrationItem> list) {
    }

    public record ListMyVisitRegistrationsRangeRequest(
            @JsonAlias({"startVisitDate", "start_visit_date"}) Long startVisitDate,
            @JsonAlias({"endVisitDate", "end_visit_date"}) Long endVisitDate,
            Integer pageNo,
            Integer pageSize
    ) {
    }

    public record ListMyVisitRegistrationsRangeResponse(Long total, List<VisitRegistrationItem> list) {
    }

    public record UpdateVisitRegistrationVisitDateRequest(
            Long id,
            @JsonAlias({"newVisitDate", "new_visit_date"}) Long newVisitDate
    ) {
    }

    public record UpdateVisitRegistrationVisitDateResponse(boolean success) {
    }

    public record ListMyVisitRegistrationsByPatientRequest(
            @JsonAlias({"visitDate", "visit_date"}) Long visitDate,
            Integer pageNo,
            Integer pageSize
    ) {
    }

    public record ListMyVisitRegistrationsByPatientResponse(Long total, List<VisitRegistrationPatientItem> list) {
    }

    public record VisitHistoryItem(
            Long id,
            @JsonAlias({"registrationId", "registration_id"}) Long registrationId,
            @JsonAlias({"doctorAccountId", "doctor_account_id"}) Long doctorAccountId,
            @JsonAlias({"doctorName", "doctor_name"}) String doctorName,
            @JsonAlias({"patientAccountId", "patient_account_id"}) Long patientAccountId,
            @JsonAlias({"visitDate", "visit_date"}) Long visitDate,
            Long od,
            Long os,
            @JsonAlias({"createdAt", "created_at"}) Long createdAt
    ) {
    }

    public record CreateVisitHistoryRequest(
            @JsonAlias({"registrationId", "registration_id"}) Long registrationId,
            @JsonAlias({"patientAccountId", "patient_account_id"}) Long patientAccountId,
            @JsonAlias({"visitDate", "visit_date"}) Long visitDate,
            Long od,
            Long os
    ) {
    }

    public record CreateVisitHistoryResponse(Long id) {
    }

    public record ListMyVisitHistoriesRequest(Integer pageNo, Integer pageSize) {
    }

    public record ListMyVisitHistoriesResponse(Long total, List<VisitHistoryItem> list) {
    }

    public record ListVisitHistoriesByPatientRequest(
            @JsonAlias({"patientAccountId", "patient_account_id"}) Long patientAccountId,
            Integer pageNo,
            Integer pageSize
    ) {
    }

    public record ListVisitHistoriesByPatientResponse(Long total, List<VisitHistoryItem> list) {
    }

    public record GetVisitHistoryByIdForDoctorRequest(Long id) {
    }

    public record DoctorPatientArchiveItem(
            @JsonAlias({"patientAccountId", "patient_account_id"}) Long patientAccountId,
            @JsonAlias({"patientName", "patient_name"}) String patientName,
            @JsonAlias({"patientRoleId", "patient_role_id"}) String patientRoleId,
            @JsonAlias({"latestVisitDate", "latest_visit_date"}) Long latestVisitDate
    ) {
    }

    public record ListMyPatientsRequest(
            @JsonAlias({"patientNameKeyword", "patient_name_keyword"}) String patientNameKeyword,
            Integer pageNo,
            Integer pageSize
    ) {
    }

    public record ListMyPatientsResponse(Long total, List<DoctorPatientArchiveItem> list) {
    }

    public record GetMyVisitHistoryByIdRequest(Long id) {
    }
}
