import { toGray, drawLinesOn, canvasFromMat, percentileGray, morph, brightnessMask, removeThinComponents, removeSmallComponents, maskFromLabelsSet, normalizeForView, labelToColor } from './cv-utils.js';
const borderLen=1.0, marginAE=0.125*borderLen, marginBL=0.06*borderLen, nGrid=7;


const allyBorder=[[0,0],[1,0],[1,1],[0,1]];
const enemyBorder=[[0,-marginAE-1],[1,-marginAE-1],[1,-marginAE],[0,-marginAE]];


const allyInner=[[marginBL,marginBL],[1-marginBL,marginBL],[1-marginBL,1-marginBL],[marginBL,1-marginBL]];
const enemyInner=[[0,-marginAE-1],[1,-marginAE-1],[1,-marginAE],[0,-marginAE]].map((p,idx)=>{ const mv=[[-marginBL,-marginBL],[ marginBL,-marginBL],[ marginBL, marginBL],[-marginBL, marginBL]][idx]; return [p[0]-mv[0], p[1]-mv[1]]; });


const formLen=1-2*marginBL; const cell=formLen/nGrid;


function getPerspectiveTransformFromPts(srcPts, dstPts){ const src=cv.matFromArray(4,1,cv.CV_32FC2, srcPts.flat()); const dst=cv.matFromArray(4,1,cv.CV_32FC2, dstPts.flat()); const H=cv.getPerspectiveTransform(src,dst); src.delete(); dst.delete(); return H; }
function projectQuad(H, quad){ const src=cv.matFromArray(4,1,cv.CV_32FC2, quad.flat()); let out=new cv.Mat(); cv.perspectiveTransform(src,out,H); const arr=[]; for (let i=0;i<4;i++) arr.push([out.floatAt(i,0), out.floatAt(i,1)]); src.delete(); out.delete(); return arr; }
function warpByPts(img, srcPts, size){ const dstPts=[[0,0],[size-1,0],[size-1,size-1],[0,size-1]]; const H=getPerspectiveTransformFromPts(srcPts,dstPts); let warped=new cv.Mat(); cv.warpPerspective(img,warped,H,new cv.Size(size,size),cv.INTER_LINEAR,cv.BORDER_REPLICATE); H.delete(); return warped; }


const H0=getPerspectiveTransformFromPts(allyBorder, ordered);


const allyInImg=projectQuad(H0, allyBorder);
const enemyInImg=projectQuad(H0, enemyBorder);
const allyWarp=warpByPts(imgRGB, allyInImg, sizeFull);
const enemyWarp=warpByPts(imgRGB, enemyInImg, sizeFull);


function gridQuadAlly(i,j){ const x0=allyInner[0][0]+j*cell; const y0=allyInner[0][1]+i*cell; return [[x0,y0],[x0+cell,y0],[x0+cell,y0+cell],[x0,y0+cell]]; }
function gridQuadEnemy(i,j){ const x0=enemyInner[2][0]-(j+1)*cell; const y0=enemyInner[2][1]-(i+1)*cell; return [[x0,y0],[x0+cell,y0],[x0+cell,y0+cell],[x0,y0+cell]]; }


const troopsAlly={}, troopsEnemy={};
for (let i=0;i<nGrid;i++){
for (let j=0;j<nGrid;j++){
const qa=projectQuad(H0, gridQuadAlly(i,j));
const qe=projectQuad(H0, gridQuadEnemy(i,j));
const wa=warpByPts(imgRGB, qa, sizePatch);
const we=warpByPts(imgRGB, qe, sizePatch);
troopsAlly[`${i}${j}`]=wa; troopsEnemy[`${i}${j}`]=we;
}
}


const heroesAlly={}, heroesEnemy={};
const hjAlly=[[0,[7,3]],[1,[3,-1]],[2,[3,7]]];
const hjEnemy=[[0,[7,3]],[1,[3.5,-1]],[2,[3.5,7]]];


for (const [k,ij] of hjAlly){ const [ii,jj]=ij; const qa=projectQuad(H0, gridQuadAlly(ii, jj)); heroesAlly[String(k)]=warpByPts(imgRGB, qa, sizePatch); }
for (const [k,ij] of hjEnemy){ const [ii,jj]=ij; const qe=projectQuad(H0, gridQuadEnemy(ii, jj)); heroesEnemy[String(k)]=warpByPts(imgRGB, qe, sizePatch); }


H0.delete(); dist.delete();
return { ordered, allyWarp, enemyWarp, troopsAlly, troopsEnemy, heroesAlly, heroesEnemy };
});


// 리소스 정리
e_log.delete(); flatRefined.delete(); bandAndLines.eRef2.delete(); bandAndLines.lblMap.delete();


return {
corners: warpRes.ordered,
ally: warpRes.allyWarp, enemy: warpRes.enemyWarp,
troopsAlly: warpRes.troopsAlly, troopsEnemy: warpRes.troopsEnemy,
heroesAlly: warpRes.heroesAlly, heroesEnemy: warpRes.heroesEnemy,
dbg
};
}
