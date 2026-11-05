-- ============ Dữ liệu mẫu (130 điểm ngập trọng điểm Hà Nội) ============

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

  ('Cầu Diễn (Đường 32 qua sông Nhuệ)',   ST_SetSRID(ST_MakePoint(105.7580, 21.0420), 4326), 'SENSOR-075', 20),

  -- Thị xã Sơn Tây
  ('Quang Trung - Chợ Nghệ (Thị xã Sơn Tây)', ST_SetSRID(ST_MakePoint(105.5085, 21.1390), 4326), 'SENSOR-076', 20),
  ('Phùng Khắc Khoan - Chùa Mía (Sơn Tây)', ST_SetSRID(ST_MakePoint(105.4780, 21.1450), 4326), 'SENSOR-077', 20),

  -- Sóc Sơn
  ('Ngã tư Phù Lỗ (Quốc lộ 2 - Sóc Sơn)', ST_SetSRID(ST_MakePoint(105.8450, 21.2380), 4326), 'SENSOR-078', 20),
  ('Thị trấn Sóc Sơn (Quốc lộ 3)', ST_SetSRID(ST_MakePoint(105.8520, 21.2720), 4326), 'SENSOR-079', 20),

  -- Mê Linh
  ('KĐT Tiền Phong - KCN Quang Minh (Mê Linh)', ST_SetSRID(ST_MakePoint(105.7480, 21.1680), 4326), 'SENSOR-080', 20),
  ('Ngã ba Thanh Lâm (Đường Mê Linh)', ST_SetSRID(ST_MakePoint(105.7180, 21.1850), 4326), 'SENSOR-081', 20),

  -- Đan Phượng
  ('Thị trấn Phùng (Quốc lộ 32 - Đan Phượng)', ST_SetSRID(ST_MakePoint(105.6650, 21.0880), 4326), 'SENSOR-082', 20),
  ('Tân Lập - Đường 422 (Đan Phượng)', ST_SetSRID(ST_MakePoint(105.6980, 21.0720), 4326), 'SENSOR-083', 20),

  -- Chương Mỹ
  ('Thị trấn Chúc Sơn (Quốc lộ 6 - Chương Mỹ)', ST_SetSRID(ST_MakePoint(105.7020, 20.9250), 4326), 'SENSOR-084', 25),
  ('Bùi Xương Trạch - Đê Tả Bùi (Nam Phương Tiến)', ST_SetSRID(ST_MakePoint(105.6580, 20.8920), 4326), 'SENSOR-085', 35),
  ('Ngã ba Xuân Mai (Quốc lộ 6 - QL 21A)', ST_SetSRID(ST_MakePoint(105.5820, 20.8980), 4326), 'SENSOR-086', 20),

  -- Quốc Oai
  ('Thị trấn Quốc Oai (Đại lộ Thăng Long)', ST_SetSRID(ST_MakePoint(105.6420, 20.9880), 4326), 'SENSOR-087', 20),
  ('Cấn Hữu - Ven sông Tích (Quốc Oai)', ST_SetSRID(ST_MakePoint(105.6080, 20.9420), 4326), 'SENSOR-088', 25),

  -- Thạch Thất
  ('Thị trấn Liên Quan (Đường 419 - Thạch Thất)', ST_SetSRID(ST_MakePoint(105.5880, 21.0320), 4326), 'SENSOR-089', 20),
  ('Cần Kiệm - Ven sông Đáy (Thạch Thất)', ST_SetSRID(ST_MakePoint(105.6120, 21.0150), 4326), 'SENSOR-090', 25),

  -- Phúc Thọ
  ('Thị trấn Phúc Thọ (Quốc lộ 32)', ST_SetSRID(ST_MakePoint(105.5650, 21.1080), 4326), 'SENSOR-091', 20),
  ('Tam Hiệp - Ven sông Tích (Phúc Thọ)', ST_SetSRID(ST_MakePoint(105.5850, 21.0820), 4326), 'SENSOR-092', 20),

  -- Ba Vì
  ('Thị trấn Tây Đằng (Quốc lộ 32 - Ba Vì)', ST_SetSRID(ST_MakePoint(105.4120, 21.2280), 4326), 'SENSOR-093', 20),
  ('Quảng Oai - Ven sông Hồng (Ba Vì)', ST_SetSRID(ST_MakePoint(105.4380, 21.2520), 4326), 'SENSOR-094', 20),

  -- Phú Xuyên
  ('Thị trấn Phú Xuyên (Quốc lộ 1A)', ST_SetSRID(ST_MakePoint(105.9080, 20.7680), 4326), 'SENSOR-095', 20),
  ('Thị trấn Phú Minh (Đường đê Sông Hồng)', ST_SetSRID(ST_MakePoint(105.9250, 20.8120), 4326), 'SENSOR-096', 20),

  -- Ứng Hòa
  ('Thị trấn Vân Đình (Quốc lộ 21B - Ứng Hòa)', ST_SetSRID(ST_MakePoint(105.7950, 20.7850), 4326), 'SENSOR-097', 20),
  ('Quảng Phú Cầu (Làng hương - Ứng Hòa)', ST_SetSRID(ST_MakePoint(105.7880, 20.8250), 4326), 'SENSOR-098', 20),

  -- Mỹ Đức
  ('Thị trấn Đại Nghĩa (Đường 419 - Mỹ Đức)', ST_SetSRID(ST_MakePoint(105.7480, 20.6980), 4326), 'SENSOR-099', 20),
  ('Bến Đục - Suối Yến (Chùa Hương - Mỹ Đức)', ST_SetSRID(ST_MakePoint(105.8150, 20.6180), 4326), 'SENSOR-100', 30),

  -- Mở rộng Cầu Giấy
  ('Phạm Văn Đồng (Trước cổng ĐH Ngoại Ngữ)', ST_SetSRID(ST_MakePoint(105.7825, 21.0425), 4326), 'SENSOR-101', 20),
  ('Trần Quốc Hoàn - Phan Văn Trường', ST_SetSRID(ST_MakePoint(105.7895, 21.0410), 4326), 'SENSOR-102', 20),
  ('Dương Đình Nghệ (Nút giao Keangnam)', ST_SetSRID(ST_MakePoint(105.7865, 21.0185), 4326), 'SENSOR-103', 20),

  -- Mở rộng Đống Đa
  ('Tôn Thất Tùng - BV Đại học Y', ST_SetSRID(ST_MakePoint(105.8325, 21.0075), 4326), 'SENSOR-104', 20),
  ('Đặng Văn Ngữ - Hồ Đắc Di', ST_SetSRID(ST_MakePoint(105.8300, 21.0110), 4326), 'SENSOR-105', 20),

  -- Mở rộng Ba Đình
  ('Đào Tấn (Cổng Công viên Thủ Lệ)', ST_SetSRID(ST_MakePoint(105.8085, 21.0335), 4326), 'SENSOR-106', 20),
  ('Chu Văn An - Điện Biên Phủ', ST_SetSRID(ST_MakePoint(105.8355, 21.0345), 4326), 'SENSOR-107', 20),

  -- Mở rộng Hoàn Kiếm
  ('Hàng Bông - Phủ Doãn', ST_SetSRID(ST_MakePoint(105.8475, 21.0305), 4326), 'SENSOR-108', 20),
  ('Phan Chu Trinh - Hai Bà Trưng', ST_SetSRID(ST_MakePoint(105.8565, 21.0235), 4326), 'SENSOR-109', 20),

  -- Mở rộng Hai Bà Trưng
  ('Tạ Quang Bửu (Trước ĐH Bách Khoa)', ST_SetSRID(ST_MakePoint(105.8455, 21.0045), 4326), 'SENSOR-110', 20),
  ('Bà Triệu - Tô Hiến Thành', ST_SetSRID(ST_MakePoint(105.8505, 21.0125), 4326), 'SENSOR-111', 20),

  -- Mở rộng Thanh Xuân
  ('Khương Đình (Ngõ 207 Khương Đình)', ST_SetSRID(ST_MakePoint(105.8125, 20.9915), 4326), 'SENSOR-112', 20),
  ('Bùi Xương Trạch (Đầu ngõ 1)', ST_SetSRID(ST_MakePoint(105.8165, 20.9885), 4326), 'SENSOR-113', 20),

  -- Mở rộng Nam Từ Liêm
  ('Hầm chui số 3 Đại lộ Thăng Long', ST_SetSRID(ST_MakePoint(105.7620, 21.0045), 4326), 'SENSOR-114', 30),
  ('Trung Văn - Phùng Khoang', ST_SetSRID(ST_MakePoint(105.7850, 20.9925), 4326), 'SENSOR-115', 20),

  -- Mở rộng Bắc Từ Liêm
  ('Tân Xuân - Xuân Đỉnh', ST_SetSRID(ST_MakePoint(105.7885, 21.0825), 4326), 'SENSOR-116', 20),
  ('Đức Thắng (Học viện Tài Chính)', ST_SetSRID(ST_MakePoint(105.7725, 21.0745), 4326), 'SENSOR-117', 20),

  -- Mở rộng Hoàng Mai
  ('Bán đảo Linh Đàm (KĐT Linh Đàm)', ST_SetSRID(ST_MakePoint(105.8280, 20.9685), 4326), 'SENSOR-118', 20),
  ('Pháp Vân (Ngã ba Pháp Vân - Giải Phóng)', ST_SetSRID(ST_MakePoint(105.8465, 20.9625), 4326), 'SENSOR-119', 25),
  ('Tam Trinh (Chân cầu Đền Lừ)', ST_SetSRID(ST_MakePoint(105.8615, 20.9855), 4326), 'SENSOR-120', 20),

  -- Mở rộng Tây Hồ
  ('Âu Cơ - Lạc Long Quân (Chợ Hoa)', ST_SetSRID(ST_MakePoint(105.8295, 21.0655), 4326), 'SENSOR-121', 20),
  ('Quảng An - Xuân Diệu (Bán đảo)', ST_SetSRID(ST_MakePoint(105.8335, 21.0585), 4326), 'SENSOR-122', 20),

  -- Mở rộng Long Biên
  ('Hoàng Như Tiếp (BV Tâm Anh - Long Biên)', ST_SetSRID(ST_MakePoint(105.8785, 21.0365), 4326), 'SENSOR-123', 20),
  ('Thạch Bàn (Chân cầu Thanh Trì - LB)', ST_SetSRID(ST_MakePoint(105.9085, 21.0025), 4326), 'SENSOR-124', 25),
  ('Ngô Gia Tự - Ngã tư Đức Giang', ST_SetSRID(ST_MakePoint(105.8925, 21.0625), 4326), 'SENSOR-125', 20),

  -- Mở rộng Hà Đông
  ('Tố Hữu - Ngã tư Vạn Phúc (Hà Đông)', ST_SetSRID(ST_MakePoint(105.7720, 20.9845), 4326), 'SENSOR-126', 20),
  ('Phùng Hưng (Hà Đông - Cổng Viện 103)', ST_SetSRID(ST_MakePoint(105.7895, 20.9655), 4326), 'SENSOR-127', 20),
  ('KĐT Văn Phú (Lê Trọng Tấn kéo dài)', ST_SetSRID(ST_MakePoint(105.7625, 20.9525), 4326), 'SENSOR-128', 20),
  ('Mỗ Lao - Nguyễn Văn Lộc (Hà Đông)', ST_SetSRID(ST_MakePoint(105.7845, 20.9815), 4326), 'SENSOR-129', 20),

  -- Mở rộng Gia Lâm
  ('Bát Tràng (Đường đê Bát Tràng - Gia Lâm)', ST_SetSRID(ST_MakePoint(105.9125, 20.9785), 4326), 'SENSOR-130', 20)
