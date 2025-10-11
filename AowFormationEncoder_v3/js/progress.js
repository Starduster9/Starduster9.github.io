// ============== Progress Manager ==============
export const nextFrame = () => new Promise(r=>requestAnimationFrame(()=>r()));


export class Progress {
constructor() {
this.bar = document.getElementById('bar');
this.stepText = document.getElementById('stepText');
this.pctText = document.getElementById('pctText');
this.elapsedEl = document.getElementById('elapsed');
this.logEl = document.getElementById('log');
this.totalWeight = 100;
this.doneWeight = 0;
this.startTs = 0;
}
start(totalWeight=100){
this.totalWeight = totalWeight;
this.doneWeight = 0;
this.startTs = performance.now();
this._render(0, '준비 중');
this._log('--- 시작 ---');
}
_render(pct, step){
this.bar.style.width = `${Math.max(0,Math.min(100,pct))}%`;
this.pctText.textContent = `${pct.toFixed(0)}%`;
if (step) this.stepText.textContent = step;
const elapsed = (performance.now() - this.startTs)/1000;
this.elapsedEl.textContent = `경과 ${elapsed.toFixed(1)}s`;
}
_log(s){ this.logEl.textContent += s + '\n'; this.logEl.parentElement.scrollTop = this.logEl.parentElement.scrollHeight; }
async step(label, weight, fn){
const begin = performance.now();
this._render(this.doneWeight / this.totalWeight * 100, label);
this._log(`▶ ${label}…`);
await nextFrame();
let ret;
try { ret = await fn(); }
catch (e) { this._log(`✖ ${label} 실패: ${e.message || e}`); throw e; }
finally { this._log(`✓ ${label} 완료 (${(performance.now()-begin).toFixed(1)} ms)`); }
this.doneWeight += weight;
this._render(this.doneWeight / this.totalWeight * 100, label);
await nextFrame();
return ret;
}
finish(ok=true, msg='완료'){
this._render(100, msg);
this._log(ok? `=== 성공: ${msg} ===` : `=== 종료: ${msg} ===`);
this.stepText.classList.toggle('error', !ok);
this.stepText.classList.toggle('success', ok);
}
}
