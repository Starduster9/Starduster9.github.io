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
  b64CopiedMark: document.getElementById('b64CopiedMark'),
  previewWrap: document.querySelector('.preview-wrap') // 로그의 미리보기/캔버스 영역
};

let cvReady = false;
let templates = {};            // { code(string): grayMat }
let srcMat = null;             // 이미지 Mat (RGB)
let templatesReady = false;    // 템플릿 전체 로딩 완료 플래그

// 시작 시 로그 미리보기 영역 감추기
if (els.previewWrap) els.previewWrap.style.display = 'none';

// 템플릿 폴더 (troop_images)
const TEMPLATE_BASE = './troop_images';

// 상태/로그
function setStatus(msg, kind){
  els.status.textContent = msg || '';
  els.status.className = 'status' + (kind ? ' ' + kind : '');
  if (msg) log(msg);
}
function log(msg){ if(!msg) return; els.log.textContent += `\n${msg}`; }
function resetCopyIndicators(){
  if (els.jsonCopiedMark) { els.jsonCopiedMark.style.display = 'none'; els.jsonCopiedMark.textContent = '복사되었습니다!'; els.jsonCopiedMark.className = 'status ok'; }
  if (els.b64CopiedMark) { els.b64CopiedMark.style.display = 'none'; els.b64CopiedMark.textContent = '복사되었습니다!'; els.b64CopiedMark.className = 'status ok'; }
}

// ✅ 새 파일이 실제로 업로드(선택)된 순간에만 UI 초기화
//    - 미리보기/캔버스/썸네일/반죽/JSON/복사표식/상태 초기화
//    - 로그 텍스트(els.log.textContent)는 초기화하지 않음
function resetUIForNewUpload(){
  resetCopyIndicators();

  // 상태 초기화 (2번 옆 문구 제거)
  els.status.textContent = '';
  els.status.className = 'status';

  // 반죽/JSON 초기화
  if (els.b64Out) els.b64Out.value = '';
  if (els.jsonOut) els.jsonOut.value = '';

  // 썸네일 초기화
  if (els.thumb){
    els.thumb.removeAttribute('src');
    els.thumb.style.display = 'none';
  }

  // 미리보기 영역 비가시화 + 캔버스 클리어
  if (els.canvas){
    els.canvas.style.display = 'none';
    const ctx = els.canvas.getContext('2d');
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  }

  // 기존 이미지 Mat 정리
  if (srcMat){ try{ srcMat.delete(); }catch{} }
  srcMat = null;

  enableRunIfReady();
}

// OpenCV 준비
window.onOpenCvReady = function(){
  cv['onRuntimeInitialized'] = async () => {
    cvReady = true;
    els.tplStatus.textContent = 'OpenCV 준비 완료';
    els.tplStatus.className = 'status ok';
    try{
      await preloadTemplates();  // 템플릿 먼저 끝까지 로드
    }catch(err){
      els.tplStatus.textContent = '템플릿 로드 실패: ' + err.message;
      els.tplStatus.className = 'status err';
    }
    enableRunIfReady();
  };
};
window.cvLoadError = function(){
  els.tplStatus.textContent = 'OpenCV 로드 실패';
  els.tplStatus.className='status err';
};

// 파일이 실제로 "새로 올라간 순간(change)"에만 초기화
els.imgInput.addEventListener('change', async (e)=>{
  const [file] = e.target.files || [];
  if (!file) {
    enableRunIfReady();
    return;
  }

  // 새 파일 업로드됨 → UI 초기화 (로그 텍스트는 보존)
  resetUIForNewUpload();

  // 새 썸네일 표시
  const url = URL.createObjectURL(file);
  if (els.thumb){ els.thumb.src = url; els.thumb.style.display = 'block'; }

  try{
    const rgba = await loadImageFile(file); // RGBA Mat (비율 유지로 읽음)
    srcMat = new cv.Mat();
    cv.cvtColor(rgba, srcMat, cv.COLOR_RGBA2RGB);
    rgba.delete();
    // 상태표시는 하지 않음
    enableRunIfReady();
  }catch(err){
    setStatus('이미지 로드 실패: ' + err.message, 'err');
  }
});

