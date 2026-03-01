-- 演示数据（与 mock-data.json 一致）
-- 在 supabase db reset 或首次部署后执行

INSERT INTO major (id, name, code) VALUES
  (1, '计算机', 'CS'),
  (2, '商科', 'BUS');

INSERT INTO "user" (id, username, password_hash, role, display_name) VALUES
  (1, 'admin', 'hash_demo_admin', 'admin', '教务处管理员'),
  (2, 'teacher_saas', 'hash_demo', 'teacher', '张老师'),
  (3, 'teacher_py', 'hash_demo', 'teacher', '李老师'),
  (4, 'student01', 'hash_demo', 'student', '学生01'),
  (5, 'student02', 'hash_demo', 'student', '学生02'),
  (6, 'student03', 'hash_demo', 'student', '学生03'),
  (7, 'student04', 'hash_demo', 'student', '学生04'),
  (8, 'student05', 'hash_demo', 'student', '学生05'),
  (9, 'student06', 'hash_demo', 'student', '学生06'),
  (10, 'student07', 'hash_demo', 'student', '学生07'),
  (11, 'student08', 'hash_demo', 'student', '学生08'),
  (12, 'student09', 'hash_demo', 'student', '学生09'),
  (13, 'student10', 'hash_demo', 'student', '学生10'),
  (14, 'student11', 'hash_demo', 'student', '学生11'),
  (15, 'student12', 'hash_demo', 'student', '学生12'),
  (16, 'student13', 'hash_demo', 'student', '学生13'),
  (17, 'student14', 'hash_demo', 'student', '学生14'),
  (18, 'student15', 'hash_demo', 'student', '学生15'),
  (19, 'student16', 'hash_demo', 'student', '学生16'),
  (20, 'student17', 'hash_demo', 'student', '学生17'),
  (21, 'student18', 'hash_demo', 'student', '学生18'),
  (22, 'student19', 'hash_demo', 'student', '学生19'),
  (23, 'student20', 'hash_demo', 'student', '学生20'),
  (24, 'student21', 'hash_demo', 'student', '学生21'),
  (25, 'student22', 'hash_demo', 'student', '学生22'),
  (26, 'student23', 'hash_demo', 'student', '学生23'),
  (27, 'student24', 'hash_demo', 'student', '学生24'),
  (28, 'student25', 'hash_demo', 'student', '学生25'),
  (29, 'student26', 'hash_demo', 'student', '学生26'),
  (30, 'student27', 'hash_demo', 'student', '学生27'),
  (31, 'student28', 'hash_demo', 'student', '学生28'),
  (32, 'student29', 'hash_demo', 'student', '学生29'),
  (33, 'student30', 'hash_demo', 'student', '学生30'),
  (34, 'student31', 'hash_demo', 'student', '学生31'),
  (35, 'student32', 'hash_demo', 'student', '学生32'),
  (36, 'student33', 'hash_demo', 'student', '学生33'),
  (37, 'student34', 'hash_demo', 'student', '学生34'),
  (38, 'student35', 'hash_demo', 'student', '学生35'),
  (39, 'student36', 'hash_demo', 'student', '学生36'),
  (40, 'student37', 'hash_demo', 'student', '学生37'),
  (41, 'student38', 'hash_demo', 'student', '学生38'),
  (42, 'student39', 'hash_demo', 'student', '学生39'),
  (43, 'student40', 'hash_demo', 'student', '学生40'),
  (44, 'student41', 'hash_demo', 'student', '学生41'),
  (45, 'student42', 'hash_demo', 'student', '学生42'),
  (46, 'student43', 'hash_demo', 'student', '学生43'),
  (47, 'student44', 'hash_demo', 'student', '学生44'),
  (48, 'student45', 'hash_demo', 'student', '学生45'),
  (49, 'student46', 'hash_demo', 'student', '学生46'),
  (50, 'student47', 'hash_demo', 'student', '学生47'),
  (51, 'student48', 'hash_demo', 'student', '学生48'),
  (52, 'student49', 'hash_demo', 'student', '学生49'),
  (53, 'student50', 'hash_demo', 'student', '学生50');

INSERT INTO teacher (id, user_id, name, employee_no) VALUES
  (1, 2, '张老师', 'T001'),
  (2, 3, '李老师', 'T002');

