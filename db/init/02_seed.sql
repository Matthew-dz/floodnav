-- ============ Dữ liệu mẫu (55 điểm ngập trọng điểm Hà Nội) ============
-- LƯU Ý: toạ độ ST_MakePoint(KINH ĐỘ, VĨ ĐỘ) -> chú ý thứ tự lng, lat

INSERT INTO users (name, vehicle) VALUES
  ('Demo Xe máy', 'motorbike'),
  ('Demo Ô tô',   'car')
ON CONFLICT DO NOTHING;

INSERT INTO flood_points (name, geom, sensor_id, threshold_cm) VALUES
  -- Cầu Giấy
  ('Nguyễn Khánh Toàn (Cầu Giấy)',       ST_SetSRID(ST_MakePoint(105.7955, 21.0385), 4326), 'SENSOR-001', 20),
  ('Xuân Thủy - Cầu Giấy',                ST_SetSRID(ST_MakePoint(105.7820, 21.0370), 4326), 'SENSOR-002', 20),
  ('Trần Duy Hưng (Cầu Giấy)',           ST_SetSRID(ST_MakePoint(105.8010, 21.0105), 4326), 'SENSOR-003', 20),
  ('Hoàng Quốc Việt (Cầu Giấy)',         ST_SetSRID(ST_MakePoint(105.7925, 21.0465), 4326), 'SENSOR-004', 20),
  ('Duy Tân (Khu CNTT Cầu Giấy)',        ST_SetSRID(ST_MakePoint(105.7830, 21.0310), 4326), 'SENSOR-005', 20),
  ('Hoa Bằng - Yên Hòa (Cầu Giấy)',      ST_SetSRID(ST_MakePoint(105.7950, 21.0220), 4326), 'SENSOR-006', 20),
  ('Trung Kính - Mạc Thái Tổ',            ST_SetSRID(ST_MakePoint(105.7915, 21.0160), 4326), 'SENSOR-007', 20),
  -- Đống Đa
  ('Chùa Bộc (Đống Đa)',                  ST_SetSRID(ST_MakePoint(105.8260, 21.0085), 4326), 'SENSOR-008', 20),
  ('Nguyễn Chí Thanh (Đống Đa)',          ST_SetSRID(ST_MakePoint(105.8105, 21.0255), 4326), 'SENSOR-009', 20),
  ('Láng Hạ (Đống Đa)',                  ST_SetSRID(ST_MakePoint(105.8120, 21.0115), 4326), 'SENSOR-010', 20),
  ('Thái Hà - Tây Sơn (Đống Đa)',         ST_SetSRID(ST_MakePoint(105.8190, 21.0145), 4326), 'SENSOR-011', 20),
  ('Tôn Đức Thắng (Văn Miếu)',            ST_SetSRID(ST_MakePoint(105.8320, 21.0250), 4326), 'SENSOR-012', 20),
  ('Trường Chinh (BV Không Quân)',        ST_SetSRID(ST_MakePoint(105.8285, 21.0015), 4326), 'SENSOR-013', 20),
  ('Khâm Thiên - Lê Duẩn',                ST_SetSRID(ST_MakePoint(105.8385, 21.0185), 4326), 'SENSOR-014', 20),
  ('Huỳnh Thúc Kháng - Nguyên Hồng',      ST_SetSRID(ST_MakePoint(105.8100, 21.0175), 4326), 'SENSOR-015', 20),
  -- Ba Đình
  ('Đội Cấn (Cống ngõ 209 Đội Cấn)',     ST_SetSRID(ST_MakePoint(105.8235, 21.0362), 4326), 'SENSOR-016', 20),
  ('Liễu Giai - Vạn Phúc',                ST_SetSRID(ST_MakePoint(105.8152, 21.0340), 4326), 'SENSOR-017', 20),
  ('Cao Bá Quát (Cty Môi Trường ĐT)',     ST_SetSRID(ST_MakePoint(105.8390, 21.0315), 4326), 'SENSOR-018', 20),
  ('Ngọc Khánh (BV Phụ Sản)',             ST_SetSRID(ST_MakePoint(105.8115, 21.0298), 4326), 'SENSOR-019', 20),
  ('Quán Thánh - Cửa Bắc',                ST_SetSRID(ST_MakePoint(105.8420, 21.0415), 4326), 'SENSOR-020', 20),
  ('Nguyễn Trường Tộ - Hàng Than',        ST_SetSRID(ST_MakePoint(105.8435, 21.0440), 4326), 'SENSOR-021', 20),
  -- Hoàn Kiếm
  ('Tràng Tiền - Đinh Tiên Hoàng (Bờ Hồ)', ST_SetSRID(ST_MakePoint(105.8540, 21.0255), 4326), 'SENSOR-022', 20),
  ('Phùng Hưng - Bát Đàn (Phố Cổ)',      ST_SetSRID(ST_MakePoint(105.8465, 21.0345), 4326), 'SENSOR-023', 20),
  ('Lý Thường Kiệt - Phan Bội Châu',      ST_SetSRID(ST_MakePoint(105.8435, 21.0260), 4326), 'SENSOR-024', 20),
  ('Đường Thành - Ngõ Trạm',              ST_SetSRID(ST_MakePoint(105.8460, 21.0322), 4326), 'SENSOR-025', 20),
  ('Tạ Hiện - Lương Ngọc Quyến',          ST_SetSRID(ST_MakePoint(105.8525, 21.0350), 4326), 'SENSOR-026', 20),
  ('Thợ Nhuộm - Hai Bà Trưng',            ST_SetSRID(ST_MakePoint(105.8450, 21.0245), 4326), 'SENSOR-027', 20),
  -- Hai Bà Trưng
  ('Minh Khai (Chân cầu Vĩnh Tuy)',      ST_SetSRID(ST_MakePoint(105.8670, 20.9995), 4326), 'SENSOR-028', 20),
  ('Lạc Trung (Đài TH Hà Nội)',           ST_SetSRID(ST_MakePoint(105.8635, 21.0040), 4326), 'SENSOR-029', 20),
  ('Nguyễn Khoái (Dốc Vĩnh Tuy)',         ST_SetSRID(ST_MakePoint(105.8725, 21.0020), 4326), 'SENSOR-030', 20),
  ('Thanh Nhàn (BV Thanh Nhàn)',          ST_SetSRID(ST_MakePoint(105.8545, 21.0065), 4326), 'SENSOR-031', 20),
  ('Đại La - Trần Đại Nghĩa',             ST_SetSRID(ST_MakePoint(105.8440, 20.9985), 4326), 'SENSOR-032', 20),
  ('Phố Huế - Nguyễn Công Trứ',           ST_SetSRID(ST_MakePoint(105.8530, 21.0145), 4326), 'SENSOR-033', 20),
  -- Thanh Xuân
  ('Nguyễn Trãi (Trước ĐHKHTN)',          ST_SetSRID(ST_MakePoint(105.8080, 20.9965), 4326), 'SENSOR-034', 20),
  ('Vương Thừa Vũ - Tô Vĩnh Diện',        ST_SetSRID(ST_MakePoint(105.8205, 21.0005), 4326), 'SENSOR-035', 20),
  ('Triều Khúc - Tân Triều',              ST_SetSRID(ST_MakePoint(105.7975, 20.9840), 4326), 'SENSOR-036', 20),
  ('Lê Văn Lương - Hoàng Đạo Thúy',       ST_SetSRID(ST_MakePoint(105.8035, 21.0070), 4326), 'SENSOR-037', 20),
  ('Quan Nhân - Nhân Chính',              ST_SetSRID(ST_MakePoint(105.8095, 21.0045), 4326), 'SENSOR-038', 20),
  -- Nam Từ Liêm
  ('Phạm Hùng - Mễ Trì',                  ST_SetSRID(ST_MakePoint(105.7770, 21.0280), 4326), 'SENSOR-039', 20),
  ('Lê Đức Thọ (SVĐ Mỹ Đình)',           ST_SetSRID(ST_MakePoint(105.7665, 21.0210), 4326), 'SENSOR-040', 20),
  ('Mễ Trì (The Garden - Keangnam)',      ST_SetSRID(ST_MakePoint(105.7760, 21.0135), 4326), 'SENSOR-041', 20),
  ('Hầm chui Thăng Long (An Khánh)',      ST_SetSRID(ST_MakePoint(105.7485, 21.0010), 4326), 'SENSOR-042', 25),
  ('Tố Hữu - Lương Thế Vinh',             ST_SetSRID(ST_MakePoint(105.7905, 20.9985), 4326), 'SENSOR-043', 20),
  -- Hoàng Mai
  ('Giải Phóng (Trước BX Giáp Bát)',     ST_SetSRID(ST_MakePoint(105.8425, 20.9785), 4326), 'SENSOR-044', 20),
  ('Định Công (Cầu Định Công - Sông Lừ)', ST_SetSRID(ST_MakePoint(105.8340, 20.9875), 4326), 'SENSOR-045', 20),
  ('Tân Mai (Chợ Tân Mai)',               ST_SetSRID(ST_MakePoint(105.8520, 20.9890), 4326), 'SENSOR-046', 20),
  ('Thịnh Liệt - Trương Định',            ST_SetSRID(ST_MakePoint(105.8490, 20.9820), 4326), 'SENSOR-047', 20),
  ('Nguyễn Xiển (Kim Văn Kim Lũ)',        ST_SetSRID(ST_MakePoint(105.8150, 20.9760), 4326), 'SENSOR-048', 20),
  -- Tây Hồ
  ('Thụy Khuê (Dốc Tam Đa)',              ST_SetSRID(ST_MakePoint(105.8210, 21.0440), 4326), 'SENSOR-049', 20),
  ('Trích Sài (Ven Hồ Tây)',              ST_SetSRID(ST_MakePoint(105.8270, 21.0475), 4326), 'SENSOR-050', 20),
  ('Võ Chí Công (Chân cầu Nhật Tân)',     ST_SetSRID(ST_MakePoint(105.8070, 21.0720), 4326), 'SENSOR-051', 20),
  -- Long Biên
  ('Nguyễn Văn Cừ - Ngọc Lâm (Long Biên)', ST_SetSRID(ST_MakePoint(105.8710, 21.0450), 4326), 'SENSOR-052', 20),
  ('Cổ Linh (Chân cầu Vĩnh Tuy - LB)',    ST_SetSRID(ST_MakePoint(105.8920, 21.0180), 4326), 'SENSOR-053', 20),
  -- Hà Đông
  ('Quang Trung - Ga La Khê (Hà Đông)',   ST_SetSRID(ST_MakePoint(105.7650, 20.9650), 4326), 'SENSOR-054', 20),
  ('Yên Nghĩa (Bến xe Yên Nghĩa)',        ST_SetSRID(ST_MakePoint(105.7480, 20.9520), 4326), 'SENSOR-055', 20),
  -- Thanh Trì
  ('Ngọc Hồi - Cầu Ngọc Hồi (Thanh Trì)', ST_SetSRID(ST_MakePoint(105.8570, 20.9320), 4326), 'SENSOR-056', 20),
  ('Phan Trọng Tuệ - Cầu Bươu (Thanh Trì)', ST_SetSRID(ST_MakePoint(105.8285, 20.9575), 4326), 'SENSOR-057', 20),
  ('Vĩnh Quỳnh - Đường 70 (Thanh Trì)',   ST_SetSRID(ST_MakePoint(105.8450, 20.9420), 4326), 'SENSOR-058', 20),
  ('Tả Thanh Oai - Ven Sông Nhuệ',        ST_SetSRID(ST_MakePoint(105.8050, 20.9480), 4326), 'SENSOR-059', 20),
  -- Thường Tín
  ('Thị trấn Thường Tín (Quốc lộ 1A)',    ST_SetSRID(ST_MakePoint(105.8640, 20.8710), 4326), 'SENSOR-060', 20),
  ('Quán Gánh - Duyên Thái (Thường Tín)', ST_SetSRID(ST_MakePoint(105.8600, 20.9020), 4326), 'SENSOR-061', 20),
  -- Thanh Oai
  ('Thị trấn Kim Bài (Thanh Oai - QL 21B)', ST_SetSRID(ST_MakePoint(105.7750, 20.8700), 4326), 'SENSOR-062', 20),
  ('Cầu Đen - Bình Minh (Thanh Oai)',     ST_SetSRID(ST_MakePoint(105.7820, 20.9120), 4326), 'SENSOR-063', 20),
  -- Hoài Đức
  ('Trạm Trôi (Hoài Đức - Quốc lộ 32)',   ST_SetSRID(ST_MakePoint(105.7150, 21.0650), 4326), 'SENSOR-064', 20),
  ('Nam An Khánh - Bảo Sơn (Hoài Đức)',   ST_SetSRID(ST_MakePoint(105.7320, 20.9980), 4326), 'SENSOR-065', 25),
  ('Vân Canh - Đường 70 (Hoài Đức)',      ST_SetSRID(ST_MakePoint(105.7350, 21.0320), 4326), 'SENSOR-066', 20),
  -- Gia Lâm
  ('Trâu Quỳ (Gia Lâm - HV Nông Nghiệp)', ST_SetSRID(ST_MakePoint(105.9320, 21.0080), 4326), 'SENSOR-067', 20),
  ('Ninh Hiệp - Dốc Lã (Gia Lâm)',        ST_SetSRID(ST_MakePoint(105.9380, 21.0850), 4326), 'SENSOR-068', 20),
  ('Đặng Xá - Quốc lộ 5 (Gia Lâm)',       ST_SetSRID(ST_MakePoint(105.9520, 21.0250), 4326), 'SENSOR-069', 20),
  -- Đông Anh
  ('Thị trấn Đông Anh (Ngã tư Quốc lộ 3)', ST_SetSRID(ST_MakePoint(105.8500, 21.1420), 4326), 'SENSOR-070', 20),
  ('Cầu Đôi - Hải Bối (Đông Anh)',        ST_SetSRID(ST_MakePoint(105.8150, 21.1050), 4326), 'SENSOR-071', 20),
  ('Tiên Dương - Cầu Nhật Tân nối dài',   ST_SetSRID(ST_MakePoint(105.8250, 21.1350), 4326), 'SENSOR-072', 20),
  -- Bắc Từ Liêm
  ('Nhổn - ĐH Công Nghiệp (Bắc Từ Liêm)', ST_SetSRID(ST_MakePoint(105.7360, 21.0540), 4326), 'SENSOR-073', 20),
  ('Cổ Nhuế (Ngõ 145 Cổ Nhuế - BTL)',     ST_SetSRID(ST_MakePoint(105.7830, 21.0680), 4326), 'SENSOR-074', 20),
  ('Cầu Diễn (Đường 32 qua sông Nhuệ)',   ST_SetSRID(ST_MakePoint(105.7580, 21.0420), 4326), 'SENSOR-075', 20)
ON CONFLICT (sensor_id) DO NOTHING;

-- Vài số đo ban đầu để có dữ liệu hiển thị phong phú
INSERT INTO water_readings (point_id, depth_cm, source)
SELECT id, (ARRAY[
  0, 3, 12, 5, 15, 27, 9, 8, 0, 18, 16, 0, 14, 4, 9, 12, 6, 22, 8, 0,
  10, 0, 14, 7, 16, 4, 0, 28, 22, 15, 8, 12, 0, 26, 15, 22, 10, 18, 25, 21,
  16, 32, 19, 28, 24, 17, 12, 20, 18, 7, 4, 10, 14, 24, 12,
  22, 24, 16, 18, 15, 21, 10, 14, 16, 26, 12, 18, 12, 15, 14, 9, 0, 25, 20, 17
])[((id - 1) % 75) + 1], 'sensor' FROM flood_points
ON CONFLICT DO NOTHING;
