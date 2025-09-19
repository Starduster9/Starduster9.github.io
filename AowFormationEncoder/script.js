// ==== 구성값 ====
const GRID_SIZE = 7;
const NUM_CELLS = GRID_SIZE * GRID_SIZE;
const TARGET_EMPTY_RGB = [246, 238, 213];
const AREA_TOLERANCE = 0.10; // 중앙값 대비 ±10%

// 요소 모음
const els = {
  imgInput: document.getElementById('imgInput'),
  runBtn: document.getElementById('runBtn'),
  copyJson: document.getElementById('copyJson'),
  copyB64: document.getElementById('copyB64'),
  jsonOut: document.getElementById('jsonOut'),
  b64Out: document.getElementById('b64Out'),
  status: document.getElementById('status'),
  canvas: document.getElementById('canvas'),
  log: document.getElementById('log'),
  tplProgress: document.getElementById('tplProgress'),
  tplStatus: document.getElementById('tplStatus'),
  thumb: document.getElementById('thumb'),
  jsonCopiedMark: document.getElementById('jsonCopiedMark'),
  b64CopiedMark: document.getElementById('b64CopiedMark')
};

let cvReady = false;
let templates = {}; // { code(string): grayMat }
let srcMat = null;  // 이미지 Mat (RGB)

// 템플릿 폴더
const TEMPLATE_BASE = './troop_images';

// 상태/로그
function setStatus(msg, kind){
  els.status.textContent = msg || '';
  els.status.className = 'status' + (kind ? ' ' + kind : '');
  log(msg);
}
function log(msg){ if(!msg) return; els.log.textContent += `\n${msg}`; }
function resetCopyIndicators(){
  if (els.jsonCopiedMark) els.jsonCopiedMark.style.display = 'none';
  if (els.b64CopiedMark) els.b64CopiedMark.style.display = 'none';
}

window.onOpenCvReady = function(){
  cv['onRuntimeInitialized'] = async () => {
    cvReady = true;
    els.tplStatus.textContent = 'OpenCV 준비 완료';
    els.tplStatus.className = 'status ok';
    try{ await preloadTemplates(); }
    catch(err){ els.tplStatus.textContent = '템플릿 로드 실패: ' + err.message; els.tplStatus.className='status err'; }
    enableRunIfReady();
  };
};
window.cvLoadError = function(){
  els.tplStatus.textContent = 'OpenCV 로드 실패';
  els.tplStatus.className='status err';
};

// 파일 → 미리보기
els.imgInput.addEventListener('change', async (e)=>{
  resetCopyIndicators();
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

// 복사 버튼
els.copyJson?.addEventListener('click', ()=> copyToClipboard(els.jsonOut.value, 'JSON', 'json'));
els.copyB64?.addEventListener('click', ()=> copyToClipboard(els.b64Out.value, '반죽', 'b64'));

function copyToClipboard(text, label, kind){
  if(!text){ setStatus(label + ' 내용이 없습니다', 'warn'); return; }
  navigator.clipboard.writeText(text).then(()=>{
    setStatus(label + ' 복사 완료', 'ok');
    if (kind==='json' && els.jsonCopiedMark) els.jsonCopiedMark.style.display = 'inline';
    if (kind==='b64' && els.b64CopiedMark) els.b64CopiedMark.style.display = 'inline';
  }).catch(()=>{
    setStatus('복사 권한이 없습니다. 직접 선택해 복사하세요.', 'warn');
  });
}

// 변환 실행
function enableRunIfReady(){
  const ready = (cvReady && Object.keys(templates).length>0 && srcMat);
  els.runBtn.disabled = !ready;
}
els.runBtn.addEventListener('click', async ()=>{
  try{
    resetCopyIndicators();
    if (!(srcMat && Object.keys(templates).length)) return;
    setStatus('변환 중… 잠시만요');
    const result = processImage(srcMat);
    const jsonStr = JSON.stringify(result, null, 2);
    els.jsonOut.value = jsonStr;
    els.b64Out.value = btoa(jsonStr);
    setStatus('완료되었습니다 ✅', 'ok');
  }catch(err){ setStatus('실패: ' + err.message, 'err'); console.error(err); }
});

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

// ===== 템플릿 자동 로더 (list.txt 기반) =====
async function preloadTemplates(){
  templates = {};
  // list.txt 읽기
  const resp = await fetch(`${TEMPLATE_BASE}/list.txt`);
  if (!resp.ok) throw new Error('list.txt 불러오기 실패');
  const txt = await resp.text();
  const codes = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (els.tplProgress){ els.tplProgress.max = codes.length; els.tplProgress.value = 0; }
  const loaded = [];

  for (const code of codes){
    const url = `${TEMPLATE_BASE}/${code}.png`;
    const mat = await urlToGrayMat(url);
    templates[String(code)] = mat; loaded.push(code);
    if (els.tplProgress){ els.tplProgress.value = loaded.length; }
  }

  log(`템플릿 ${loaded.length}개 로드 완료`);
  log(`로드된 템플릿: ${loaded.join(', ')}`);
  els.tplStatus.textContent = `템플릿 로드 완료`;
  els.tplStatus.className = 'status ok';
}

function urlToGrayMat(url){
  return new Promise((resolve, reject)=>{
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = ()=>{
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img,0,0);
      const rgba = cv.imread(c);
      let gray = new cv.Mat(); cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY); rgba.delete();
      resolve(gray);
    };
    img.onerror = ()=>reject(new Error('이미지 로드 실패: '+url));
    img.src = url;
  });
}

