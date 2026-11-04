/**
 * ========================================================
 * FloodNav - Voice Navigation & Audio Warning Module
 * Phụ trách chính: Thành viên 3 (Independent Frontend)
 * Công nghệ: W3C Web Speech Synthesis API (100% Client-side, Free, Offline)
 * ========================================================
 */

const VoiceWarning = (function () {
  let isEnabled = true;
  let synth = window.speechSynthesis;
  let vietnameseVoice = null;

  function initVoices() {
    if (!synth) return;
    const voices = synth.getVoices();
    // Tìm giọng đọc tiếng Việt nếu có trên hệ điều hành / trình duyệt
    vietnameseVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VIE')) || null;
  }

  if (window.speechSynthesis) {
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = initVoices;
    }
    initVoices();
  }

  function speak(text) {
    if (!isEnabled || !synth) return;
    try {
      synth.cancel(); // Dừng câu đọc trước nếu đang đọc dở
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'vi-VN';
      utter.rate = 1.05; // Tốc độ vừa phải
      utter.pitch = 1.0;
      if (vietnameseVoice) utter.voice = vietnameseVoice;
      synth.speak(utter);
    } catch (e) {
      console.warn('Voice synthesis error:', e);
    }
  }

  function toggleVoice() {
    isEnabled = !isEnabled;
    const icon = document.getElementById('voice-toggle-icon');
    if (icon) {
      icon.setAttribute('data-lucide', isEnabled ? 'volume-2' : 'volume-x');
      if (window.lucide) lucide.createIcons();
    }
    speak(isEnabled ? "Đã bật cảnh báo giọng nói tiếng Việt." : "Đã tắt âm thanh cảnh báo.");
  }

  function speakRouteResult(data) {
    if (!data) return;
    const safe = data.safe;
    const fastest = data.fastest;

    if (!safe || !safe.found) {
      speak("Cảnh báo khẩn cấp: Không tìm thấy đường an toàn. Mọi ngả đường đều ngập sâu vượt ngưỡng xe của bạn.");
      return;
    }

    if (data.same_route) {
      speak(`Đã tìm thấy lộ trình an toàn nhất dài ${(safe.distance_m / 1000).toFixed(1)} ki lô mét, dự kiến di chuyển trong ${Math.round(safe.duration_min)} phút.`);
    } else {
      const warnCount = fastest && fastest.flood_warnings ? fastest.flood_warnings.length : 0;
      speak(`Đã phát hiện ${warnCount} điểm ngập trên đường ngắn nhất. Hệ thống đã tự động chuyển sang tuyến đường né ngập an toàn.`);
    }
  }

  // Tương thích ngược với các lệnh gọi speakRoutePlan(safe, same_route)
  function speakRoutePlan(safe, same_route) {
    speakRouteResult({ safe, same_route });
  }

  return {
    speak,
    toggleVoice,
    speakRouteResult,
    speakRoutePlan,
    isEnabled: () => isEnabled
  };
})();

window.VoiceWarning = VoiceWarning;
