package com.example.server.repository;

import com.example.server.model.EyeCareTip;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EyeCareTipRepository extends JpaRepository<EyeCareTip, Long> {
    Page<EyeCareTip> findByOrderByIdDesc(Pageable pageable);

    long countBy();

    Optional<EyeCareTip> findByTitle(String title);
}

