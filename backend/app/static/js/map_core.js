/**
 * ========================================================
 * FloodNav - Map Controller & Core Interaction
 * Phụ trách: Thành viên 1 & Thành viên 2 (Hợp tác nâng cấp)
 * Thư viện: Leaflet 1.9.4 (BSD-2-Clause - OSI Approved)
 * ========================================================
 */

let map = null;
let floodMarkersLayer = L.layerGroup();
let floodCirclesLayer = L.layerGroup();
let routeLayers = { safe: null, fastest: null };
let pickMarkers = { origin: null, destination: null, report: null };

let currentBaseLayer = null;
let esriBaseLayer = null;
let darkBaseLayer = null;

let coords = {
  origin: null,
  destination: null,
  report: null
};

let currentPickMode = null; // 'origin' | 'destination' | 'report' | null
let floodPoints = [];

// 1. Khởi tạo bản đồ
function initMap() {
  // Tâm bản đồ tại trung tâm khu vực nghiên cứu Hà Nội (Cầu Giấy - Đống Đa)
  map = L.map('map', {
    center: [21.0285, 105.8030],
    zoom: 14,
    zoomControl: true
  });

  // Lớp bản đồ chính: ESRI World Street Map (Akamai CDN tốc độ cao, không dính watermark, không cần API key)
  esriBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; OpenStreetMap contributors',
    maxZoom: 19
  });

  // Lớp bản đồ Dark Mode chuyên nghiệp (CartoDB Dark Matter sạch, nét từng tuyến phố ban đêm)
  darkBaseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
    subdomains: 'abcd'
  });

  // Lớp bản đồ OpenStreetMap France (CDN châu Âu tốc độ cao)
  const osmFrLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap France &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c']
  });

  // Lớp bản đồ tiêu chuẩn OSM
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c']
  });

  // Mặc định nạp ESRI
  currentBaseLayer = esriBaseLayer;
  currentBaseLayer.addTo(map);

  L.control.layers({
    'Bản đồ Đường phố (ESRI)': esriBaseLayer,
    'Chế độ Ban đêm (Dark Matter)': darkBaseLayer,
    'OpenStreetMap (Bản đồ Pháp OSM-FR)': osmFrLayer,
    'OpenStreetMap Chuẩn': osmLayer
  }, null, { position: 'topright' }).addTo(map);

  floodCirclesLayer.addTo(map);
  floodMarkersLayer.addTo(map);

  map.on('click', onMapClick);

  // Tự động tính toán lại kích thước bản đồ tránh lỗi màn hình xám khi layout flex tải xong
  map.whenReady(() => {
    map.invalidateSize();
  });
  setTimeout(() => { if (map) map.invalidateSize(); }, 250);
  setTimeout(() => { if (map) map.invalidateSize(); }, 800);
  window.addEventListener('resize', () => { if (map) map.invalidateSize(); });

  // Tải danh sách điểm ngập ban đầu
  loadFloodPoints();

  // Kiểm tra và hiển thị hướng dẫn người dùng mới (Onboarding Guide)
  checkFirstTimeVisitor();
}

// 2. Tải danh sách 8 điểm ngập và vẽ lên bản đồ
async function loadFloodPoints() {
  try {
    const res = await fetch('/api/flood-points');
    const geojson = await res.json();
    renderFloodPoints(geojson);
  } catch (err) {
    console.error('Lỗi tải danh sách điểm ngập:', err);
  }
}