// ====== 복사 버튼: 인라인 메시지(버튼 옆)에만 표시 ======
els.copyJson?.addEventListener('click', ()=> handleCopy('json'));
els.copyB64?.addEventListener('click', ()=> handleCopy('b64'));

function handleCopy(kind){
  const isJson = (kind === 'json');
  const text = isJson ? (els.jsonOut?.value || '') : (els.b64Out?.value || '');
  const mark = isJson ? els.jsonCopiedMark : els.b64CopiedMark;

  // 우선 다른 표시들 리셋
  resetCopyIndicators();

  if (!text){
    if (mark){
      mark.textContent = isJson ? 'JSON 내용이 없습니다' : '반죽 내용이 없습니다';
      mark.className = 'status warn';
      mark.style.display = 'inline';
    }
    return;
  }

  navigator.clipboard.writeText(text).then(()=>{
    if (mark){
      mark.textContent = '복사되었습니다!';
      mark.className = 'status ok';
      mark.style.display = 'inline';
    }
    // 상단 status는 변경하지 않음
  }).catch(()=>{
    if (mark){
      mark.textContent = '복사 권한이 없습니다. 직접 선택해 복사하세요.';
      mark.className = 'status warn';
      mark.style.display = 'inline';
    }
  });
}

// 변환 실행: 템플릿 로딩 완료 + 이미지 + OpenCV 세 조건 필요
function enableRunIfReady(){
  const ready = (cvReady && templatesReady && srcMat);
  els.runBtn.disabled = !ready;
}
els.runBtn.addEventListener('click', async ()=>{
  try{
    resetCopyIndicators();
    if (!(cvReady && templatesReady && srcMat && Object.keys(templates).length)) return;
    setStatus('변환 중… 잠시만요');
    // 처리 + 시각화
    const { result, comps, gridLabels } = processImage(srcMat);
    // 결과 출력
    const jsonStr = JSON.stringify(result, null, 2);
    if (els.jsonOut) els.jsonOut.value = jsonStr;
    if (els.b64Out) els.b64Out.value = btoa(jsonStr);
    // 그리드 라벨 시각화 (로그 이미지)
    drawGridLabelsVisualization(srcMat, comps.stats, gridLabels);
    setStatus('완료되었습니다 ✅', 'ok');
  }catch(err){ setStatus('실패: ' + err.message, 'err'); console.error(err); }
});

// ===== 이미지 로딩 (비율 유지, 최대 변 한 변 800) =====
function loadImageFile(file){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = () => {
      const max = 800;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w >= h){
        if (w > max){ h = Math.round(h * (max / w)); w = max; }
      } else {
        if (h > max){ w = Math.round(w * (max / h)); h = max; }
      }
      // 미리보기 캔버스 크기만 맞춰두고, 실제 그리기는 변환 후 진행
      els.canvas.width = w; els.canvas.height = h;
      const off = document.createElement('canvas'); off.width = w; off.height = h;
      off.getContext('2d').drawImage(img, 0, 0, w, h);
      const mat = cv.imread(off); // RGBA
      resolve(mat);
    };
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = URL.createObjectURL(file);
  });
}