ON CONFLICT (sensor_id) DO NOTHING;



-- Vài số đo ban đầu để có dữ liệu hiển thị phong phú

INSERT INTO water_readings (point_id, depth_cm, source)
SELECT id, (ARRAY[
  0, 3, 12, 5, 15, 27, 9, 8, 0, 18, 16, 0, 14, 4, 9, 12, 6, 22, 8, 0,
  10, 0, 14, 7, 16, 4, 0, 28, 22, 15, 8, 12, 0, 26, 15, 22, 10, 18, 25, 21,
  16, 32, 19, 28, 24, 17, 12, 20, 18, 7, 4, 10, 14, 24, 12, 22, 24, 16, 18, 15,
  21, 10, 14, 16, 26, 12, 18, 12, 15, 14, 9, 0, 25, 20, 17, 15, 12, 18, 14, 22,
  10, 16, 18, 28, 42, 15, 24, 30, 14, 26, 12, 17, 10, 15, 18, 14, 20, 11, 16, 32,
  22, 19, 17, 14, 15, 8, 5, 12, 6, 15, 0, 25, 27, 35, 21, 18, 20, 19, 28, 23,
  15, 8, 14, 24, 11, 26, 21, 18, 16, 13
])[((id - 1) % 130) + 1], 'sensor' FROM flood_points
ON CONFLICT DO NOTHING;

