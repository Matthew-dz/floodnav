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
    // FE: gán map vào window
    

    center: [21.020, 105.815],

    zoom: 13,

    zoomControl: true

  });
  window.map = map;



  // Lớp bản đồ chính: ESRI World Street Map (Akamai CDN tốc độ cao, không dính watermark, không cần API key)

  esriBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {

    attribution: 'Tiles &copy; Esri &mdash; OpenStreetMap contributors',

    maxZoom: 19

  });



  // Lớp bản đồ Dark Mode chuyên nghiệp (ESRI World Dark Gray - 100% Free, không cần API key, không dính watermark, Akamai CDN)

  const esriDarkBase = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {

    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',

    maxZoom: 19

  });

  const esriDarkRef = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {

    attribution: '',

    maxZoom: 19

  });

  darkBaseLayer = L.layerGroup([esriDarkBase, esriDarkRef]);



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

    'Chế độ Ban đêm (ESRI Dark)': darkBaseLayer,

    'OpenStreetMap (Bản đồ Pháp OSM-FR)': osmFrLayer,

    'OpenStreetMap Chuẩn': osmLayer

  }, null, { position: 'topright' }).addTo(map);



  // Đồng bộ hóa khi người dùng chuyển lớp bản đồ từ điều khiển Leaflet

  map.on('baselayerchange', (e) => {

    currentBaseLayer = e.layer;

    const isDark = (e.layer === darkBaseLayer);

    if (isDark && !document.body.classList.contains('dark-mode')) {

      document.body.classList.add('dark-mode');

      const btn = document.getElementById('dark-mode-icon');

      if (btn) btn.setAttribute('data-lucide', 'sun');

      if (window.lucide) lucide.createIcons();

    } else if (!isDark && document.body.classList.contains('dark-mode')) {

      document.body.classList.remove('dark-mode');

      const btn = document.getElementById('dark-mode-icon');

      if (btn) btn.setAttribute('data-lucide', 'moon');

      if (window.lucide) lucide.createIcons();

    }

  });



  floodCirclesLayer.addTo(map);

  floodMarkersLayer.addTo(map);



  map.on('click', onMapClick);



  // Cập nhật cảnh báo điểm ngập theo thời gian thực khi người dùng kéo/thu phóng bản đồ

  map.on('moveend', () => {

    updateViewportFloodAlert();

    renderPointsList();

  });



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



