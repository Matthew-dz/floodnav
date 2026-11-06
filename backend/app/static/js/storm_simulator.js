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

      if (newDepth < 5) {
        fp.water_trend = 'stable';
        fp.estimated_drainage_time = 'Đã cạn / Không ngập (< 5cm)';
      } else {
        if (k > 0.35) {
          fp.water_trend = 'rising';
          const mins = Math.round(30 + ((newDepth - 4.5) / 8.5) * 60);
          fp.estimated_drainage_time = mins > 120 ? '> 2.5 giờ' : `~ ${Math.max(30, Math.round(mins / 15) * 15)} phút`;
        } else {
          fp.water_trend = 'falling';
          const mins = Math.round(((newDepth - 4.5) / 12.0) * 60);
          fp.estimated_drainage_time = mins > 120 ? '> 2 giờ' : `~ ${Math.max(15, Math.round(mins / 15) * 15)} phút`;
        }
      }

      // Cập nhật dự báo ngập AI tức thì theo mô hình thủy văn & lượng mưa mm
      const baseThreshold = fp.threshold_cm || 20;
      const slope = (fp.name && fp.name.toLowerCase().includes('hầm chui')) ? 2.2 : (baseThreshold >= 25 ? 1.6 : 1.2);
      let pred30 = 0, pred60 = 0;
      if (k > 0) {
        const excess30 = Math.max(0, mm - 18.0) * 0.45 * slope;
        const excess60 = Math.max(0, mm - 18.0) * 0.70 * slope;
        pred30 = Math.max(0, Math.round((newDepth * 0.90 + excess30) * 10) / 10);
        pred60 = Math.max(0, Math.round((newDepth * 0.82 + excess60) * 10) / 10);
      } else {
        pred30 = Math.max(0, Math.round(newDepth * 0.15 * 10) / 10);
        pred60 = Math.max(0, Math.round(newDepth * 0.05 * 10) / 10);
      }
      const risk30 = baseThreshold > 0 ? Math.min(1.0, Math.round((pred30 / baseThreshold) * 100) / 100) : 0;
      const risk60 = baseThreshold > 0 ? Math.min(1.0, Math.round((pred60 / baseThreshold) * 100) / 100) : 0;

      if (!window.aiPredictionsCache) {
        window.aiPredictionsCache = {};
      }
      window.aiPredictionsCache[fp.id] = {
        point_id: fp.id,
        name: fp.name,
        current_depth_cm: newDepth,
        threshold_cm: baseThreshold,
        forecast_30m: {
          predicted_depth_cm: pred30,
          risk_score: risk30,
          exceeds_threshold: pred30 >= baseThreshold
        },
        forecast_60m: {
          predicted_depth_cm: pred60,
          risk_score: risk60,
          exceeds_threshold: pred60 >= baseThreshold
        },
        water_trend: fp.water_trend,
        estimated_drainage_time: fp.estimated_drainage_time,
        drainage_forecast: {
          water_trend: fp.water_trend,
          estimated_drainage_time: fp.estimated_drainage_time
        }
      };
    });

    if (seq !== requestSeq) return;

    // Vẽ lại toàn bộ 130 marker, vòng cảnh báo, bảng điểm ngập và thông báo viewport
    if (typeof window.renderFloodPoints === 'function') {
      window.renderFloodPoints(points);
    } else if (typeof renderFloodPoints === 'function') {
      renderFloodPoints(points);
    }

    // Cập nhật ngay lập tức khung dự báo AI của bất kỳ popup nào đang mở
    if (typeof window.updateOpenPopupAi === 'function') {
      window.updateOpenPopupAi();
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
    }).then(() => {
      // Sau khi backend lưu dữ liệu ngập, fetch lại dự báo AI chính xác từ Scikit-learn
      if (typeof window.fetchAiPredictions === 'function') {
        window.fetchAiPredictions(true, mm);
      }
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
    if (key === 'clear') {
      resetToDefault();
      return;
    }

    const sc = scenarios[key];
    if (!sc) return;

    const select = document.getElementById('storm-scenario-select');
    if (select) select.value = key;
    const mobSelect = document.getElementById('mobile-storm-select');
    if (mobSelect) mobSelect.value = key;


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
  async function resetToDefault() {
    clearTimeout(sliderSyncTimer);

    // 6.1. Đưa Dropdown về kịch bản 'clear' (Tạnh 0mm) và xóa tuỳ chỉnh (nếu có)
    const select = document.getElementById('storm-scenario-select');
    if (select) {
      const customOpt = select.querySelector('option[value="custom"]');
      if (customOpt) customOpt.remove();
      select.value = 'clear';
    }
    const mobSelect = document.getElementById('mobile-storm-select');
    if (mobSelect) mobSelect.value = 'clear';


    // 6.2. Đưa thanh trượt Slider về 0 mm/h
    const slider = document.getElementById('storm-slider');
    const val = document.getElementById('storm-slider-value');
    if (slider) slider.value = 0;
    if (val) val.innerText = '0 mm/h';

    setLabel('Dữ liệu quan trắc thực tế');

    // 6.3. Khôi phục trực tiếp dữ liệu thực từ các trạm quan trắc trong CSDL qua API /reset
    try {
      const res = await fetch('/api/flood-points/reset', { method: 'POST' });
      if (res.ok) {
        const geojson = await res.json();
        if (typeof window.renderFloodPoints === 'function') {
          window.renderFloodPoints(geojson);
        } else if (typeof renderFloodPoints === 'function') {
          renderFloodPoints(geojson);
        }
      } else if (typeof loadFloodPoints === 'function') {
        await loadFloodPoints();
      }
      // Nạp lại dự báo AI thực tế từ backend sau khi khôi phục CSDL
      if (typeof window.fetchAiPredictions === 'function') {
        await window.fetchAiPredictions(true, null);
      }
    } catch (err) {
      console.warn('Lỗi gọi /api/flood-points/reset:', err);
      if (typeof loadFloodPoints === 'function') {
        await loadFloodPoints();
      }
      if (typeof window.fetchAiPredictions === 'function') {
        await window.fetchAiPredictions(true, null);
      }
    }

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
      VoiceWarning.speak('Đã khôi phục dữ liệu quan trắc thực tế từ cơ sở dữ liệu.');
    }

    // 6.11. Hiển thị thông báo Toast nổi
    if (typeof showToast === 'function') {
      showToast('Đã khôi phục dữ liệu thực từ các trạm quan trắc trong CSDL', 'success');
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
