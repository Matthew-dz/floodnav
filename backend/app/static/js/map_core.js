/**
 * ========================================================
 * FloodNav - Core Map & Navigation Controller
 * Phụ trách chính: Thành viên 1 (Junior Frontend)
 * ========================================================
 */

// Global State
let map;
let floodPoints = [];
let floodMarkersLayer = L.layerGroup();
let floodCirclesLayer = L.layerGroup();
let routeLayers = { safe: null, fastest: null };
let pickMarkers = { origin: null, destination: null, report: null };
let currentPickMode = null; // 'origin', 'destination', 'report'

let coords = {
  origin: null,
  destination: null,
  report: null
};

// 1. Khởi tạo bản đồ OpenStreetMap & CartoDB (100% Free & Open Source ODbL)
function initMap() {
  // Tâm bản đồ tại trung tâm khu vực nghiên cứu Hà Nội (Cầu Giấy - Đống Đa)
  map = L.map('map', {
    center: [21.0285, 105.8030],
    zoom: 14,
    zoomControl: true
  });

  // Lớp bản đồ chính: ESRI World Street Map (Akamai CDN tốc độ cao, 100% không dính watermark, không cần API key)
  const esriLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Lớp bản đồ OpenStreetMap France (CDN châu Âu tốc độ cao, không watermark)
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

  L.control.layers({
    'Bản đồ Đường phố (ESRI - Khuyên dùng)': esriLayer,
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

  // Tải dữ liệu điểm ngập ban đầu
  loadFloodPoints();
}

// 2. Tải danh sách điểm ngập từ Backend PostGIS API
async function loadFloodPoints() {
  try {
    const res = await fetch('/api/flood-points');
    const data = await res.json();
    floodPoints = data.features || [];
    renderFloodMarkers();
    renderPointsList();
    const countEl = document.getElementById('points-count');
    if (countEl) countEl.innerText = floodPoints.length;
  } catch (err) {
    console.error('Lỗi khi tải điểm ngập:', err);
  }
}

// 3. Hiển thị Marker và Vùng ngập nước trên Bản đồ
function renderFloodMarkers() {
  floodMarkersLayer.clearLayers();
  floodCirclesLayer.clearLayers();

  floodPoints.forEach(fp => {
    const [lng, lat] = fp.geometry.coordinates;
    const p = fp.properties;
    const depth = p.depth_cm;
    const status = p.status; // 'safe', 'warning', 'danger'

    let bgColor = '#10b981'; // Green: Safe (<5cm)
    let pulseClass = '';
    let radiusColor = '#10b981';

    if (status === 'warning') {
      bgColor = '#f59e0b'; // Amber: 5 - 19cm
      pulseClass = 'flood-pulse-warning';
      radiusColor = '#f59e0b';
    } else if (status === 'danger') {
      bgColor = '#ef4444'; // Red: >=20cm
      pulseClass = 'flood-pulse-danger';
      radiusColor = '#ef4444';
    }

    // Vẽ vùng bán kính ảnh hưởng lan tỏa (Flood Radius Circle)
    if (depth >= 5) {
      const radiusMeters = Math.min(100 + depth * 2, 250);
      const circle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: radiusColor,
        fillColor: radiusColor,
        fillOpacity: 0.18,
        weight: 1.5,
        dashArray: '4, 4'
      });
      floodCirclesLayer.addLayer(circle);
    }

    // Custom Round Marker
    const iconHtml = `
      <div class="custom-marker ${pulseClass}" style="width: 32px; height: 32px; background-color: ${bgColor};">
        <span>${Math.round(depth)}cm</span>
      </div>
    `;

    const icon = L.divIcon({
      html: iconHtml,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });

    const marker = L.marker([lat, lng], { icon });

    // Popup thông tin & cập nhật nhanh
    const popupContent = `
      <div class="p-2 min-w-[210px] font-sans">
        <div class="font-bold text-sm text-slate-800">${p.name}</div>
        <div class="text-[11px] text-slate-500 mb-2">Mã cảm biến: <span class="font-mono font-semibold">${p.sensor_id || 'N/A'}</span></div>
        
        <div class="flex items-center justify-between text-xs py-1 border-t border-slate-100">
          <span class="text-slate-600">Mực nước đo được:</span>
          <span class="font-bold text-sm" style="color: ${bgColor};">${depth} cm</span>
        </div>
        <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100 mb-2">
          <span class="text-slate-600">Ngưỡng xe máy:</span>
          <span class="font-semibold text-slate-700">${p.threshold_cm} cm</span>
        </div>

        <div class="mt-2 pt-1">
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Cập nhật mực nước (cm):</label>
          <div class="flex gap-1">
            <input type="number" id="quick-depth-${p.id}" value="${depth}" min="0" max="100" class="w-16 px-2 py-1 text-xs border rounded bg-white text-slate-800">
            <button onclick="updateSensorDepth(${p.id}, document.getElementById('quick-depth-${p.id}').value)" class="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition shadow-sm">
              Lưu
            </button>
          </div>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent);
    floodMarkersLayer.addLayer(marker);
  });
}

// 4. Render danh sách điểm ngập trong Tab
function renderPointsList() {
  const container = document.getElementById('points-list');
  if (!container) return;
  container.innerHTML = '';

  floodPoints.forEach(fp => {
    const [lng, lat] = fp.geometry.coordinates;
    const p = fp.properties;
    const depth = p.depth_cm;
    const status = p.status;

    let badgeClass = 'bg-emerald-100 text-emerald-800';
    let statusText = 'An toàn';
    if (status === 'warning') {
      badgeClass = 'bg-amber-100 text-amber-800';
      statusText = 'Cảnh báo ngập';
    } else if (status === 'danger') {
      badgeClass = 'bg-rose-100 text-rose-800';
      statusText = 'Nguy hiểm (Chặn)';
    }

    const div = document.createElement('div');
    div.className = 'p-3 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition space-y-2';
    div.innerHTML = `
      <div class="flex items-start justify-between">
        <div>
          <span class="font-bold text-xs text-slate-900 block">${p.name}</span>
          <span class="text-[10px] text-slate-400 font-mono">${p.sensor_id}</span>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}">${statusText}</span>
      </div>

      <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
        <span class="text-slate-500">Mực nước: <strong class="text-slate-800">${depth} cm</strong></span>
        <button onclick="flyToPoint(${lat}, ${lng})" class="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
          <i data-lucide="crosshair" class="w-3 h-3"></i> Xem
        </button>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <input type="range" min="0" max="60" value="${depth}" class="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer" onchange="updateSensorDepth(${p.id}, this.value)">
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

// 5. Cập nhật số đo mực nước cảm biến
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
    alert('Lỗi cập nhật số đo: ' + err.message);
  }
}

