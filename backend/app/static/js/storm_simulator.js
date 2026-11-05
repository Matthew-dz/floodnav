/**
 * ========================================================
 * FloodNav - Interactive Storm Scenario Simulator
 * Phụ trách chính: Thành viên 3 (Independent Frontend)
 * Mục đích: Biểu diễn demo trực tiếp trước Ban Giám Khảo cuộc thi
 * - Dropdown kịch bản mẫu (Tạnh, Mưa, Lớn, Bão)
 * - Thanh trượt lượng mưa thời gian thực (0 - 100 mm/h)
 * - Đồng bộ hai chiều giữa Dropdown & Slider
 * - Cập nhật tức thì 130 trạm ngập, vòng lan tỏa và tái định tuyến an toàn
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

  // 1. Cập nhật giao diện 130 trạm cục bộ tức thì (Real-time 60fps)
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

    // Vẽ lại toàn bộ 130 marker, vòng cảnh báo, bảng điểm ngập và thông báo viewport
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

    // 6. Trở về trạng thái & giao diện mặc định sau khi mô phỏng thời tiết
  function resetToDefault() {
    clearTimeout(sliderSyncTimer);

    // 6.1. Đưa Dropdown về kịch bản 'clear' (Tạnh 0mm) và xóa tuỳ chỉnh (nếu có)
    const select = document.getElementById('storm-scenario-select');
    if (select) {
      const customOpt = select.querySelector('option[value="custom"]');
      if (customOpt) customOpt.remove();
      select.value = 'clear';
    }

    // 6.2. Đưa thanh trượt Slider về 0 mm/h
    const slider = document.getElementById('storm-slider');
    const val = document.getElementById('storm-slider-value');
    if (slider) slider.value = 0;
    if (val) val.innerText = '0 mm/h';

    setLabel('Trời tạnh (Bình thường) - Lượng mưa: 0 mm/h');

    // 6.3. Khôi phục toàn bộ các trạm quan trắc về trạng thái mặc định (0 cm ngập)
    updateLocalPoints(0);

    // 6.4. Đồng bộ 0 cm lên backend
    syncBackendAndReroute(0);

    // 6.5. Dừng mô phỏng xe chạy và xóa lộ trình nếu có
    if (window.VehicleSim && typeof VehicleSim.stop === 'function') {
      VehicleSim.stop();
    }
    if (typeof routeLayers !== 'undefined') {
      if (routeLayers.safe && typeof map !== 'undefined' && map) {
        map.removeLayer(routeLayers.safe);
        routeLayers.safe = null;
      }
      if (routeLayers.fastest && typeof map !== 'undefined' && map) {
        map.removeLayer(routeLayers.fastest);
        routeLayers.fastest = null;
      }
    }
    const resultCard = document.getElementById('route-results');
    if (resultCard) resultCard.classList.add('hidden');

    // 6.6. Xóa điểm xuất phát và điểm đến trên bản đồ (nếu có)
    if (typeof clearLocation === 'function') {
      clearLocation('origin');
      clearLocation('destination');
    }

    // 6.7. Đặt lại camera bản đồ về góc nhìn mặc định Hà Nội
    if (typeof map !== 'undefined' && map) {
      map.setView([21.0285, 105.8030], 12, { animate: true });
    }

    // 6.8. Cập nhật banner cảnh báo khung nhìn
    if (typeof updateViewportFloodAlert === 'function') {
      updateViewportFloodAlert();
    }

    // 6.9. Tạo lại các biểu tượng Lucide
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }

    // 6.10. Thông báo giọng nói (nếu người dùng bật loa cảnh báo)
    if (window.VoiceWarning && typeof VoiceWarning.speak === 'function') {
      VoiceWarning.speak('Đã trở về giao diện mặc định sau mô phỏng.');
    }

    // 6.11. Hiển thị thông báo Toast nổi
    if (typeof showToast === 'function') {
      showToast('Đã trở về giao diện mặc định ban đầu', 'success');
    }
  }

  return {
    applyScenario,
    onSliderInput,
    pushDepthsByRain: updateLocalPoints,
    updateLocalPoints,
    resetToDefault,
    scenarios
  };
})();

window.StormSimulator = StormSimulator;