function renderFloodPoints(data) {

  if (data && data.features) {

    floodPoints = data.features.map(f => ({

      id: f.properties.id,

      name: f.properties.name,

      lng: f.geometry.coordinates[0],

      lat: f.geometry.coordinates[1],

      depth_cm: f.properties.depth_cm,

      threshold_cm: f.properties.threshold_cm,

      status: f.properties.status

    }));

  } else if (Array.isArray(data)) {

    floodPoints = data;

  }

  window.floodPoints = floodPoints;
  if (!window._initialFloodPoints && floodPoints && floodPoints.length > 0) {
    window._initialFloodPoints = JSON.parse(JSON.stringify(floodPoints));
  }





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

  updateViewportFloodAlert();

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



// 3. Render danh sách điểm ngập ở Tab 2 (Ưu tiên điểm trong khung nhìn bản đồ)

function renderPointsList() {

  const container = document.getElementById('points-list');

  if (!container) return;

  container.innerHTML = '';



  const bounds = map ? map.getBounds() : null;

  const inViewCount = bounds ? floodPoints.filter(fp => bounds.contains([fp.lat, fp.lng])).length : floodPoints.length;

  const summaryEl = document.getElementById('points-viewport-summary');

  if (summaryEl) {

    summaryEl.innerHTML = `<i data-lucide="eye" class="w-3.5 h-3.5 text-blue-600 inline-block mr-1"></i> Trong khung nhìn: <b>${inViewCount}</b> / ${floodPoints.length} điểm`;

  }



  // Sắp xếp: Các điểm trong khung nhìn lên trước, kế tiếp sắp xếp theo mực nước sâu nhất

  const sortedPoints = [...floodPoints].sort((a, b) => {

    const aInView = bounds ? bounds.contains([a.lat, a.lng]) : false;

    const bInView = bounds ? bounds.contains([b.lat, b.lng]) : false;

    if (aInView && !bInView) return -1;

    if (!aInView && bInView) return 1;

    return (Number(b.depth_cm) || 0) - (Number(a.depth_cm) || 0);

  });



  sortedPoints.forEach(fp => {

    const { id, name, depth_cm, threshold_cm, status, lat, lng } = fp;

    const depth = Number(depth_cm) || 0;

    const isInView = bounds ? bounds.contains([lat, lng]) : true;



    let badgeBg = 'bg-emerald-100 text-emerald-800';

    let badgeText = 'An toàn';

    if (status === 'warning') {

      badgeBg = 'bg-amber-100 text-amber-800';

      badgeText = 'Cảnh báo';

    } else if (status === 'danger') {

      badgeBg = 'bg-rose-100 text-rose-800';

      badgeText = 'Nguy hiểm';

    }



    const inViewBadge = isInView ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">Khung nhìn</span>' : '';



    const div = document.createElement('div');

    div.className = `p-3 bg-white rounded-xl border ${isInView ? 'border-blue-300 shadow-sm' : 'border-slate-200 opacity-80'} space-y-2 hover:border-blue-500 transition`;

    div.innerHTML = `

      <div class="flex items-center justify-between gap-1">

        <h4 class="font-bold text-xs text-slate-800 cursor-pointer hover:text-blue-600 truncate flex-1" onclick="flyToPoint(${lat}, ${lng})" title="Nhấp để chuyển tới điểm này">

          ${name}

        </h4>

        <div class="flex items-center gap-1 flex-shrink-0">

          ${inViewBadge}

          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg}">${badgeText}</span>

        </div>

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



// 3.1. Cảnh báo điểm ngập theo khung nhìn hiện tại (Viewport Alert Controller)

let lastVoiceViewportAlertTime = 0;

let viewportAlertTargetPoint = null;



function onViewportAlertClick() {

  if (viewportAlertTargetPoint && map) {

    map.flyTo([viewportAlertTargetPoint.lat, viewportAlertTargetPoint.lng], 15, { duration: 1 });

  }

}



function zoomToAllPoints() {

  if (!map || !floodPoints || floodPoints.length === 0) return;

  const group = L.featureGroup(floodPoints.map(p => L.marker([p.lat, p.lng])));

  map.fitBounds(group.getBounds().pad(0.08));

}



function updateViewportFloodAlert() {

  if (!map || !floodPoints || floodPoints.length === 0) return;



  const alertEl = document.getElementById('viewport-flood-alert');

  const alertText = document.getElementById('viewport-alert-text');

  const alertBtn = document.getElementById('viewport-alert-btn');

  const alertIcon = document.getElementById('viewport-alert-icon');

  if (!alertEl || !alertText || !alertBtn || !alertIcon) return;



  const bounds = map.getBounds();

  const inView = floodPoints.filter(fp => bounds.contains([fp.lat, fp.lng]));

  const dangerInView = inView.filter(fp => fp.status === 'danger' || (Number(fp.depth_cm) >= fp.threshold_cm));

  const warningInView = inView.filter(fp => fp.status === 'warning');



  alertEl.classList.remove('hidden');

  const baseClass = 'absolute px-3.5 py-2 rounded-2xl shadow-xl text-xs font-semibold backdrop-blur-md flex items-center gap-2.5 border transition-all duration-300 pointer-events-auto ';



  if (dangerInView.length > 0) {

    dangerInView.sort((a, b) => (Number(b.depth_cm) || 0) - (Number(a.depth_cm) || 0));

    viewportAlertTargetPoint = dangerInView[0];

    alertEl.className = baseClass + 'bg-rose-50/95 border-rose-300 text-rose-900 shadow-rose-200/50';

    alertIcon.className = 'p-1 rounded-full bg-rose-200 text-rose-700 animate-pulse flex-shrink-0';

    alertIcon.innerHTML = '<i data-lucide="alert-octagon" class="w-4 h-4"></i>';

    

    const spotNames = dangerInView.slice(0, 2).map(p => `${p.name} (${p.depth_cm}cm)`).join(', ');

    const more = dangerInView.length > 2 ? ` và ${dangerInView.length - 2} điểm khác` : '';

    alertText.innerHTML = `<span class="font-bold text-rose-700">Nguy hiểm:</span> ${dangerInView.length} điểm ngập sâu: <b>${spotNames}</b>${more}`;

    

    alertBtn.classList.remove('hidden');

    alertBtn.className = 'px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition flex-shrink-0 shadow';

    alertBtn.innerText = 'Xem điểm ngập';



    // Cảnh báo bằng giọng nói (chống spam mỗi 15 giây)

    const now = Date.now();

    if (window.VoiceWarning && (now - lastVoiceViewportAlertTime > 15000)) {

      lastVoiceViewportAlertTime = now;

      VoiceWarning.speak(`Khu vực này có điểm ngập sâu nguy hiểm tại ${viewportAlertTargetPoint.name}, mực nước ${viewportAlertTargetPoint.depth_cm} centimet.`);

    }

  } else if (warningInView.length > 0) {

    warningInView.sort((a, b) => (Number(b.depth_cm) || 0) - (Number(a.depth_cm) || 0));

    viewportAlertTargetPoint = warningInView[0];

    alertEl.className = baseClass + 'bg-amber-50/95 border-amber-300 text-amber-900 shadow-amber-200/50';

    alertIcon.className = 'p-1 rounded-full bg-amber-200 text-amber-700 flex-shrink-0';

    alertIcon.innerHTML = '<i data-lucide="alert-triangle" class="w-4 h-4"></i>';



    const spotNames = warningInView.slice(0, 2).map(p => `${p.name} (${p.depth_cm}cm)`).join(', ');

    const more = warningInView.length > 2 ? ` và ${warningInView.length - 2} điểm khác` : '';

    alertText.innerHTML = `<span class="font-bold text-amber-700">Chú ý:</span> ${warningInView.length} điểm ngập nhẹ: <b>${spotNames}</b>${more}`;



    alertBtn.classList.remove('hidden');

    alertBtn.className = 'px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition flex-shrink-0 shadow';

    alertBtn.innerText = 'Xem vị trí';

  } else if (inView.length > 0) {

    viewportAlertTargetPoint = null;

    alertEl.className = baseClass + 'bg-emerald-50/95 border-emerald-300 text-emerald-900 shadow-emerald-200/50';

    alertIcon.className = 'p-1 rounded-full bg-emerald-200 text-emerald-700 flex-shrink-0';

    alertIcon.innerHTML = '<i data-lucide="shield-check" class="w-4 h-4"></i>';



    alertText.innerHTML = `Khu vực đang xem có <b>${inView.length}</b> trạm quan trắc, tất cả đều an toàn (&lt;5cm)`;

    alertBtn.classList.add('hidden');

  } else {

    // Không có điểm ngập nào trong khung nhìn -> tìm điểm gần nhất tâm bản đồ

    const center = map.getCenter();

    let minDist = Infinity;

    let nearest = null;

    floodPoints.forEach(fp => {

      const d = map.distance(center, [fp.lat, fp.lng]);

      if (d < minDist) {

        minDist = d;

        nearest = fp;

      }

    });



    viewportAlertTargetPoint = nearest;

    alertEl.className = baseClass + 'bg-slate-900/90 border-slate-700 text-white shadow-xl';

    alertIcon.className = 'p-1 rounded-full bg-slate-800 text-cyan-300 flex-shrink-0';

    alertIcon.innerHTML = '<i data-lucide="map-pin" class="w-4 h-4"></i>';



    const distKm = (minDist / 1000).toFixed(1);

    alertText.innerHTML = `Chưa có điểm ngập trong khung nhìn. Gần nhất: <b>${nearest.name}</b> (${distKm} km)`;

    alertBtn.classList.remove('hidden');

    alertBtn.className = 'px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition flex-shrink-0 shadow';

    alertBtn.innerText = 'Đến xem';

  }



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



// 5. Chế độ chọn điểm trên bản đồ & Điều khiển giao diện Mobile (FE-02)

function toggleMobilePanel(show) {

  const panel = document.getElementById('sidebar-panel');

  const openBtn = document.getElementById('btn-mobile-open-panel');

  if (!panel) return;



  if (show) {

    panel.classList.remove('translate-y-full');

    panel.classList.add('translate-y-0');

    if (openBtn) openBtn.classList.add('hidden');

  } else {

    panel.classList.add('translate-y-full');

    panel.classList.remove('translate-y-0');

    if (openBtn) openBtn.classList.remove('hidden');

  }



  setTimeout(() => {

    if (window.map) map.invalidateSize();

  }, 320);

}



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



  // Tự động thu gọn bảng điều khiển trên Mobile để người dùng dễ dàng chấm điểm trên bản đồ

  if (window.innerWidth < 640) {

    toggleMobilePanel(false);

  }

}



function cancelPickMode() {

  currentPickMode = null;

  const hint = document.getElementById('pick-hint');

  if (hint) hint.classList.add('hidden');

  if (window.innerWidth < 640) {

    toggleMobilePanel(true);

  }

}



function onMapClick(e) {

  if (!currentPickMode) return;



  const lat = e.latlng.lat;

  const lng = e.latlng.lng;



  if (currentPickMode === 'origin') {

    coords.origin = { lat, lng };

    document.getElementById('origin-text').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const clr = document.getElementById('btn-clear-origin');

    if (clr) clr.classList.remove('hidden');

    updatePickMarker('origin', lat, lng, '#10b981', 'Điểm xuất phát');

  } else if (currentPickMode === 'destination') {

    coords.destination = { lat, lng };

    document.getElementById('dest-text').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const clr = document.getElementById('btn-clear-dest');

    if (clr) clr.classList.remove('hidden');

    updatePickMarker('destination', lat, lng, '#ef4444', 'Điểm đến');

  } else if (currentPickMode === 'report') {

    coords.report = { lat, lng };

    document.getElementById('report-coord-text').innerText = `Toạ độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    updatePickMarker('report', lat, lng, '#f43f5e', 'Vị trí báo ngập');

  }



  cancelPickMode();



  // Tự động mở lại bảng điều khiển trên Mobile sau khi chấm điểm xong

  if (window.innerWidth < 640) {

    toggleMobilePanel(true);

  }

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



  if (name && name.includes('➔')) {

    const parts = name.split('➔').map(s => s.trim());

    const originEl = document.getElementById('origin-text');

    const destEl = document.getElementById('dest-text');

    if (originEl) originEl.value = parts[0] || `${oLat.toFixed(4)}, ${oLng.toFixed(4)}`;

    if (destEl) destEl.value = parts[1] || `${dLat.toFixed(4)}, ${dLng.toFixed(4)}`;

  } else {

    document.getElementById('origin-text').value = `${oLat.toFixed(4)}, ${oLng.toFixed(4)}`;

    document.getElementById('dest-text').value = `${dLat.toFixed(4)}, ${dLng.toFixed(4)}`;

  }



  const clrO = document.getElementById('btn-clear-origin');

  if (clrO) clrO.classList.remove('hidden');

  const clrD = document.getElementById('btn-clear-dest');

  if (clrD) clrD.classList.remove('hidden');

  updatePickMarker('origin', oLat, oLng, '#10b981', 'Điểm xuất phát');

  updatePickMarker('destination', dLat, dLng, '#ef4444', 'Điểm đến');



  calculateRoute();

}



// 7. Gọi API Tìm đường Né ngập

async function calculateRoute() {

  const btn = document.getElementById('btn-submit-route');



  // Tự động phân giải địa chỉ nếu người dùng đã gõ chữ vào ô nhưng chưa chọn từ gợi ý

  if (!coords.origin) {

    await resolveAddressFromInput('origin');

  }

  if (!coords.destination) {

    await resolveAddressFromInput('destination');

  }



  if (!coords.origin || !coords.destination) {

    alert('Vui lòng chọn hoặc nhập cả Điểm xuất phát và Điểm đến!');

    return;

  }



  const vehicle = document.querySelector('input[name="vehicle"]:checked').value;

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

      const warnNames = safe.flood_warnings.map(w => typeof w === 'string' ? w : (w.street || w.source || 'Mép ngập')).join(', ');

      safeWarnings.innerHTML = `⚠️ Chú ý: Tuyến đi qua mép ngập nhẹ (${warnNames})`;

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



      // Mô phỏng xe chạy dọc lộ trình an toàn (vehicle_sim.js - Thành viên 3)

      if (window.VehicleSim) {

        const v = document.querySelector('input[name="vehicle"]:checked');

        VehicleSim.start(latlngs, v ? v.value : 'motorbike');

      }



      // Gọi module cảnh báo âm thanh an toàn (không bao giờ làm đơ UI nếu âm thanh lỗi)

      if (window.VoiceWarning) {

        try {

          if (typeof VoiceWarning.speakRouteResult === 'function') {

            VoiceWarning.speakRouteResult(data);

          } else if (typeof VoiceWarning.speakRoutePlan === 'function') {

            VoiceWarning.speakRoutePlan(safe, same_route);

          }

        } catch (voiceErr) {

          console.warn("Lỗi phát âm thanh cảnh báo:", voiceErr);

        }

      }

    }

  } else {

    document.getElementById('safe-dist').innerText = 'Không thể đi';

    document.getElementById('safe-time').innerText = 'Bị chặn';

    if (window.VehicleSim) VehicleSim.stop();

    document.getElementById('safe-warnings').innerText = safe.reason || 'Nước ngập quá sâu, mọi ngả đường đều bị chặn!';



    if (window.VoiceWarning) {

      try {

        if (typeof VoiceWarning.speakRouteResult === 'function') {

          VoiceWarning.speakRouteResult(data);

        }

      } catch (voiceErr) {

        console.warn("Lỗi phát âm thanh cảnh báo:", voiceErr);

      }

    }

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

      const warnNames = (fastest.flood_warnings || []).map(w => typeof w === 'string' ? w : (w.street || w.source || 'Đoạn trũng')).join(', ');

      warnings.innerHTML = `⚠️ Bị ngập tại: ${warnNames || 'Đoạn trũng'}`;



      const latlngs = fastest.geometry.coordinates.map(c => [c[1], c[0]]);

      routeLayers.fastest = L.polyline(latlngs, {

        color: '#94a3b8',

        weight: 4,

        opacity: 0.6,

        dashArray: '8, 8'

      }).addTo(map);

    }

  }



  // Tối ưu trải nghiệm Mobile: tự động thu gọn bảng điều khiển và hiển thị thẻ tóm tắt nổi (FE-02)

  if (window.innerWidth < 640) {

    const card = document.getElementById('mobile-route-floating-card');

    const title = document.getElementById('mobile-card-title');

    const sub = document.getElementById('mobile-card-subtitle');

    if (card && title && sub) {

      if (safe && safe.found) {

        title.innerText = same_route ? 'Lộ trình tối ưu (Không ngập)' : 'Đã tìm thấy lộ trình né ngập';

        sub.innerText = `${(safe.distance_m / 1000).toFixed(1)} km • ${Math.round(safe.duration_min)} phút di chuyển`;

        card.classList.remove('hidden');

      } else {

        title.innerText = 'Cảnh báo: Bị chặn ngập';

        sub.innerText = 'Không còn đường an toàn cho xe này';

        card.classList.remove('hidden');

      }

    }

    toggleMobilePanel(false);

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

  if (modal) modal.classList.remove('hidden'); if (window.lucide) lucide.createIcons();

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





// ========================================================

// 13. TÌM KIẾM ĐỊA CHỈ & GỢI Ý ĐỊA ĐIỂM (Address Geocoding - FE-02)

// ========================================================

let addressDebounceTimer = null;



// Danh bạ địa điểm trọng yếu Hà Nội phục vụ tìm kiếm tức thì và offline

const HANOI_LANDMARKS = [

  { name: "Đại học Quốc Gia Hà Nội (Xuân Thủy)", lat: 21.0372, lng: 105.7818, sub: "144 Xuân Thủy, Cầu Giấy" },

  { name: "Đại học Sư Phạm Hà Nội", lat: 21.0365, lng: 105.7830, sub: "136 Xuân Thủy, Dịch Vọng Hậu" },

  { name: "Cầu Giấy (Ngã tư Cầu Giấy - Trần Đăng Ninh)", lat: 21.0335, lng: 105.7950, sub: "Quận Cầu Giấy, Hà Nội" },

  { name: "Xuân Thủy - Cầu Giấy", lat: 21.0370, lng: 105.7820, sub: "Đường Xuân Thủy, Cầu Giấy" },

  { name: "Nguyễn Khánh Toàn", lat: 21.0385, lng: 105.7955, sub: "Đường Nguyễn Khánh Toàn, Quan Hoa" },

  { name: "Trần Duy Hưng (Trung Hòa)", lat: 21.0105, lng: 105.8010, sub: "Đường Trần Duy Hưng, Cầu Giấy" },

  { name: "Láng Hạ (Đống Đa)", lat: 21.0115, lng: 105.8120, sub: "Đường Láng Hạ, Đống Đa" },

  { name: "Chùa Bộc (Học viện Ngân Hàng)", lat: 21.0085, lng: 105.8260, sub: "Đường Chùa Bộc, Quang Trung" },

  { name: "Phạm Hùng - Mễ Trì (Keangnam)", lat: 21.0280, lng: 105.7770, sub: "Phạm Hùng, Mễ Trì, Nam Từ Liêm" },

  { name: "Hoàng Quốc Việt (Cầu Giấy)", lat: 21.0465, lng: 105.7925, sub: "Đường Hoàng Quốc Việt, Nghĩa Đô" },

  { name: "Nguyễn Chí Thanh (Đại học Luật)", lat: 21.0255, lng: 105.8105, sub: "Nguyễn Chí Thanh, Láng Thượng" },

  { name: "Bến xe Mỹ Đình", lat: 21.0288, lng: 105.7780, sub: "20 Phạm Hùng, Mỹ Đình 2" },

  { name: "Hồ Gươm (Hồ Hoàn Kiếm)", lat: 21.0285, lng: 105.8542, sub: "Quận Hoàn Kiếm, Hà Nội" },

  { name: "Hồ Tây (Đường Thanh Niên)", lat: 21.0450, lng: 105.8350, sub: "Quận Tây Hồ, Hà Nội" },

  { name: "Đại học Bách Khoa Hà Nội", lat: 21.0050, lng: 105.8430, sub: "Số 1 Đại Cồ Việt, Hai Bà Trưng" },

  { name: "Keangnam Landmark 72", lat: 21.0175, lng: 105.7840, sub: "Khu E6 Phạm Hùng, Cầu Giấy" },

  { name: "Big C Thăng Long (Go!)", lat: 21.0070, lng: 105.7930, sub: "222 Trần Duy Hưng, Trung Hòa" },

  { name: "Công viên Cầu Giấy", lat: 21.0250, lng: 105.7900, sub: "Phố Duy Tân, Dịch Vọng" },

  { name: "Học viện Báo chí và Tuyên truyền", lat: 21.0380, lng: 105.7870, sub: "36 Xuân Thủy, Dịch Vọng Hậu" },

  { name: "Sân vận động Mỹ Đình", lat: 21.0205, lng: 105.7640, sub: "Đường Lê Đức Thọ, Mỹ Đình 1" },

  { name: "Học viện Ngoại Giao", lat: 21.0226, lng: 105.8063, sub: "69 Chùa Láng, Đống Đa" },

  { name: "Đại học Ngoại Thương", lat: 21.0235, lng: 105.8068, sub: "91 Chùa Láng, Đống Đa" },

  { name: "Đại học Giao Thông Vận Tải", lat: 21.0285, lng: 105.8035, sub: "Số 3 Cầu Giấy, Láng Thượng" },

  { name: "Bệnh viện Bạch Mai", lat: 21.0028, lng: 105.8398, sub: "78 Giải Phóng, Phương Mai, Đống Đa" },

  { name: "Phường Tương Mai (Hoàng Mai)", lat: 20.9884, lng: 105.8547, sub: "Quận Hoàng Mai, Hà Nội" },

  { name: "Đường Hoàng Mai", lat: 20.9882, lng: 105.8550, sub: "Quận Hoàng Mai, Hà Nội" },

  { name: "Đường Nguyễn An Ninh (Tương Mai)", lat: 20.9895, lng: 105.8480, sub: "Phố Nguyễn An Ninh, Tương Mai, Hoàng Mai" },

  { name: "Đường Giải Phóng", lat: 20.9964, lng: 105.8414, sub: "Quận Hoàng Mai / Hai Bà Trưng, Hà Nội" },

  { name: "Bến xe Giáp Bát", lat: 20.9806, lng: 105.8418, sub: "Đường Giải Phóng, Giáp Bát, Hoàng Mai" },

  { name: "Đường Trương Định", lat: 20.9912, lng: 105.8475, sub: "Quận Hoàng Mai / Hai Bà Trưng, Hà Nội" },

  { name: "Đường Kim Mã (Ba Đình)", lat: 21.0315, lng: 105.8200, sub: "Quận Ba Đình, Hà Nội" },

  { name: "Đường Nguyễn Trãi (Thanh Xuân)", lat: 20.9960, lng: 105.8080, sub: "Quận Thanh Xuân, Hà Nội" },

  { name: "Đường Minh Khai (Hai Bà Trưng)", lat: 20.9980, lng: 105.8600, sub: "Quận Hai Bà Trưng, Hà Nội" }

];



// Helper đồng bộ ID phần tử cho cả 'destination' và 'dest'

function getAddressElements(type) {

  const isDest = (type === 'destination' || type === 'dest');

  const prefix = isDest ? 'dest' : 'origin';

  return {

    targetType: isDest ? 'destination' : 'origin',

    input: document.getElementById(`${prefix}-text`) || document.getElementById(`${type}-text`),

    container: document.getElementById(`${prefix}-suggestions`) || document.getElementById(`${type}-suggestions`),

    clearBtn: document.getElementById(`btn-clear-${prefix}`) || document.getElementById(`btn-clear-${type}`)

  };

}



// Tự động phân giải địa chỉ từ chuỗi người dùng đã nhập

async function resolveAddressFromInput(type) {

  const { targetType, input } = getAddressElements(type);

  if (!input) return false;

  const query = input.value.trim();

  if (!query) return false;



  // 1. Kiểm tra nếu là dạng tọa độ số "lat, lng"

  const parts = query.split(',').map(s => parseFloat(s.trim()));

  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {

    coords[targetType] = { lat: parts[0], lng: parts[1] };

    const color = targetType === 'origin' ? '#10b981' : '#ef4444';

    const label = targetType === 'origin' ? 'Điểm xuất phát' : 'Điểm đến';

    updatePickMarker(targetType, parts[0], parts[1], color, label);

    return true;

  }



  // 2. Tra cứu trong danh bạ trọng yếu

  const qNorm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const localMatch = HANOI_LANDMARKS.find(item => {

    const nameNorm = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const subNorm = item.sub.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return nameNorm.includes(qNorm) || subNorm.includes(qNorm);

  });

  if (localMatch) {

    coords[targetType] = { lat: localMatch.lat, lng: localMatch.lng };

    const color = targetType === 'origin' ? '#10b981' : '#ef4444';

    const label = targetType === 'origin' ? 'Điểm xuất phát' : 'Điểm đến';

    updatePickMarker(targetType, localMatch.lat, localMatch.lng, color, label);

    return true;

  }



  // 3. Tra cứu nhanh qua Photon API

  try {

    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=21.0285&lon=105.8030&limit=1&lang=default`;

    const res = await fetch(url);

    if (res.ok) {

      const data = await res.json();

      if (data.features && data.features.length > 0) {

        const f = data.features[0];

        const lat = f.geometry.coordinates[1];

        const lng = f.geometry.coordinates[0];

        coords[targetType] = { lat, lng };

        const color = targetType === 'origin' ? '#10b981' : '#ef4444';

        const label = targetType === 'origin' ? 'Điểm xuất phát' : 'Điểm đến';

        updatePickMarker(targetType, lat, lng, color, label);

        return true;

      }

    }

  } catch (e) {

    if (e.name === 'AbortError') return false;
    console.debug("resolveAddressFromInput status:", e.message || e);

  }



  return false;

}



function handleAddressInput(type, query) {

  const { targetType, clearBtn, container } = getAddressElements(type);

  if (!container) return;



  if (clearBtn) {

    if (query && query.trim().length > 0) clearBtn.classList.remove('hidden');

    else clearBtn.classList.add('hidden');

  }



  // Nếu người dùng xóa sạch text, xóa luôn tọa độ tương ứng

  if (!query || query.trim().length === 0) {

    coords[targetType] = null;

    if (pickMarkers[targetType]) {

      map.removeLayer(pickMarkers[targetType]);

      pickMarkers[targetType] = null;

    }

    container.innerHTML = '';

    container.classList.add('hidden');

    return;

  }



  if (query.trim().length < 2) {

    container.innerHTML = '';

    container.classList.add('hidden');

    return;

  }



  clearTimeout(addressDebounceTimer);

  addressDebounceTimer = setTimeout(() => {

    executeAddressSearch(type, query.trim());

  }, 250);

}



async function executeAddressSearch(type, query) {

  const { targetType, container } = getAddressElements(type);

  if (!container) return;



  container.innerHTML = `<div class="p-2.5 text-center text-slate-400 text-xs flex items-center justify-center gap-1.5"><i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Đang tìm địa chỉ...</span></div>`;

  container.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();



  const qNorm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');



  // 1. Khớp từ khóa danh bạ địa điểm Hà Nội tức thì

  const localMatches = HANOI_LANDMARKS.filter(item => {

    const nameNorm = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const subNorm = item.sub.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return nameNorm.includes(qNorm) || subNorm.includes(qNorm);

  });



  // 2. Tìm kiếm mở rộng qua Photon Komoot API (OSM geocoder tốc độ cao, hỗ trợ CORS & tiếng Việt, không bị timeout như Nominatim)

  let apiMatches = [];

  try {

    const controller = new AbortController();

    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=21.0285&lon=105.8030&limit=6&lang=default`;

    const res = await fetch(url, { signal: controller.signal });

    clearTimeout(timeoutId);



    if (res.ok) {

      const data = await res.json();

      apiMatches = (data.features || []).map(f => {

        const p = f.properties || {};

        const title = p.name || p.street || query;

        const parts = [];

        if (p.housenumber && p.street && !title.includes(p.street)) {

          parts.push(`${p.housenumber} ${p.street}`);

        } else if (p.street && !title.includes(p.street)) {

          parts.push(p.street);

        }

        if (p.district) parts.push(p.district);

        if (p.city) parts.push(p.city);

        const sub = parts.join(', ') || 'Hà Nội, Việt Nam';

        return {

          name: title,

          sub: sub,

          lat: f.geometry.coordinates[1],

          lng: f.geometry.coordinates[0]

        };

      });

    }

  } catch (e) {

    if (e.name === 'AbortError') {
      return; // Bỏ qua AbortError khi người dùng gõ tiếp hoặc debounce hủy request
    }
    console.debug("Photon API search status:", e.message || e);

  }



  // Kết hợp và loại bỏ trùng lặp

  const allResults = [...localMatches];

  apiMatches.forEach(item => {

    if (!allResults.some(r => Math.abs(r.lat - item.lat) < 0.003 && Math.abs(r.lng - item.lng) < 0.003)) {

      allResults.push(item);

    }

  });



  if (allResults.length === 0) {

    container.innerHTML = `<div class="p-3 text-center text-slate-400 text-xs">Không tìm thấy địa chỉ phù hợp. Bạn có thể chọn trực tiếp trên bản đồ.</div>`;

    return;

  }



  container.innerHTML = allResults.slice(0, 6).map(item => `

    <div onclick="selectAddress('${targetType}', ${item.lat}, ${item.lng}, '${encodeURIComponent(item.name)}')" 

         class="p-2.5 hover:bg-blue-50 cursor-pointer transition flex items-start gap-2.5 text-left group border-b border-slate-100 last:border-b-0">

      <i data-lucide="map-pin" class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5 group-hover:scale-110 transition"></i>

      <div class="flex-1 overflow-hidden">

        <p class="font-bold text-slate-800 text-xs truncate group-hover:text-blue-600">${item.name}</p>

        <p class="text-[11px] text-slate-500 truncate">${item.sub}</p>

      </div>

    </div>

  `).join('');



  if (window.lucide) lucide.createIcons();

}



function selectAddress(type, lat, lng, displayName) {

  try {

    displayName = decodeURIComponent(displayName);

  } catch (e) {}

  const { targetType, input, clearBtn, container } = getAddressElements(type);

  coords[targetType] = { lat: Number(lat), lng: Number(lng) };

  

  if (input) input.value = displayName;

  if (clearBtn) clearBtn.classList.remove('hidden');

  if (container) container.classList.add('hidden');



  const color = targetType === 'origin' ? '#10b981' : '#ef4444';

  const label = targetType === 'origin' ? 'Điểm xuất phát' : 'Điểm đến';

  updatePickMarker(targetType, lat, lng, color, label);



  map.flyTo([lat, lng], 15, { duration: 0.8 });



  // Tự động kích hoạt tính lộ trình nếu cả 2 điểm đã sẵn sàng

  if (coords.origin && coords.destination) {

    calculateRoute();

  }

}



function clearLocation(type) {

  const { targetType, input, clearBtn, container } = getAddressElements(type);

  coords[targetType] = null;

  if (input) input.value = '';

  if (clearBtn) clearBtn.classList.add('hidden');

  if (container) container.classList.add('hidden');



  if (pickMarkers[targetType]) {

    map.removeLayer(pickMarkers[targetType]);

    pickMarkers[targetType] = null;

  }

}



async function handleAddressKeydown(event, type) {

  const { targetType, container } = getAddressElements(type);

  if (event.key === 'Enter') {

    event.preventDefault();

    if (container && !container.classList.contains('hidden')) {

      const firstItem = container.querySelector('[onclick]');

      if (firstItem) {

        firstItem.click();

        return;

      }

    }

    // Nếu dropdown chưa có hoặc người dùng nhấn Enter ngay

    await resolveAddressFromInput(type);

    if (coords.origin && coords.destination) {

      calculateRoute();

    }

  } else if (event.key === 'Escape') {

    if (container) container.classList.add('hidden');

  }

}



// Đóng dropdown khi click ra ngoài

document.addEventListener('click', (e) => {

  ['origin', 'destination'].forEach(type => {

    const { input, container } = getAddressElements(type);

    if (container && !container.contains(e.target) && e.target !== input) {

      container.classList.add('hidden');

    }

  });

});



// ========================================================
// Xuất các biến và hàm điều khiển quan trọng ra window
// ========================================================
window.floodPoints = floodPoints;
window.coords = coords;
if (typeof map !== 'undefined') window.map = map;
window.renderFloodPoints = renderFloodPoints;
window.renderPointsList = renderPointsList;
window.updateViewportFloodAlert = updateViewportFloodAlert;
window.calculateRoute = calculateRoute;
window.loadFloodPoints = loadFloodPoints;


// ========================================================
// FE: Tiện ích Toast & Điều khiển Đặt lại Mặc định
// ========================================================
function showToast(message, type = 'info') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }
  
  const bgClass = type === 'success' ? 'bg-emerald-600 text-white shadow-emerald-500/30' :
                  type === 'warning' ? 'bg-amber-600 text-white shadow-amber-500/30' :
                  type === 'error' ? 'bg-rose-600 text-white shadow-rose-500/30' :
                  'bg-slate-800 text-white shadow-slate-900/30';
  const icon = type === 'success' ? 'check-circle' : 'info';

  toast.className = `fixed bottom-6 right-6 z-[9999] px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 transition-all duration-300 transform translate-y-0 opacity-100 ${bgClass} pointer-events-auto`;
  toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${message}</span>`;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = toast.className.replace('translate-y-0 opacity-100', 'translate-y-10 opacity-0');
  }, 3000);
}

function clearActiveRoute() {
  if (routeLayers.safe && map) {
    map.removeLayer(routeLayers.safe);
    routeLayers.safe = null;
  }
  if (routeLayers.fastest && map) {
    map.removeLayer(routeLayers.fastest);
    routeLayers.fastest = null;
  }
  if (window.VehicleSim && typeof VehicleSim.stop === 'function') {
    VehicleSim.stop();
  }
  clearLocation('origin');
  clearLocation('destination');
  const resultCard = document.getElementById('route-results');
  if (resultCard) resultCard.classList.add('hidden');
  showToast('Đã xóa lộ trình hiện tại', 'info');
}

window.showToast = showToast;
window.clearActiveRoute = clearActiveRoute;
window.resetToDefaultState = function() {
  if (window.StormSimulator && typeof StormSimulator.resetToDefault === 'function') {
    StormSimulator.resetToDefault();
  }
};
