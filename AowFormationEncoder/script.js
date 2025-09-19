// ==== 구성값 (기존 로직 유지) ====
const GRID_SIZE = 7;
const NUM_CELLS = GRID_SIZE * GRID_SIZE;
const TARGET_EMPTY_RGB = [246, 238, 213];
const AREA_TOLERANCE = 0.10;

// 요소 모음
const els = {
  imgInput: document.getElementById('imgInput'),
  runBtn: document.getElementById('runBtn'),
  resetBtn: document.getElementById('resetBtn'),
  dlJsonBtn: document.getElementById('dlJsonBtn'),
  dlB64Btn: document.getElementById('dlB64Btn'),
  copyJson: document.getElementById('copyJson'),
  copyB64: document.getElementById('copyB64'),
  jsonOut: document.getElementById('jsonOut'),
  b64Out: document.getElementById('b64Out'),
  status: document.getElementById('status'),
  canvas: document.getElementById('canvas'),
  log: document.getElementById('log'),
  tplList: document.getElementById('tplList'),
  tplProgress: document.getElementById('tplProgress'),
  tplStatus: document.getElementById('tplStatus'),
  thumb: document.getElementById('thumb')
};

let cvReady = false;
let templates = {};
let srcMat = null;

const TEMPLATE_BASE = './templates';
const TEMPLATE_CODES = [
  101,102,103,104,105,106,107,109,110,111,112,113,
  124,125,126,132,133,134,142,143,144,145,146,147,148,149,150,151,
  159,160,161,162,163,164,166,168,173,178,179,180,181,182,183,186,
  188,189,191,192,193,198,199,200,201,202,203,210,211,212,213,214,
  215,216,217,219,220
];

function setStatus(msg, kind){
  els.status.textContent = msg || '';
  els.status.className = 'status' + (kind ? ' ' + kind : '');
  log(msg);
}
function log(msg){ if(!msg) return; els.log.textContent += `\n${msg}`; }

function onOpenCvReady(){
  cv['onRuntimeInitialized'] = async () => {
    cvReady = true;
    els.tplStatus.textContent = 'OpenCV 준비 완료';
    els.tplStatus.className = 'status ok';
    try{ await preloadTemplates(); }
    catch(err){ els.tplStatus.textContent = '템플릿 로드 실패: ' + err.message; els.tplStatus.className='status err'; }
    enableRunIfReady();
  };
}
function cvLoadError(){ els.tplStatus.textContent = 'OpenCV 로드 실패'; els.tplStatus.className='status err'; }

// 파일 → 미리보기
els.imgInput.addEventListener('change', async (e)=>{
  const [file] = e.target.files || [];
  if (!file) return;
  const url = URL.createObjectURL(file);
  els.thumb.src = url; els.thumb.style.display = 'block';
  try{
    if (srcMat){ srcMat.delete(); srcMat=null; }
    const bgr = await loadImageFile(file);
    srcMat = new cv.Mat();
    if (bgr.type() === cv.CV_8UC4){ cv.cvtColor(bgr, srcMat, cv.COLOR_RGBA2RGB); bgr.delete(); }
    else { cv.cvtColor(bgr, srcMat, cv.COLOR_BGR2RGB); bgr.delete(); }
    setStatus('이미지 준비 완료', 'ok');
    enableRunIfReady();
  }catch(err){ setStatus('이미지 로드 실패: ' + err.message, 'err'); }
});

els.resetBtn.addEventListener('click', ()=>{
  els.imgInput.value = '';
  els.thumb.removeAttribute('src'); els.thumb.style.display='none';
  els.jsonOut.value = els.b64Out.value = '';
  els.dlJsonBtn.disabled = els.dlB64Btn.disabled = true;
  setStatus('초기화 완료');
});

els.copyJson.addEventListener('click', ()=> copyToClipboard(els.jsonOut.value, 'JSON'));
els.copyB64.addEventListener('click', ()=> copyToClipboard(els.b64Out.value, 'Base64'));

function copyToClipboard(text, label){
  if(!text){ setStatus(label + ' 내용이 없습니다', 'warn'); return; }
  navigator.clipboard.writeText(text).then(()=> setStatus(label + ' 복사 완료', 'ok'))
    .catch(()=> setStatus('복사 권한이 없습니다. 직접 선택해 복사하세요.', 'warn'));
}

function enableRunIfReady(){
  const ready = (cvReady && Object.keys(templates).length>0 && srcMat);
  els.runBtn.disabled = !ready;
}

els.runBtn.addEventListener('click', async ()=>{
  try{
    if (!(srcMat && Object.keys(templates).length)) return;
    setStatus('변환 중… 잠시만요');
    const result = processImage(srcMat);
    const jsonStr = JSON.stringify(result, null, 2);
    els.jsonOut.value = jsonStr;
    els.b64Out.value = btoa(jsonStr);
    els.dlJsonBtn.disabled = false; els.dlB64Btn.disabled = false;
    setStatus('완료되었습니다 ✅', 'ok');
  }catch(err){ setStatus('실패: ' + err.message, 'err'); console.error(err); }
});

els.dlJsonBtn.addEventListener('click', ()=> downloadText('payload.json', els.jsonOut.value));
els.dlB64Btn.addEventListener('click', ()=> downloadText('payload.base64.txt', els.b64Out.value));

function downloadText(name, text){
  const blob = new Blob([text], {type:'text/plain'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

// ===== 이미지 로딩 =====
function loadImageFile(file){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = () => {
      const ctx = els.canvas.getContext('2d');
      const size = Math.min(els.canvas.width, els.canvas.height);
      ctx.clearRect(0,0,els.canvas.width, els.canvas.height);
      ctx.drawImage(img, 0, 0, size, size);
      const mat = cv.imread(els.canvas);
      resolve(mat);
    };
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = URL.createObjectURL(file);
  });
}

// ===== 템플릿 로딩 =====
async function preloadTemplates(){
  templates = {}; const loaded = [];
  if (els.tplProgress){ els.tplProgress.max = TEMPLATE_CODES.length; els.tplProgress.value = 0; }
  for (const code of TEMPLATE_CODES){
    const url = `${TEMPLATE_BASE}/${code}.png`;
    const mat = await urlToGrayMat(url);
    templates[String(code)] = mat; loaded.push(code);
    if (els.tplProgress){ els.tplProgress.value = loaded.length; }
  }
  els.tplList.textContent = `로드된 템플릿: ${loaded.join(', ')}`;
  els.tplStatus.textContent = `템플릿 ${loaded.length}개 로드 완료`;
