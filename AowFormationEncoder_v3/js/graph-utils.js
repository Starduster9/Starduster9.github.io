// 선 샘플링, 교차/그래프, 코너/사각형 유틸
function intersect(l1,l2){ const [x1,y1,x2,y2]=l1,[x3,y3,x4,y4]=l2; const den=(x2-x1)*(y4-y3)-(y2-y1)*(x4-x3); if(Math.abs(den)<eps) return null; const t=((x3-x1)*(y4-y3)-(y3-y1)*(x4-x3))/den; return [x1+t*(x2-x1), y1+t*(y2-y1)]; }
const mask=new cv.Mat.zeros(H,W,cv.CV_8U); const angles=new Array(N); for(let i=0;i<N;i++) angles[i]=ang(lines[i]); let pairsTried=0,dotsPainted=0;
for(let i=0;i<N;i++){
const ai=angles[i], li=lines[i];
for(let j=i+1;j<N;j++){
let d=Math.abs(ai-angles[j]); if(d>Math.PI) d=2*Math.PI-d; if(d+1e-9<angleThr) continue;
const P=intersect(li, lines[j]); if(!P) continue; const X=P[0],Y=P[1]; const cx=Math.round(X), cy=Math.round(Y);
const dx=(cx<0)?-cx:(cx>(W-1)?(cx-(W-1)):0); const dy=(cy<0)?-cy:(cy>(H-1)?(cy-(H-1)):0); const overflow=Math.max(dx,dy);
const cap=Math.floor(Math.max(H,W)/20); const r=rBase+Math.min(overflow*3, cap);
cv.circle(mask, new cv.Point(cx,cy), r|0, new cv.Scalar(255,255,255,255), -1);
dotsPainted++; pairsTried++;
}
}
let labels=new cv.Mat(), stats=new cv.Mat(), cents=new cv.Mat();
const n=cv.connectedComponentsWithStats(mask, labels, stats, cents, 4, cv.CV_32S);
mask.delete(); stats.delete(); cents.delete();
return { count: Math.max(n-1,0), labels };
}


export function buildLabelGraphFromLines(lines, labels){
function edgeKey(a,b){ return a<b ? (a+'-'+b) : (b+'-'+a); }
const adj=new Map(); const edges=new Map();
function addEdge(a,b){ if(!adj.has(a)) adj.set(a,new Set()); if(!adj.has(b)) adj.set(b,new Set()); adj.get(a).add(b); adj.get(b).add(a); edges.set(edgeKey(a,b), true); }
for (let idx=0; idx<lines.length; idx++){
const {vals}=sampleLineVals(labels, lines[idx]); const seq=vals.map(v=>v|0).filter(v=>v>=1);
if (seq.length<2) continue; const uniq=[]; for(let k=0;k<seq.length;k++){ if (k===0 || seq[k]!==seq[k-1]) uniq.push(seq[k]); }
for (let k=0;k<uniq.length-1;k++){ const a=uniq[k], b=uniq[k+1]; if (a===b) continue; addEdge(a,b); }
}
const cycles=new Set();
const norm=(cyc)=>{ const r=cyc.slice(); const m=Math.min(...r); const i=r.indexOf(m); const rot=r.slice(i).concat(r.slice(0,i)); const rev=[rot[0],rot[3],rot[2],rot[1]]; const a=rot.join('-'), b=rev.join('-'); return a<b? a : b; };
for (const u of adj.keys()){
for (const v of (adj.get(u)||new Set()).keys()) if (v>u){
for (const x of (adj.get(u)||new Set()).keys()) if (x>u && x!==v){
for (const y of (adj.get(v)||new Set()).keys()) if (y>v && y!==u){
if ((adj.get(x)||new Set()).has(y)) cycles.add(norm([u,v,y,x]));
}
}
}
}
return { cycles:[...cycles].map(s=>s.split('-').map(Number)) , adj, edges };
}


export function abcline(line){ const [x1,y1,x2,y2]=line.map(Number); const dx=x2-x1, dy=y2-y1; const a=dy,b=-dx,c=-(a*x1+b*y1); return {a,b,c}; }
export function intersectLines(l1,l2){ const A=abcline(l1), B=abcline(l2); const det=A.a*B.b-B.a*A.b; if (Math.abs(det)<1e-9) return [NaN,NaN]; const x=(A.b*B.c-B.b*A.c)/det, y=(A.c*B.a-B.c*A.a)/det; return [x,y]; }
export function cornersFromCycles(linesBest, cycles){
const quads=cycles.filter(c=>c.length===4); const corners=[];
for (const cyc of quads){
const edges=[[cyc[0],cyc[1]],[cyc[1],cyc[2]],[cyc[2],cyc[3]],[cyc[3],cyc[0]]];
const lines=[]; let ok=true;
for (const [u,v] of edges){ const key=(Math.min(u,v)+'-'+Math.max(u,v)); if (!linesBest.has(key)){ ok=false; break; } lines.push(linesBest.get(key)); }
if (!ok){ corners.push([[NaN,NaN],[NaN,NaN],[NaN,NaN],[NaN,NaN]]); continue; }
corners.push([
intersectLines(lines[3],lines[0]),
intersectLines(lines[0],lines[1]),
intersectLines(lines[1],lines[2]),
intersectLines(lines[2],lines[3]),
]);
}
return corners;
}
export function polygonArea(pts){ if (pts.some(p=>!isFinite(p[0])||!isFinite(p[1]))) return 0; let s=0; for (let i=0;i<pts.length;i++){ const [x1,y1]=pts[i],[x2,y2]=pts[(i+1)%pts.length]; s+=x1*y2 - y1*x2; } return Math.abs(0.5*s); }
export function orderCornersTLTRBRBL(pts){ const arr=pts.map(p=>({ p, s:p[0]+p[1], d:p[0]-p[1] })); const tl=arr.reduce((a,b)=>a.s<b.s?a:b).p; const br=arr.reduce((a,b)=>a.s>b.s?a:b).p; const tr=arr.reduce((a,b)=>a.d>b.d?a:b).p; const bl=arr.reduce((a,b)=>a.d<b.d?a:b).p; return [tl,tr,br,bl]; }