// 6. Xử lý sự kiện nhấp chọn điểm trên bản đồ
function onMapClick(e) {
  const { lat, lng } = e.latlng;

  if (currentPickMode === 'origin') {
    coords.origin = { lat, lng };
    document.getElementById('origin-text').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    setPin('origin', lat, lng, '#10b981', 'Điểm xuất phát');
    cancelPickMode();
  } else if (currentPickMode === 'destination') {
    coords.destination = { lat, lng };
    document.getElementById('dest-text').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    setPin('destination', lat, lng, '#f43f5e', 'Điểm đến');
    cancelPickMode();
  } else if (currentPickMode === 'report') {
    coords.report = { lat, lng };
    document.getElementById('report-coord-text').innerText = `Toạ độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    setPin('report', lat, lng, '#6366f1', 'Vị trí báo ngập');
    cancelPickMode();
  }
}

function setPin(type, lat, lng, color, title) {
  if (pickMarkers[type]) {
    map.removeLayer(pickMarkers[type]);
  }
  const marker = L.circleMarker([lat, lng], {
    radius: 8,
    fillColor: color,
    color: '#ffffff',
    weight: 3,
    opacity: 1,
    fillOpacity: 1
  }).bindTooltip(title, { permanent: true, direction: 'top', offset: [0, -8] });

  marker.addTo(map);
  pickMarkers[type] = marker;
}

function setPickMode(mode) {
  currentPickMode = mode;
  const hint = document.getElementById('pick-hint');
  const hintText = document.getElementById('pick-hint-text');
  hint.classList.remove('hidden');

  if (mode === 'origin') hintText.innerText = 'Nhấp lên bản đồ để chọn Điểm xuất phát';
  if (mode === 'destination') hintText.innerText = 'Nhấp lên bản đồ để chọn Điểm đến';
  if (mode === 'report') hintText.innerText = 'Nhấp lên bản đồ tại vị trí đang ngập';
}

function cancelPickMode() {
  currentPickMode = null;
  const hint = document.getElementById('pick-hint');
  if (hint) hint.classList.add('hidden');
}

function setPresetRoute(oLng, oLat, dLng, dLat, label) {
  coords.origin = { lat: oLat, lng: oLng };
  coords.destination = { lat: dLat, lng: dLng };
  document.getElementById('origin-text').value = `${oLat.toFixed(4)}, ${oLng.toFixed(4)}`;
  document.getElementById('dest-text').value = `${dLat.toFixed(4)}, ${dLng.toFixed(4)}`;
  setPin('origin', oLat, oLng, '#10b981', 'Điểm xuất phát');
  setPin('destination', dLat, dLng, '#f43f5e', 'Điểm đến');
  calculateRoute();
}

function onVehicleChange() {
  if (coords.origin && coords.destination) {
    calculateRoute();
  }
}

// 7. Gọi API định tuyến tránh ngập
async function calculateRoute() {
  if (!coords.origin || !coords.destination) {
    alert('Vui lòng chọn Điểm xuất phát và Điểm đến trước!');
    return;
  }

  const vehicle = document.querySelector('input[name="vehicle"]:checked').value;
  const btn = document.getElementById('btn-submit-route');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i><span>Đang tính toán lộ trình...</span>';
  if (window.lucide) lucide.createIcons();

  try {
    const payload = {
      origin: { lng: coords.origin.lng, lat: coords.origin.lat },
      destination: { lng: coords.destination.lng, lat: coords.destination.lat },
      vehicle: vehicle
    };

    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Không thể tìm đường trong khu vực này');
    }

    const data = await res.json();
    renderRoute(data);

    // Kích hoạt Cảnh báo Giọng nói Tiếng Việt nếu Thành viên 3 đã nạp module
    if (window.VoiceWarning) {
      VoiceWarning.speakRouteResult(data);
    }
  } catch (err) {
    alert('Lỗi tìm đường: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="compass" class="w-5 h-5"></i><span>Tìm Lộ Trình Né Ngập</span>';
    if (window.lucide) lucide.createIcons();
  }
}

// 8. Vẽ lộ trình an toàn và lộ trình nhanh nhất lên bản đồ
function renderRoute(data) {
  if (routeLayers.safe) map.removeLayer(routeLayers.safe);
  if (routeLayers.fastest) map.removeLayer(routeLayers.fastest);

  const resDiv = document.getElementById('route-results');
  resDiv.classList.remove('hidden');

  const safe = data.safe;
  const fastest = data.fastest;

  // Safe Route (Tuyến đường an toàn)
  if (safe && safe.found) {
    document.getElementById('safe-dist').innerText = (safe.distance_m / 1000).toFixed(2) + ' km';
    document.getElementById('safe-time').innerText = safe.duration_min.toFixed(1) + ' phút';
    
    let warningsHtml = '';
    if (safe.flood_warnings && safe.flood_warnings.length > 0) {
      warningsHtml = `<div class="mt-1 text-amber-700">⚠️ Có ${safe.flood_warnings.length} đoạn ngập nhẹ trên đường, hãy giảm tốc độ.</div>`;
    } else {
      warningsHtml = `<div class="mt-1 text-emerald-700 font-semibold">✨ Tuyệt đối an toàn: Không qua bất kỳ đoạn ngập nào!</div>`;
    }
    document.getElementById('safe-warnings').innerHTML = warningsHtml;

    const latlngs = safe.geometry.coordinates.map(c => [c[1], c[0]]);
    routeLayers.safe = L.polyline(latlngs, {
      color: '#2563eb', // Blue solid
      weight: 6,
      opacity: 0.85,
      lineJoin: 'round'
    }).addTo(map);

    map.fitBounds(routeLayers.safe.getBounds(), { padding: [50, 50] });

    // Mô phỏng xe chạy dọc lộ trình an toàn (vehicle_sim.js)
    if (window.VehicleSim) {
      const v = document.querySelector('input[name="vehicle"]:checked');
      VehicleSim.start(latlngs, v ? v.value : 'motorbike');
    }
  } else {
    document.getElementById('safe-dist').innerText = '--';
    document.getElementById('safe-time').innerText = '--';
    if (window.VehicleSim) VehicleSim.stop();
    document.getElementById('safe-warnings').innerHTML = '<span class="text-rose-600 font-bold">Không còn đường đi an toàn do các ngả đều ngập sâu quá ngưỡng!</span>';
  }

  // Fastest Route (Tuyến đường nhanh nhất)
  if (fastest && fastest.found) {
    document.getElementById('fastest-dist').innerText = (fastest.distance_m / 1000).toFixed(2) + ' km';
    document.getElementById('fastest-time').innerText = fastest.duration_min.toFixed(1) + ' phút';

    const badge = document.getElementById('fastest-badge');
    const fWarnings = document.getElementById('fastest-warnings');

    if (data.same_route) {
      badge.innerText = 'Trùng lộ trình an toàn';
      badge.className = 'text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full';
      fWarnings.innerText = 'Lộ trình nhanh nhất hiện tại cũng là lộ trình an toàn nhất.';
    } else {
      badge.innerText = 'Có nguy cơ ngập';
      badge.className = 'text-[10px] font-semibold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full';
      
      let warnText = '';
      if (fastest.flood_warnings && fastest.flood_warnings.length > 0) {
        warnText = `Cảnh báo: Đi qua ${fastest.flood_warnings.length} điểm ngập (có thể chết máy)!`;
      }
      fWarnings.innerText = warnText;

      const flatlngs = fastest.geometry.coordinates.map(c => [c[1], c[0]]);
      routeLayers.fastest = L.polyline(flatlngs, {
        color: '#ef4444',
        weight: 4,
        opacity: 0.7,
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
  ['route', 'points', 'report'].forEach(t => {
    const tabEl = document.getElementById(`tab-${t}`);
    const btnEl = document.getElementById(`tab-btn-${t}`);
    if (tabEl) tabEl.classList.add('hidden');
    if (btnEl) btnEl.className = 'flex-1 py-3 px-2 border-b-2 border-transparent hover:text-slate-900 flex items-center justify-center gap-1.5 transition text-slate-600';
  });

  const activeTab = document.getElementById(`tab-${tabId}`);
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeTab) activeTab.classList.remove('hidden');
  if (activeBtn) activeBtn.className = 'flex-1 py-3 px-2 border-b-2 border-blue-600 text-blue-600 flex items-center justify-center gap-1.5 transition font-bold';
  cancelPickMode();
}

// 11. Chuyển đổi Dark Mode
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  const btn = document.getElementById('dark-mode-icon');
  if (btn) {
    btn.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
  }
}
