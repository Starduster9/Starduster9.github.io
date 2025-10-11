/* 앱 엔트리: 모듈 초기화 + UI 바인딩 */
import './progress.js';
import { initUI } from './ui.js';

initUI();

/**
 * OpenCV 로더/모듈 로딩 순서 경합을 막기 위한 안전장치.
 * - 커스텀 이벤트 'cv-ready'가 오면 즉시 실행 버튼을 해제
 * - 혹시 이벤트를 놓쳐도 주기적으로 상태를 확인하여 버튼을 풀어줌
 */
function tryEnableRun() {
  const runEl = document.getElementById('run');
  if (runEl && window.cv && cv.Mat) {
    runEl.disabled = false;
  }
}

// 로더에서 onCvReady가 호출될 때 커스텀 이벤트를 쏘도록 되어 있음
window.addEventListener('cv-ready', tryEnableRun);

// 폴백: 300ms 간격으로 최대 약 10초 확인
let tries = 0;
const iv = setInterval(() => {
  tryEnableRun();
  if (++tries >= 34 || (window.cv && cv.Mat)) {
    clearInterval(iv);
  }
}, 300);
