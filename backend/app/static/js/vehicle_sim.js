/**
 * ========================================================
 * FloodNav - Mô phỏng xe di chuyển trên lộ trình
 * map_core.js gọi: VehicleSim.start(latlngs, vehicle) sau khi vẽ tuyến
 * Dùng requestAnimationFrame, nội suy theo quãng đường thực (haversine)
 * ========================================================
 */

const VehicleSim = (function () {
  let marker = null;
  let rafId = null;
  let restartTimer = null;

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
    marker = L.marker(latlngs[0], {
      icon: L.divIcon({
        html: `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));">${emoji}</div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      }),
      interactive: false,
      zIndexOffset: 1000
    }).addTo(map);

    // Thời gian chạy demo: 8s - 25s tuỳ độ dài tuyến
    const duration = Math.max(8000, Math.min(25000, total * 4));
    let startTs = null;
    let seg = 1;

    function frame(ts) {
      if (startTs === null) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const dist = progress * total;

      while (seg < cum.length - 1 && cum[seg] < dist) seg++;
      const segLen = cum[seg] - cum[seg - 1] || 1;
      const t = Math.min(Math.max((dist - cum[seg - 1]) / segLen, 0), 1);
      const a = latlngs[seg - 1], b = latlngs[seg];
      marker.setLatLng([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);

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
