DROP DATABASE IF EXISTS `eyesManager`;

CREATE DATABASE IF NOT EXISTS `eyesManager`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `eyesManager`;

CREATE TABLE IF NOT EXISTS `auth` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(255) NOT NULL,
  `description` VARCHAR(1024) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `auth` (`key`)
SELECT 'base'
WHERE NOT EXISTS (SELECT 1 FROM `auth` WHERE `key` = 'base');

INSERT INTO `auth` (`key`)
SELECT 'base123'
WHERE NOT EXISTS (SELECT 1 FROM `auth` WHERE `key` = 'base123');

INSERT INTO `auth` (`key`, `description`)
SELECT 'manager', '后台管理入口'
WHERE NOT EXISTS (SELECT 1 FROM `auth` WHERE `key` = 'manager');

INSERT INTO `auth` (`key`, `description`)
SELECT 'manager_page', '管理员端页面'
WHERE NOT EXISTS (SELECT 1 FROM `auth` WHERE `key` = 'manager_page');

INSERT INTO `auth` (`key`, `description`)
SELECT 'doctor_page', '医生端页面'
WHERE NOT EXISTS (SELECT 1 FROM `auth` WHERE `key` = 'doctor_page');

INSERT INTO `auth` (`key`, `description`)
SELECT 'teacher_page', '老师端页面'
WHERE NOT EXISTS (SELECT 1 FROM `auth` WHERE `key` = 'teacher_page');

INSERT INTO `auth` (`key`, `description`)
SELECT 'student_page', '学生端页面'
WHERE NOT EXISTS (SELECT 1 FROM `auth` WHERE `key` = 'student_page');

INSERT INTO `auth` (`key`, `description`)
SELECT 'create_class_on_account', '新建账号时建立班级表'
WHERE NOT EXISTS (SELECT 1 FROM `auth` WHERE `key` = 'create_class_on_account');

CREATE TABLE IF NOT EXISTS `role` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `table_id` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `role` (`table_id`)
SELECT 'admin'
WHERE NOT EXISTS (SELECT 1 FROM `role` WHERE `table_id` = 'admin');

INSERT INTO `role` (`table_id`)
SELECT 'user'
WHERE NOT EXISTS (SELECT 1 FROM `role` WHERE `table_id` = 'user');

