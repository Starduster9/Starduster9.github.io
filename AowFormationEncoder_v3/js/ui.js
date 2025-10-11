import { isCvReady, setStatus, loadImageToMat, canvasFromMat, makeDbgSlot } from './cv-utils.js';
import { Progress } from './progress.js';
import { detectAndRecognize } from './pipeline.js';

function clearContainer(node){ while(node.firstChild) node.removeChild(node.firstChild); }
function makeCellCanvas(title){
  const w=document.createElement('div');
  w.className='cellWrap';
  const h4=document.createElement('h4'); h4.textContent=title; w.appendChild(h4);
  const c=document.createElement('canvas'); w.appendChild(c);
  return {wrap:w, canvas:c};
}

export function initUI(){
  const fileInput=document.getElementById('file');
  const runBtn=document.getElementById('run');
  let src=null; // cv.Mat (RGB, 8UC3)

  // 파일 업로드 → 안전 경로로 Mat 만들기 + 미리보기
  fileInput.addEventListener('change', async (e)=>{
    const f=e.target.files && e.target.files[0];
    if(!f) return;
    try{
      if (!isCvReady()){
        setStatus('OpenCV 준비 전 – 잠시 후 다시 시도');
        return;
      }
      // 이전 Mat 정리
      if (src) { try { src.delete(); } catch(_) {} src = null; }

      setStatus('이미지 읽는 중…');
      src = await loadImageToMat(f);

      const c=document.getElementById('cOrig');
      c.width = src.cols; c.height = src.rows;
      canvasFromMat(src, c);

      // OpenCV 준비되어 있으면 실행 버튼 해제
      if (isCvReady()) runBtn.disabled = false;
      setStatus('이미지 로드 완료');
    }catch(err){
      console.error(err);
      setStatus('이미지 로드 실패');
      alert('이미지 로드 실패: ' + (err && err.message ? err.message : err));
    }
  });

  // 실행
  runBtn.addEventListener('click', async ()=>{
    if (!isCvReady()){
      alert('OpenCV 초기화 전입니다. 잠시 후 다시 시도하세요.');
      return;
    }
    if (!src){
      alert('이미지를 선택하세요.');
      return;
    }

    runBtn.disabled = true;
    setStatus('실행 중…');
    const progress = new Progress();

    try{
      const opts={
        angleDeg:Number(document.getElementById('angleDeg').value)||45,
        brush:Number(document.getElementById('brush').value)||5,
        sizeFull:Number(document.getElementById('sizeFull').value)||1024,
        sizePatch:Number(document.getElementById('sizePatch').value)||32
      };

      const res=await detectAndRecognize(src, opts, progress);

      const grid=document.getElementById('dbgGrid'); grid.innerHTML='';
      const idxCluster = res.dbg.findIndex(d => d[0] === 'cluster');
      if (idxCluster >= 0) {
        const m = res.dbg[idxCluster][1];
        const c = document.getElementById('cDebug'); c.width = m.cols; c.height = m.rows; canvasFromMat(m, c);
      }
      for (let i = 0; i < res.dbg.length; i++) {
        const [title, mat] = res.dbg[i]; if (title === 'cluster') continue;
        const { wrap, canvas } = makeDbgSlot(title);
        grid.appendChild(wrap);
        canvas.width = mat.cols; canvas.height = mat.rows;
        canvasFromMat(mat, canvas);
        mat.delete();
      }
      if (idxCluster >= 0) res.dbg[idxCluster][1].delete();

      if (res.ally){
        const cA=document.getElementById('cAlly');
        cA.width=res.ally.cols; cA.height=res.ally.rows;
        canvasFromMat(res.ally,cA);
        res.ally.delete();
      }
      if (res.enemy){
        const cE=document.getElementById('cEnemy');
        cE.width=res.enemy.cols; cE.height=res.enemy.rows;
        canvasFromMat(res.enemy,cE);
        res.enemy.delete();
      }

      const gridAlly = document.getElementById('gridAlly');
      const gridEnemy = document.getElementById('gridEnemy');
      clearContainer(gridAlly); clearContainer(gridEnemy);

      for (let i=0;i<7;i++){
        for (let j=0;j<7;j++){
          const key = `${i}${j}`;
          const A = res.troopsAlly[key], E = res.troopsEnemy[key];
          const ca = makeCellCanvas(key); gridAlly.appendChild(ca.wrap);
          const ce = makeCellCanvas(key); gridEnemy.appendChild(ce.wrap);
          if (A){ ca.canvas.width=A.cols; ca.canvas.height=A.rows; canvasFromMat(A, ca.canvas); A.delete(); }
          if (E){ ce.canvas.width=E.cols; ce.canvas.height=E.rows; canvasFromMat(E, ce.canvas); E.delete(); }
        }
      }

      const heroAlly = document.getElementById('heroAlly');
      const heroEnemy = document.getElementById('heroEnemy');
      clearContainer(heroAlly); clearContainer(heroEnemy);

      for (let k of ['0','1','2']){
        const HA = res.heroesAlly[k], HE = res.heroesEnemy[k];
        const ca = makeCellCanvas(`H${k}`); heroAlly.appendChild(ca.wrap);
        const ce = makeCellCanvas(`H${k}`); heroEnemy.appendChild(ce.wrap);
        if (HA){ ca.canvas.width=HA.cols; ca.canvas.height=HA.rows; canvasFromMat(HA, ca.canvas); HA.delete(); }
        if (HE){ ce.canvas.width=HE.cols; ce.canvas.height=HE.rows; canvasFromMat(HE, ce.canvas); HE.delete(); }
      }

      progress.finish(true, res.corners ? '완료' : '코너 미검출');
      setStatus(res.corners ? '완료' : '코너를 찾지 못했습니다');
    }catch(err){
      console.error(err);
      alert('실행 중 오류: ' + (err && err.message ? err.message : err));
      setStatus('에러');
      try { progress.finish(false, '에러'); } catch(_) {}
    }finally{
      runBtn.disabled = false;
    }
  });
}
