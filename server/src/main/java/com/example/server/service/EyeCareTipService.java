package com.example.server.service;

import com.example.server.dto.EyeCareTipDto;
import com.example.server.model.EyeCareTip;
import com.example.server.repository.EyeCareTipRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class EyeCareTipService {
    private final EyeCareTipRepository eyeCareTipRepository;

    public EyeCareTipService(EyeCareTipRepository eyeCareTipRepository) {
        this.eyeCareTipRepository = eyeCareTipRepository;
    }

    public EyeCareTipDto.ListEyeCareTipsResponse list(EyeCareTipDto.ListEyeCareTipsRequest req) {
        int pageNo = Math.max(1, req == null || req.pageNo() == null ? 1 : req.pageNo());
        int pageSize = Math.min(100, Math.max(1, req == null || req.pageSize() == null ? 20 : req.pageSize()));
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);

        long total = eyeCareTipRepository.count();
        List<EyeCareTip> rows = eyeCareTipRepository.findByOrderByIdDesc(pageable).getContent();
        List<EyeCareTipDto.EyeCareTipItem> list = rows.stream()
                .map(t -> new EyeCareTipDto.EyeCareTipItem(t.getId(), t.getTitle(), t.getContent(), t.getCreatedAt()))
                .collect(Collectors.toList());
        return new EyeCareTipDto.ListEyeCareTipsResponse(total, list);
    }

    @Transactional
    public EyeCareTipDto.CreateEyeCareTipResponse create(EyeCareTipDto.CreateEyeCareTipRequest req) {
        String title = req == null ? null : normalize(req.title());
        String content = req == null ? null : normalize(req.content());
        if (content == null) {
            throw new IllegalArgumentException("INVALID_CONTENT");
        }
        if (title == null) {
            title = "护眼提示";
        }
        Optional<EyeCareTip> existing = eyeCareTipRepository.findByTitle(title);
        if (existing.isPresent()) {
            title = title + " " + System.currentTimeMillis();
        }
        long now = System.currentTimeMillis();
        EyeCareTip saved = eyeCareTipRepository.save(new EyeCareTip(null, title, content, now));
        return new EyeCareTipDto.CreateEyeCareTipResponse(saved.getId());
    }

    @Transactional
    public EyeCareTipDto.DeleteEyeCareTipResponse delete(EyeCareTipDto.DeleteEyeCareTipRequest req) {
        Long id = req == null ? null : req.id();
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("INVALID_ID");
        }
        if (!eyeCareTipRepository.existsById(id)) {
            throw new IllegalArgumentException("NOT_FOUND");
        }
        eyeCareTipRepository.deleteById(id);
        return new EyeCareTipDto.DeleteEyeCareTipResponse(true);
    }

    private static String normalize(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}

