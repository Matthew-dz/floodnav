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

  // Kịch bản mưa mẫu ứng với mực nước (cm) tại mạng lưới trạm cảm biến Hà Nội
  const scenarios = {
    clear: {
      label: "Trời tạnh (Bình thường)",
      rainfall: "0 mm/h"
    },
    light_rain: {
      label: "Mưa rào nhẹ (~20mm)",
      rainfall: "20 mm/h"
    },
    heavy_storm: {
      label: "Mưa lớn diện rộng (~50mm)",
      rainfall: "50 mm/h"
    },
    extreme_flood: {
      label: "Bão cực đoan lịch sử (>100mm)",
      rainfall: "105 mm/h"
    }
  };

  async function applyScenario(key) {
    const sc = scenarios[key];
    if (!sc) return;

    // Cập nhật nhãn trạng thái
    const labelEl = document.getElementById('sim-current-scenario');
    if (labelEl) labelEl.innerText = `${sc.label} - Lượng mưa: ${sc.rainfall}`;

    // Cập nhật cục bộ tức thì trên giao diện cho toàn bộ các trạm cảm biến
    if (window.floodPoints && window.floodPoints.length > 0) {
      const batchPayload = [];
      window.floodPoints.forEach(fp => {
        let newDepth = 0;
        if (key === 'clear') {
          newDepth = (fp.id % 7 === 0) ? 2 : 0;
        } else if (key === 'light_rain') {
          newDepth = Math.round(5 + (fp.id % 5) * 2.2);
        } else if (key === 'heavy_storm') {
          newDepth = Math.round(18 + (fp.id % 7) * 2.5);
        } else if (key === 'extreme_flood') {
          newDepth = Math.round(35 + (fp.id % 6) * 3.5);
        }
        fp.depth_cm = newDepth;
        fp.status = newDepth < 5 ? 'safe' : (newDepth < fp.threshold_cm ? 'warning' : 'danger');

        batchPayload.push({
          point_id: fp.id,
          depth_cm: newDepth,
          source: 'sensor'
        });
      });

      // Vẽ lại bản đồ và danh sách điểm ngập ngay lập tức
      if (typeof renderFloodPoints === 'function') {
        renderFloodPoints(window.floodPoints);
      }

      // Gửi batch update lên backend
      fetch('/api/readings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload)
      }).catch(err => console.warn('Lỗi gửi batch readings:', err));

      // Tự động tính lại lộ trình ngay lập tức (Dynamic Re-routing)
      if (window.coords && coords.origin && coords.destination && window.calculateRoute) {
        calculateRoute();
      }

      if (window.VoiceWarning) {
        VoiceWarning.speak(`Kích hoạt mô phỏng: ${sc.label}. Hệ thống đang cập nhật mạng lưới giao thông toàn thành phố.`);
      }
    }
  }

  return {
    applyScenario,
    scenarios
  };
})();

window.StormSimulator = StormSimulator;