CREATE TABLE IF NOT EXISTS `account` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `role_id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `account_name` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `phone_number` VARCHAR(32) NOT NULL,
  `avator_url` VARCHAR(1024) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `classmap` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `teacher` VARCHAR(255) NOT NULL,
  `classtablename` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `eyessight` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `od` BIGINT NOT NULL,
  `os` BIGINT NOT NULL,
  `eyes_time` BIGINT NOT NULL,
  `has_glasses` BOOLEAN NOT NULL DEFAULT 0,
  `people_id` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_eyessight_people_id` (`people_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `visit_registration` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `doctor_account_id` BIGINT NOT NULL,
  `patient_account_id` BIGINT NOT NULL,
  `visit_date` BIGINT NOT NULL,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_visit_registration_doctor_patient_date` (`doctor_account_id`, `patient_account_id`, `visit_date`),
  KEY `idx_visit_registration_doctor_date` (`doctor_account_id`, `visit_date`),
  KEY `idx_visit_registration_patient_date` (`patient_account_id`, `visit_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `visit_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `registration_id` BIGINT NULL,
  `doctor_account_id` BIGINT NOT NULL,
  `patient_account_id` BIGINT NOT NULL,
  `visit_date` BIGINT NOT NULL,
  `od` BIGINT NOT NULL,
  `os` BIGINT NOT NULL,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_visit_history_patient` (`patient_account_id`),
  KEY `idx_visit_history_doctor_patient` (`doctor_account_id`, `patient_account_id`),
  KEY `idx_visit_history_doctor_date` (`doctor_account_id`, `visit_date`),
  KEY `idx_visit_history_patient_date` (`patient_account_id`, `visit_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `eye_care_tip` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `content` VARCHAR(2048) NOT NULL,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_eye_care_tip_title` (`title`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `eye_care_tip` (`title`, `content`, `created_at`)
SELECT '用眼 20-20-20 法则', '每用眼 20 分钟，眺望 20 英尺（约 6 米）外 20 秒，让睫状肌放松。', CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED)
WHERE NOT EXISTS (SELECT 1 FROM `eye_care_tip` WHERE `title` = '用眼 20-20-20 法则');

INSERT INTO `eye_care_tip` (`title`, `content`, `created_at`)
SELECT '保持正确读写距离', '眼睛与书本距离保持 33-35 厘米；胸部离桌沿一拳；手指离笔尖一寸。', CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED)
WHERE NOT EXISTS (SELECT 1 FROM `eye_care_tip` WHERE `title` = '保持正确读写距离');

INSERT INTO `eye_care_tip` (`title`, `content`, `created_at`)
SELECT '增加户外活动时间', '每天累计户外活动不少于 2 小时，自然光照有助于延缓近视发生与发展。', CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED)
WHERE NOT EXISTS (SELECT 1 FROM `eye_care_tip` WHERE `title` = '增加户外活动时间');

INSERT INTO `eye_care_tip` (`title`, `content`, `created_at`)
SELECT '减少电子屏幕时长', '连续使用电子屏幕不宜超过 30-40 分钟，注意眨眼与调整屏幕亮度。', CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED)
WHERE NOT EXISTS (SELECT 1 FROM `eye_care_tip` WHERE `title` = '减少电子屏幕时长');

INSERT INTO `eye_care_tip` (`title`, `content`, `created_at`)
SELECT '保证睡眠与照明', '规律作息保证充足睡眠；读写环境照明均匀柔和，避免强光直射与暗光用眼。', CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED)
WHERE NOT EXISTS (SELECT 1 FROM `eye_care_tip` WHERE `title` = '保证睡眠与照明');

-- 学校表
CREATE TABLE IF NOT EXISTS `school` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `table_name` VARCHAR(255) NOT NULL,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 插入角色
INSERT INTO `role` (`table_id`)
SELECT 'doctor'
WHERE NOT EXISTS (SELECT 1 FROM `role` WHERE `table_id` = 'doctor');

INSERT INTO `role` (`table_id`)
SELECT 'teacher'
WHERE NOT EXISTS (SELECT 1 FROM `role` WHERE `table_id` = 'teacher');

INSERT INTO `role` (`table_id`)
SELECT 'student'
WHERE NOT EXISTS (SELECT 1 FROM `role` WHERE `table_id` = 'student');

-- 创建角色权限表
CREATE TABLE IF NOT EXISTS `user_admin` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `auth_code` BIGINT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_doctor` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `auth_code` BIGINT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_teacher` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `auth_code` BIGINT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_student` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `auth_code` BIGINT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 为 admin 角色关联权限
INSERT INTO `user_admin` (`name`, `auth_code`)
SELECT 'base', a.id
FROM `auth` a
WHERE a.`key` = 'base'
  AND NOT EXISTS (SELECT 1 FROM `user_admin` WHERE `auth_code` = a.id);

INSERT INTO `user_admin` (`name`, `auth_code`)
SELECT 'manager', a.id
FROM `auth` a
WHERE a.`key` = 'manager'
  AND NOT EXISTS (SELECT 1 FROM `user_admin` WHERE `auth_code` = a.id);

INSERT INTO `user_admin` (`name`, `auth_code`)
SELECT 'manager_page', a.id
FROM `auth` a
WHERE a.`key` = 'manager_page'
  AND NOT EXISTS (SELECT 1 FROM `user_admin` WHERE `auth_code` = a.id);

-- 为 doctor 角色关联权限
INSERT INTO `user_doctor` (`name`, `auth_code`)
SELECT 'base', a.id
FROM `auth` a
WHERE a.`key` = 'base'
  AND NOT EXISTS (SELECT 1 FROM `user_doctor` WHERE `auth_code` = a.id);

INSERT INTO `user_doctor` (`name`, `auth_code`)
SELECT 'doctor_page', a.id
FROM `auth` a
WHERE a.`key` = 'doctor_page'
  AND NOT EXISTS (SELECT 1 FROM `user_doctor` WHERE `auth_code` = a.id);

-- 为 teacher 角色关联权限
INSERT INTO `user_teacher` (`name`, `auth_code`)
SELECT 'base', a.id
FROM `auth` a
WHERE a.`key` = 'base'
  AND NOT EXISTS (SELECT 1 FROM `user_teacher` WHERE `auth_code` = a.id);

INSERT INTO `user_teacher` (`name`, `auth_code`)
SELECT 'teacher_page', a.id
FROM `auth` a
WHERE a.`key` = 'teacher_page'
  AND NOT EXISTS (SELECT 1 FROM `user_teacher` WHERE `auth_code` = a.id);

-- 为 student 角色关联权限
INSERT INTO `user_student` (`name`, `auth_code`)
SELECT 'base', a.id
FROM `auth` a
WHERE a.`key` = 'base'
  AND NOT EXISTS (SELECT 1 FROM `user_student` WHERE `auth_code` = a.id);

INSERT INTO `user_student` (`name`, `auth_code`)
SELECT 'student_page', a.id
FROM `auth` a
WHERE a.`key` = 'student_page'
  AND NOT EXISTS (SELECT 1 FROM `user_student` WHERE `auth_code` = a.id);

INSERT INTO `account` (`role_id`, `name`, `account_name`, `password`, `phone_number`, `avator_url`)
VALUES ('admin', '超级管理员', 'root', '123456', '18800000000', 'https://example.com/avatar/root.png');

INSERT INTO `account` (`role_id`, `name`, `account_name`, `password`, `phone_number`, `avator_url`)
VALUES ('doctor', '张医生', 'doctor', '123456', '18800000001', 'https://example.com/avatar/doctor.png');

INSERT INTO `account` (`role_id`, `name`, `account_name`, `password`, `phone_number`, `avator_url`)
VALUES ('teacher', '李老师', 'teacher', '123456', '18800000002', 'https://example.com/avatar/teacher.png');

INSERT INTO `account` (`role_id`, `name`, `account_name`, `password`, `phone_number`, `avator_url`)
VALUES ('student', '王同学', 'student', '123456', '18800000003', 'https://example.com/avatar/student.png');

INSERT INTO `eyessight` (`od`, `os`, `eyes_time`, `has_glasses`, `people_id`)
SELECT 0, 0, CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED), 0, a.id
FROM `account` a
WHERE a.`account_name` = 'root'
  AND NOT EXISTS (SELECT 1 FROM `eyessight` e WHERE e.`people_id` = a.`id`);

INSERT INTO `eyessight` (`od`, `os`, `eyes_time`, `has_glasses`, `people_id`)
SELECT 0, 0, CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED), 0, a.id
FROM `account` a
WHERE a.`account_name` = 'doctor'
  AND NOT EXISTS (SELECT 1 FROM `eyessight` e WHERE e.`people_id` = a.`id`);

INSERT INTO `eyessight` (`od`, `os`, `eyes_time`, `has_glasses`, `people_id`)
SELECT 0, 0, CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED), 0, a.id
FROM `account` a
WHERE a.`account_name` = 'teacher'
  AND NOT EXISTS (SELECT 1 FROM `eyessight` e WHERE e.`people_id` = a.`id`);

INSERT INTO `eyessight` (`od`, `os`, `eyes_time`, `has_glasses`, `people_id`)
SELECT 0, 0, CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED), 0, a.id
FROM `account` a
WHERE a.`account_name` = 'student'
  AND NOT EXISTS (SELECT 1 FROM `eyessight` e WHERE e.`people_id` = a.`id`);
