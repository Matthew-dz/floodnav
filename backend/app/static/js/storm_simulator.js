/**
 * ========================================================
 * FloodNav - Interactive Storm Scenario Simulator
 * Phụ trách chính: Thành viên 3 (Independent Frontend)
 * Mục đích: Biểu diễn demo trực tiếp trước Ban Giám Khảo cuộc thi
 * - Dropdown kịch bản mẫu (Tạnh, Mưa, Lớn, Bão)
 * - Thanh trượt lượng mưa thời gian thực (0 - 100 mm/h)
 * - Đồng bộ hai chiều giữa Dropdown & Slider
 * - Cập nhật tức thì 75 trạm ngập, vòng lan tỏa và tái định tuyến an toàn
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

  let sliderSyncTimer = null;
  let requestSeq = 0;

  function setLabel(text) {
    const labelEl = document.getElementById('sim-current-scenario');
    if (labelEl) labelEl.innerText = text;
  }

  function getFloodPoints() {
    if (window.floodPoints && Array.isArray(window.floodPoints) && window.floodPoints.length > 0) {
      return window.floodPoints;
    }
    if (typeof floodPoints !== 'undefined' && Array.isArray(floodPoints) && floodPoints.length > 0) {
      window.floodPoints = floodPoints;
      return floodPoints;
    }
    return null;
  }

  // 1. Cập nhật giao diện 75 trạm cục bộ tức thì (Real-time 60fps)
  function updateLocalPoints(mm) {
    const seq = ++requestSeq;
    const points = getFloodPoints();
    if (!points) {
      console.warn("StormSimulator: Danh sách điểm ngập đang được tải...");
      return;
    }

    const k = Math.max(0, Math.min(Number(mm) || 0, 100)) / 100;
    const intensityFactor = k > 0 ? Math.pow(k, 0.9) * 1.55 : 0;

    points.forEach(fp => {
      let newDepth = 0;
      if (k > 0) {
        const baseThreshold = fp.threshold_cm || 20;
        const elevationVariance = 0.85 + ((Number(fp.id) * 13) % 7) * 0.05;
        newDepth = Math.max(0, Math.round(baseThreshold * intensityFactor * elevationVariance));
      }

      fp.depth_cm = newDepth;
      fp.status = newDepth >= (fp.threshold_cm || 20)
        ? 'danger'
        : (newDepth >= 5 ? 'warning' : 'safe');
    });

    if (seq !== requestSeq) return;

    // Vẽ lại toàn bộ 75 marker, vòng cảnh báo, bảng điểm ngập và thông báo viewport
    if (typeof window.renderFloodPoints === 'function') {
      window.renderFloodPoints(points);
    } else if (typeof renderFloodPoints === 'function') {
      renderFloodPoints(points);
    }
  }

  // 2. Đồng bộ ngầm lên backend và tính lại lộ trình né ngập (Debounced)
  function syncBackendAndReroute(mm) {
    const points = getFloodPoints();
    if (!points) return;

    const batchPayload = points.map(fp => ({
      point_id: fp.id,
      depth_cm: Number(fp.depth_cm) || 0,
      source: 'sensor'
    }));

    // Gửi batch readings lên backend
    fetch('/api/readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchPayload)
    }).catch(err => console.debug('StormSimulator sync readings error:', err));

    // Nếu người dùng đang xem một lộ trình thì tính lại đường né ngập mới nhất
    const c = window.coords || (typeof coords !== 'undefined' ? coords : null);
    if (c && c.origin && c.destination) {
      if (typeof window.calculateRoute === 'function') {
        window.calculateRoute();
      } else if (typeof calculateRoute === 'function') {
        calculateRoute();
      }
    }
  }

  // 3. Đồng bộ trạng thái của Dropdown theo mm lượng mưa
  function syncSelectFromMm(mm) {
    const select = document.getElementById('storm-scenario-select');
    if (!select) return;

    if (mm === 0) select.value = 'clear';
    else if (mm === 20) select.value = 'light_rain';
    else if (mm === 50) select.value = 'heavy_storm';
    else if (mm === 100) select.value = 'extreme_flood';
    else {
      let customOpt = select.querySelector('option[value="custom"]');
      if (!customOpt) {
        customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.className = 'text-slate-900';
        select.appendChild(customOpt);
      }
      customOpt.innerText = `⚙️ Tuỳ chỉnh (${mm}mm)`;
      select.value = 'custom';
    }
  }

  // 4. Khi người dùng chọn từ Dropdown kịch bản
  async function applyScenario(key) {
    const sc = scenarios[key];
    if (!sc) return;

    const select = document.getElementById('storm-scenario-select');
    if (select) select.value = key;

    const slider = document.getElementById('storm-slider');
    const val = document.getElementById('storm-slider-value');
    if (slider) slider.value = sc.mm;
    if (val) val.innerText = `${sc.mm} mm/h`;

    setLabel(`${sc.label} - Lượng mưa: ${sc.rainfall}`);

    // Cập nhật giao diện bản đồ tức thì
    updateLocalPoints(sc.mm);

    // Đồng bộ backend và reroute ngay lập tức
    clearTimeout(sliderSyncTimer);
    syncBackendAndReroute(sc.mm);

    if (window.VoiceWarning && typeof VoiceWarning.speak === 'function') {
      VoiceWarning.speak(`Kích hoạt mô phỏng: ${sc.label}. Lượng mưa ${sc.rainfall}.`);
    }
  }

  // 5. Khi người dùng tự tay kéo thanh trượt Slider
  function onSliderInput(mm) {
    mm = Number(mm);
    const val = document.getElementById('storm-slider-value');
    if (val) val.innerText = `${mm} mm/h`;
    setLabel(`Tuỳ chỉnh - Lượng mưa: ${mm} mm/h`);

    // Đồng bộ Dropdown tương ứng
    syncSelectFromMm(mm);

    // CẬP NHẬT NGAY LẬP TỨC TRÊN BẢN ĐỒ VÀ MỌI ĐIỂM NGẬP (Real-time mượt mà khi kéo)
    updateLocalPoints(mm);

    // Debounce 250ms gửi dữ liệu lên server và tính lại đường đi né ngập
    clearTimeout(sliderSyncTimer);
    sliderSyncTimer = setTimeout(() => {
      syncBackendAndReroute(mm);
    }, 250);
  }

  return {
    applyScenario,
    onSliderInput,
    pushDepthsByRain: updateLocalPoints,
    updateLocalPoints,
    scenarios
  };
})();

window.StormSimulator = StormSimulator;
