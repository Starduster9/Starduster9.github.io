/* 앱 엔트리: 모듈 초기화 + UI 바인딩 */
import './progress.js'; // CSS/DOM 요소를 바라보는 클래스
import { onCvReady } from './cv-utils.js';
import { initUI } from './ui.js';


// OpenCV 준비 이벤트가 오면 상태 갱신됨 (cv-utils 가 window.onCvReady 핸들함)
window.addEventListener('cv-ready', ()=>{ /* 필요 시 추가 초기화 가능 */ });


// UI 셋업
initUI();
