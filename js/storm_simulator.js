/**
 * ========================================================
 * FloodNav - Interactive Storm Scenario Simulator
 * Phụ trách chính: Thành viên 3 (Independent Frontend)
 * Mục đích: Biểu diễn demo trực tiếp trước Ban Giám Khảo cuộc thi
 * ========================================================
 */

const StormSimulator = (function () {
  let isSimulating = false;
  let timer = null;

  // Kịch bản mưa mẫu ứng với mực nước (cm) tại 8 cảm biến Hà Nội
  const scenarios = {
    clear: {
      label: "Trời tạnh (Bình thường)",
      rainfall: "0 mm/h",
      depths: [0, 2, 0, 0, 3, 0, 0, 0]
    },
    light_rain: {
      label: "Mưa rào nhẹ (~20mm)",
      rainfall: "20 mm/h",
      depths: [5, 10, 8, 12, 12, 4, 10, 8]
    },
    heavy_storm: {
      label: "Mưa lớn diện rộng (~50mm)",
      rainfall: "50 mm/h",
      depths: [18, 25, 22, 28, 22, 12, 24, 18]
    },
    extreme_flood: {
      label: "Bão cực đoan lịch sử (>100mm)",
      rainfall: "105 mm/h",
      depths: [35, 45, 40, 50, 42, 25, 48, 38]
    }
  };

  async function applyScenario(key) {
    const sc = scenarios[key];
    if (!sc) return;

    // Cập nhật nhãn trạng thái
    const labelEl = document.getElementById('sim-current-scenario');
    if (labelEl) labelEl.innerText = `${sc.label} - Lượng mưa: ${sc.rainfall}`;

    // Gửi cập nhật mực nước 8 điểm lên Backend
    try {
      const updates = sc.depths.map((depth, idx) => {
        return fetch('/api/readings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            point_id: idx + 1,
            depth_cm: depth,
            source: 'sensor'
          })
        });
      });

      await Promise.all(updates);

      // Nạp lại danh sách điểm ngập và vẽ lại bản đồ
      if (window.loadFloodPoints) {
        await loadFloodPoints();
      }

      // Tự động tính lại lộ trình ngay lập tức (Dynamic Re-routing)
      if (window.coords && coords.origin && coords.destination && window.calculateRoute) {
        calculateRoute();
      }

      if (window.VoiceWarning) {
        VoiceWarning.speak(`Kích hoạt mô phỏng: ${sc.label}. Hệ thống đang cập nhật mạng lưới giao thông.`);
      }
    } catch (err) {
      console.error('Lỗi mô phỏng:', err);
    }
  }

  return {
    applyScenario,
    scenarios
  };
})();

window.StormSimulator = StormSimulator;
