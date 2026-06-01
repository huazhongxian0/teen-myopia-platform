package com.example.server.repository;

import com.example.server.model.RiskWarning;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RiskWarningRepository extends JpaRepository<RiskWarning, Long> {
    Page<RiskWarning> findByStudentAccountIdOrderByIdDesc(Long studentAccountId, Pageable pageable);

    long countByStudentAccountId(Long studentAccountId);

    Optional<RiskWarning> findByIdAndStudentAccountId(Long id, Long studentAccountId);

    List<RiskWarning> findByStudentAccountIdAndStatusOrderByIdDesc(Long studentAccountId, String status);

    List<RiskWarning> findByLevelAndStatusOrderByIdDesc(String level, String status);

    long countByLevel(String level);

    long countByStatus(String status);

    List<RiskWarning> findByStudentAccountIdInOrderByIdDesc(List<Long> studentAccountIds);
}