// ===================== 핵심 처리 파이프라인 (원본 기능 유지) =====================
function processImage(imgRGB){
  const nonEmptyMask = buildNonEmptyMask(imgRGB, TARGET_EMPTY_RGB);
  const comps = connectedComponents(nonEmptyMask);
  const gridLabels = selectGridComponents(comps.stats, NUM_CELLS, AREA_TOLERANCE);
  const troopLayout = buildTroopLayout(imgRGB, comps.stats, comps.centroids, gridLabels, templates);
  return buildPayload(troopLayout, {});
}

function buildNonEmptyMask(imgRGB, emptyRGB){
  const src = imgRGB; let mask = new cv.Mat();
  const lo = new cv.Mat(src.rows, src.cols, src.type(), new cv.Scalar(emptyRGB[0], emptyRGB[1], emptyRGB[2]));
  const hi = new cv.Mat(src.rows, src.cols, src.type(), new cv.Scalar(emptyRGB[0], emptyRGB[1], emptyRGB[2]));
  cv.inRange(src, lo, hi, mask); // empty == 255
  lo.delete(); hi.delete();

  let labels = new cv.Mat(); let stats = new cv.Mat(); let centroids = new cv.Mat();
  cv.connectedComponentsWithStats(mask, labels, stats, centroids, 4, cv.CV_32S);
  if (stats.rows <= 1) { cv.bitwise_not(mask, mask); return mask; }

  let maxArea = -1, maxIdx = 1;
  for (let i=1; i<stats.rows; i++){
    const area = stats.intPtr(i, cv.CC_STAT_AREA)[0];
    if (area > maxArea){ maxArea = area; maxIdx = i; }
  }
  let refinedBG = new cv.Mat.zeros(mask.rows, mask.cols, cv.CV_8U);
  for (let r=0; r<labels.rows; r++){
    for (let c=0; c<labels.cols; c++){
      if (labels.intPtr(r,c)[0] === maxIdx) refinedBG.ucharPtr(r,c)[0] = 255;
    }
  }
  let nonEmpty = new cv.Mat();
  cv.bitwise_not(refinedBG, nonEmpty);
  mask.delete(); labels.delete(); stats.delete(); centroids.delete(); refinedBG.delete();
  return nonEmpty;
}

function connectedComponents(mask){
  let labels = new cv.Mat(); let stats = new cv.Mat(); let centroids = new cv.Mat();
  cv.connectedComponentsWithStats(mask, labels, stats, centroids, 4, cv.CV_32S);
  return { labels, stats, centroids };
}