function renderFloodPoints(geojson) {
  floodPoints = geojson.features.map(f => ({
    id: f.properties.id,
    name: f.properties.name,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    depth_cm: f.properties.depth_cm,
    threshold_cm: f.properties.threshold_cm,
    status: f.properties.status
  }));

  // Cập nhật số đếm trên Tab
  const countEl = document.getElementById('points-count');
  if (countEl) countEl.innerText = floodPoints.length;

  floodMarkersLayer.clearLayers();
  floodCirclesLayer.clearLayers();

  floodPoints.forEach(fp => {
    const { id, name, lng, lat, depth_cm, threshold_cm, status } = fp;
    const depth = Number(depth_cm) || 0;

    let bgColor = '#10b981'; // Xanh lá: an toàn
    let pulseClass = '';
    let radiusColor = '#10b981';

    if (status === 'warning') {
      bgColor = '#f59e0b'; // Vàng: 5-20cm
      pulseClass = 'flood-pulse-warning';
      radiusColor = '#f59e0b';
    } else if (status === 'danger') {
      bgColor = '#ef4444'; // Đỏ: >=20cm
      pulseClass = 'flood-pulse-danger';
      radiusColor = '#ef4444';
    }

    // FE-04 Nâng cấp: Hiệu ứng vùng ngập nước sóng tỏa động (Animated Pulsing Flood Waves)
    if (depth >= 5) {
      const radiusMeters = Math.min(100 + depth * 2.5, 300);
      
      // Vòng ngoài mờ lan tỏa
      const outerCircle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: radiusColor,
        fillColor: radiusColor,
        fillOpacity: depth >= 20 ? 0.22 : 0.14,
        weight: depth >= 20 ? 2 : 1,
        dashArray: depth >= 20 ? '5, 5' : '8, 8',
        className: depth >= 20 ? 'animated-flood-ring' : ''
      });
      outerCircle.bindTooltip(`<b>${fp.name}</b><br/>Mực nước: ${depth} cm | Ngưỡng ngập: ${threshold_cm} cm`, { direction: 'top' });
      floodCirclesLayer.addLayer(outerCircle);

      // Vòng tâm lõi đậm
      const innerCircle = L.circle([lat, lng], {
        radius: Math.max(30, radiusMeters * 0.4),
        color: radiusColor,
        fillColor: radiusColor,
        fillOpacity: 0.35,
        weight: 1
      });
      floodCirclesLayer.addLayer(innerCircle);
    }

    // Marker tròn hiển thị số cm ngập
    const icon = L.divIcon({
      className: 'custom-flood-pin',
      html: `
        <div class="custom-marker ${pulseClass}" style="width: 32px; height: 32px; background-color: ${bgColor};">
          <span>${Math.round(depth)}cm</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([lat, lng], { icon });
    marker.bindPopup(`
      <div class="text-xs space-y-1 p-1">
        <h4 class="font-bold text-slate-900 text-sm">${name}</h4>
        <p class="text-slate-600">Mực nước hiện tại: <b class="text-blue-600 font-mono">${depth} cm</b></p>
        <p class="text-slate-500 text-[11px]">Ngưỡng chịu đựng: ${threshold_cm} cm</p>
        <div class="pt-1.5 flex gap-1">
          <button onclick="setAsRouteTarget(${lng}, ${lat}, 'origin')" class="px-2 py-1 bg-emerald-500 text-white rounded text-[10px] font-semibold hover:bg-emerald-600">Đặt làm Điểm Đi</button>
          <button onclick="setAsRouteTarget(${lng}, ${lat}, 'destination')" class="px-2 py-1 bg-rose-500 text-white rounded text-[10px] font-semibold hover:bg-rose-600">Đặt làm Điểm Đến</button>
        </div>
      </div>
    `);
    floodMarkersLayer.addLayer(marker);
  });

  renderPointsList();
}

function setAsRouteTarget(lng, lat, type) {
  if (type === 'origin') {
    coords.origin = { lng, lat };
    document.getElementById('origin-text').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    updatePickMarker('origin', lat, lng, '#10b981', 'Điểm xuất phát');
  } else {
    coords.destination = { lng, lat };
    document.getElementById('dest-text').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    updatePickMarker('destination', lat, lng, '#ef4444', 'Điểm đến');
  }
  map.closePopup();
  switchTab('route');
}

// 3. Render danh sách điểm ngập ở Tab 2
function renderPointsList() {
  const container = document.getElementById('points-list');
  if (!container) return;
  container.innerHTML = '';

  floodPoints.forEach(fp => {
    const { id, name, depth_cm, threshold_cm, status, lat, lng } = fp;
    const depth = Number(depth_cm) || 0;
    let badgeBg = 'bg-emerald-100 text-emerald-800';
    let badgeText = 'An toàn';
    if (status === 'warning') {
      badgeBg = 'bg-amber-100 text-amber-800';
      badgeText = 'Cảnh báo';
    } else if (status === 'danger') {
      badgeBg = 'bg-rose-100 text-rose-800';
      badgeText = 'Nguy hiểm';
    }

    const div = document.createElement('div');
    div.className = 'p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 hover:border-blue-400 transition';
    div.innerHTML = `
      <div class="flex items-center justify-between">
        <h4 class="font-bold text-xs text-slate-800 cursor-pointer hover:text-blue-600" onclick="flyToPoint(${lat}, ${lng})">
          ${name}
        </h4>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg}">${badgeText}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[11px] text-slate-500">Mực nước:</span>
        <input type="range" min="0" max="60" value="${depth}" 
               class="flex-1 accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
               onchange="updateSensorDepth(${id}, this.value)"
               oninput="this.nextElementSibling.innerText = this.value + 'cm'">
        <span class="text-[11px] font-mono w-8 text-right font-bold text-slate-700">${depth}cm</span>
      </div>
    `;
    container.appendChild(div);
  });
  if (window.lucide) lucide.createIcons();
}

function flyToPoint(lat, lng) {
  map.flyTo([lat, lng], 16, { duration: 1 });
}

// 4. Cập nhật số đo mực nước cảm biến
async function updateSensorDepth(pointId, depthCm) {
  try {
    const res = await fetch('/api/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        point_id: Number(pointId),
        depth_cm: Number(depthCm),
        source: 'sensor'
      })
    });
    if (res.ok) {
      await loadFloodPoints();
      if (coords.origin && coords.destination) {
        calculateRoute();
      }
    }
  } catch (err) {
    console.error('Lỗi cập nhật số đo cảm biến:', err);
  }
}

// 5. Chế độ chọn điểm trên bản đồ (Pick Mode)
function setPickMode(mode) {
  currentPickMode = mode;
  const hint = document.getElementById('pick-hint');
  const hintText = document.getElementById('pick-hint-text');
  hint.classList.remove('hidden');

  if (mode === 'origin') {
    hintText.innerText = 'Nhấp lên bản đồ để chọn Điểm xuất phát...';
  } else if (mode === 'destination') {
    hintText.innerText = 'Nhấp lên bản đồ để chọn Điểm đến...';
  } else if (mode === 'report') {
    hintText.innerText = 'Nhấp lên vị trí ngập bạn muốn báo cáo...';
  }
}

function cancelPickMode() {
  currentPickMode = null;
  const hint = document.getElementById('pick-hint');
  if (hint) hint.classList.add('hidden');
}

function onMapClick(e) {
  if (!currentPickMode) return;

  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  if (currentPickMode === 'origin') {
    coords.origin = { lat, lng };
    document.getElementById('origin-text').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    updatePickMarker('origin', lat, lng, '#10b981', 'Điểm xuất phát');
  } else if (currentPickMode === 'destination') {
    coords.destination = { lat, lng };
    document.getElementById('dest-text').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    updatePickMarker('destination', lat, lng, '#ef4444', 'Điểm đến');
  } else if (currentPickMode === 'report') {
    coords.report = { lat, lng };
    document.getElementById('report-coord-text').innerText = `Toạ độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    updatePickMarker('report', lat, lng, '#f43f5e', 'Vị trí báo ngập');
  }

  cancelPickMode();
}

