package com.example.server.repository;

import com.example.server.model.VisitHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VisitHistoryRepository extends JpaRepository<VisitHistory, Long> {
    Page<VisitHistory> findByPatientAccountIdOrderByIdDesc(Long patientAccountId, Pageable pageable);

    long countByPatientAccountId(Long patientAccountId);

    Optional<VisitHistory> findByIdAndPatientAccountId(Long id, Long patientAccountId);

    Page<VisitHistory> findByDoctorAccountIdAndPatientAccountIdOrderByIdDesc(Long doctorAccountId, Long patientAccountId, Pageable pageable);

    long countByDoctorAccountIdAndPatientAccountId(Long doctorAccountId, Long patientAccountId);

    Optional<VisitHistory> findByIdAndDoctorAccountId(Long id, Long doctorAccountId);
}