function selectGridComponents(stats, expected, tol){
  const areas = []; for (let i=1; i<stats.rows; i++){ areas.push(stats.intPtr(i, cv.CC_STAT_AREA)[0]); }
  if (areas.length < expected) throw new Error(`성분 부족: ${areas.length} < ${expected}`);
  const med = median(areas); const lo = med * (1 - tol), hi = med * (1 + tol);
  const candidates = [];
  for (let i=1; i<stats.rows; i++){
    const area = stats.intPtr(i, cv.CC_STAT_AREA)[0];
    if (area>=lo && area<=hi) candidates.push({label:i, area});
  }
  if (candidates.length < expected){
    const all = []; for (let i=1; i<stats.rows; i++) all.push({label:i, area: stats.intPtr(i, cv.CC_STAT_AREA)[0]});
    all.sort((a,b)=>b.area-a.area); return all.slice(0, expected).map(o=>o.label);
  }
  candidates.sort((a,b)=>b.area-a.area); return candidates.slice(0, expected).map(o=>o.label);
}

function sortLabelsRowMajor(stats, centroids, labels){
  const pts = labels.map(lbl => ({
    lbl,
    x: centroids.doublePtr(lbl, 0)[0],
    y: centroids.doublePtr(lbl, 1)[0]
  }));
  const ys = pts.map(p=>p.y); const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const rowStep = (yMax - yMin + 1e-6) / GRID_SIZE;
  function rowIndex(y){ let r = Math.floor((y - yMin) / rowStep); return Math.min(Math.max(r, 0), GRID_SIZE-1); }
  pts.sort((a,b)=>{ const ra = rowIndex(a.y), rb = rowIndex(b.y); if (ra !== rb) return ra - rb; return a.x - b.x; });
  return pts.map(p=>p.lbl);
}

function extractPatchGray(imgRGB, statRow){
  const x = statRow.intPtr(0, cv.CC_STAT_LEFT)[0];
  const y = statRow.intPtr(0, cv.CC_STAT_TOP)[0];
  const w = statRow.intPtr(0, cv.CC_STAT_WIDTH)[0];
  const h = statRow.intPtr(0, cv.CC_STAT_HEIGHT)[0];
  const rect = new cv.Rect(x,y,w,h); const patch = imgRGB.roi(rect);
  let gray = new cv.Mat(); cv.cvtColor(patch, gray, cv.COLOR_RGB2GRAY); patch.delete();
  const y0 = Math.floor(h*0.20), y1 = Math.floor(h*0.60);
  const x0 = Math.floor(w*0.10), x1 = Math.floor(w*0.90);
  const roi = gray.roi(new cv.Rect(x0, y0, Math.max(1,x1-x0), Math.max(1,y1-y0)));
  gray.delete(); return roi;
}

function mse(a, b){ let diff = new cv.Mat(); cv.absdiff(a, b, diff); cv.multiply(diff, diff, diff); const mean = cv.mean(diff)[0]; diff.delete(); return mean; }

function matchTemplateCode(patchGray, templates){
  const size = patchGray.size(); let best = {code:null, score:Infinity};
  for (const [code, tGray] of Object.entries(templates)){
    let resized = new cv.Mat(); cv.resize(tGray, resized, size, 0, 0, cv.INTER_AREA);
    const score = mse(patchGray, resized); resized.delete();
    if (score < best.score){ best = {code, score}; }
  }
  if (!best.code) throw new Error('템플릿 매칭 실패');
  return best.code;
}

function buildTroopLayout(imgRGB, stats, centroids, labels, templates){
  const ordered = sortLabelsRowMajor(stats, centroids, labels); const layout = {};
  for (let idx=0; idx<ordered.length; idx++){
    const lbl = ordered[idx]; const r = Math.floor(idx / GRID_SIZE), c = idx % GRID_SIZE;
    const statRow = stats.row(lbl); const patch = extractPatchGray(imgRGB, statRow); const code = matchTemplateCode(patch, templates);
    layout[`${r}${c}`] = parseInt(code, 10); patch.delete(); statRow.delete();
  }
  return layout;
}

function buildPayload(troopLayout, heroLayout){
  return { GameMode: 0, troopLayout, heroLayout: heroLayout || {}, armyLayout: null };
}

function median(arr){ const s=[...arr].sort((a,b)=>a-b); const m=(s.length-1)/2; return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2; }
