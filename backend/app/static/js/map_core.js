/**

 * =================================================
 * FloodNav - Map Controller & Core Interaction

 * Phụ trách: Thành viên 1 & Thành viên 2 (Hợp tác nâng cấp)

 * Thư viện: Leaflet 1.9.4 (BSD-2-Clause - OSI Approved)

 * =================================================
 */



let map = null;

let floodMarkersLayer = null;

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


/**
 * Tạo icon cụm (MarkerCluster) theo phong cách nhận diện FloodNav (Xanh dương & Xanh ngọc)
 * Tự động hiển thị số lượng điểm ngập trong cụm và cảnh báo nếu có điểm ngập sâu.
 */
function createClusterIcon(cluster) {
  const count = cluster.getChildCount();
  const children = cluster.getAllChildMarkers();

  let hasDanger = false;
  let hasWarning = false;
  let hasSafe = false;

  for (let i = 0; i < children.length; i++) {
    const s = children[i].options.floodStatus;
    const d = children[i].options.depthCm;
    if (s === 'danger' || (d !== null && d !== undefined && d >= 20)) {
      hasDanger = true;
    } else if (s === 'warning' || (d !== null && d !== undefined && d >= 5)) {
      hasWarning = true;
    } else if (s === 'safe') {
      hasSafe = true;
    }
  }

  let size = 36;
  let clusterLevel = 'safe';
  if (hasDanger) {
    clusterLevel = 'danger';
  } else if (hasWarning) {
    clusterLevel = 'warning';
  } else if (!hasSafe) {
    // Toàn bộ các điểm trong cụm là mất tín hiệu hoặc chưa có dữ liệu
    clusterLevel = 'offline';
  }

  if (count >= 25) {
    size = 46;
  } else if (count >= 10) {
    size = 40;
  }

  const badgeHtml = hasDanger ? '<span class="cluster-danger-dot" title="Có điểm ngập sâu trong cụm"></span>' : '';

  return L.divIcon({
    html: `
      <div class="flood-cluster-badge flood-cluster-${clusterLevel}" style="width: ${size}px; height: ${size}px;" title="Cụm ${count} điểm quan trắc (nhấp để phóng to)">
        <span class="cluster-num">${count}</span>
        ${badgeHtml}
      </div>
    `,
    className: 'flood-cluster-container',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function syncFloodCirclesWithZoom() {
  if (!map) return;
  // Khi ở zoom xa (zoom < 14) các điểm được gom cụm, ẩn bớt vòng sóng nước để bản đồ thoáng đãng
  // Khi zoom gần (zoom >= 14) tách cụm, hiển thị đầy đủ vòng bán kính sóng nước
  if (map.getZoom() < 14) {
    if (map.hasLayer(floodCirclesLayer)) {
      map.removeLayer(floodCirclesLayer);
    }
  } else {
    if (!map.hasLayer(floodCirclesLayer)) {
      map.addLayer(floodCirclesLayer);
    }
  }
}

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

  // FE-01: Cách ly container bản đồ tránh lỗi xung đột z-index modal
  const mapContainer = map.getContainer();
  mapContainer.style.isolation = 'isolate';
  if (mapContainer.parentElement) {
    mapContainer.parentElement.style.isolation = 'isolate';
  }

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



    // Triển khai Marker Clustering cho 130 điểm ngập (Leaflet.markercluster)
  if (typeof L.markerClusterGroup === 'function') {
    floodMarkersLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 1.4,
      maxClusterRadius: 40,
      disableClusteringAtZoom: 16,
      iconCreateFunction: createClusterIcon
    });
  } else {
    floodMarkersLayer = L.layerGroup();
  }
  floodCirclesLayer.addTo(map);
  floodMarkersLayer.addTo(map);
  map.on('zoomend', syncFloodCirclesWithZoom);



  map.on('click', onMapClick);



  // Cập nhật cảnh báo điểm ngập theo thời gian thực khi người dùng kéo/thu phóng bản đồ

  map.on('moveend', () => {

    updateViewportFloodAlert();

    renderPointsList();
  syncFloodCirclesWithZoom();

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
  checkPostGISConnection();
  loadWeatherInfo();




  // Kiểm tra và hiển thị hướng dẫn người dùng mới (Onboarding Guide)

  checkFirstTimeVisitor();

}



// 2. Tải danh sách 8 điểm ngập và vẽ lên bản đồ
async function loadFloodPoints() {
  const loadingEl = document.getElementById('summary-loading-view');
  const errorEl = document.getElementById('summary-error-view');
  const contentEl = document.getElementById('summary-content-view');

  try {
    const res = await fetch('/api/flood-points');
    if (!res.ok) {
      throw new Error(`Mã phản hồi HTTP: ${res.status}`);
    }
    const geojson = await res.json();
    renderFloodPoints(geojson);
  } catch (err) {
    console.error('Lỗi tải danh sách điểm ngập:', err);
    if (loadingEl) loadingEl.classList.add('hidden');
    if (contentEl) contentEl.classList.add('hidden');
    if (errorEl) {
      errorEl.classList.remove('hidden');
      const errP = errorEl.querySelector('p');
      if (errP) errP.innerText = `Lỗi kết nối máy chủ: ${err.message || 'Không thể lấy dữ liệu'}.`;
    }
  }
}

function formatReadingTime(isoStr) {
  if (!isoStr) return 'Chưa có bản ghi';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${mins} ${day}/${month}/${year}`;
  } catch (e) {
    return isoStr;
  }
}

// Tính toán số liệu thống kê tình hình ngập từ dữ liệu trạm quan trắc thực tế
function getFloodStats() {
  const points = window.floodPoints || [];
  if (!points || points.length === 0) {
    return null;
  }

  let validCount = 0;
  let safeCount = 0;
  let warningCount = 0;
  let dangerCount = 0;
  let offlineCount = 0;
  let noDataCount = 0;
  let latestTime = null;

  points.forEach(p => {
    const hasValidDepth = (p.depth_cm !== null && p.depth_cm !== undefined && !isNaN(Number(p.depth_cm)));
    const isOffline = p.status === 'offline';
    const isNoData = p.status === 'no_data' || !hasValidDepth;
    const isInvalid = p.status === 'invalid';

    if (p.last_reading_at) {
      const t = new Date(p.last_reading_at);
      if (!isNaN(t.getTime()) && (!latestTime || t > latestTime)) {
        latestTime = t;
      }
    }

    if (isOffline) {
      offlineCount++;
    } else if (isNoData || isInvalid) {
      noDataCount++;
    } else {
      validCount++;
      const depth = Number(p.depth_cm);
      if (depth < 5) {
        safeCount++;
      } else if (depth < 20) {
        warningCount++;
      } else {
        dangerCount++;
      }
    }
  });

  return {
    total: points.length,
    valid: validCount,
    safe: safeCount,
    warning: warningCount,
    danger: dangerCount,
    offline: offlineCount,
    noData: noDataCount,
    latestTime: latestTime ? latestTime.toISOString() : null
  };
}

// Cập nhật giao diện Tóm tắt tình hình ngập ở Sidebar (trước khi tìm đường)
function updateSidebarFloodSummary() {
  const loadingEl = document.getElementById('summary-loading-view');
  const errorEl = document.getElementById('summary-error-view');
  const contentEl = document.getElementById('summary-content-view');
  if (!contentEl) return;

  const stats = getFloodStats();
  if (!stats) {
    if (loadingEl) loadingEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    return;
  }

  if (loadingEl) loadingEl.classList.add('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  const safeEl = document.getElementById('sum-count-safe');
  const warnEl = document.getElementById('sum-count-warning');
  const dangEl = document.getElementById('sum-count-danger');
  const ratioEl = document.getElementById('sum-valid-ratio');
  const timeEl = document.getElementById('sum-last-update');
  const badgeEl = document.getElementById('summary-badge-status');
  const staleNoteEl = document.getElementById('sum-stale-note');
  const staleCountEl = document.getElementById('sum-stale-count');

  if (safeEl) safeEl.innerText = stats.safe;
  if (warnEl) warnEl.innerText = stats.warning;
  if (dangEl) dangEl.innerText = stats.danger;
  if (ratioEl) ratioEl.innerText = `${stats.valid} / ${stats.total} trạm`;

  const staleTotal = stats.offline + stats.noData;
  if (staleNoteEl && staleCountEl) {
    if (staleTotal > 0) {
      staleNoteEl.classList.remove('hidden');
      const parts = [];
      if (stats.offline > 0) parts.push(`${stats.offline} mất tín hiệu`);
      if (stats.noData > 0) parts.push(`${stats.noData} chưa có DL`);
      staleCountEl.innerText = `${staleTotal} trạm (${parts.join(', ')})`;
    } else {
      staleNoteEl.classList.add('hidden');
    }
  }

  if (timeEl) {
    timeEl.innerText = stats.latestTime ? formatReadingTime(stats.latestTime) : 'Chưa có bản ghi';
  }

  if (badgeEl) {
    if (stats.danger > 0) {
      badgeEl.innerText = `${stats.danger} điểm ngập sâu`;
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300';
    } else if (stats.warning > 0) {
      badgeEl.innerText = `${stats.warning} điểm chú ý`;
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300';
    } else {
      badgeEl.innerText = 'Bình thường';
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
    }
  }

  if (window.lucide) lucide.createIcons();
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
      status: f.properties.status,
      last_reading_at: f.properties.last_reading_at
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
  const hdrCountEl = document.getElementById('hdr-points-count');
  if (hdrCountEl) hdrCountEl.innerText = floodPoints.length;


  floodMarkersLayer.clearLayers();
  floodCirclesLayer.clearLayers();

  floodPoints.forEach(fp => {
    const { id, name, lng, lat, depth_cm, threshold_cm, status, last_reading_at } = fp;
    const hasValidDepth = (depth_cm !== null && depth_cm !== undefined && !isNaN(Number(depth_cm)));
    const depth = hasValidDepth ? Number(depth_cm) : null;

    let bgColor = '#10b981'; // Xanh lá: an toàn
    let pulseClass = '';
    let radiusColor = '#10b981';
    let markerText = hasValidDepth ? `${Math.round(depth)}cm` : '--';
    let statusLabel = 'An toàn';
    let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    let depthColorClass = 'text-emerald-600';
    let depthDisplay = hasValidDepth ? `${depth} cm` : 'Chưa có dữ liệu';
    let timeDisplay = formatReadingTime(last_reading_at);

    if (status === 'no_data' || !hasValidDepth) {
      bgColor = '#94a3b8'; // Xám bạc: Chưa có dữ liệu
      pulseClass = '';
      markerText = '--';
      statusLabel = 'Chưa có DL';
      badgeClass = 'bg-slate-100 text-slate-700 border-slate-300';
      depthColorClass = 'text-slate-500';
      depthDisplay = 'Chưa có dữ liệu quan trắc';
      timeDisplay = 'Chưa có số đo';
    } else if (status === 'offline') {
      bgColor = '#64748b'; // Xám đậm: Mất tín hiệu
      pulseClass = '';
      markerText = hasValidDepth ? `${Math.round(depth)}cm` : 'OFF';
      statusLabel = 'Mất tín hiệu';
      badgeClass = 'bg-slate-200 text-slate-800 border-slate-400';
      depthColorClass = 'text-slate-600';
      depthDisplay = hasValidDepth ? `${depth} cm (Dữ liệu cũ)` : 'Mất tín hiệu';
      timeDisplay = `${formatReadingTime(last_reading_at)} (Quá 24h)`;
    } else if (status === 'invalid') {
      bgColor = '#64748b'; // Xám: Dữ liệu lỗi
      pulseClass = '';
      markerText = 'ERR';
      statusLabel = 'Lỗi DL';
      badgeClass = 'bg-slate-200 text-slate-800 border-slate-400';
      depthColorClass = 'text-rose-600';
      depthDisplay = `Không hợp lệ (${depth} cm)`;
      timeDisplay = formatReadingTime(last_reading_at);
    } else if (status === 'warning') {
      bgColor = '#f59e0b'; // Vàng: 5-20cm
      pulseClass = 'flood-pulse-warning';
      radiusColor = '#f59e0b';
      markerText = `${Math.round(depth)}cm`;
      statusLabel = 'Chú ý';
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
      depthColorClass = 'text-amber-600';
      depthDisplay = `${depth} cm`;
      timeDisplay = formatReadingTime(last_reading_at);
    } else if (status === 'danger') {
      bgColor = '#ef4444'; // Đỏ: >=20cm
      pulseClass = 'flood-pulse-danger';
      radiusColor = '#ef4444';
      markerText = `${Math.round(depth)}cm`;
      statusLabel = 'Nguy hiểm';
      badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
      depthColorClass = 'text-rose-600';
      depthDisplay = `${depth} cm`;
      timeDisplay = formatReadingTime(last_reading_at);
    } else {
      // status === 'safe'
      bgColor = '#10b981'; // Xanh lá: an toàn
      pulseClass = '';
      radiusColor = '#10b981';
      markerText = `${Math.round(depth)}cm`;
      statusLabel = 'An toàn';
      badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      depthColorClass = 'text-emerald-600';
      depthDisplay = `${depth} cm`;
      timeDisplay = formatReadingTime(last_reading_at);
    }

    // Hiệu ứng vùng sóng ngập chỉ vẽ khi có dữ liệu thực tế và mực nước >= 5cm
    if (hasValidDepth && depth >= 5 && status !== 'no_data' && status !== 'offline') {
      const radiusMeters = Math.min(100 + depth * 2.5, 300);
      
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

      const innerCircle = L.circle([lat, lng], {
        radius: Math.max(30, radiusMeters * 0.4),
        color: radiusColor,
        fillColor: radiusColor,
        fillOpacity: 0.35,
        weight: 1
      });
      floodCirclesLayer.addLayer(innerCircle);
    }

    // Marker tròn hiển thị số cm ngập hoặc ký hiệu trạng thái
    const icon = L.divIcon({
      className: 'custom-flood-pin',
      html: `
        <div class="custom-marker ${pulseClass}" style="width: 32px; height: 32px; background-color: ${bgColor};" title="${name}: ${depthDisplay}">
          <span>${markerText}</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([lat, lng], {
      icon,
      floodStatus: status,
      depthCm: depth,
      thresholdCm: threshold_cm
    });

    marker.bindPopup(`
      <div class="text-xs space-y-1.5 p-1 min-w-[210px]">
        <div class="flex items-start justify-between gap-1.5 border-b border-slate-100 pb-1.5">
          <h4 class="font-bold text-slate-900 text-sm leading-tight">${name}</h4>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass} flex-shrink-0">
            ${statusLabel}
          </span>
        </div>
        <div class="space-y-1 text-slate-600 text-xs">
          <p class="flex justify-between items-center">
            <span>Mực nước:</span>
            <b class="font-mono ${depthColorClass}">${depthDisplay}</b>
          </p>
          <p class="flex justify-between items-center text-slate-500 text-[11px]">
            <span>Ngưỡng chịu đựng:</span>
            <span>${threshold_cm} cm</span>
          </p>
          <p class="flex justify-between items-center text-slate-500 text-[11px] border-t border-slate-100 pt-1">
            <span>Cập nhật:</span>
            <span class="font-mono text-slate-700">${timeDisplay}</span>
          </p>
        </div>
        <div class="pt-1.5 flex gap-1">
          <button onclick="setAsRouteTarget(${lng}, ${lat}, 'origin')" class="flex-1 px-2 py-1 bg-emerald-500 text-white rounded text-[10px] font-semibold hover:bg-emerald-600 transition">Điểm Đi</button>
          <button onclick="setAsRouteTarget(${lng}, ${lat}, 'destination')" class="flex-1 px-2 py-1 bg-rose-500 text-white rounded text-[10px] font-semibold hover:bg-rose-600 transition">Điểm Đến</button>
        </div>
      </div>
    `);

    floodMarkersLayer.addLayer(marker);
  });




    renderPointsList();
  updateViewportFloodAlert();
  syncFloodCirclesWithZoom();
  updateSidebarFloodSummary();
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

  // Sắp xếp: Điểm trong khung nhìn lên trước, kế tiếp ưu tiên nguy hiểm / chú ý / an toàn / mất tín hiệu
  const sortedPoints = [...floodPoints].sort((a, b) => {
    const aInView = bounds ? bounds.contains([a.lat, a.lng]) : false;
    const bInView = bounds ? bounds.contains([b.lat, b.lng]) : false;
    if (aInView && !bInView) return -1;
    if (!aInView && bInView) return 1;

    const rank = s => (s === 'danger' ? 4 : s === 'warning' ? 3 : s === 'safe' ? 2 : 1);
    const rDiff = rank(b.status) - rank(a.status);
    if (rDiff !== 0) return rDiff;

    return (Number(b.depth_cm) || 0) - (Number(a.depth_cm) || 0);
  });

  sortedPoints.forEach(fp => {
    const { id, name, depth_cm, threshold_cm, status, lat, lng } = fp;
    const hasValidDepth = (depth_cm !== null && depth_cm !== undefined && !isNaN(Number(depth_cm)));
    const depth = hasValidDepth ? Number(depth_cm) : null;
    const isInView = bounds ? bounds.contains([lat, lng]) : true;

    let badgeBg = 'bg-emerald-100 text-emerald-800';
    let badgeText = 'An toàn';
    if (status === 'no_data' || !hasValidDepth) {
      badgeBg = 'bg-slate-100 text-slate-700 border border-slate-300';
      badgeText = 'Chưa có DL';
    } else if (status === 'offline') {
      badgeBg = 'bg-slate-200 text-slate-800 border border-slate-400';
      badgeText = 'Mất tín hiệu';
    } else if (status === 'invalid') {
      badgeBg = 'bg-slate-200 text-slate-800 border border-slate-400';
      badgeText = 'Lỗi DL';
    } else if (status === 'warning') {
      badgeBg = 'bg-amber-100 text-amber-800';
      badgeText = 'Chú ý';
    } else if (status === 'danger') {
      badgeBg = 'bg-rose-100 text-rose-800';
      badgeText = 'Nguy hiểm';
    }

    const inViewBadge = isInView ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">Khung nhìn</span>' : '';

    const div = document.createElement('div');
    div.className = `p-3 bg-white rounded-xl border ${isInView ? 'border-blue-300 shadow-sm' : 'border-slate-200 opacity-80'} space-y-2 hover:border-blue-500 transition`;

    const sliderVal = hasValidDepth ? depth : 0;
    const depthText = hasValidDepth ? `${depth}cm` : '--';

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
        <input type="range" min="0" max="60" value="${sliderVal}" 
               class="flex-1 accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
               onchange="updateSensorDepth(${id}, this.value)"
               oninput="this.nextElementSibling.innerText = this.value + 'cm'">
        <span class="text-[11px] font-mono w-10 text-right font-bold text-slate-700">${depthText}</span>
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
  const dangerInView = inView.filter(fp => fp.status === 'danger');
  const warningInView = inView.filter(fp => fp.status === 'warning');
  const offlineOrNoDataInView = inView.filter(fp => fp.status === 'offline' || fp.status === 'no_data' || fp.status === 'invalid');
  const safeInView = inView.filter(fp => fp.status === 'safe');

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
    if (offlineOrNoDataInView.length === 0) {
      alertEl.className = baseClass + 'bg-emerald-50/95 border-emerald-300 text-emerald-900 shadow-emerald-200/50';
      alertIcon.className = 'p-1 rounded-full bg-emerald-200 text-emerald-700 flex-shrink-0';
      alertIcon.innerHTML = '<i data-lucide="shield-check" class="w-4 h-4"></i>';
      alertText.innerHTML = `Khu vực đang xem có <b>${inView.length}</b> trạm quan trắc, tất cả đều an toàn (&lt;5cm)`;
    } else {
      alertEl.className = baseClass + 'bg-slate-50/95 border-slate-300 text-slate-800 shadow-slate-200/50';
      alertIcon.className = 'p-1 rounded-full bg-slate-200 text-slate-700 flex-shrink-0';
      alertIcon.innerHTML = '<i data-lucide="info" class="w-4 h-4"></i>';
      alertText.innerHTML = `Khu vực có <b>${safeInView.length}</b> trạm an toàn, <b>${offlineOrNoDataInView.length}</b> trạm mất tín hiệu / chưa có dữ liệu`;
    }
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



// 8. Vẽ lộ trình lên bản đồ và quản lý tương tác chuyển đổi lộ trình
let currentRouteData = null;
let activeRouteMode = 'safe';

function displayRouteResults(data) {
  currentRouteData = data;
  window.lastRouteData = data;

  const resultCard = document.getElementById('route-results');
  const summaryCard = document.getElementById('flood-summary-card');

  if (summaryCard) summaryCard.classList.add('hidden');
  if (resultCard) resultCard.classList.remove('hidden');

  // Xóa lộ trình cũ trên bản đồ
  if (routeLayers.safe && map) {
    map.removeLayer(routeLayers.safe);
    routeLayers.safe = null;
  }
  if (routeLayers.fastest && map) {
    map.removeLayer(routeLayers.fastest);
    routeLayers.fastest = null;
  }

  const { safe, fastest, same_route } = data;

  // 1. Điền thông tin cho Lộ trình An Toàn
  const safeDistEl = document.getElementById('safe-dist');
  const safeTimeEl = document.getElementById('safe-time');
  const safeSafetyEl = document.getElementById('safe-safety-level');
  const safeFloodSegsEl = document.getElementById('safe-flood-segs');
  const safeWarnings = document.getElementById('safe-warnings');

  if (safe && safe.found) {
    if (safeDistEl) safeDistEl.innerText = (safe.distance_m / 1000).toFixed(2) + ' km';
    if (safeTimeEl) safeTimeEl.innerText = safe.duration_min.toFixed(1) + ' phút';

    const safeWarnList = safe.flood_warnings || [];
    if (safeFloodSegsEl) safeFloodSegsEl.innerText = `${safeWarnList.length} đoạn`;

    if (safeSafetyEl) {
      if (safeWarnList.length === 0) {
        safeSafetyEl.innerText = 'Rất cao (Khô ráo)';
        safeSafetyEl.className = 'text-[11px] font-bold text-emerald-700';
      } else {
        safeSafetyEl.innerText = 'Tương đối (Mép ngập)';
        safeSafetyEl.className = 'text-[11px] font-bold text-teal-700';
      }
    }

    if (safeWarnings) {
      if (safeWarnList.length > 0) {
        const warnNames = safeWarnList.map(w => typeof w === 'string' ? w : (w.street || w.source || 'Mép ngập')).join(', ');
        safeWarnings.innerHTML = `⚠️ <em>Chú ý:</em> Tuyến đi qua mép ngập nhẹ (${warnNames}) nhưng vẫn an toàn cho xe.`;
      } else {
        safeWarnings.innerHTML = `✨ Tuyến đường hoàn toàn khô ráo, không bị ngập.`;
      }
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
    }
  } else {
    if (safeDistEl) safeDistEl.innerText = 'Không thể đi';
    if (safeTimeEl) safeTimeEl.innerText = 'Bị chặn';
    if (safeSafetyEl) {
      safeSafetyEl.innerText = 'Không an toàn';
      safeSafetyEl.className = 'text-[11px] font-bold text-rose-600';
    }
    if (safeFloodSegsEl) safeFloodSegsEl.innerText = 'Bị chặn';
    if (safeWarnings) safeWarnings.innerText = safe.reason || 'Nước ngập quá sâu, mọi ngả đường đều bị chặn!';
  }

  // 2. Điền thông tin cho Lộ trình Nhanh Nhất (Gốc)
  const fastestDistEl = document.getElementById('fastest-dist');
  const fastestTimeEl = document.getElementById('fastest-time');
  const fastestSafetyEl = document.getElementById('fastest-safety-level');
  const fastestFloodSegsEl = document.getElementById('fastest-flood-segs');
  const badge = document.getElementById('fastest-badge');
  const warnings = document.getElementById('fastest-warnings');

  if (fastest && fastest.found) {
    if (fastestDistEl) fastestDistEl.innerText = (fastest.distance_m / 1000).toFixed(2) + ' km';
    if (fastestTimeEl) fastestTimeEl.innerText = fastest.duration_min.toFixed(1) + ' phút';

    const fastestWarnList = fastest.flood_warnings || [];
    if (fastestFloodSegsEl) fastestFloodSegsEl.innerText = `${fastestWarnList.length} đoạn có nguy cơ`;

    if (same_route) {
      if (badge) {
        badge.innerText = 'Trùng lộ trình an toàn';
        badge.className = 'text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full';
      }
      if (fastestSafetyEl) {
        fastestSafetyEl.innerText = 'An toàn (Khô ráo)';
        fastestSafetyEl.className = 'text-[11px] font-bold text-emerald-700';
      }
      if (warnings) warnings.innerText = 'Đường ngắn nhất hiện không bị ngập.';
    } else {
      if (badge) {
        badge.innerText = 'Bị ngập sâu!';
        badge.className = 'text-[10px] font-semibold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full';
      }
      if (fastestSafetyEl) {
        fastestSafetyEl.innerText = 'Nguy hiểm (Bị ngập)';
        fastestSafetyEl.className = 'text-[11px] font-bold text-rose-600';
      }
      const warnNames = fastestWarnList.map(w => {
        const name = typeof w === 'string' ? w : (w.street || w.source || 'Đoạn trũng');
        const d = w.depth_cm ? ` (${w.depth_cm}cm)` : '';
        return `${name}${d}`;
      }).join(', ');
      if (warnings) warnings.innerHTML = `⚠️ Bị ngập tại: ${warnNames || 'Đoạn trũng'}`;

      if (fastest.geometry && fastest.geometry.coordinates) {
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

  // 3. Mặc định chọn tuyến An Toàn (hoặc Nhanh Nhất nếu An Toàn bị chặn)
  if (safe && safe.found) {
    selectActiveRoute('safe');
  } else if (fastest && fastest.found) {
    selectActiveRoute('fastest');
  }

  // 4. Gọi module cảnh báo âm thanh
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

  // 5. Tối ưu trải nghiệm Mobile
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

  if (window.lucide) lucide.createIcons();
}

// Hàm chuyển đổi lựa chọn giữa các lộ trình (An toàn vs Nhanh nhất)
function selectActiveRoute(mode) {
  if (!currentRouteData) return;
  activeRouteMode = mode;

  const cardSafe = document.getElementById('card-safe-route');
  const cardFastest = document.getElementById('card-fastest-route');
  const badgeSafe = document.getElementById('safe-selected-badge');
  const badgeFastest = document.getElementById('fastest-selected-badge');

  const { safe, fastest, same_route } = currentRouteData;

  if (mode === 'safe') {
    if (!safe || !safe.found) {
      showToast('Lộ trình an toàn hiện không khả dụng (đường bị chặn)', 'warning');
      return;
    }

    if (cardSafe) {
      cardSafe.classList.remove('opacity-60', 'border-slate-300');
      cardSafe.classList.add('border-emerald-500', 'ring-2', 'ring-emerald-400', 'shadow-md');
    }
    if (badgeSafe) badgeSafe.classList.remove('hidden');

    if (cardFastest) {
      cardFastest.classList.remove('ring-2', 'ring-blue-400', 'border-blue-500', 'shadow-md');
      cardFastest.classList.add('opacity-70', 'border-slate-300');
    }
    if (badgeFastest) badgeFastest.classList.add('hidden');

    if (routeLayers.safe && map) {
      routeLayers.safe.setStyle({ color: '#2563eb', weight: 6, opacity: 0.95 });
      routeLayers.safe.bringToFront();
      map.fitBounds(routeLayers.safe.getBounds(), { padding: [40, 40] });
    }
    if (routeLayers.fastest && map) {
      routeLayers.fastest.setStyle({ color: '#94a3b8', weight: 3, opacity: 0.45 });
    }

    if (window.VehicleSim && safe.geometry && safe.geometry.coordinates) {
      const latlngs = safe.geometry.coordinates.map(c => [c[1], c[0]]);
      const v = document.querySelector('input[name="vehicle"]:checked');
      VehicleSim.start(latlngs, v ? v.value : 'motorbike');
    }
  } else if (mode === 'fastest') {
    if (!fastest || !fastest.found) {
      showToast('Lộ trình nhanh nhất không khả dụng', 'warning');
      return;
    }

    if (cardFastest) {
      cardFastest.classList.remove('opacity-70', 'border-slate-300');
      cardFastest.classList.add('border-blue-500', 'ring-2', 'ring-blue-400', 'shadow-md');
    }
    if (badgeFastest) badgeFastest.classList.remove('hidden');

    if (cardSafe) {
      cardSafe.classList.remove('ring-2', 'ring-emerald-400', 'border-emerald-500', 'shadow-md');
      cardSafe.classList.add('opacity-70', 'border-slate-300');
    }
    if (badgeSafe) badgeSafe.classList.add('hidden');

    if (routeLayers.fastest && map) {
      routeLayers.fastest.setStyle({
        color: same_route ? '#2563eb' : '#dc2626',
        weight: 6,
        opacity: 0.95,
        dashArray: same_route ? null : '6, 6'
      });
      routeLayers.fastest.bringToFront();
      map.fitBounds(routeLayers.fastest.getBounds(), { padding: [40, 40] });
    }
    if (routeLayers.safe && map) {
      routeLayers.safe.setStyle({ color: '#2563eb', weight: 3, opacity: 0.35 });
    }

    if (window.VehicleSim && fastest.geometry && fastest.geometry.coordinates) {
      const latlngs = fastest.geometry.coordinates.map(c => [c[1], c[0]]);
      const v = document.querySelector('input[name="vehicle"]:checked');
      VehicleSim.start(latlngs, v ? v.value : 'motorbike');
    }
  }

  if (window.lucide) lucide.createIcons();
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



// 10. Chuyển đổi Tab Sidebar & Thanh công cụ Header
function switchTab(tabId) {
  ['route', 'points', 'report'].forEach(id => {
    const tab = document.getElementById(`tab-${id}`);
    const btn = document.getElementById(`tab-btn-${id}`);
    const hdrBtn = document.getElementById(`hdr-btn-${id}`);

    if (tab) tab.classList.add('hidden');
    if (btn) btn.className = 'flex-1 py-3 px-2 border-b-2 border-transparent hover:text-slate-900 flex items-center justify-center gap-1.5 transition text-xs font-semibold text-slate-600';
    if (hdrBtn) {
      hdrBtn.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 font-semibold text-xs transition flex items-center gap-1.5';
    }
  });

  const activeTab = document.getElementById(`tab-${tabId}`);
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  const activeHdrBtn = document.getElementById(`hdr-btn-${tabId}`);

  if (activeTab) activeTab.classList.remove('hidden');
  if (activeBtn) activeBtn.className = 'flex-1 py-3 px-2 border-b-2 border-blue-600 text-blue-600 flex items-center justify-center gap-1.5 transition font-bold text-xs';
  if (activeHdrBtn) {
    activeHdrBtn.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/25 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm border border-white/20';
  }

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





// =================================================
// 13. TÌM KIẾM ĐỊA CHỈ & GỢI Ý ĐỊA ĐIỂM (Address Geocoding - FE-02)

// =================================================
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



// FE-01: Kiểm tra trạng thái PostGIS kết nối cho Floating Header
async function checkPostGISConnection() {
  const badge = document.getElementById('postgis-status-badge');
  if (!badge) return;
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (data.database === 'connected') {
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>PostGIS Live</span>';
        badge.className = 'flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 rounded-lg text-[11px] font-semibold cursor-default';
        badge.title = 'PostGIS Live: Cơ sở dữ liệu không gian PostgreSQL kết nối thành công';
        return;
      }
    }
  } catch (e) {}
  badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>PostGIS Standby</span>';
  badge.className = 'flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 border border-amber-400/30 text-amber-100 rounded-lg text-[11px] font-semibold cursor-default';
  badge.title = 'PostGIS Standby: Đang hoạt động ở chế độ bộ nhớ dự phòng In-Memory / SQLite';
}

// FE-02: Tải thông tin thời tiết & lượng mưa thực tế cho Nhóm 2 (Giám sát)
async function loadWeatherInfo() {
  const el = document.getElementById('weather-badge');
  if (!el) return;
  try {
    const res = await fetch('/api/weather/hanoi');
    if (res.ok) {
      const data = await res.json();
      const currentPrecip = data.hourly_forecast && data.hourly_forecast[0] ? data.hourly_forecast[0].precipitation_mm : 0;
      const weatherText = currentPrecip > 0 ? `Mưa ${currentPrecip} mm` : `☀️ Tạnh ráo`;
      el.innerHTML = `<i data-lucide="${currentPrecip > 0 ? 'cloud-rain' : 'cloud-sun'}" class="w-3.5 h-3.5 text-cyan-200"></i><span>Hà Nội: <b>${weatherText}</b></span>`;
      el.title = `Dự báo lượng mưa tại Hà Nội: ${currentPrecip} mm/h (Open-Meteo API)`;
      if (window.lucide) lucide.createIcons();
      return;
    }
  } catch (e) {}
  el.innerHTML = `<i data-lucide="sun" class="w-3.5 h-3.5 text-amber-300"></i><span>Hà Nội: <b>28°C • Tạnh</b></span>`;
  if (window.lucide) lucide.createIcons();
}

// FE-02: Điều khiển Menu phụ Dropdown trong Nhóm 3 (Tiện ích)
function toggleHeaderMenu(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  const menu = document.getElementById('header-more-dropdown');
  if (menu) menu.classList.toggle('hidden');
}

function closeHeaderMenu() {
  const menu = document.getElementById('header-more-dropdown');
  if (menu) menu.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('header-more-dropdown');
  const btn = document.getElementById('btn-header-more');
  if (menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

// =================================================
// Xuất các biến và hàm điều khiển quan trọng ra window
// =================================================
window.floodPoints = floodPoints;
window.coords = coords;
if (typeof map !== 'undefined') window.map = map;
window.renderFloodPoints = renderFloodPoints;
window.switchTab = switchTab;
window.toggleHeaderMenu = toggleHeaderMenu;
window.closeHeaderMenu = closeHeaderMenu;
window.loadWeatherInfo = loadWeatherInfo;
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
  currentRouteData = null;

  const resultCard = document.getElementById('route-results');
  if (resultCard) resultCard.classList.add('hidden');

  const summaryCard = document.getElementById('flood-summary-card');
  if (summaryCard) summaryCard.classList.remove('hidden');

  updateSidebarFloodSummary();
  showToast('Đã xóa lộ trình & xem lại tình hình ngập', 'info');
}

window.showToast = showToast;
window.clearActiveRoute = clearActiveRoute;
window.selectActiveRoute = selectActiveRoute;
window.updateSidebarFloodSummary = updateSidebarFloodSummary;
window.resetToDefaultState = function() {
  if (window.StormSimulator && typeof StormSimulator.resetToDefault === 'function') {
    StormSimulator.resetToDefault();
  }
};