// ===== 템플릿 자동 로더 (list.txt 기반) =====
async function preloadTemplates(){
  templates = {};
  templatesReady = false; // 로딩 시작
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

  templatesReady = true;  // 전체 로딩 완료
  enableRunIfReady();
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

// ===================== 핵심 처리 파이프라인 =====================
function processImage(imgRGB){
  const nonEmptyMask = buildNonEmptyMask(imgRGB, TARGET_EMPTY_RGB);
  const comps = connectedComponents(nonEmptyMask);
  const gridLabels = selectGridComponents(comps.stats, NUM_CELLS, AREA_TOLERANCE);
  const troopLayout = buildTroopLayout(imgRGB, comps.stats, comps.centroids, gridLabels, templates);
  const result = buildPayload(troopLayout, {});
  return { result, comps, gridLabels };
}

// ====== 로그용 시각화 (의사코드 구현, 비율 유지) ======
function drawGridLabelsVisualization(imgRGB, stats, labels){
  // 원본 복사
  let vis = new cv.Mat(); cv.cvtColor(imgRGB, vis, cv.COLOR_RGB2BGR); // BGR로 그리기
  // 사각형(파란색) 그리기
  for (const lbl of labels){
    const x = stats.intPtr(lbl, cv.CC_STAT_LEFT)[0];
    const y = stats.intPtr(lbl, cv.CC_STAT_TOP)[0];
    const w = stats.intPtr(lbl, cv.CC_STAT_WIDTH)[0];
    const h = stats.intPtr(lbl, cv.CC_STAT_HEIGHT)[0];
    const p1 = new cv.Point(x, y), p2 = new cv.Point(x+w, y+h);
    cv.rectangle(vis, p1, p2, new cv.Scalar(0, 0, 255), 1);
  }
  // 캔버스 크기를 Mat 크기에 맞춤(비율 유지)
  els.canvas.width = vis.cols; els.canvas.height = vis.rows;
  // 표시 전에 다시 RGB로 변환해서 자연스러운 색 출력
  let visRGB = new cv.Mat();
  cv.cvtColor(vis, visRGB, cv.COLOR_BGR2RGB);
  cv.imshow(els.canvas, visRGB);
  vis.delete(); visRGB.delete();

  // 변환 후에만 미리보기 영역 보이기
  if (els.previewWrap) els.previewWrap.style.display = 'grid';
}

// ===== OpenCV 유틸 =====
function buildNonEmptyMask(imgRGB, emptyRGB){
  const src = imgRGB;

  // 상대 오차 허용 (rtol=1e-2) 영역 설정
  const lo = new cv.Mat(src.rows, src.cols, src.type(),
    new cv.Scalar(
      emptyRGB[0] * (1 - 0.01),
      emptyRGB[1] * (1 - 0.01),
      emptyRGB[2] * (1 - 0.01)
    )
  );
  const hi = new cv.Mat(src.rows, src.cols, src.type(),
    new cv.Scalar(
      emptyRGB[0] * (1 + 0.01),
      emptyRGB[1] * (1 + 0.01),
      emptyRGB[2] * (1 + 0.01)
    )
  );

  let mask = new cv.Mat();
  cv.inRange(src, lo, hi, mask); // 배경은 255

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
// 연속 일관성 기반 선택 로직
function selectGridComponents(stats, expected, tol){
  const troopLabels = [];
  let areaPrev = 0, wPrev = 0, hPrev = 0;

  for (let i = 1; i < stats.rows; i++){ // 0 = background
    const area = stats.intPtr(i, cv.CC_STAT_AREA)[0];
    const w = stats.intPtr(i, cv.CC_STAT_WIDTH)[0];
    const h = stats.intPtr(i, cv.CC_STAT_HEIGHT)[0];

    if (area < 100) continue;

    if ((areaPrev * (1 - tol) < area && area < areaPrev * (1 + tol)) &&
        (wPrev * (1 - tol) < w && w < wPrev * (1 + tol)) &&
        (hPrev * (1 - tol) < h && h < hPrev * (1 + tol))) {
      troopLabels.push(i);
    } else {
      troopLabels.length = 0; // reset
      troopLabels.push(i);
    }

    areaPrev = area;
    wPrev = w;
    hPrev = h;

    if (troopLabels.length === expected) {
      break;
    }
  }

  return troopLabels;
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