function updatePickMarker(type, lat, lng, color, label) {
  if (pickMarkers[type]) {
    map.removeLayer(pickMarkers[type]);
  }
  const marker = L.circleMarker([lat, lng], {
    radius: 8,
    fillColor: color,
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9
  }).bindTooltip(label, { permanent: true, direction: 'top' });
  marker.addTo(map);
  pickMarkers[type] = marker;
}

// 6. Cài đặt lộ trình mẫu nhanh
function setPresetRoute(oLng, oLat, dLng, dLat, name) {
  coords.origin = { lng: oLng, lat: oLat };
  coords.destination = { lng: dLng, lat: dLat };

  document.getElementById('origin-text').value = `${oLat.toFixed(4)}, ${oLng.toFixed(4)}`;
  document.getElementById('dest-text').value = `${dLat.toFixed(4)}, ${dLng.toFixed(4)}`;

  updatePickMarker('origin', oLat, oLng, '#10b981', 'Điểm xuất phát');
  updatePickMarker('destination', dLat, dLng, '#ef4444', 'Điểm đến');

  calculateRoute();
}

// 7. Gọi API Tìm đường Né ngập
async function calculateRoute() {
  if (!coords.origin || !coords.destination) {
    alert('Vui lòng chọn cả Điểm xuất phát và Điểm đến!');
    return;
  }

  const vehicle = document.querySelector('input[name="vehicle"]:checked').value;
  const btn = document.getElementById('btn-submit-route');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang tính toán lộ trình A*...</span>`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: coords.origin,
        destination: coords.destination,
        vehicle: vehicle,
        use_ai_prediction: true
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || 'Không thể tìm thấy lộ trình');
    }

    const data = await res.json();
    displayRouteResults(data);
  } catch (err) {
    alert('Lỗi tìm đường: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="compass" class="w-5 h-5"></i><span>Tìm Lộ Trình Né Ngập</span>`;
    if (window.lucide) lucide.createIcons();
  }
}