INSERT INTO student (id, user_id, name, student_no, major_id) VALUES
  (1, 4, '学生01', 'S001', 1), (2, 5, '学生02', 'S002', 1), (3, 6, '学生03', 'S003', 1), (4, 7, '学生04', 'S004', 1), (5, 8, '学生05', 'S005', 1),
  (6, 9, '学生06', 'S006', 1), (7, 10, '学生07', 'S007', 1), (8, 11, '学生08', 'S008', 1), (9, 12, '学生09', 'S009', 1), (10, 13, '学生10', 'S010', 1),
  (11, 14, '学生11', 'S011', 1), (12, 15, '学生12', 'S012', 1), (13, 16, '学生13', 'S013', 1), (14, 17, '学生14', 'S014', 1), (15, 18, '学生15', 'S015', 1),
  (16, 19, '学生16', 'S016', 1), (17, 20, '学生17', 'S017', 1), (18, 21, '学生18', 'S018', 1), (19, 22, '学生19', 'S019', 1), (20, 23, '学生20', 'S020', 1),
  (21, 24, '学生21', 'S021', 1), (22, 25, '学生22', 'S022', 1), (23, 26, '学生23', 'S023', 1), (24, 27, '学生24', 'S024', 1), (25, 28, '学生25', 'S025', 1),
  (26, 29, '学生26', 'S026', 1), (27, 30, '学生27', 'S027', 1), (28, 31, '学生28', 'S028', 1), (29, 32, '学生29', 'S029', 1), (30, 33, '学生30', 'S030', 1),
  (31, 34, '学生31', 'S031', 1), (32, 35, '学生32', 'S032', 1), (33, 36, '学生33', 'S033', 1), (34, 37, '学生34', 'S034', 1), (35, 38, '学生35', 'S035', 1),
  (36, 39, '学生36', 'S036', 1), (37, 40, '学生37', 'S037', 1), (38, 41, '学生38', 'S038', 1), (39, 42, '学生39', 'S039', 1), (40, 43, '学生40', 'S040', 1),
  (41, 44, '学生41', 'S041', 1), (42, 45, '学生42', 'S042', 1), (43, 46, '学生43', 'S043', 1), (44, 47, '学生44', 'S044', 1), (45, 48, '学生45', 'S045', 1),
  (46, 49, '学生46', 'S046', 1), (47, 50, '学生47', 'S047', 1), (48, 51, '学生48', 'S048', 1), (49, 52, '学生49', 'S049', 1), (50, 53, '学生50', 'S050', 1);

INSERT INTO course (id, major_id, teacher_id, name, code) VALUES
  (1, 1, 1, 'SAAS设计', 'CS-SAAS'),
  (2, 1, 2, 'python编程', 'CS-PY');

INSERT INTO section (id, course_id, name) VALUES
  (1, 1, 'section1'),
  (2, 1, 'section2'),
  (3, 2, 'section1'),
  (4, 2, 'section2');

INSERT INTO section_schedule (id, section_id, day_of_week, start_time, end_time, room, valid_from, valid_to) VALUES
  (1, 1, 1, '08:30', '11:30', '01', '2026-01-04', '2026-05-01'),
  (2, 2, 2, '08:30', '11:30', '02', '2026-01-04', '2026-05-01'),
  (3, 3, 3, '08:30', '11:30', '03', '2026-01-04', '2026-05-01'),
  (4, 4, 4, '08:30', '11:30', '04', '2026-01-04', '2026-05-01');

INSERT INTO enrollment (id, student_id, section_id) VALUES
  (1, 1, 1), (2, 1, 3), (3, 2, 1), (4, 2, 3), (5, 3, 1), (6, 3, 3), (7, 4, 1), (8, 4, 3), (9, 5, 1), (10, 5, 3),
  (11, 6, 1), (12, 6, 3), (13, 7, 1), (14, 7, 3), (15, 8, 1), (16, 8, 3), (17, 9, 1), (18, 9, 3), (19, 10, 1), (20, 10, 3),
  (21, 11, 1), (22, 12, 1), (23, 13, 1), (24, 14, 1), (25, 15, 1), (26, 16, 1), (27, 17, 1), (28, 18, 1), (29, 19, 1), (30, 20, 1),
  (31, 21, 2), (32, 22, 2), (33, 23, 2), (34, 24, 2), (35, 25, 2), (36, 26, 2), (37, 27, 2), (38, 28, 2), (39, 29, 2), (40, 30, 2),
  (41, 31, 3), (42, 32, 3), (43, 33, 3), (44, 34, 3), (45, 35, 3), (46, 36, 3), (47, 37, 3), (48, 38, 3), (49, 39, 3), (50, 40, 3),
  (51, 41, 4), (52, 42, 4), (53, 43, 4), (54, 44, 4), (55, 45, 4), (56, 46, 4), (57, 47, 4), (58, 48, 4), (59, 49, 4), (60, 50, 4);

SELECT setval(pg_get_serial_sequence('major', 'id'), (SELECT COALESCE(MAX(id), 1) FROM major));
SELECT setval(pg_get_serial_sequence('"user"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "user"));
SELECT setval(pg_get_serial_sequence('teacher', 'id'), (SELECT COALESCE(MAX(id), 1) FROM teacher));
SELECT setval(pg_get_serial_sequence('student', 'id'), (SELECT COALESCE(MAX(id), 1) FROM student));
SELECT setval(pg_get_serial_sequence('course', 'id'), (SELECT COALESCE(MAX(id), 1) FROM course));
SELECT setval(pg_get_serial_sequence('section', 'id'), (SELECT COALESCE(MAX(id), 1) FROM section));
SELECT setval(pg_get_serial_sequence('section_schedule', 'id'), (SELECT COALESCE(MAX(id), 1) FROM section_schedule));
SELECT setval(pg_get_serial_sequence('enrollment', 'id'), (SELECT COALESCE(MAX(id), 1) FROM enrollment));
