/**
 * ========================================================
 * FloodNav - Interactive Storm Scenario Simulator
 * Phụ trách chính: Thành viên 3 (Independent Frontend)
 * Mục đích: Biểu diễn demo trực tiếp trước Ban Giám Khảo cuộc thi
 * - Dropdown kịch bản mẫu
 * - Thanh trượt lượng mưa (0 - 100 mm/h) mô phỏng toàn bộ 75 trạm cảm biến Hà Nội
 * ========================================================
 */

const StormSimulator = (function () {
  const scenarios = {
    clear: {
      label: "Trời tạnh (Bình thường)",
      rainfall: "0 mm/h",
      mm: 0
    },
    light_rain: {
      label: "Mưa rào nhẹ (~20mm)",
      rainfall: "20 mm/h",
      mm: 20
    },
    heavy_storm: {
      label: "Mưa lớn diện rộng (~50mm)",
      rainfall: "50 mm/h",
      mm: 50
    },
    extreme_flood: {
      label: "Bão cực đoan lịch sử (>100mm)",
      rainfall: "105 mm/h",
      mm: 100
    }
  };

  let sliderTimer = null;
  let requestSeq = 0;

  function setLabel(text) {
    const labelEl = document.getElementById('sim-current-scenario');
    if (labelEl) labelEl.innerText = text;
  }

  // Cập nhật mực nước toàn bộ 75 trạm theo lượng mưa (mm/h)
  async function pushDepthsByRain(mm) {
    const seq = ++requestSeq;
    const k = Math.max(0, Math.min(mm, 100)) / 100;

    if (window.floodPoints && window.floodPoints.length > 0) {
      const batchPayload = [];
      window.floodPoints.forEach(fp => {
        let newDepth = 0;
        if (mm > 0) {
          // Tính toán mực nước theo tỷ lệ ngưỡng chịu ngập của từng điểm
          newDepth = Math.max(0, Math.round(fp.threshold_cm * k * 1.45));
        }
        fp.depth_cm = newDepth;
        fp.status = newDepth >= fp.threshold_cm ? 'danger' : (newDepth >= 5 ? 'warning' : 'safe');
        batchPayload.push({ point_id: fp.id, depth_cm: newDepth, source: 'sensor' });
      });

      if (seq !== requestSeq) return;

      // Cập nhật ngay trên bản đồ và sidebar
      if (typeof renderPointsList === 'function') renderPointsList();
      if (typeof renderFloodMarkers === 'function') renderFloodMarkers();
      if (typeof updateViewportFloodAlert === 'function') updateViewportFloodAlert();

      // Đồng bộ ngầm lên backend
      fetch('/api/readings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload)
      }).catch(err => console.debug('Gửi batch readings:', err));

      // Tính lại lộ trình né ngập tức thì (Dynamic Re-routing)
      if (typeof coords !== 'undefined' && coords.origin && coords.destination && typeof calculateRoute === 'function') {
        calculateRoute();
      }
    }
  }

  async function applyScenario(key) {
    const sc = scenarios[key];
    if (!sc) return;

    setLabel(`${sc.label} - Lượng mưa: ${sc.rainfall}`);

    const slider = document.getElementById('storm-slider');
    const val = document.getElementById('storm-slider-value');
    if (slider) slider.value = sc.mm;
    if (val) val.innerText = `${sc.mm} mm/h`;

    await pushDepthsByRain(sc.mm);

    if (window.VoiceWarning) {
      VoiceWarning.speak(`Kích hoạt mô phỏng: ${sc.label}. Hệ thống đang cập nhật mạng lưới giao thông toàn thành phố.`);
    }
  }

  function onSliderInput(mm) {
    mm = Number(mm);
    const val = document.getElementById('storm-slider-value');
    if (val) val.innerText = `${mm} mm/h`;
    setLabel(`Tuỳ chỉnh - Lượng mưa: ${mm} mm/h`);

    clearTimeout(sliderTimer);
    sliderTimer = setTimeout(() => pushDepthsByRain(mm), 250);
  }

  return {
    applyScenario,
    onSliderInput,
    pushDepthsByRain,
    scenarios
  };
})();

window.StormSimulator = StormSimulator;