function onVehicleChange() {
  if (coords.origin && coords.destination) {
    calculateRoute();
  }
}

// 8. Vẽ lộ trình lên bản đồ
function displayRouteResults(data) {
  const resultCard = document.getElementById('route-results');
  resultCard.classList.remove('hidden');

  // Xóa lộ trình cũ
  if (routeLayers.safe) map.removeLayer(routeLayers.safe);
  if (routeLayers.fastest) map.removeLayer(routeLayers.fastest);

  const { safe, fastest, same_route } = data;

  // Lộ trình an toàn (Màu xanh đậm nét)
  if (safe && safe.found) {
    document.getElementById('safe-dist').innerText = (safe.distance_m / 1000).toFixed(2) + ' km';
    document.getElementById('safe-time').innerText = safe.duration_min.toFixed(1) + ' phút';

    const safeWarnings = document.getElementById('safe-warnings');
    if (safe.flood_warnings && safe.flood_warnings.length > 0) {
      safeWarnings.innerHTML = `⚠️ Chú ý: Tuyến đi qua mép ngập nhẹ (${safe.flood_warnings.join(', ')})`;
    } else {
      safeWarnings.innerHTML = `✨ Tuyến đường hoàn toàn khô ráo, không bị ngập.`;
    }

    if (safe.geometry && safe.geometry.coordinates) {
      const latlngs = safe.geometry.coordinates.map(c => [c[1], c[0]]);
      routeLayers.safe = L.polyline(latlngs, {
        color: '#2563eb', // Blue-600
        weight: 6,
        opacity: 0.9,
        lineJoin: 'round'
      }).addTo(map);
      map.fitBounds(routeLayers.safe.getBounds(), { padding: [40, 40] });

      // Gọi module cảnh báo âm thanh
      if (window.VoiceWarning) {
        VoiceWarning.speakRoutePlan(safe, same_route);
      }
    }
  } else {
    document.getElementById('safe-dist').innerText = 'Không thể đi';
    document.getElementById('safe-time').innerText = 'Bị chặn';
    document.getElementById('safe-warnings').innerText = safe.reason || 'Nước ngập quá sâu, mọi ngả đường đều bị chặn!';
  }

  // Lộ trình nhanh nhất (Nét đứt màu xám/đỏ)
  if (fastest && fastest.found) {
    document.getElementById('fastest-dist').innerText = (fastest.distance_m / 1000).toFixed(2) + ' km';
    document.getElementById('fastest-time').innerText = fastest.duration_min.toFixed(1) + ' phút';

    const badge = document.getElementById('fastest-badge');
    const warnings = document.getElementById('fastest-warnings');

    if (same_route) {
      badge.innerText = 'Trùng lộ trình an toàn';
      badge.className = 'text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full';
      warnings.innerText = 'Đường ngắn nhất hiện không bị ngập.';
    } else {
      badge.innerText = 'Bị ngập sâu!';
      badge.className = 'text-[10px] font-semibold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full';
      warnings.innerHTML = `⚠️ Bị ngập tại: ${fastest.flood_warnings.join(', ') || 'Đoạn trũng'}`;

      const latlngs = fastest.geometry.coordinates.map(c => [c[1], c[0]]);
      routeLayers.fastest = L.polyline(latlngs, {
        color: '#94a3b8',
        weight: 4,
        opacity: 0.6,
        dashArray: '8, 8'
      }).addTo(map);
    }
  }
}

