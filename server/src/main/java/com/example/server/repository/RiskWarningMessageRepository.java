package com.example.server.repository;

import com.example.server.model.RiskWarningMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RiskWarningMessageRepository extends JpaRepository<RiskWarningMessage, Long> {
    List<RiskWarningMessage> findByReceiverAccountIdOrderByIdDesc(Long receiverAccountId);

    long countByReceiverAccountIdAndReadStatus(Long receiverAccountId, Boolean readStatus);

    Optional<RiskWarningMessage> findByIdAndReceiverAccountId(Long id, Long receiverAccountId);

    List<RiskWarningMessage> findByWarningIdInOrderByIdDesc(List<Long> warningIds);

    List<RiskWarningMessage> findByReceiverRoleOrderByIdDesc(String receiverRole);
}
