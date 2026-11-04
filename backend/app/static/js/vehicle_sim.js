/**
 * ========================================================
 * FloodNav - Mô phỏng xe di chuyển trên lộ trình
 * map_core.js gọi: VehicleSim.start(latlngs, vehicle) sau khi vẽ tuyến
 * Dùng requestAnimationFrame, nội suy theo quãng đường thực (haversine)
 * Tự động xoay/lật đầu xe theo đúng hướng di chuyển thực tế (FE-01 / Thành viên 3)
 * ========================================================
 */

const VehicleSim = (function () {
  let marker = null;
  let rafId = null;
  let restartTimer = null;
  let iconEl = null;

  function haversine(a, b) {
    const R = 6371000, toRad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * toRad, dLng = (b[1] - a[1]) * toRad;
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    clearTimeout(restartTimer);
    rafId = null;
    restartTimer = null;
    if (marker && typeof map !== 'undefined') map.removeLayer(marker);
    marker = null;
    iconEl = null;
  }

  // latlngs: [[lat, lng], ...] của tuyến an toàn; vehicle: 'motorbike' | 'car'
  function start(latlngs, vehicle) {
    stop();
    if (typeof map === 'undefined' || !latlngs || latlngs.length < 2) return;

    // Quãng đường tích luỹ tại từng đỉnh của polyline
    const cum = [0];
    for (let i = 1; i < latlngs.length; i++) {
      cum.push(cum[i - 1] + haversine(latlngs[i - 1], latlngs[i]));
    }
    const total = cum[cum.length - 1];
    if (total <= 0) return;

    const emoji = vehicle === 'car' ? '🚗' : '🏍️';

    // Xác định hướng di chuyển ban đầu của đoạn xuất phát
    const initDlng = (latlngs[1][1] - latlngs[0][1]);
    const initIsEast = initDlng >= 0;
    const initScaleX = initIsEast ? -1 : 1;

    marker = L.marker(latlngs[0], {
      icon: L.divIcon({
        html: `<div id="sim-vehicle-icon" class="vehicle-icon" style="font-size:28px;line-height:1;filter:drop-shadow(0 3px 5px rgba(0,0,0,.45));transform:scaleX(${initScaleX});transform-origin:center;transition:transform 0.15s ease-out;display:inline-block;">${emoji}</div>`,
        className: 'vehicle-sim-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      }),
      interactive: false,
      zIndexOffset: 1000
    }).addTo(map);

    // Thời gian chạy demo: 8s - 25s tuỳ độ dài tuyến
    const duration = Math.max(8000, Math.min(25000, total * 4));
    let startTs = null;
    let seg = 1;
    let lastIsEast = initIsEast;

    function frame(ts) {
      if (startTs === null) {
        startTs = ts;
        iconEl = document.getElementById('sim-vehicle-icon');
      }
      const progress = Math.min((ts - startTs) / duration, 1);
      const dist = progress * total;

      while (seg < cum.length - 1 && cum[seg] < dist) seg++;
      const segLen = cum[seg] - cum[seg - 1] || 1;
      const t = Math.min(Math.max((dist - cum[seg - 1]) / segLen, 0), 1);
      const a = latlngs[seg - 1], b = latlngs[seg];
      marker.setLatLng([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);

      // Tự động căn chỉnh đầu xe theo hướng tiến
      const dLng = b[1] - a[1];
      const dLat = b[0] - a[0];

      if (Math.abs(dLng) > 0.00005) {
        lastIsEast = (dLng >= 0);
      }

      if (!iconEl) iconEl = document.getElementById('sim-vehicle-icon');
      if (iconEl) {
        // Emoji chuẩn (🚗 / 🏍️) có mặt quay về bên Trái (Tây)
        // Khi di chuyển sang Phải (Đông): lật scaleX(-1) để đầu xe hướng sang Phải
        // Khi di chuyển sang Trái (Tây): scaleX(1) để đầu xe hướng sang Trái
        const scaleX = lastIsEast ? -1 : 1;
        // Độ nghiêng dốc nhẹ
        const slope = Math.atan2(dLat, Math.abs(dLng) * 1.1 + 0.00001) * (180 / Math.PI);
        const tilt = Math.max(-20, Math.min(20, -slope * (lastIsEast ? 1 : -1)));

        iconEl.style.transform = `scaleX(${scaleX}) rotate(${tilt.toFixed(1)}deg)`;
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        // Tới nơi: nghỉ 1.5s rồi chạy lại để demo liên tục
        rafId = null;
        restartTimer = setTimeout(() => start(latlngs, vehicle), 1500);
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  return { start, stop };
})();

window.VehicleSim = VehicleSim;
