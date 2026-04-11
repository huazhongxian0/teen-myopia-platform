package com.example.server.repository;

import com.example.server.model.VisitRegistration;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VisitRegistrationRepository extends JpaRepository<VisitRegistration, Long> {
    Optional<VisitRegistration> findByDoctorAccountIdAndPatientAccountIdAndVisitDate(Long doctorAccountId, Long patientAccountId, Long visitDate);

    Page<VisitRegistration> findByDoctorAccountIdAndVisitDateOrderByIdDesc(Long doctorAccountId, Long visitDate, Pageable pageable);

    long countByDoctorAccountIdAndVisitDate(Long doctorAccountId, Long visitDate);

    Page<VisitRegistration> findByDoctorAccountIdOrderByIdDesc(Long doctorAccountId, Pageable pageable);

    long countByDoctorAccountId(Long doctorAccountId);

    Page<VisitRegistration> findByDoctorAccountIdAndVisitDateBetweenOrderByIdDesc(Long doctorAccountId, Long startVisitDate, Long endVisitDate, Pageable pageable);

    long countByDoctorAccountIdAndVisitDateBetween(Long doctorAccountId, Long startVisitDate, Long endVisitDate);

    Page<VisitRegistration> findByPatientAccountIdOrderByIdDesc(Long patientAccountId, Pageable pageable);

    long countByPatientAccountId(Long patientAccountId);

    Page<VisitRegistration> findByPatientAccountIdAndVisitDateOrderByIdDesc(Long patientAccountId, Long visitDate, Pageable pageable);

    long countByPatientAccountIdAndVisitDate(Long patientAccountId, Long visitDate);
}
