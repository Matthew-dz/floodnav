/**
 * ========================================================
 * FloodNav - Interactive Storm Scenario Simulator
 * Phụ trách chính: Thành viên 3 (Independent Frontend)
 * Mục đích: Biểu diễn demo trực tiếp trước Ban Giám Khảo cuộc thi
 * - Dropdown kịch bản mẫu
 * - Thanh trượt lượng mưa (mm/h): kéo -> mực nước 8 cảm biến tăng/giảm đồng bộ
 * ========================================================
 */

const StormSimulator = (function () {
  // Mực nước đỉnh (cm) của 8 cảm biến khi mưa 100 mm/h
  const PEAK_DEPTHS = [35, 45, 40, 50, 42, 25, 48, 38];

  // Kịch bản mưa mẫu ứng với mực nước (cm) tại 8 cảm biến Hà Nội
  const scenarios = {
    clear: {
      label: "Trời tạnh (Bình thường)",
      rainfall: "0 mm/h",
      mm: 0,
      depths: [0, 2, 0, 0, 3, 0, 0, 0]
    },
    light_rain: {
      label: "Mưa rào nhẹ (~20mm)",
      rainfall: "20 mm/h",
      mm: 20,
      depths: [5, 10, 8, 12, 12, 4, 10, 8]
    },
    heavy_storm: {
      label: "Mưa lớn diện rộng (~50mm)",
      rainfall: "50 mm/h",
      mm: 50,
      depths: [18, 25, 22, 28, 22, 12, 24, 18]
    },
    extreme_flood: {
      label: "Bão cực đoan lịch sử (>100mm)",
      rainfall: "105 mm/h",
      mm: 100,
      depths: [35, 45, 40, 50, 42, 25, 48, 38]
    }
  };

  let sliderTimer = null;
  let requestSeq = 0; // chỉ áp dụng kết quả của lần kéo mới nhất

  function setLabel(text) {
    const labelEl = document.getElementById('sim-current-scenario');
    if (labelEl) labelEl.innerText = text;
  }

  // Gửi mực nước 8 điểm lên Backend -> nạp lại bản đồ -> tính lại lộ trình
  async function pushDepths(depths) {
    const seq = ++requestSeq;
    try {
      await Promise.all(depths.map((depth, idx) =>
        fetch('/api/readings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ point_id: idx + 1, depth_cm: depth, source: 'sensor' })
        })
      ));
      if (seq !== requestSeq) return; // đã có lần kéo mới hơn

      if (typeof loadFloodPoints === 'function') await loadFloodPoints();

      // Dynamic Re-routing: tính lại ngay nếu đã chọn điểm đi/đến
      // (coords khai báo bằng `let` nên KHÔNG nằm trên window -> dùng typeof)
      if (typeof coords !== 'undefined' && coords.origin && coords.destination &&
          typeof calculateRoute === 'function') {
        calculateRoute();
      }
    } catch (err) {
      console.error('Lỗi mô phỏng:', err);
    }
  }

  async function applyScenario(key) {
    const sc = scenarios[key];
    if (!sc) return;

    setLabel(`${sc.label} - Lượng mưa: ${sc.rainfall}`);

    // Đồng bộ thanh trượt với kịch bản
    const slider = document.getElementById('storm-slider');
    const val = document.getElementById('storm-slider-value');
    if (slider) slider.value = sc.mm;
    if (val) val.innerText = `${sc.mm} mm/h`;

    await pushDepths(sc.depths);

    if (window.VoiceWarning) {
      VoiceWarning.speak(`Kích hoạt mô phỏng: ${sc.label}. Hệ thống đang cập nhật mạng lưới giao thông.`);
    }
  }

  // Mực nước mỗi cảm biến tỉ lệ thuận với lượng mưa (0 - 100 mm/h)
  function depthsFromRain(mm) {
    const k = Math.max(0, Math.min(mm, 100)) / 100;
    return PEAK_DEPTHS.map(p => Math.round(p * k));
  }

  // Gọi từ oninput của thanh trượt
  function onSliderInput(mm) {
    mm = Number(mm);
    const val = document.getElementById('storm-slider-value');
    if (val) val.innerText = `${mm} mm/h`;
    setLabel(`Tuỳ chỉnh - Lượng mưa: ${mm} mm/h`);

    // Debounce: ngừng kéo 350ms mới gửi API, tránh spam server
    clearTimeout(sliderTimer);
    sliderTimer = setTimeout(() => pushDepths(depthsFromRain(mm)), 350);
  }

  return {
    applyScenario,
    onSliderInput,
    depthsFromRain,
    scenarios
  };
})();

window.StormSimulator = StormSimulator;
