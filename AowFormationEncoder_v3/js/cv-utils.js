/* Core utils (OpenCV.js) – 매트릭스/모폴로지/시각화 등 */
}
export function fastErodeBinary(mask, kSize=3){
const r=Math.max(1, Math.floor(kSize/2));
let dist=new cv.Mat(); cv.distanceTransform(mask, dist, cv.DIST_L2, 3);
let out=new cv.Mat(); cv.threshold(dist, out, r, 255, cv.THRESH_BINARY); dist.delete();
let u8=new cv.Mat(); out.convertTo(u8, cv.CV_8U); out.delete();
return u8;
}
export function fastOpenBinary(mask, kSize=3){ const er=fastErodeBinary(mask,kSize); const di=fastDilateBinary(er,kSize); er.delete(); return di; }
export function fastCloseBinary(mask, kSize=3){ const di=fastDilateBinary(mask,kSize); const er=fastErodeBinary(di,kSize); di.delete(); return er; }
export function morph(mat, op, kSize=3){
if(op==='dilate') return fastDilateBinary(mat, kSize);
if(op==='erode') return fastErodeBinary(mat, kSize);
if(op==='open') return fastOpenBinary(mat, kSize);
if(op==='close') return fastCloseBinary(mat, kSize);
throw new Error(`Unknown morph op: ${op}`);
}
export function brightnessMask(gray, perc){ const thr=percentileGray(gray, perc); let m=new cv.Mat(); cv.threshold(gray,m,thr,255,cv.THRESH_BINARY); return m; }


// 라벨 유틸
export function maskFromLabelsSet(labels, keepSet){
const rows=labels.rows, cols=labels.cols, N=rows*cols;
const L=labels.data32S; let out=new cv.Mat.zeros(rows, cols, cv.CV_8U); const M=out.data;
for (let i=0;i<N;i++){ const v=L[i]; if (v>=1 && keepSet.has(v)) M[i]=255; }
return out;
}
export function removeSmallComponents(mask, minArea=100, area_w_wh=false){
let labels=new cv.Mat(), stats=new cv.Mat(), cents=new cv.Mat();
const n=cv.connectedComponentsWithStats(mask, labels, stats, cents, 4, cv.CV_32S);
const keep=new Set();
for (let i=1;i<n;i++){
const area=stats.intAt(i,cv.CC_STAT_AREA);
const w=stats.intAt(i,cv.CC_STAT_WIDTH), h=stats.intAt(i,cv.CC_STAT_HEIGHT);
if ((area_w_wh ? (w*h>=minArea) : (area>=minArea))) keep.add(i);
}
const cleaned=maskFromLabelsSet(labels, keep);
labels.delete(); stats.delete(); cents.delete();
return cleaned;
}
export function removeThinComponents(mask, minArea=100){
let labels=new cv.Mat(), stats=new cv.Mat(), cents=new cv.Mat();
const n=cv.connectedComponentsWithStats(mask, labels, stats, cents, 4, cv.CV_32S);
const keep=new Set();
for (let i=1;i<n;i++){
const area=stats.intAt(i,cv.CC_STAT_AREA);
const w=stats.intAt(i,cv.CC_STAT_WIDTH), h=stats.intAt(i,cv.CC_STAT_HEIGHT);
if (area>=minArea && area>0.1*w*h) keep.add(i);
}
const cleaned=maskFromLabelsSet(labels, keep);
labels.delete(); stats.delete(); cents.delete();
return cleaned;
}


// 시각화 보조
export function normalizeForView(mat32f){ const mm=cv.minMaxLoc(mat32f); const maxv=(mm&&typeof mm.maxVal==='number')?mm.maxVal:0; let out=new cv.Mat(); const scale=maxv>0?255.0/maxv:1.0; mat32f.convertTo(out, cv.CV_8U, scale, 0); return out; }
export function labelToColor(labels){
let lab32f=new cv.Mat(); labels.convertTo(lab32f, cv.CV_32F); const mm=cv.minMaxLoc(lab32f); lab32f.delete();
let val8=new cv.Mat(); const scale=mm.maxVal>0?255.0/mm.maxVal:1.0; labels.convertTo(val8, cv.CV_8U, scale, 0);
let R=val8.clone(); let G=new cv.Mat(val8.rows,val8.cols,cv.CV_8U,new cv.Scalar(0)); let S255=new cv.Mat(val8.rows,val8.cols,cv.CV_8U,new cv.Scalar(255)); cv.subtract(S255,val8,G);
let B=new cv.Mat(val8.rows,val8.cols,cv.CV_8U,new cv.Scalar(0)); let S128=new cv.Mat(val8.rows,val8.cols,cv.CV_8U,new cv.Scalar(128)); cv.absdiff(val8,S128,B);
let mv=new cv.MatVector(); mv.push_back(B); mv.push_back(G); mv.push_back(R); let out=new cv.Mat(); cv.merge(mv,out);
mv.delete(); B.delete(); G.delete(); R.delete(); S128.delete(); S255.delete(); val8.delete();
return out; // CV_8UC3
}