// 9. Báo cáo ngập cộng đồng
async function submitReport() {
  if (!coords.report) {
    alert('Vui lòng chọn vị trí ngập trên bản đồ trước!');
    return;
  }
  const level = document.querySelector('input[name="report_level"]:checked').value;
  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lng: coords.report.lng,
        lat: coords.report.lat,
        level: level
      })
    });
    if (res.ok) {
      alert('Cảm ơn bạn! Báo cáo ngập đã được gửi lên hệ thống.');
      coords.report = null;
      document.getElementById('report-coord-text').innerText = 'Nhấp vào đây rồi bấm lên bản đồ';
      if (pickMarkers.report) map.removeLayer(pickMarkers.report);
      loadFloodPoints();
    }
  } catch (err) {
    alert('Lỗi gửi báo cáo: ' + err.message);
  }
}

// 10. Chuyển đổi Tab Sidebar
function switchTab(tabId) {
  ['route', 'points', 'report'].forEach(id => {
    const tab = document.getElementById(`tab-${id}`);
    const btn = document.getElementById(`tab-btn-${id}`);
    if (tab) tab.classList.add('hidden');
    if (btn) btn.className = 'flex-1 py-3 px-2 border-b-2 border-transparent hover:text-slate-900 flex items-center justify-center gap-1.5 transition text-xs font-semibold text-slate-600';
  });

  const activeTab = document.getElementById(`tab-${tabId}`);
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeTab) activeTab.classList.remove('hidden');
  if (activeBtn) activeBtn.className = 'flex-1 py-3 px-2 border-b-2 border-blue-600 text-blue-600 flex items-center justify-center gap-1.5 transition font-bold text-xs';
  cancelPickMode();
}

// 11. Chuyển đổi Dark Mode nâng cao (CartoDB Dark Matter)
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  const btn = document.getElementById('dark-mode-icon');
  if (btn) {
    btn.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
  }

  // Chuyển đổi lớp nền bản đồ mượt mà
  if (map) {
    if (isDark) {
      if (currentBaseLayer && map.hasLayer(currentBaseLayer)) {
        map.removeLayer(currentBaseLayer);
      }
      darkBaseLayer.addTo(map);
      currentBaseLayer = darkBaseLayer;
    } else {
      if (darkBaseLayer && map.hasLayer(darkBaseLayer)) {
        map.removeLayer(darkBaseLayer);
      }
      esriBaseLayer.addTo(map);
      currentBaseLayer = esriBaseLayer;
    }
  }
}

// 12. Modal Hướng Dẫn Sử Dụng Nhanh (Onboarding Guide - FE-05)
function openHelpGuide() {
  const modal = document.getElementById('onboarding-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeHelpGuide() {
  const modal = document.getElementById('onboarding-modal');
  if (modal) modal.classList.add('hidden');
  try {
    localStorage.setItem('floodnav_tour_seen', 'true');
  } catch (e) {}
}

function checkFirstTimeVisitor() {
  try {
    const seen = localStorage.getItem('floodnav_tour_seen');
    if (!seen) {
      setTimeout(openHelpGuide, 500);
    }
  } catch (e) {}
}
