/**
 * ========================================================
 * FloodNav - Urban Operations & Analytics Dashboard
 * Phụ trách chính: Thành viên 3 (Independent Frontend)
 * Thư viện: Chart.js (MIT License - OSI Approved)
 * ========================================================
 */

const FloodDashboard = (function () {
  let depthChartInstance = null;
  let statusChartInstance = null;

  function openDashboard() {
    const modal = document.getElementById('dashboard-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderCharts();
  }

  function closeDashboard() {
    const modal = document.getElementById('dashboard-modal');
    if (modal) modal.classList.add('hidden');
  }

  // Lấy dữ liệu trực tiếp từ /api/flood-points (floodPoints trong map_core.js khai báo bằng `let`
  // nên window.floodPoints luôn undefined -> trước đây Dashboard bị trống)
  async function fetchPoints() {
    try {
      const res = await fetch('/api/flood-points');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return data.features || [];
    } catch (err) {
      console.warn('Dashboard: không gọi được /api/flood-points, dùng dữ liệu đang có.', err);
      return (typeof floodPoints !== 'undefined') ? floodPoints : [];
    }
  }

  async function renderCharts() {
    if (!window.Chart) return;
    const floodPoints = await fetchPoints();
    if (!floodPoints.length) return;

    const names = floodPoints.map(f => f.name || f.properties?.name || ('Trạm ' + f.id));
    const depths = floodPoints.map(f => Number(f.depth_cm !== undefined ? f.depth_cm : f.properties?.depth_cm) || 0);
    const thresholds = floodPoints.map(f => Number(f.threshold_cm !== undefined ? f.threshold_cm : f.properties?.threshold_cm) || 20);

    let safeCount = 0, warnCount = 0, dangerCount = 0;
    floodPoints.forEach(f => {
      const s = f.status || f.properties?.status;
      if (s === 'safe') safeCount++;
      else if (s === 'warning') warnCount++;
      else if (s === 'danger') dangerCount++;
    });

    // 1. Biểu đồ cột: Mực nước từng cảm biến
    const ctxDepth = document.getElementById('chart-sensor-depths');
    if (ctxDepth) {
      if (depthChartInstance) depthChartInstance.destroy();
      depthChartInstance = new Chart(ctxDepth, {
        type: 'bar',
        data: {
          labels: names,
          datasets: [
            {
              label: 'Mực nước hiện tại (cm)',
              data: depths,
              backgroundColor: floodPoints.map(f => f.properties.status === 'danger' ? '#ef4444' : (f.properties.status === 'warning' ? '#f59e0b' : '#10b981')),
              borderRadius: 6
            },
            {
              label: 'Ngưỡng cảnh báo (20cm)',
              data: thresholds,
              type: 'line',
              borderColor: '#94a3b8',
              borderDash: [5, 5],
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' }
          },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Centimet (cm)' } }
          }
        }
      });
    }

    // 2. Biểu đồ tròn: Tỷ lệ an toàn / cảnh báo / nguy hiểm
    const ctxStatus = document.getElementById('chart-status-ratio');
    if (ctxStatus) {
      if (statusChartInstance) statusChartInstance.destroy();
      statusChartInstance = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
          labels: ['An toàn (<5cm)', 'Cảnh báo (5-19cm)', 'Nguy hiểm (≥20cm)'],
          datasets: [{
            data: [safeCount, warnCount, dangerCount],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }
  }

  return {
    openDashboard,
    closeDashboard,
    renderCharts
  };
})();

window.FloodDashboard = FloodDashboard;
