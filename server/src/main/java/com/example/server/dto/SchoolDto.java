package com.example.server.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.List;

public class SchoolDto {
    public record SchoolItem(
            Long id,
            String name,
            @JsonAlias({"createdAt", "created_at"}) Long createdAt
    ) {
    }

    public record ClassInfoItem(
            Long id,
            @JsonAlias({"schoolId", "school_id"}) Long schoolId,
            String name,
            @JsonAlias({"className", "class_name"}) String className,
            @JsonAlias({"studentTableName", "student_table_name"}) String studentTableName,
            @JsonAlias({"headTeacherAccountId", "head_teacher_account_id"}) Long headTeacherAccountId,
            @JsonAlias({"createdAt", "created_at"}) Long createdAt
    ) {
    }

    public record ListSchoolsRequest(Integer pageNo, Integer pageSize, String keyword) {
    }

    public record ListSchoolsResponse(Long total, List<SchoolItem> list) {
    }

    public record CreateSchoolRequest(String name) {
    }

    public record UpdateSchoolRequest(Long id, String name) {
    }

    public record DeleteSchoolRequest(Long id) {
    }

    public record ListClassesRequest(
            @JsonAlias({"schoolId", "school_id"}) Long schoolId,
            Integer pageNo,
            Integer pageSize,
            String keyword
    ) {
    }

    public record ListClassesResponse(Long total, List<ClassInfoItem> list) {
    }

    public record CreateClassRequest(
            @JsonAlias({"schoolId", "school_id"}) Long schoolId,
            String name
    ) {
    }

    public record UpdateClassRequest(
            Long id,
            String name,
            @JsonAlias({"headTeacherAccountId", "head_teacher_account_id"}) Long headTeacherAccountId
    ) {
    }

    public record DeleteClassRequest(Long id) {
    }

    public record ListTeacherClassesRequest(
            @JsonAlias({"teacherAccountId", "teacher_account_id"}) Long teacherAccountId
    ) {
    }

    public record ListTeacherClassesResponse(List<ClassInfoItem> list) {
    }

    public record StudentItem(
            Long id,
            @JsonAlias({"accountId", "account_id"}) Long accountId
    ) {
    }

    public record ListStudentsRequest(
            @JsonAlias({"classId", "class_id"}) Long classId,
            Integer pageNo,
            Integer pageSize
    ) {
    }

    public record ListStudentsResponse(Long total, List<StudentItem> list) {
    }

    public record CreateStudentRequest(
            @JsonAlias({"classId", "class_id"}) Long classId,
            @JsonAlias({"accountId", "account_id"}) Long accountId
    ) {
    }

    public record DeleteStudentRequest(
            @JsonAlias({"classId", "class_id"}) Long classId,
            @JsonAlias({"studentId", "student_id"}) Long studentId
    ) {
    }

    public record SuccessResponse(boolean success) {
    }

    public record ListTeacherEyeSightRequest(
            @JsonAlias({"teacherAccountId", "teacher_account_id"}) Long teacherAccountId,
            @JsonAlias({"classId", "class_id"}) Long classId
    ) {
    }

    public record TeacherEyeSightItem(
            @JsonAlias({"classId", "class_id"}) Long classId,
            @JsonAlias({"className", "class_name"}) String className,
            @JsonAlias({"studentAccountId", "student_account_id"}) Long studentAccountId,
            @JsonAlias({"studentName", "student_name"}) String studentName,
            Long od,
            Long os,
            @JsonAlias({"eyesTime", "eyes_time"}) Long eyesTime
    ) {
    }

    public record ListTeacherEyeSightResponse(List<TeacherEyeSightItem> list) {
    }
}
