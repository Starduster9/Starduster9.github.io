/* OpenCV.js 로더: 2개 CDN + 런타임 폴링 */
(function(){
let statusEl=null, readyCalled=false, pollId=null;
function setStatus(t){
if(!statusEl) statusEl=document.getElementById('status');
if(statusEl) statusEl.textContent=t;
}
function callReadyOnce(){
if(!readyCalled){
readyCalled=true;
if(typeof window.onCvReady==='function') window.onCvReady();
// 커스텀 이벤트도 발행 (모듈에서 사용할 수 있음)
try{ window.dispatchEvent(new CustomEvent('cv-ready')); }catch(_){}
}
}
window.onOpenCvLoaded=function(){
if (typeof cv !== 'undefined'){
cv['onRuntimeInitialized'] = function(){ callReadyOnce(); };
let t0=performance.now();
pollId = setInterval(()=>{
try{
if (cv && cv.Mat && typeof cv.imread === 'function'){
callReadyOnce();
clearInterval(pollId);
}
if (performance.now()-t0>10000) clearInterval(pollId);
}catch(_){}
},100);
}
};
const urls=['https://docs.opencv.org/4.10.0/opencv.js','https://cdn.jsdelivr.net/npm/opencv.js@4.10.0/dist/opencv.js'];
let i=0;
function loadNext(){
if(i>=urls.length){setStatus('OpenCV.js 로드 실패');return;}
const u=urls[i++]; setStatus('OpenCV.js 로딩 중… '+u);
const s=document.createElement('script'); s.src=u; s.async=true;
s.onload=function(){setStatus('OpenCV.js 스크립트 로드됨'); if(typeof onOpenCvLoaded==='function') onOpenCvLoaded(); };
s.onerror=function(){setStatus('로드 실패: '+u); loadNext();};
document.head.appendChild(s);
}
loadNext();
setTimeout(function(){
if(!(window.cv&&cv.Mat)){ setStatus('초기화 지연: 대체 CDN 시도'); loadNext(); }
},10000);
})();
