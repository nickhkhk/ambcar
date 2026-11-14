(function(){
"use strict";
/* ================= Q 版屯門：城市生成 ================= */
const C={sky:0xbfe4fb,ground:0xe8eddc,road:0x6f7684,line:0xffffff,
  amb:0xfdfdfd,red:0xe8323c,hiviz:0xd7ff2e,glass:0x33475b,dark:0x2b2d33,
  jacket:0xff7a1a,reflect:0xe9edf2,navy:0x24324a,skin:0xffd7b5,hair:0x3b2f2a,tree:0x6fcf5a,trunk:0xa9744f};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>document.getElementById(id);
const R=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
R.setPixelRatio(Math.min(devicePixelRatio,1.3)); R.shadowMap.enabled=true; R.shadowMap.type=THREE.PCFShadowMap;
$('stage').appendChild(R.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color(C.sky); scene.fog=new THREE.Fog(C.sky,200,560);
const cam=new THREE.PerspectiveCamera(55,1,0.5,2400);

const M=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:o.r??0.55,metalness:0,emissive:o.e||0,transparent:!!o.op,opacity:o.op??1});
function add(geo,mat,p,x=0,y=0,z=0,cast=true){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;p.add(m);return m;}
function rbox(w,h,d,r){ r=Math.min(r,w/2-0.01,h/2-0.01,d/2-0.01); if(r<=0.01) return new THREE.BoxGeometry(w,h,d);
  const s=new THREE.Shape(),x=-w/2+r,y=-h/2+r,ww=w-2*r,hh=h-2*r;
  s.moveTo(x,-h/2);s.lineTo(x+ww,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,y);s.lineTo(w/2,y+hh);s.quadraticCurveTo(w/2,h/2,x+ww,h/2);
  s.lineTo(x,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,y+hh);s.lineTo(-w/2,y);s.quadraticCurveTo(-w/2,-h/2,x,-h/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:0,bevelSegments:3,curveSegments:4});
  g.translate(0,0,-(d-2*r)/2); g.computeVertexNormals(); return g; }
const sph=r=>new THREE.SphereGeometry(r,24,16), cyl=(a,b,h,s=20)=>new THREE.CylinderGeometry(a,b,h,s);
function tex(lines,bg,fg,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  if(bg){g.fillStyle=bg;g.fillRect(0,0,w,h)} g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
  lines.forEach((l,i)=>{g.font=l.f;g.fillText(l.t,w/2,h*(i+1)/(lines.length+1))}); const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;}


function drawStar(g,sx,sy,r){
  g.fillStyle='#1f4fbf';
  for(let k=0;k<3;k++){ g.save(); g.translate(sx,sy); g.rotate(k*Math.PI/3); g.fillRect(-r*0.22,-r,r*0.44,r*2); g.restore(); }
  g.strokeStyle='#ffffff'; g.lineWidth=Math.max(2,r*0.07); g.beginPath(); g.moveTo(sx,sy-r*0.75); g.lineTo(sx,sy+r*0.75); g.stroke();
  g.lineWidth=Math.max(2,r*0.05); g.beginPath(); for(let t=0;t<=1.001;t+=0.05){ const yy=sy-r*0.6+t*r*1.2, xx=sx+Math.sin(t*Math.PI*4)*r*0.14; t?g.lineTo(xx,yy):g.moveTo(xx,yy);} g.stroke();
}
function rearTex(body,base='#ffe500'){
  // 車尾整個面（闊 3.0 × 高 3.1，每單位 200px）。body=true 時門位畫成車廂內部（門打開時見到）
  const W=600,H=620,c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,W,H);
  // 下半紅黃人字（倒 V，中間相交）
  const top=372; g.save(); g.beginPath(); g.rect(0,top,W,H-top); g.clip();
  const sw=40;
  for(let i=-20;i<20;i++){ g.fillStyle=(i&1)?'#e8202a':'#ffe500';
    const o=top+i*sw*1.41;
    g.beginPath(); g.moveTo(0,o); g.lineTo(W/2,o-W/2); g.lineTo(W/2,o-W/2+sw*1.41); g.lineTo(0,o+sw*1.41); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(W,o); g.lineTo(W/2,o-W/2); g.lineTo(W/2,o-W/2+sw*1.41); g.lineTo(W,o+sw*1.41); g.closePath(); g.fill(); }
  g.restore();
  // 兩邊車身：生命之星、細字「救護車」「勿駛近」
  drawStar(g,30,42,24); drawStar(g,W-30,42,24);
  g.fillStyle='#e8202a'; g.font='bold 20px sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  ['救','護','車'].forEach((ch,i)=>g.fillText(ch,30,92+i*24)); ['勿','駛','近'].forEach((ch,i)=>g.fillText(ch,W-30,92+i*24));
  // 「救 AMBULANCE 護」
  g.font='bold 50px sans-serif'; g.fillText('救',30,322); g.fillText('護',W-30,322);
  g.font='bold 58px sans-serif'; g.fillText('AMBULANCE',W/2,322);
  // 兩扇門：圓角窗（酒紅色玻璃）、車號、門把、門縫
  const win=(x)=>{ const w=92,h=176,y=62,r=40; g.fillStyle='#6b2430'; g.beginPath(); g.moveTo(x-w/2+r,y); g.arcTo(x+w/2,y,x+w/2,y+h,r); g.arcTo(x+w/2,y+h,x-w/2,y+h,r); g.arcTo(x-w/2,y+h,x-w/2,y,r); g.arcTo(x-w/2,y,x+w/2,y,r); g.fill();
    g.fillStyle='rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x-w/2+14,y+30); g.lineTo(x-w/2+34,y+20); g.lineTo(x-w/2+34,y+h-40); g.lineTo(x-w/2+14,y+h-30); g.fill();
    g.strokeStyle='#2b2d33'; g.lineWidth=5; g.beginPath(); g.moveTo(x-w/2+r,y); g.arcTo(x+w/2,y,x+w/2,y+h,r); g.arcTo(x+w/2,y+h,x-w/2,y+h,r); g.arcTo(x-w/2,y+h,x-w/2,y,r); g.arcTo(x-w/2,y,x+w/2,y,r); g.stroke(); };
  win(180); win(420);
  g.fillStyle='#e8202a'; g.font='bold 24px sans-serif'; g.fillText(CALLSIGN,180,266); g.fillText(CALLSIGN,420,266);
  // KEEP CLEAR
  g.fillStyle='#ffe500'; g.fillRect(112,436,376,66); g.strokeStyle='#e8202a'; g.lineWidth=3; g.strokeRect(112,436,376,66);
  g.fillStyle='#e8202a'; g.font='bold 54px sans-serif'; g.fillText('KEEP CLEAR',W/2,471);
  // 門縫同門把
  g.strokeStyle='#8a7d00'; g.lineWidth=3; g.strokeRect(60,40,480,540); g.beginPath(); g.moveTo(W/2,40); g.lineTo(W/2,580); g.stroke();
  g.fillStyle='#7a7f87'; g.fillRect(W/2-34,370,20,46); g.fillRect(W/2+14,370,20,46);
  if(body){ g.fillStyle='#4a5260'; g.fillRect(60,40,480,540); g.fillStyle='#d9dde3'; g.fillRect(80,470,440,90); g.fillStyle='#6f7884'; g.fillRect(80,60,440,30); }
  return c;
}
function roofTex(base='#ffe500'){
  // 車頂（闊 2.7 × 長 4.9）：canvas 上方 = 車頭
  const W=270,H=490,c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,W,H);
  // 邊緣紅藍線（跟車身斜紋延續）
  g.fillStyle='#e8202a'; g.fillRect(6,0,12,H); g.fillStyle='#1f4fbf'; g.fillRect(W-18,0,12,H);
  g.fillStyle='#1f4fbf'; g.fillRect(6,H-20,W-12,8); g.fillStyle='#e8202a'; g.fillRect(6,H-34,W-12,8);
  // 大生命之星（近車尾）
  drawStar(g,W/2,H-100,70);
  // 大車號（沿車身長度）
  g.save(); g.translate(W/2,H*0.44); g.rotate(Math.PI/2); g.fillStyle='#1f4fbf'; g.font='bold 92px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(CALLSIGN,0,0); g.restore();
  const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t;
}
function liveryTex(frontRight,classic){
  // 車身側面貼紙：紅藍斜紋、生命之星、文字。長 7.05 × 高 3.1（每單位 160px）
  const PX=160, W=Math.round(7.05*PX), H=Math.round(3.1*PX);
  const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d');
  const X=x=>frontRight?x:W-x;
  const band=(pts,col,wd)=>{ g.strokeStyle=col; g.lineWidth=wd; g.lineJoin='round'; g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(X(x),y):g.moveTo(X(x),y)); g.stroke(); };
  if(classic){ // 經典白色：紅黃紅斜紋由車頭低位斜上車尾
    const P=(dy)=>[[W+10,404+dy],[720,404+dy],[470,190+dy],[-10,190+dy]];
    band(P(0),'#e8202a',46); band(P(-44),'#ffd400',40); band(P(-84),'#e8202a',34);
    drawStar(g,X(215),350,84);
    g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#1f4fbf';
    g.font='bold 46px sans-serif'; g.fillText('AMBULANCE',X(520),458); g.font='bold 40px sans-serif'; g.fillText('救護',X(820),300);
    g.font='bold 40px sans-serif'; g.fillText(CALLSIGN,X(800),110);
    g.fillStyle='#3c4656'; g.fillRect(frontRight?640:W-640-80,70,80,70);
    g.strokeStyle='rgba(120,120,120,.6)'; g.lineWidth=4; g.strokeRect(frontRight?620:W-620-110,170,110,230);
    const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t; }
  // 紅帶（上）同藍帶（下），喺側門前斜落車頭
  band([[150,218],[620,218],[770,330],[W+10,330]],'#e8202a',34);
  band([[150,270],[600,270],[740,374],[W+10,374]],'#1f4fbf',34);
  band([[150,244],[610,244],[755,352],[W+10,352]],'#ffd400',10);
  drawStar(g,X(118),230,100);
  // 文字
  g.textAlign='center'; g.textBaseline='middle';
  g.fillStyle='#1c1c1c'; g.font='bold 30px sans-serif'; g.fillText('消防處救護車',X(470),219);
  g.fillStyle='#ffffff'; g.font='bold 20px sans-serif'; g.fillText('FIRE SERVICES AMBULANCE',X(420),271);
  g.fillStyle='#e8202a'; g.font='bold 40px sans-serif'; g.fillText('AMBULANCE',X(420),330); g.font='bold 44px sans-serif'; g.fillText('救護',X(420),382);
  g.fillStyle='#1f4fbf'; g.font='bold 40px sans-serif'; g.fillText(CALLSIGN,X(780),110);
  // 車廂小窗
  g.fillStyle='#3c4656'; g.fillRect(frontRight?640:W-640-80,70,80,70);
  // 側門輪廓
  g.strokeStyle='rgba(120,120,90,.7)'; g.lineWidth=4; g.strokeRect(frontRight?620:W-620-110,170,110,230);
  const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t;
}
let CALLSIGN='A188';
function ambulance(num){ CALLSIGN=num||'A188';
  const g=new THREE.Group(); scene.add(g);
  const body=new THREE.Group(); g.add(body); // 車頭 = +z
  const Y=M(0xffe500,{r:0.45,e:0x3a3300}), gl=M(C.glass,{r:0.15}), dk=M(C.dark), red=M(C.red), grey=M(0xb8bcc2);
  add(rbox(3.0,3.1,5.4,0.4),Y,body,0,2.15,-0.7);              // 車廂（方箱）
  add(rbox(2.85,2.5,0.9,0.35),Y,body,0,1.85,2.45);            // 駕駛室
  add(rbox(2.85,1.35,0.9,0.35),Y,body,0,1.28,3.2);            // 車頭（較矮）
  const ws=add(new THREE.BoxGeometry(2.45,1.0,0.08),gl,body,0,2.55,2.95,false); ws.rotation.x=-0.45;
  add(rbox(2.95,0.45,0.35,0.15),dk,body,0,0.8,3.62);          // 黑色前泵把
  add(rbox(3.02,0.5,0.6,0.15),dk,body,0,0.85,-3.4);           // 後泵把
  [-0.95,0.95].forEach(x=>add(sph(0.2),M(0xfff6c4,{e:0x554400}),body,x,1.55,3.65,false));
  // 車頭紅藍帶、引擎蓋生命之星、車廂頂「AMBULANCE」藍牌
  add(new THREE.BoxGeometry(2.7,0.12,0.04),M(0xe8202a),body,0,1.93,3.66,false);
  add(new THREE.BoxGeometry(2.7,0.12,0.04),M(0x1f4fbf),body,0,1.8,3.66,false);
  { const c=document.createElement('canvas'); c.width=128; c.height=128; const g2=c.getContext('2d'); drawStar(g2,64,64,56);
    const st=new THREE.Mesh(new THREE.PlaneGeometry(0.55,0.55),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true}));
    st.rotation.x=-Math.PI/2; st.position.set(0,1.97,3.25); body.add(st); }
  { const c=document.createElement('canvas'); c.width=512; c.height=96; const g2=c.getContext('2d');
    g2.fillStyle='#1f4fbf'; g2.fillRect(0,0,512,96); g2.strokeStyle='#ffffff'; g2.lineWidth=6; g2.strokeRect(8,8,496,80);
    g2.fillStyle='#ffffff'; g2.font='bold 62px sans-serif'; g2.textAlign='center'; g2.textBaseline='middle'; g2.fillText('AMBULANCE',256,50);
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(2.0,0.38),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));
    sg.position.set(0,3.42,2.03); body.add(sg); }
  const SK={sides:[],doors:[]}; const myNum=CALLSIGN;
  { const rf=SK.roof=new THREE.Mesh(new THREE.PlaneGeometry(2.7,4.9),new THREE.MeshStandardMaterial({map:roofTex(),roughness:0.5}));
    rf.rotation.x=-Math.PI/2; rf.rotation.z=Math.PI; rf.position.set(0,3.71,-0.7); body.add(rf); }
  [-1,1].forEach(sx=>{
    add(rbox(0.12,0.45,0.25,0.05),dk,body,sx*1.62,2.35,2.95,false); add(new THREE.BoxGeometry(0.25,0.05,0.05),dk,body,sx*1.52,2.35,2.95,false);
    add(new THREE.BoxGeometry(0.05,0.8,0.75),gl,body,sx*1.44,2.4,2.5,false);           // 側窗
    const p=new THREE.Mesh(new THREE.PlaneGeometry(7.05,3.1),new THREE.MeshStandardMaterial({map:liveryTex(sx<0),transparent:true,roughness:0.5}));
    p.position.set(sx*1.53,2.15,0.125); p.rotation.y=sx*Math.PI/2; body.add(p); SK.sides.push([p,sx<0]);
  });
  // 藍色警示燈：車頂四角 + 前燈架
  const blues=[];
  [[-1.2,3.75,-3.2],[1.2,3.75,-3.2],[-1.2,3.75,1.7],[1.2,3.75,1.7]].forEach(([x,y,z],i)=>blues.push(add(rbox(0.5,0.18,0.3,0.06),M(0x2f6bff),body,x,y,z,false)));
  blues.push(add(rbox(0.32,0.3,0.12,0.05),M(0x2f6bff),body,-1.25,3.42,2.04,false), add(rbox(0.32,0.3,0.12,0.05),M(0x2f6bff),body,1.25,3.42,2.04,false));
  const pB=new THREE.PointLight(0x3a88ff,0,11), pR=new THREE.PointLight(0x3a88ff,0,11); pB.position.set(-1,4.2,0); pR.position.set(1,4.2,0); body.add(pB,pR);
  // 車輪
  const wheels=[]; [[-1.42,2.6],[1.42,2.6],[-1.42,-2.3],[1.42,-2.3]].forEach(([x,z])=>{
    const w=add(cyl(0.6,0.6,0.48),dk,body,x,0.6,z); w.rotation.z=Math.PI/2; add(cyl(0.3,0.3,0.5),grey,w,0,0,0,false); wheels.push(w);});
  // 尾門 + 紅黃人字反光
  const REAR=rearTex(false), REARB=rearTex(true);
  { const bp=SK.bp=new THREE.Mesh(new THREE.PlaneGeometry(3.0,3.1),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(REARB),roughness:0.5}));
    bp.rotation.y=Math.PI; bp.position.set(0,2.15,-3.405); body.add(bp); }
  const doors=[]; [-1,1].forEach(s=>{ const hinge=new THREE.Group(); hinge.position.set(s*1.2,0,-3.43); body.add(hinge);
    const d=add(new THREE.BoxGeometry(1.2,2.7,0.06),Y,hinge,-s*0.6,2.15,0);
    const tx=new THREE.CanvasTexture(REAR); tx.anisotropy=8; tx.repeat.set(0.4,540/620); tx.offset.set(s>0?0.1:0.5,40/620);
    const dp=new THREE.Mesh(new THREE.PlaneGeometry(1.2,2.7),new THREE.MeshStandardMaterial({map:tx,roughness:0.5})); dp.rotation.y=Math.PI; dp.position.z=-0.035; d.add(dp); SK.doors.push([dp,s]);
    hinge.userData.s=s; doors.push(hinge); });
  // 尾燈（紅＋琥珀，直排）、車牌、踏板
  [-1,1].forEach(s=>{ add(rbox(0.22,0.34,0.1,0.04),M(0xe8202a,{e:0x400000}),body,s*1.36,1.32,-3.43,false);
    add(rbox(0.22,0.2,0.1,0.04),M(0xffa31a,{e:0x402000}),body,s*1.36,1.02,-3.43,false);
    add(rbox(0.22,0.14,0.1,0.04),M(0xffffff),body,s*1.36,0.82,-3.43,false); });
  { const c=document.createElement('canvas'); c.width=256; c.height=64; const g2=c.getContext('2d'); g2.fillStyle='#ffd400'; g2.fillRect(0,0,256,64); g2.strokeStyle='#111'; g2.lineWidth=4; g2.strokeRect(3,3,250,58);
    g2.fillStyle='#111'; g2.font='bold 44px sans-serif'; g2.textAlign='center'; g2.textBaseline='middle'; g2.fillText(CALLSIGN,128,34);
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.23),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)})); pl.rotation.y=Math.PI; pl.position.set(0,0.85,-3.72); body.add(pl); }
  add(new THREE.BoxGeometry(1.6,0.08,0.35),M(0x8a8f97),body,0,0.62,-3.75,false);
  // 車頂設備：冷氣機、天窗、天線、尾部藍燈
  add(rbox(1.3,0.26,0.6,0.1),M(0xe9ecef),body,0,3.83,1.4);
  add(cyl(0.03,0.03,0.7,6),M(0x2b2d33),body,0.9,4.05,1.6,false);
  add(cyl(0.03,0.03,0.5,6),M(0x2b2d33),body,-0.9,3.95,-2.6,false);
  blues.push(add(rbox(0.4,0.18,0.18,0.05),M(0x2f6bff),body,-0.9,3.55,-3.47,false), add(rbox(0.4,0.18,0.18,0.05),M(0x2f6bff),body,0.9,3.55,-3.47,false));
  add(rbox(0.3,0.16,0.16,0.05),M(0xffa31a,{e:0x402000}),body,0,3.6,-3.47,false);
  // 換塗裝（黃／經典白）：第一次用先生成貼圖
  const TS={}; const texSet=(cl)=>{ if(TS[cl]) return TS[cl]; CALLSIGN=myNum; const base=cl?'#f4f6f8':'#ffe500';
    const R=rearTex(false,base), RB=rearTex(true,base);
    const dt=s=>{ const tx=new THREE.CanvasTexture(R); tx.anisotropy=8; tx.repeat.set(0.4,540/620); tx.offset.set(s>0?0.1:0.5,40/620); return tx; };
    return TS[cl]={roof:roofTex(base),bp:new THREE.CanvasTexture(RB),side:{true:liveryTex(true,cl),false:liveryTex(false,cl)},door:{'1':dt(1),'-1':dt(-1)}}; };
  const setClassic=(cl)=>{ cl=!!cl; if(!cl&&!TS[true]&&!TS[false]) return; const T=texSet(cl); const put=(mesh,t)=>{ mesh.material.map=t; mesh.material.needsUpdate=true; };
    put(SK.roof,T.roof); put(SK.bp,T.bp); SK.sides.forEach(([p,f])=>put(p,T.side[f])); SK.doors.forEach(([p,s])=>put(p,T.door[s])); };
  g.userData={body,doors,wheels,blues,pB,pR,lb:blues[4],lr:blues[5],setClassic};
  return g;
}
/* ---------- Q 版救護員（橙色風褸） ---------- */
function person(kind){
  const g=new THREE.Group();
  const jacket=kind==='crew'?M(C.jacket):M(kind==='bystander'?0x7ec8e3:0xa78bfa), refl=M(C.reflect,{e:0x333333,r:0.3}), legs=M(kind==='crew'?C.navy:0x50586a);
  add(cyl(0.45,0.52,1.05),jacket,g,0,1.07,0);
  if(kind==='crew'){ add(cyl(0.465,0.49,0.1),refl,g,0,0.9,0,false); add(cyl(0.455,0.475,0.1),refl,g,0,1.25,0,false); add(cyl(0.2,0.2,0.18),jacket,g,0,1.62,0); }
  add(sph(0.64),M(C.skin),g,0,2.1,0);
  const hair=add(sph(0.66),M(C.hair),g,0,2.26,-0.07); hair.scale.set(1,0.72,1);
  [-0.21,0.21].forEach(x=>add(sph(0.08),M(0x22252b),g,x,2.15,0.58,false));
  [-0.34,0.34].forEach(x=>add(sph(0.085),M(0xff9aa2),g,x,1.99,0.52,false));
  const arms=[-0.6,0.6].map(x=>{const a=add(cyl(0.13,0.13,0.8),jacket,g,x,1.18,0.12); if(kind==='crew') add(cyl(0.14,0.14,0.08),refl,a,0,-0.15,0,false); a.rotation.x=-0.8; return a;});
  const legL=add(cyl(0.15,0.15,0.6),legs,g,-0.21,0.3,0), legR=add(cyl(0.15,0.15,0.6),legs,g,0.21,0.3,0);
  [legL,legR].forEach(l=>add(sph(0.17),M(0x1f2328),l,0,-0.3,0.06,false));
  g.userData={legL,legR,arms}; return g;
}
function stretcherSet(){
  const g=new THREE.Group(); scene.add(g);
  const st=new THREE.Group(); g.add(st);
  const fr=M(0xc9d1da), mat=M(0xff9f1c), dk=M(C.dark);
  add(rbox(1.2,0.16,3.2,0.07),fr,st,0,1.0,0); add(rbox(1.1,0.22,3.0,0.1),mat,st,0,1.18,0);
  [[-0.45,1.2],[0.45,1.2],[-0.45,-1.2],[0.45,-1.2]].forEach(([x,z])=>{add(cyl(0.05,0.05,0.9),fr,st,x,0.5,z);add(sph(0.14),dk,st,x,0.12,z);});
  const c1=person('crew'), c2=person('crew'); c1.position.z=2.3; c1.rotation.y=Math.PI; c2.position.z=-2.3; g.add(c1,c2);
  g.userData={st,c1,c2}; g.visible=false; return g;
}
function lyingPatient(){
  const g=new THREE.Group(); scene.add(g);
  const p=person('patient'); p.rotation.x=-Math.PI/2; p.position.set(0,0.5,1.2); g.add(p);
  const blanket=add(rbox(1.1,0.35,1.9,0.15),M(0xb9e3ff),g,0,0.62,0.4); blanket.visible=false; g.userData={blanket,p}; return g;
}



let seed=20261108; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647; const pick=a=>a[rnd()*a.length|0];

/* ---------- 貼圖 ---------- */
function canvasTex(w,h,draw,rep=true){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;} t.anisotropy=4; return t; }
const rr=(g,x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
// 屋邨：一格 = 一層兩個單位（闊 8 米、高 3 米）
function housingTex(wall,trim,k0=0){ return canvasTex(256,96,(g,w,h)=>{
  g.fillStyle=wall; g.fillRect(0,0,w,h); g.fillStyle=trim; g.fillRect(0,h-8,w,8);
  for(let k=0;k<2;k++){ const x=k*128+22;
    g.fillStyle='#ffffff'; rr(g,x-4,16,88,52,8); g.fill();
    g.fillStyle=['#7fb3d5','#9cc9e6','#ffe6a3','#8fc1e3'][(k+k0)%4]; rr(g,x,20,80,44,6); g.fill();
    g.fillStyle='rgba(255,255,255,.55)'; g.fillRect(x+38,20,4,44);
    if(k===0){ g.fillStyle='#d9dde3'; rr(g,x+58,70,26,16,3); g.fill(); g.fillStyle='#aeb5bf'; g.fillRect(x+62,74,18,2); g.fillRect(x+62,79,18,2);} // 冷氣機
  } }); }
// 唐樓：露台、晾衫
function tongTex(wall,k0){ return canvasTex(256,96,(g,w,h)=>{
  g.fillStyle=wall; g.fillRect(0,0,w,h);
  for(let k=0;k<3;k++){ const x=k*85+10; g.fillStyle='#5b6b7d'; g.fillRect(x,18,62,46); g.fillStyle='#a8c6dc'; g.fillRect(x+4,22,54,38);
    g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x+29,22,3,38); g.fillStyle='#e9e2d4'; g.fillRect(x-4,64,70,6);
    if((k+k0)%2){ ['#ff8fab','#8fd3ff','#ffd166','#b8f2a8'].forEach((c,q)=>{g.fillStyle=c; g.fillRect(x+6+q*14,66,8,14);}); } }
  g.fillStyle='rgba(0,0,0,.12)'; g.fillRect(0,h-4,w,4); }); }
// 地舖：一格 = 4 間舖（闊 24 米、高 4.5 米）
const SHOPS=['茶餐廳','藥房','麵包店','便利店','涼茶','文具','時裝','眼鏡','五金','海味','燒味','髮型屋','電器','車仔麵','金行','花店','書局','糖水','士多','雜貨'];
const SCOL=['#e63946','#2a9d8f','#f4a261','#457b9d','#e76f51','#6a4c93','#2b9348','#d62828','#0077b6','#ff006e'];
function shopTex(){ return canvasTex(512,96,(g,w,h)=>{
  g.fillStyle='#f3efe6'; g.fillRect(0,0,w,h);
  for(let k=0;k<4;k++){ const x=k*128; const col=pick(SCOL);
    g.fillStyle=col; g.fillRect(x+4,4,120,26); g.fillStyle='#fff'; g.font='bold 20px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(pick(SHOPS),x+64,18);
    for(let s=0;s<8;s++){ g.fillStyle=s%2?'#ffffff':col; g.fillRect(x+4+s*15,32,15,10); } // 雨篷
    if(rnd()<0.75){ g.fillStyle='#bfe3f2'; g.fillRect(x+12,44,104,46); g.fillStyle='rgba(255,255,255,.6)'; g.fillRect(x+20,48,8,38);
      g.fillStyle=pick(['#ffd166','#ff8fab','#8ecae6','#cdb4db']); g.fillRect(x+36,70,30,20); g.fillRect(x+74,64,26,26); }
    else { g.fillStyle='#b8bec6'; g.fillRect(x+12,44,104,46); g.fillStyle='#9aa1aa'; for(let q=0;q<10;q++) g.fillRect(x+12,46+q*4.6,104,1.5); } // 閘
  } }); }
const MAT={}; function texMat(key,tex){ if(!MAT[key]) MAT[key]=new THREE.MeshStandardMaterial({map:tex,roughness:0.8}); return MAT[key]; }
const HOUSING=[['#ffd6e0','#ff8fab'],['#d3f5e8','#52b788'],['#d8ecff','#5aa9e6'],['#fff2c6','#f4a261'],['#eadcff','#9d4edd'],['#ffe5d1','#f77f00']];
const housingMats=HOUSING.map((p,k)=>texMat('h'+k,housingTex(p[0],p[1],k)));
const tongMats=['#f2e3c9','#e8d5d5','#d9e4d0','#f0d9b5'].map((c,k)=>texMat('t'+k,tongTex(c,k)));
const shopMats=[0,1,2,3,4,5].map(k=>texMat('s'+k,shopTex()));
const roofMat=new THREE.MeshStandardMaterial({color:0xc9ced6,roughness:0.9});
// 天台：有地磚格、矮牆、通風口，幾種顏色
const roofMats=[['#c9b8a6','#a8947f'],['#b9c6cf','#8fa2b0'],['#c7d1b3','#9fae86'],['#d8c3c3','#b39494'],['#cfc6e0','#a49abf']].map(([a,b],k)=>texMat('roof'+k,canvasTex(128,128,(g,w,h)=>{
  g.fillStyle=a; g.fillRect(0,0,w,h); g.strokeStyle=b; g.lineWidth=2; for(let q=0;q<=w;q+=16){ g.beginPath(); g.moveTo(q,0); g.lineTo(q,h); g.stroke(); g.beginPath(); g.moveTo(0,q); g.lineTo(w,q); g.stroke(); }
  g.fillStyle='rgba(255,255,255,.55)'; g.fillRect(20+k*8,30,22,22); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(80,76-k*6,18,30); })));
const walkTex=canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#e4dccf'; g.fillRect(0,0,w,h); g.strokeStyle='#cdbfa9'; g.lineWidth=2; g.strokeRect(1,1,31,31); g.strokeRect(33,1,30,31); g.strokeRect(1,33,31,30); g.strokeRect(33,33,30,30); g.fillStyle='#d9cdb9'; g.fillRect(34,34,28,28); });
const walkMat=new THREE.MeshStandardMaterial({map:walkTex,roughness:0.9}), lotMat=M(0xe8dcc6,{r:0.95}), grassMat=M(0x9fd77c,{r:0.95}), podMat=M(0xa8d98a,{r:0.95}), alleyMat=M(0xd7d2c4,{r:0.95});

/* ---------- 合併幾何（任意四邊形底） ---------- */
const buckets=new Map();
function bucket(mat){ if(!buckets.has(mat)) buckets.set(mat,{p:[],n:[],u:[]}); return buckets.get(mat); }
// c：四個角 [[x,z]×4]（任何次序順時針／逆時針都得）
function boxQ(c,y0,y1,sideMat,topMat,us=8,vs=3,uOff=0){
  const cx=(c[0][0]+c[1][0]+c[2][0]+c[3][0])/4, cz=(c[0][1]+c[1][1]+c[2][1]+c[3][1])/4;
  if(!topMat||topMat===roofMat) topMat=roofMats[Math.abs((cx*7+cz*13)|0)%roofMats.length];
  const sb=bucket(sideMat), tb=bucket(topMat);
  for(let i=0;i<4;i++){ let P=c[i], Q=c[(i+1)%4]; const ex=Q[0]-P[0], ez=Q[1]-P[1], L=Math.hypot(ex,ez)||1;
    let nx=ez/L, nz=-ex/L; const mx=(P[0]+Q[0])/2-cx, mz=(P[1]+Q[1])/2-cz; if(nx*mx+nz*mz<0){ nx=-nx; nz=-nz; }
    // 由外面望：左→右 = (nz,-nx)
    if(ex*nz+ez*(-nx)<0){ const t=P; P=Q; Q=t; }
    const u1=uOff+L/us, v1=(y1-y0)/vs;
    sb.p.push(P[0],y0,P[1], Q[0],y0,Q[1], Q[0],y1,Q[1],  P[0],y0,P[1], Q[0],y1,Q[1], P[0],y1,P[1]);
    for(let k=0;k<6;k++) sb.n.push(nx,0,nz);
    sb.u.push(uOff,0, u1,0, u1,v1,  uOff,0, u1,v1, uOff,v1); }
  const tri=(A,B,Cc)=>{ const y=(B[1]-A[1])*(Cc[0]-A[0])-(B[0]-A[0])*(Cc[1]-A[1]); const T=y>=0?[A,B,Cc]:[A,Cc,B];
    T.forEach(p=>{ tb.p.push(p[0],y1,p[1]); tb.n.push(0,1,0); const s=topMat===walkMat?3:8; tb.u.push(p[0]/s,p[1]/s); }); };
  tri(c[0],c[1],c[2]); tri(c[0],c[2],c[3]);
}
const rectQ=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
// 分區合併：每 200 米一格各自一個 mesh，鏡頭睇唔到嘅格（同影子）會自動唔畫
const CHUNK=200;
function flushBuckets(){ buckets.forEach((b,mat)=>{ const P=b.p,N=b.n,U=b.u;
  if(typeof ELEV==='function') for(let i=0;i<P.length;i+=3) P[i+1]+=ELEV(P[i],P[i+2]);   // 元朗公路高架：抬高路面同橋身
  const groups=new Map(); const tri=P.length%9===0&&U.length*3===P.length*2;
  if(!tri) groups.set('all',{p:P,n:N,u:U});
  else for(let t=0;t<P.length;t+=9){ const k=Math.floor((P[t]+P[t+3]+P[t+6])/3/CHUNK)+','+Math.floor((P[t+2]+P[t+5]+P[t+8])/3/CHUNK);
    let g=groups.get(k); if(!g){ g={p:[],n:[],u:[]}; groups.set(k,g); }
    for(let j=0;j<9;j++){ g.p.push(P[t+j]); g.n.push(N[t+j]); } const uo=t/9*6; for(let j=0;j<6;j++) g.u.push(U[uo+j]); }
  groups.forEach(gp=>{ const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(gp.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(gp.n,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(gp.u,2));
    g.computeBoundingSphere(); const m=new THREE.Mesh(g,mat); m.castShadow=true; m.receiveShadow=true; m.matrixAutoUpdate=false; m.updateMatrix(); scene.add(m); }); }); buckets.clear(); }
// 山丘：半球體，合併入同一批幾何
const HILLG=new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2).toNonIndexed();
function hillQ(x,z,r,h,r2,rot,mat){ const bk=bucket(mat), P=HILLG.attributes.position.array, N=HILLG.attributes.normal.array, U=HILLG.attributes.uv.array, c=Math.cos(rot), s=Math.sin(rot);
  for(let i=0;i<P.length;i+=3){ const lx=P[i]*r, lz=P[i+2]*r2; bk.p.push(x+lx*c-lz*s,P[i+1]*h,z+lx*s+lz*c); const nx=N[i]/r, ny=N[i+1]/h, nz=N[i+2]/r2, L=Math.hypot(nx,ny,nz)||1; bk.n.push(nx/L,ny/L,nz/L); }
  for(let i=0;i<U.length;i++) bk.u.push(U[i]*4); }
// 平面（帶世界坐標 UV）
function flat(arr,mat,y,uvs=3){ // 統一三角形方向（由上面望係逆時針），法線向上
  for(let i=0;i<arr.length;i+=9){ const ax=arr[i],az=arr[i+2],bx=arr[i+3],bz=arr[i+5],cx=arr[i+6],cz=arr[i+8]; if((bz-az)*(cx-ax)-(bx-ax)*(cz-az)<0){ arr[i+3]=cx; arr[i+5]=cz; arr[i+6]=bx; arr[i+8]=bz; } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
  const uv=[]; for(let i=0;i<arr.length;i+=3) uv.push(arr[i]/uvs,arr[i+2]/uvs); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const n=[]; for(let i=0;i<arr.length;i+=3) n.push(0,1,0); g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));
  const m=new THREE.Mesh(g,mat); m.position.y=y||0; m.receiveShadow=true; scene.add(m); return m; }
const ribbon=(arr,A,B,half)=>{ const dx=B[0]-A[0], dz=B[1]-A[1], L=Math.hypot(dx,dz)||1; const nx=dz/L*half, nz=-dx/L*half;
  arr.push(A[0]+nx,0,A[1]+nz, B[0]+nx,0,B[1]+nz, B[0]-nx,0,B[1]-nz,  A[0]+nx,0,A[1]+nz, B[0]-nx,0,B[1]-nz, A[0]-nx,0,A[1]-nz); };
const disc=(arr,C0,r,seg=16)=>{ for(let i=0;i<seg;i++){ const a=i/seg*Math.PI*2, b=(i+1)/seg*Math.PI*2; arr.push(C0[0],0,C0[1], C0[0]+Math.cos(a)*r,0,C0[1]+Math.sin(a)*r, C0[0]+Math.cos(b)*r,0,C0[1]+Math.sin(b)*r); } };
const quadA=(arr,c)=>arr.push(c[0][0],0,c[0][1], c[1][0],0,c[1][1], c[2][0],0,c[2][1], c[0][0],0,c[0][1], c[2][0],0,c[2][1], c[3][0],0,c[3][1]);

/* ---------- 版圖（簡化真實屯門） ---------- */
const LAY={"S":0.4,"nodes":[[-152.0,-312.0],[-137.0,-292.5],[-121.9,-273.0],[-106.9,-253.4],[-88.8,-230.0],[-87.5,-200.5],[-86.3,-173.8],[-85.2,-146.2],[-84.1,-119.2],[-83.2,-92.8],[-82.0,-56.0],[-79.0,-31.0],[-76.0,-6.0],[-73.0,19.0],[-71.2,34.0],[-82.9,59.9],[-94.4,81.9],[-107.8,102.5],[-120.0,120.0],[-127.9,146.2],[-136.2,175.9],[-142.7,204.5],[-148.8,236.0],[-154.2,260.3],[-159.7,284.6],[-164.0,304.0],[-128.4,-318.6],[-102.6,-325.2],[-76.8,-328.2],[-52.0,-326.8],[-26.0,-321.9],[-16.0,-320.0],[-7.0,-342.5],[4.9,-368.4],[18.4,-393.7],[24.0,-404.0],[-256.0,-224.0],[-231.1,-229.2],[-203.5,-234.6],[-178.1,-236.8],[-151.3,-236.5],[-123.7,-233.8],[-60.8,-228.7],[-36.8,-229.1],[-12.0,-231.2],[15.0,-244.5],[39.0,-253.1],[63.0,-256.6],[87.0,-257.2],[111.0,-256.2],[132.0,-254.8],[-13.1,-255.9],[-14.2,-280.5],[-15.3,-305.2],[-256.0,-44.0],[-227.1,-45.3],[-201.0,-46.5],[-173.7,-48.1],[-146.6,-50.1],[-119.6,-52.5],[-95.4,-54.8],[-56.0,-58.1],[-31.8,-44.2],[-13.4,-20.4],[2.9,1.2],[17.6,20.8],[-69.6,-83.0],[-54.6,-103.2],[-33.0,-117.5],[-12.0,-128.0],[-12.0,-152.6],[-12.0,-177.1],[-12.0,-201.7],[46.0,11.4],[70.8,1.2],[95.0,-11.8],[116.0,-24.0],[160.0,-360.0],[154.2,-333.8],[148.0,-305.9],[140.8,-277.8],[144.2,-230.8],[156.4,-202.2],[162.2,-178.5],[164.6,-152.6],[160.5,-127.0],[153.1,-103.8],[143.1,-80.2],[130.6,-54.4],[118.2,3.0],[115.9,31.4],[109.5,57.2],[101.6,82.2],[96.0,100.0],[97.8,129.8],[99.8,154.1],[105.1,181.2],[115.6,211.6],[129.8,239.8],[142.3,262.6],[160.6,286.8],[178.6,303.6],[188.0,312.0],[193.2,336.5],[198.1,364.5],[200.0,392.5],[200.0,424.0],[204.0,448.0],[208.0,472.0],[-256.0,208.0],[-232.7,214.1],[-209.4,220.2],[-186.1,226.3],[-162.8,232.3],[-118.7,245.6],[-93.5,252.8],[-62.7,257.0],[-35.4,256.1],[-8.2,252.9],[12.0,248.8],[35.3,241.8],[68.0,232.0],[91.8,221.8],[16.0,45.3],[14.3,69.7],[12.0,104.0],[8.7,128.9],[5.4,156.1],[4.5,183.6],[6.4,210.1],[10.4,238.1],[7.6,273.9],[4.0,294.0],[7.8,319.0],[10.0,334.0],[10.7,358.3],[11.3,382.6],[12.0,406.9],[12.8,436.0],[12.8,461.7],[12.8,472.0],[75.0,256.0],[82.0,280.0],[88.8,305.0],[92.8,320.0],[96.0,348.0],[99.3,378.5],[102.1,405.0],[104.8,432.0],[28.4,289.6],[52.8,285.2],[34.4,329.9],[58.7,325.8],[37.0,434.9],[61.2,433.9],[85.4,432.8],[129.0,430.2],[155.1,428.2],[182.5,425.8],[71.2,98.9],[44.7,99.5],[12.9,-327.9],[39.0,-334.9],[66.5,-341.8],[94.0,-347.8],[121.5,-353.0],[146.2,-357.5],[178.8,-381.9],[195.0,-400.8],[214.0,-423.0],[230.5,-441.5],[247.6,-459.7],[265.1,-477.8],[283.3,-495.5],[303.2,-514.2],[321.2,-530.5],[340.2,-547.4],[358.7,-563.9],[376.8,-580.0],[398.7,-599.4],[419.9,-618.2],[439.2,-635.1],[462.6,-655.8],[472.0,-664.0],[496.8,-667.8],[521.5,-671.6],[546.3,-675.4],[576.0,-680.0],[600.8,-680.0],[625.5,-680.0],[650.3,-680.0],[680.0,-680.0],[704.8,-680.0],[729.5,-680.0],[754.3,-680.0],[784.0,-680.0],[806.5,-689.0],[831.5,-702.8],[850.9,-717.5],[864.0,-728.0],[476.8,-688.0],[481.6,-712.0],[486.4,-736.0],[491.2,-760.0],[496.0,-784.0],[521.0,-784.0],[546.0,-784.0],[576.0,-784.0],[600.8,-784.0],[625.5,-784.0],[650.3,-784.0],[680.0,-784.0],[576.0,-759.2],[576.0,-734.5],[576.0,-709.7],[680.0,-759.2],[680.0,-734.5],[680.0,-709.7],[576.0,-656.0],[576.0,-632.0],[576.0,-608.0],[576.0,-584.0],[680.0,-656.0],[680.0,-632.0],[680.0,-608.0],[680.0,-584.0],[600.8,-584.0],[625.5,-584.0],[650.3,-584.0],[704.8,-584.0],[729.5,-584.0],[754.3,-584.0],[784.0,-584.0],[784.0,-656.0],[784.0,-632.0],[784.0,-608.0]],"edges":[{"a":0,"b":1,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":1,"b":2,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":2,"b":3,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":3,"b":4,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":4,"b":5,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":5,"b":6,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":6,"b":7,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":7,"b":8,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":8,"b":9,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":9,"b":10,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":10,"b":11,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":11,"b":12,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":12,"b":13,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":13,"b":14,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":14,"b":15,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":15,"b":16,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":16,"b":17,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":17,"b":18,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":18,"b":19,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":19,"b":20,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":20,"b":21,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":21,"b":22,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":22,"b":23,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":23,"b":24,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":24,"b":25,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":0,"b":26,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":26,"b":27,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":27,"b":28,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":28,"b":29,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":29,"b":30,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":30,"b":31,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":31,"b":32,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":32,"b":33,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":33,"b":34,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":34,"b":35,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":36,"b":37,"t":"main","name":"\u9752\u7530\u8def"},{"a":37,"b":38,"t":"main","name":"\u9752\u7530\u8def"},{"a":38,"b":39,"t":"main","name":"\u9752\u7530\u8def"},{"a":39,"b":40,"t":"main","name":"\u9752\u7530\u8def"},{"a":40,"b":41,"t":"main","name":"\u9752\u7530\u8def"},{"a":41,"b":4,"t":"main","name":"\u9752\u7530\u8def"},{"a":4,"b":42,"t":"main","name":"\u9752\u7530\u8def"},{"a":42,"b":43,"t":"main","name":"\u9752\u7530\u8def"},{"a":43,"b":44,"t":"main","name":"\u9752\u7530\u8def"},{"a":44,"b":45,"t":"main","name":"\u9752\u7530\u8def"},{"a":45,"b":46,"t":"main","name":"\u9752\u7530\u8def"},{"a":46,"b":47,"t":"main","name":"\u9752\u7530\u8def"},{"a":47,"b":48,"t":"main","name":"\u9752\u7530\u8def"},{"a":48,"b":49,"t":"main","name":"\u9752\u7530\u8def"},{"a":49,"b":50,"t":"main","name":"\u9752\u7530\u8def"},{"a":44,"b":51,"t":"street","name":"\u91ab\u9662\u8def"},{"a":51,"b":52,"t":"street","name":"\u91ab\u9662\u8def"},{"a":52,"b":53,"t":"street","name":"\u91ab\u9662\u8def"},{"a":53,"b":31,"t":"street","name":"\u91ab\u9662\u8def"},{"a":54,"b":55,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":55,"b":56,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":56,"b":57,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":57,"b":58,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":58,"b":59,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":59,"b":60,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":60,"b":10,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":10,"b":61,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":61,"b":62,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":62,"b":63,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":63,"b":64,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":64,"b":65,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":10,"b":66,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":66,"b":67,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":67,"b":68,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":68,"b":69,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":69,"b":70,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":70,"b":71,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":71,"b":72,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":72,"b":44,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":65,"b":73,"t":"street","name":"\u65b0\u589f\u8def"},{"a":73,"b":74,"t":"street","name":"\u65b0\u589f\u8def"},{"a":74,"b":75,"t":"street","name":"\u65b0\u589f\u8def"},{"a":75,"b":76,"t":"street","name":"\u65b0\u589f\u8def"},{"a":77,"b":78,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":78,"b":79,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":79,"b":80,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":80,"b":50,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":50,"b":81,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":81,"b":82,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":82,"b":83,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":83,"b":84,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":84,"b":85,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":85,"b":86,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":86,"b":87,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":87,"b":88,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":88,"b":76,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":76,"b":89,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":89,"b":90,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":90,"b":91,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":91,"b":92,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":92,"b":93,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":93,"b":94,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":94,"b":95,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":95,"b":96,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":96,"b":97,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":97,"b":98,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":98,"b":99,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":99,"b":100,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":100,"b":101,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":101,"b":102,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":102,"b":103,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":103,"b":104,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":104,"b":105,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":105,"b":106,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":106,"b":107,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":107,"b":108,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":109,"b":110,"t":"main","name":"\u676f\u6e21\u8def"},{"a":110,"b":111,"t":"main","name":"\u676f\u6e21\u8def"},{"a":111,"b":112,"t":"main","name":"\u676f\u6e21\u8def"},{"a":112,"b":113,"t":"main","name":"\u676f\u6e21\u8def"},{"a":113,"b":22,"t":"main","name":"\u676f\u6e21\u8def"},{"a":22,"b":114,"t":"main","name":"\u676f\u6e21\u8def"},{"a":114,"b":115,"t":"main","name":"\u676f\u6e21\u8def"},{"a":115,"b":116,"t":"main","name":"\u676f\u6e21\u8def"},{"a":116,"b":117,"t":"main","name":"\u676f\u6e21\u8def"},{"a":117,"b":118,"t":"main","name":"\u676f\u6e21\u8def"},{"a":118,"b":119,"t":"main","name":"\u676f\u6e21\u8def"},{"a":119,"b":120,"t":"main","name":"\u676f\u6e21\u8def"},{"a":120,"b":121,"t":"main","name":"\u676f\u6e21\u8def"},{"a":121,"b":122,"t":"main","name":"\u676f\u6e21\u8def"},{"a":122,"b":97,"t":"main","name":"\u676f\u6e21\u8def"},{"a":65,"b":123,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":123,"b":124,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":124,"b":125,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":125,"b":126,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":126,"b":127,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":127,"b":128,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":128,"b":129,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":129,"b":130,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":130,"b":119,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":119,"b":131,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":131,"b":132,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":132,"b":133,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":133,"b":134,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":134,"b":135,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":135,"b":136,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":136,"b":137,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":137,"b":138,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":138,"b":139,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":139,"b":140,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":121,"b":141,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":141,"b":142,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":142,"b":143,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":143,"b":144,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":144,"b":145,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":145,"b":146,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":146,"b":147,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":147,"b":148,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":132,"b":149,"t":"street","name":"\u5c6f\u9806\u8857"},{"a":149,"b":150,"t":"street","name":"\u5c6f\u9806\u8857"},{"a":150,"b":142,"t":"street","name":"\u5c6f\u9806\u8857"},{"a":134,"b":151,"t":"street","name":"\u5c6f\u76db\u8857"},{"a":151,"b":152,"t":"street","name":"\u5c6f\u76db\u8857"},{"a":152,"b":144,"t":"street","name":"\u5c6f\u76db\u8857"},{"a":138,"b":153,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":153,"b":154,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":154,"b":155,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":155,"b":148,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":148,"b":156,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":156,"b":157,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":157,"b":158,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":158,"b":106,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":93,"b":159,"t":"street","name":"\u5c6f\u8cb4\u8def"},{"a":159,"b":160,"t":"street","name":"\u5c6f\u8cb4\u8def"},{"a":160,"b":125,"t":"street","name":"\u5c6f\u8cb4\u8def"},{"a":31,"b":161,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":161,"b":162,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":162,"b":163,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":163,"b":164,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":164,"b":165,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":165,"b":166,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":166,"b":77,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":77,"b":167,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":167,"b":168,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":168,"b":169,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":169,"b":170,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":170,"b":171,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":171,"b":172,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":172,"b":173,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":173,"b":174,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":174,"b":175,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":175,"b":176,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":176,"b":177,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":177,"b":178,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":178,"b":179,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":179,"b":180,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":180,"b":181,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":181,"b":182,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":182,"b":183,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":183,"b":184,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":184,"b":185,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":185,"b":186,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":186,"b":187,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":187,"b":188,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":188,"b":189,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":189,"b":190,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":190,"b":191,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":191,"b":192,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":192,"b":193,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":193,"b":194,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":194,"b":195,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":195,"b":196,"t":"main","name":"\u5773\u982d\u8def"},{"a":196,"b":197,"t":"main","name":"\u5773\u982d\u8def"},{"a":197,"b":198,"t":"main","name":"\u5773\u982d\u8def"},{"a":198,"b":199,"t":"main","name":"\u5773\u982d\u8def"},{"a":183,"b":200,"t":"main","name":"\u6717\u5929\u8def"},{"a":200,"b":201,"t":"main","name":"\u6717\u5929\u8def"},{"a":201,"b":202,"t":"main","name":"\u6717\u5929\u8def"},{"a":202,"b":203,"t":"main","name":"\u6717\u5929\u8def"},{"a":203,"b":204,"t":"main","name":"\u6717\u5929\u8def"},{"a":204,"b":205,"t":"street","name":"\u6717\u65e5\u8def"},{"a":205,"b":206,"t":"street","name":"\u6717\u65e5\u8def"},{"a":206,"b":207,"t":"street","name":"\u6717\u65e5\u8def"},{"a":207,"b":208,"t":"street","name":"\u6717\u65e5\u8def"},{"a":208,"b":209,"t":"street","name":"\u6717\u65e5\u8def"},{"a":209,"b":210,"t":"street","name":"\u6717\u65e5\u8def"},{"a":210,"b":211,"t":"street","name":"\u6717\u65e5\u8def"},{"a":207,"b":212,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":212,"b":213,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":213,"b":214,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":214,"b":187,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":211,"b":215,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":215,"b":216,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":216,"b":217,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":217,"b":191,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":187,"b":218,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":218,"b":219,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":219,"b":220,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":220,"b":221,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":191,"b":222,"t":"street","name":"\u99ac\u7530\u8def"},{"a":222,"b":223,"t":"street","name":"\u99ac\u7530\u8def"},{"a":223,"b":224,"t":"street","name":"\u99ac\u7530\u8def"},{"a":224,"b":225,"t":"street","name":"\u99ac\u7530\u8def"},{"a":221,"b":226,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":226,"b":227,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":227,"b":228,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":228,"b":225,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":225,"b":229,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":229,"b":230,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":230,"b":231,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":231,"b":232,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":195,"b":233,"t":"street","name":"\u6771\u5824\u8857"},{"a":233,"b":234,"t":"street","name":"\u6771\u5824\u8857"},{"a":234,"b":235,"t":"street","name":"\u6771\u5824\u8857"},{"a":235,"b":232,"t":"street","name":"\u6771\u5824\u8857"}],"river":[[177.6,-579.2],[176.6,-576.1],[174.7,-570.1],[171.8,-560.9],[167.9,-548.7],[163.1,-533.5],[157.3,-515.1],[150.5,-493.8],[142.7,-469.4],[135.4,-445.3],[128.5,-421.4],[122.0,-397.8],[115.9,-374.5],[110.2,-351.4],[104.9,-328.6],[100.0,-306.1],[95.6,-283.9],[91.0,-262.3],[86.3,-241.5],[81.4,-221.3],[76.4,-201.9],[71.3,-183.1],[66.0,-165.1],[60.6,-147.7],[55.0,-131.1],[49.3,-115.1],[43.5,-99.9],[37.5,-85.3],[31.4,-71.4],[25.1,-58.2],[18.7,-45.7],[12.2,-34.0],[5.5,-22.9],[-1.0,-11.8],[-7.1,-0.7],[-13.0,10.5],[-18.5,21.6],[-23.8,32.6],[-28.8,43.8],[-33.6,54.9],[-38.0,66.0],[-42.5,78.4],[-46.9,92.3],[-51.4,107.6],[-55.8,124.3],[-60.3,142.4],[-64.7,161.8],[-69.2,182.7],[-73.6,204.9],[-78.1,226.5],[-82.5,247.3],[-86.9,267.5],[-91.4,286.9],[-95.8,305.7],[-100.2,323.7],[-104.6,341.1],[-109.0,357.7],[-113.2,373.6],[-117.1,388.7],[-120.7,403.1],[-124.2,416.6],[-127.3,429.4],[-130.3,441.5],[-133.0,452.8],[-135.4,463.2],[-137.6,472.4],[-139.4,480.3],[-140.9,486.9],[-142.2,492.1],[-143.1,496.1],[-143.7,498.7],[-144.0,500.0]],"lake":[[-68.0,328.0],[-66.8,327.5],[-64.2,326.5],[-60.5,325.0],[-55.5,323.0],[-51.0,322.5],[-47.0,323.5],[-43.5,326.0],[-40.5,330.0],[-38.5,334.5],[-37.5,339.5],[-37.5,345.0],[-38.5,351.0],[-40.5,356.2],[-43.5,360.8],[-47.5,364.5],[-52.5,367.5],[-57.5,369.0],[-62.5,369.0],[-67.5,367.5],[-72.5,364.5],[-76.2,361.0],[-78.8,357.0],[-80.0,352.5],[-80.0,347.5],[-79.2,343.0],[-77.8,339.0],[-75.5,335.5],[-72.5,332.5],[-70.2,330.2],[-68.8,328.8],[-68.0,328.0]],"bounds":[-256.0,-832.0,920.0,472.0],"J":{"W0":0,"W1":4,"W2":10,"W3":14,"W4":18,"W5":22,"W6":25,"H1":31,"HOSP":35,"Q0":36,"H0":44,"Q4":50,"S0":54,"N0":65,"K0":69,"E1":76,"E0":77,"E2":93,"E3":97,"E4":102,"E5":106,"E6":108,"B0":109,"B2":119,"B3":121,"N1":125,"C1":132,"D1":134,"F0":138,"N9":140,"C2":142,"D2":144,"F1":148,"YW":183,"YM1":187,"YM2":191,"YE":195,"POK":199,"YN0":204,"YN1":207,"YN2":211,"YS1":221,"YS2":225,"YS3":232}};
const WD={main:16,avenue:26,street:12};
const [LB0,LB1,LB2,LB3]=LAY.bounds; const BX0=LB0-8, BZ0=LB1-8, BX1=LB2+8, BZ1=LB3+8;
const MAP={nodes:LAY.nodes,roads:[],crossings:[],blds:[],parks:[],water:[],poi:{},bounds:[BX0,BZ0,BX1,BZ1]}; window.MAP=MAP;
const NODES=MAP.nodes, ADJ=NODES.map(()=>[]), EDGE={};
const RIV=LAY.river, RIVH=13;
function segDist(px,pz,A,B){ const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; let t=((px-A[0])*dx+(pz-A[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); return Math.hypot(A[0]+dx*t-px,A[1]+dz*t-pz); }
function riverDist(x,z){ let d=1e9; for(let i=1;i<RIV.length;i++) d=Math.min(d,segDist(x,z,RIV[i-1],RIV[i])); return d; }
LAY.edges.forEach(e=>{ const A=NODES[e.a], B=NODES[e.b]; const w=WD[e.t];
  let bridge=false; for(let q=0;q<=10;q++){ if(riverDist(A[0]+(B[0]-A[0])*q/10,A[1]+(B[1]-A[1])*q/10)<RIVH+2){ bridge=true; break; } }
  const r={n:[e.a,e.b],w,t:e.t,name:e.name,bridge}; MAP.roads.push(r); const L=Math.hypot(B[0]-A[0],B[1]-A[1]);
  ADJ[e.a].push([e.b,L,r]); ADJ[e.b].push([e.a,L,r]); EDGE[e.a+'-'+e.b]=EDGE[e.b+'-'+e.a]=r; });
const DEG=ADJ.map(a=>a.length);
/* ---------- 元朗公路高架：由 E0 到元朗，兩頭上落斜，中間約 8 米高 ---------- */
const HW=(()=>{ const st=LAY.J.E0, en=LAY.J.YW, E=NODES[en]; let cur=st, prev=-1; const seq=[st];
  for(let g=0;g<300&&cur!==en;g++){ const c=ADJ[cur].filter(([o,,r])=>r.name==='元朗公路'&&o!==prev); if(!c.length) break;
    const dd=k=>Math.hypot(NODES[k][0]-E[0],NODES[k][1]-E[1]); c.sort((p,q)=>dd(p[0])-dd(q[0])); prev=cur; cur=c[0][0]; seq.push(cur); }
  const pts=seq.map(k=>NODES[k]); const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const L=cum[cum.length-1], H=8, s0=30, R=75; const hAt=s=>{ const u=Math.min((s-s0)/R,(L-s0-s)/R); if(u<=0) return 0; if(u>=1) return H; return H*u*u*(3-2*u); };
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; pts.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  return {seq,pts,cum,L,H,hAt,bb:[x0-30,z0-30,x1+30,z1+30],rad:12.4}; })();
function ELEV(x,z,rad){ const T=HW, b=T.bb; if(x<b[0]||x>b[2]||z<b[1]||z>b[3]) return 0; rad=rad||T.rad; let best=1e9,bs=0;
  for(let i=1;i<T.pts.length;i++){ const A=T.pts[i-1],B=T.pts[i], dx=B[0]-A[0], dz=B[1]-A[1], L2=dx*dx+dz*dz||1; let t=((x-A[0])*dx+(z-A[1])*dz)/L2; t=t<0?0:t>1?1:t;
    const ex=x-A[0]-dx*t, ez=z-A[1]-dz*t, d=ex*ex+ez*ez; if(d<best){ best=d; bs=T.cum[i-1]+t*(T.cum[i]-T.cum[i-1]); } }
  return best<=rad*rad?T.hAt(bs):0; }
window.ELEV=ELEV;
const rural=(x,z)=>!(x<240&&z>-440)&&!(x>430&&z<-540);   // 屯門同元朗市區以外：郊區
const SIGNAL=DEG.map(d=>d>=3);
const CLR=ADJ.map((a,k)=>DEG[k]>=3?Math.max(...a.map(e=>e[2].w/2))+1.5:0);   // 路口半徑（停車線之前）
const NW=ADJ.map(a=>Math.max(...a.map(e=>e[2].w/2)));                        // 路口填色半徑
const angOf=(A,B)=>Math.atan2(B[0]-A[0],B[1]-A[1]);
const REF=ADJ.map((a,k)=>a.length?angOf(NODES[k],NODES[a[0][0]]):0);

/* ---------- 格網：1 路、2 建築、4 水、8 預留、16 行人路 ---------- */
const X0=BX0-60,Z0=BZ0-60, CELL=2, GW=Math.ceil((BX1+60-X0)/CELL), GH=Math.ceil((BZ1+60-Z0)/CELL);
const grid=new Uint8Array(GW*GH);
const gi=(x,z)=>{const i=Math.floor((x-X0)/CELL), j=Math.floor((z-Z0)/CELL); return (i<0||j<0||i>=GW||j>=GH)?-1:j*GW+i;};
const cellAt=(x,z)=>{const k=gi(x,z); return k<0?2:grid[k];};
function markSeg(A,B,w,bit,clear=0){ const r=w/2, minx=Math.min(A[0],B[0])-r, maxx=Math.max(A[0],B[0])+r, minz=Math.min(A[1],B[1])-r, maxz=Math.max(A[1],B[1])+r;
  for(let z=minz;z<=maxz+CELL;z+=CELL) for(let x=minx;x<=maxx+CELL;x+=CELL){ const cx=Math.floor((x-X0)/CELL)*CELL+X0+1, cz=Math.floor((z-Z0)/CELL)*CELL+Z0+1;
    if(segDist(cx,cz,A,B)<=r){ const k=gi(cx,cz); if(k>=0){ grid[k]&=~clear; grid[k]|=bit; } } } }
function inQuad(x,z,c){ let s=0; for(let i=0;i<4;i++){ const A=c[i],B=c[(i+1)%4]; const cr=(B[0]-A[0])*(z-A[1])-(B[1]-A[1])*(x-A[0]); if(cr>0) s|=1; else if(cr<0) s|=2; } return s!==3; }
function quadCells(c,fn,margin=0){ let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; c.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  const cx=(c[0][0]+c[2][0])/2, cz=(c[0][1]+c[2][1])/2; const cc=margin?c.map(([x,z])=>{ const dx=x-cx,dz=z-cz,L=Math.hypot(dx,dz)||1; return [x+dx/L*margin,z+dz/L*margin]; }):c;
  for(let z=z0-margin;z<=z1+margin;z+=CELL/2) for(let x=x0-margin;x<=x1+margin;x+=CELL/2) if(inQuad(x,z,cc)){ if(fn(gi(x,z))===false) return false; } return true; }
const quadFree=(c,margin=1)=>quadCells(c,k=>!(k<0||grid[k]),margin);
const markQuad=(c,bit)=>quadCells(c,k=>{ if(k>=0) grid[k]|=bit; });
// 邊界外面當障礙
for(let j=0;j<GH;j++) for(let i=0;i<GW;i++){ const x=X0+i*CELL+1, z=Z0+j*CELL+1; if(x<BX0||x>BX1||z<BZ0||z>BZ1) grid[j*GW+i]|=2; }
// 河
for(let i=1;i<RIV.length;i++) markSeg(RIV[i-1],RIV[i],RIVH*2,4);
// 湖（公園）
const LAKE=LAY.lake; { let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; LAKE.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  const inP=(x,z)=>{let c=false;for(let i=0,j=LAKE.length-1;i<LAKE.length;j=i++){const [xi,zi]=LAKE[i],[xj,zj]=LAKE[j]; if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
  for(let z=z0;z<=z1;z+=CELL) for(let x=x0;x<=x1;x+=CELL) if(inP(x,z)){ const k=gi(x,z); if(k>=0) grid[k]|=4; } }
// 行人路、路面
MAP.roads.forEach(r=>{ const A=NODES[r.n[0]],B=NODES[r.n[1]]; if(!r.bridge) markSeg(A,B,r.w+7.2,16); });
NODES.forEach((N,k)=>{ if(DEG[k]) markSeg(N,N,(NW[k]+3.6)*2,16); });
MAP.roads.forEach(r=>{ const A=NODES[r.n[0]],B=NODES[r.n[1]]; markSeg(A,B,r.w,1,4|16); });
NODES.forEach((N,k)=>{ if(DEG[k]) markSeg(N,N,NW[k]*2,1,4|16); });

/* ---------- 地面、河、路 ---------- */
{ const g=add(new THREE.PlaneGeometry(BX1-BX0+900,BZ1-BZ0+900),M(0xcfe6b8,{r:0.95}),scene,(BX0+BX1)/2,-0.05,(BZ0+BZ1)/2,false); g.rotation.x=-Math.PI/2; }
{ const bank=[], water=[]; for(let i=1;i<RIV.length;i++){ ribbon(bank,RIV[i-1],RIV[i],RIVH+4); ribbon(water,RIV[i-1],RIV[i],RIVH); }
  RIV.forEach(p=>{ disc(bank,p,RIVH+4,12); disc(water,p,RIVH,12); });
  flat(bank,M(0xb9c7a8,{r:0.95}),0.0); flat(water,M(0x6cc2ec,{r:0.25}),0.03);
  const lake=[]; for(let i=1;i<LAKE.length-1;i++) lake.push(LAKE[0][0],0,LAKE[0][1], LAKE[i][0],0,LAKE[i][1], LAKE[i+1][0],0,LAKE[i+1][1]); flat(lake,M(0x7ec8f0,{r:0.3}),0.2);
  // 小地圖用：河嘅多邊形
  const Lp=[],Rp=[]; for(let i=0;i<RIV.length;i++){ const A=RIV[Math.max(0,i-1)],B=RIV[Math.min(RIV.length-1,i+1)]; const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1;
    Lp.push([RIV[i][0]+dz/L*RIVH,RIV[i][1]-dx/L*RIVH]); Rp.push([RIV[i][0]-dz/L*RIVH,RIV[i][1]+dx/L*RIVH]); }
  MAP.water.push([...Lp,...Rp.reverse()], LAKE); }
{ const walk=[], road=[]; MAP.roads.forEach(r=>{ const A=NODES[r.n[0]],B=NODES[r.n[1]]; ribbon(walk,A,B,r.w/2+3.6); ribbon(road,A,B,r.w/2); });
  NODES.forEach((N,k)=>{ if(!DEG[k]) return; disc(walk,N,NW[k]+3.6,20); disc(road,N,NW[k],20); });
  flat(walk,new THREE.MeshStandardMaterial({map:walkTex,roughness:0.9}),0.10); flat(road,M(C.road,{r:0.85}),0.14); }
// 標線、斑馬線、輕鐵路軌
const mW=[], mY=[], mR=[];
const dirn=(A,B)=>{ const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1; return [dx/L,dz/L,L]; };
MAP.roads.forEach(r=>{ const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,L]=dirn(A,B); const nx=uz, nz=-ux;
  const s0=DEG[a]>=3?CLR[a]+4.5:0, s1=L-(DEG[b]>=3?CLR[b]+4.5:0);
  const P=s=>[A[0]+ux*s,A[1]+uz*s];
  const line=(arr,o,hw,dash)=>{ for(let s=s0;s<s1-0.5;s+=dash?8:1e9){ const e=Math.min(s1,s+(dash?4:1e9)); const p=P(s), q=P(e);
      arr.push(p[0]+nx*(o+hw),0,p[1]+nz*(o+hw), q[0]+nx*(o+hw),0,q[1]+nz*(o+hw), q[0]+nx*(o-hw),0,q[1]+nz*(o-hw),  p[0]+nx*(o+hw),0,p[1]+nz*(o+hw), q[0]+nx*(o-hw),0,q[1]+nz*(o-hw), p[0]+nx*(o-hw),0,p[1]+nz*(o-hw)); } };
  if(r.t==='avenue'){ line(mY,6.1,0.15,false); line(mY,-6.1,0.15,false);
    [-3.2,3.2].forEach(o=>[-0.7,0.7].forEach(q=>{ const p=A,q2=B; mR.push(p[0]+nx*(o+q+0.1),0,p[1]+nz*(o+q+0.1), q2[0]+nx*(o+q+0.1),0,q2[1]+nz*(o+q+0.1), q2[0]+nx*(o+q-0.1),0,q2[1]+nz*(o+q-0.1), p[0]+nx*(o+q+0.1),0,p[1]+nz*(o+q+0.1), q2[0]+nx*(o+q-0.1),0,q2[1]+nz*(o+q-0.1), p[0]+nx*(o+q-0.1),0,p[1]+nz*(o+q-0.1)); })); }
  else line(r.t==='main'?mY:mW,0,0.18,r.t!=='main');
  // 斑馬線：喺有燈路口嘅每條入口
  [[a,0,1],[b,L,-1]].forEach(([k,sb,sg])=>{ if(!SIGNAL[k]) return; const s=sb+sg*(CLR[k]+0.6), s2=s+sg*3; const hw=r.w/2;
    for(let o=-hw+0.9;o<=hw-0.9;o+=1.6){ const p=P(s), q=P(s2); quadA(mW,[[p[0]+nx*(o-0.5),p[1]+nz*(o-0.5)],[q[0]+nx*(o-0.5),q[1]+nz*(o-0.5)],[q[0]+nx*(o+0.5),q[1]+nz*(o+0.5)],[p[0]+nx*(o+0.5),p[1]+nz*(o+0.5)]]); }
    const m=P(s+sg*1.5); MAP.crossings.push({p:m,n:[nx,nz],half:hw+2.6,node:k,ang:Math.atan2(ux,uz)}); });
});
flat(mW,new THREE.MeshBasicMaterial({color:0xffffff}),0.17); flat(mY,new THREE.MeshBasicMaterial({color:0xffd23f}),0.17); flat(mR,new THREE.MeshBasicMaterial({color:0x50535a}),0.18);
// 橋欄杆
// 只喺真正跨過河嘅位置起欄杆，而且唔會伸入其他馬路
const railMat=M(0xf1f3f5);
MAP.roads.forEach(r=>{ if(!r.bridge) return; const A=NODES[r.n[0]],B=NODES[r.n[1]]; const [ux,uz,L]=dirn(A,B);
  [-1,1].forEach(sd=>{ const o=(r.w/2+3.4)*sd; let run=null; const flush=()=>{ if(run&&run[1]-run[0]>=2){ const s0=run[0],s1=run[1], m=add(new THREE.BoxGeometry(0.45,1.1,s1-s0),railMat,scene,A[0]+ux*(s0+s1)/2+uz*o,0.7,A[1]+uz*(s0+s1)/2-ux*o,true); m.rotation.y=Math.atan2(ux,uz); } run=null; };
    for(let s=0;s<=L;s+=1){ const x=A[0]+ux*s+uz*o, z=A[1]+uz*s-ux*o; const ok=!(cellAt(x,z)&1)&&riverDist(x,z)<RIVH+5&&!(cellAt(x+ux*1.5,z+uz*1.5)&1)&&!(cellAt(x-ux*1.5,z-uz*1.5)&1);
      if(ok){ if(!run) run=[s,s]; run[1]=s+1; } else flush(); } flush(); }); });

/* ---------- 地標 ---------- */
// 高架橋身：橋面、兩邊石壆、橋躉（建好之後一齊抬高）
{ const T=HW, deck=M(0xb9bec6,{r:0.9}), side=M(0x9aa1ab,{r:0.9}), par=M(0xe3e6ea,{r:0.8}), hw=8+3.6;
  for(let i=1;i<T.pts.length;i++){ const A=T.pts[i-1],B=T.pts[i]; const h=Math.max(T.hAt(T.cum[i-1]),T.hAt(T.cum[i])); if(h<0.3) continue;
    const [ux,uz,L]=dirn(A,B); const nx=uz, nz=-ux; const P=(s,o)=>[A[0]+ux*s+nx*o,A[1]+uz*s+nz*o];
    boxQ([P(0,-hw),P(L,-hw),P(L,hw),P(0,hw)],-1.5,0.2,side,deck,8,3);
    [-1,1].forEach(sd=>{ const o=sd*(hw+0.2); boxQ([P(0,o-0.35),P(L,o-0.35),P(L,o+0.35),P(0,o+0.35)],0.2,1.4,par,par,8,3); });
    const hm=T.hAt(T.cum[i-1]+L/2); if(hm>3) for(const o of [-5,5]) boxQ([P(L/2-1.3,o-1.3),P(L/2+1.3,o-1.3),P(L/2+1.3,o+1.3),P(L/2-1.3,o+1.3)],-hm,-1.5,side,side,4,4); } }
const props={tree:[],lamp:[],rail:[],bin:[]}; const signs=[]; const parked=[];
function labelPlane(text,x,y,z,ry,bg,w=14,parent=scene){ const t=canvasTex(512,128,(g)=>{ g.fillStyle=bg; rr(g,4,4,504,120,24); g.fill(); g.fillStyle='#fff'; g.font='bold 72px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,256,68); },false);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshBasicMaterial({map:t})); m.position.set(x,y,z); m.rotation.y=ry; parent.add(m); return m; }
function addBldQ(c,h,lm){ MAP.blds.push({p:c,h,lm}); markQuad(c,2); }
// 搵最近（唔係橋）嘅路段
function nearestEdge(x,z,filter){ let best=null; MAP.roads.forEach(r=>{ if(r.bridge||(filter&&!filter(r))) return; const A=NODES[r.n[0]],B=NODES[r.n[1]]; const d=segDist(x,z,A,B); if(!best||d<best.d) best={r,d}; });
  const r=best.r, A=NODES[r.n[0]],B=NODES[r.n[1]]; const [ux,uz,L]=dirn(A,B); let t=((x-A[0])*ux+(z-A[1])*uz); t=Math.max(6,Math.min(L-6,t));
  const R=[A[0]+ux*t,A[1]+uz*t]; let nx=uz, nz=-ux; if((x-R[0])*nx+(z-R[1])*nz<0){ nx=-nx; nz=-nz; } return {r,R,nx,nz}; }
// 地標框：原點喺行人路後面，+z（局部）= 遠離馬路，+x（局部）= (nz,-nx)
function frameAt(R,nx,nz,off){ const F=[R[0]+nx*off,R[1]+nz*off], ux=nz, uz=-nx; const L=(lx,lz)=>[F[0]+ux*lx+nx*lz,F[1]+uz*lx+nz*lz];
  const g=new THREE.Group(); g.position.set(F[0],0,F[1]); g.rotation.y=Math.atan2(nx,nz); scene.add(g);
  const rq=(x0,z0,x1,z1)=>[L(x0,z0),L(x1,z0),L(x1,z1),L(x0,z1)]; return {F,L,g,rq,nx,nz,ux,uz,off}; }
function placeLM(px,pz,w,d,filter){ // 沿住條路前後試位置，直到成塊地唔壓到其他馬路、河或者其他地標
  let E0=nearestEdge(px,pz,filter), pick0=null;
  for(const k of [0,8,-8,16,-16,24,-24,32,-32,44,-44,56,-56]){ const ux=E0.nz, uz=-E0.nx; const E=nearestEdge(px-ux*k,pz-uz*k,filter); const off=E.r.w/2+3.6+0.4;
    const F=[E.R[0]+E.nx*off,E.R[1]+E.nz*off], Lx=(lx,lz)=>[F[0]+E.nz*lx+E.nx*lz,F[1]-E.nx*lx+E.nz*lz];
    const ok=quadCells([Lx(-w/2,1),Lx(w/2,1),Lx(w/2,d),Lx(-w/2,d)],q=>!(q<0||(grid[q]&(1|4|8))));
    if(ok){ pick0=E; break; } }
  const E=pick0||E0; const off=E.r.w/2+3.6+0.4; const f=frameAt(E.R,E.nx,E.nz,off); f.E=E;
  markQuad(f.rq(-w/2-2,-2,w/2+2,d+2),8); boxQ(f.rq(-w/2,0,w/2,d),0,0.32,lotMat,lotMat); return f; }
// 停車位：喺地標嗰邊嘅行車線
const laneOff=r=>r.t==='avenue'?8.6:r.w/4;
function curbStop(f,lx){ const o=f.off-laneOff(f.E.r); return f.L(lx,-o); }
const LMK={};
const S2=LAY.S; const RP=(x,z)=>[x*S2,z*S2]; // 真實坐標 → 遊戲坐標

// 醫院：喺路盡頭（屯門醫院：青松觀路北；博愛醫院：坳頭路）
function buildHosp(key,name,c1,c2){ const k=LAY.J[key], N=NODES[k], P0=NODES[ADJ[k][0][0]]; const [dx,dz]=dirn(P0,N); const f=frameAt(N,dx,dz,4);
  const w=120,d=80; markQuad(f.rq(-w/2-2,-4,w/2+2,d+2),8); boxQ(f.rq(-w/2,0,w/2,d),0,0.3,walkMat,walkMat);
  markQuad(f.rq(-16,-4,16,26),1);  // 車道當路面
  boxQ(f.rq(-16,0,16,26),0,0.33,M(0xa9b0ba,{r:0.9}),M(0xa9b0ba,{r:0.9}));
  const hm=texMat('hosp'+key,housingTex(c1[0],c1[1],2)), hm2=texMat('hosp2'+key,housingTex(c2[0],c2[1],1));
  let c=f.rq(-50,26,50,40); boxQ(c,0.3,12,hm2,M(0xd62839),8,3); addBldQ(c,12,'hospital');
  c=f.rq(-54,44,-6,76); boxQ(c,0.3,34,hm,roofMat,8,3); addBldQ(c,34,'hospital');
  c=f.rq(4,46,54,76); boxQ(c,0.3,26,hm,roofMat,8,3); addBldQ(c,26,'hospital');
  add(new THREE.CylinderGeometry(8,8,0.4,32),M(0x58606b),f.g,-30,34.5,60,false);
  labelPlane('H',-30,34.75,60,0,'#58606b',9,f.g).rotation.x=-Math.PI/2;
  labelPlane(name,-30,28,43.9,Math.PI,'#d62839',22,f.g);
  add(new THREE.BoxGeometry(26,0.6,11),M(0x8fd3c7),f.g,0,5.2,20.5,true);
  [-12,12].forEach(o=>add(new THREE.CylinderGeometry(0.35,0.35,5,10),M(0xd0d4da),f.g,o,2.6,15.5,true));
  labelPlane('急症室 A&E',0,8.4,25.9,Math.PI,'#d62839',18,f.g);
  MAP.poi.ae=(MAP.poi.ae||[]).concat([f.L(0,26)]);
  return {door:f.L(0,24.5),stop:f.L(0,13),poi:f.L(0,50)};
}
LMK.ae=buildHosp('HOSP','屯門醫院',['#e3f4f1','#2a9d8f'],['#fde8e8','#d62839']); MAP.poi.hospital=LMK.ae.poi;
LMK.ae2=buildHosp('POK','博愛醫院',['#f3efe6','#b5651d'],['#fff1e0','#c0392b']); MAP.poi.hospital2=LMK.ae2.poi;
// 救護站（屯門：震寰路；元朗：擊壤路）
function buildDepot(f,zh,en,addr,key){
  // 外觀跟真實屯門救護站：米色混凝土平房、紅色摺門、紅字招牌、門柱黃黑間條、射燈
  const dm=texMat('depot'+key,canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); g.fillStyle='rgba(120,110,90,.10)'; for(let i=0;i<14;i++) g.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*30,1+Math.random()*3);
    g.fillStyle='#c9c0a8'; g.fillRect(0,0,w,6); }));
  const roofM=M(0xbdb5a0,{r:0.95}), H=8;
  const BX=-5.4, B0=BX-4.4, B1=BX+4.4;
  [[-26,16,B0,38],[B1,16,26,38],[B0,33,B1,38]].forEach(([a,b,cc,d])=>{ const q=f.rq(a,b,cc,d); boxQ(q,0.3,H,dm,roofM,8,4); addBldQ(q,H,'depot'); });
  boxQ(f.rq(B0,16,B1,33),6.4,H,dm,roofM,8,4);                            // 車房門頂
  boxQ(f.rq(B0,16,B1,33),0.3,0.34,M(0x8a4b3a),M(0x8a4b3a));              // 車房地台（紅啡色）
  { const pl=new THREE.PointLight(0xfff2cc,0.6,14); pl.position.set(BX,5.5,24); f.g.add(pl); }
  boxQ(f.rq(-26.3,15.7,26.3,38.3),H,H+0.5,dm,roofM,8,4);                 // 天台矮牆
  // 紅色摺門
  const doorT=canvasTex(256,192,(g,w,h)=>{ for(let i=0;i<16;i++){ g.fillStyle=i%2?'#b8434f':'#c95560'; g.fillRect(i*16,0,16,h); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(i*16+14,0,2,h); }
    g.fillStyle='#ffffff'; g.font='bold 18px sans-serif'; g.textAlign='center'; g.fillText('CAUTION FOLDING DOOR',w/2,112); g.font='bold 26px sans-serif'; g.fillText('小心摺門',w/2,146); },false);
  const doorM=new THREE.MeshStandardMaterial({map:doorT,roughness:0.7});
  const hazT=canvasTex(32,128,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); for(let i=0;i<8;i++){ g.fillStyle=i%2?'#1c1c1c':'#f2c200'; g.fillRect(10,64+i*8,12,8); } },false);
  const pilM=new THREE.MeshStandardMaterial({map:hazT,roughness:0.9});
  for(let k=0;k<4;k++){ const x=-16+k*10.6; if(Math.abs(x-BX)<1){ // 打開咗嗰個車位：摺門摺埋喺兩邊
      [-1,1].forEach(s=>add(new THREE.BoxGeometry(1.0,6.1,0.9),M(0xb8434f),f.g,x+s*3.7,3.35,16.6,false)); continue; }
    const d=new THREE.Mesh(new THREE.PlaneGeometry(8.6,6.1),doorM); d.position.set(x,3.35,15.92); d.rotation.y=Math.PI; f.g.add(d); }
  for(let k=0;k<5;k++){ const x=-21.3+k*10.6; add(new THREE.BoxGeometry(1.6,6.4,0.6),dm,f.g,x,3.5,15.7,true);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(1.6,6.4),pilM); p.position.set(x,3.5,15.38); p.rotation.y=Math.PI; f.g.add(p); }
  // 招牌：米色牆身上嘅紅字
  { const t=canvasTex(1024,128,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); g.fillStyle='#c4202f'; g.textAlign='center'; g.textBaseline='middle';
      g.font='bold 54px sans-serif'; g.fillText(zh,w/2,34); g.font='bold '+(en.length>24?44:50)+'px sans-serif'; g.fillText(en,w/2,96); },false);
    const s=new THREE.Mesh(new THREE.PlaneGeometry(17,2.1),new THREE.MeshStandardMaterial({map:t,roughness:0.9})); s.position.set(-2,7.45,15.66); s.rotation.y=Math.PI; f.g.add(s);
    const t2=canvasTex(256,32,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); g.fillStyle='#c4202f'; g.font='bold 22px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(addr,w/2,17); },false);
    const s2=new THREE.Mesh(new THREE.PlaneGeometry(8,1),new THREE.MeshStandardMaterial({map:t2})); s2.position.set(16,7.6,15.66); s2.rotation.y=Math.PI; f.g.add(s2); }
  // 射燈
  [12,-8].forEach(x=>{ const l=add(new THREE.BoxGeometry(1.6,0.7,0.9),M(0x8c9196),f.g,x,H+0.9,15.4,false); l.rotation.x=0.5; add(new THREE.BoxGeometry(1.3,0.45,0.05),M(0xfff6d0,{e:0x666655}),f.g,x,H+0.75,14.95,false); });
  // 門口盆栽
  for(let k=0;k<4;k++){ add(new THREE.CylinderGeometry(0.9,0.7,0.8,10),M(0xd8cfc2),f.g,-24+k*1.9,0.75,10,false); add(new THREE.SphereGeometry(1.1,8,6),M(0x4f9a45),f.g,-24+k*1.9,1.9,10,false); }
  markSeg(f.L(-21,10),f.L(-18.3,10),2.4,2);
  const face=Math.atan2(-f.nx,-f.nz);
  return {pos:f.L(BX,25),a:face,face,f}; }   // 開波時喺車房入面，車頭向住馬路
{ const f=placeLM(...RP(-450,505),56,40,r=>r.name==='震寰路'); const D=buildDepot(f,'屯 門 救 護 站','TUEN MUN AMBULANCE DEPOT','NO. 1 TSUN WEN ROAD','tm'); const face=D.face;
  LMK.parkedAmb=[[f.L(10,7),face],[f.L(21,7),face]];
  LMK.parkedAmb.forEach(([p])=>markSeg(p,p,6,2));
  LMK.depot={pos:D.pos,a:D.a};
  MAP.poi.depot=f.L(0,20);
  // 隔籬消防局
  const g=placeLM(...RP(-450,330),44,36,r=>r.name==='震寰路');
  const fm=texMat('fire',canvasTex(256,96,(g2,w,h)=>{ g2.fillStyle='#ffd9cf'; g2.fillRect(0,0,w,h); g2.fillStyle='#c1121f'; g2.fillRect(0,h-16,w,16); g2.fillStyle='#8fb8d8'; g2.fillRect(30,20,70,40); g2.fillRect(156,20,70,40); }));
  let c2=g.rq(-20,8,20,34); boxQ(c2,0.3,14,fm,M(0xc1121f),8,3); addBldQ(c2,14); c2=g.rq(12,22,20,32); boxQ(c2,14,30,fm,M(0xc1121f),8,3);
  for(let k=0;k<3;k++) add(new THREE.BoxGeometry(9,6.4,0.3),M(0xc1121f),g.g,-12+k*12,3.4,7.85,false);
  labelPlane('消防局',0,10.5,7.7,Math.PI,'#c1121f',14,g.g);
}
// 屯門站（杯渡路北面，河西）
{ const f=placeLM(...RP(-80,560),40,24,r=>r.name==='杯渡路');
  const sm=texMat('stn',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#cfe6f7'; g.fillRect(0,0,w,h); g.fillStyle='#2f8fd8'; g.fillRect(0,h-20,w,20); g.fillStyle='#9cc9e6'; g.fillRect(10,14,236,46); }));
  const c=f.rq(-19,3,19,22); boxQ(c,0.3,16,sm,M(0x2f8fd8),16,6); addBldQ(c,16,'station');
  boxQ(f.rq(-21,6,21,19),16,17.2,roofMat,M(0x2f8fd8));
  labelPlane('屯門站',0,11,2.9,Math.PI,'#2f8fd8',14,f.g);
  LMK.station={patient:f.L(-9,-2.2),stop:curbStop(f,-13)}; }
// 屯門市廣場（屯喜路同青山公路之間）
{ const f=placeLM(...RP(330,760),64,48,r=>r.name==='屯喜路');
  const gm=texMat('plz',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#ffd6a5'; g.fillRect(0,0,w,h); g.fillStyle='#8ecae6'; g.fillRect(0,20,w,64); g.fillStyle='rgba(255,255,255,.45)'; for(let k=0;k<8;k++) g.fillRect(k*32,20,3,64); }));
  let c=f.rq(-30,6,30,46); boxQ(c,0.3,14,gm,M(0xffb366),24,7); addBldQ(c,14,'plaza');
  boxQ(f.rq(-26,12,4,40),14,24,gm,roofMat,24,7); boxQ(f.rq(10,14,26,30),14,44,pick(housingMats),roofMat,8,3);
  labelPlane('屯門市廣場',-12,10.5,5.9,Math.PI,'#f08c2e',24,f.g);
  for(let k=0;k<5;k++) add(new THREE.BoxGeometry(2,5,0.2),M([0xff6b6b,0x4ecdc4,0xffe66d,0x5f27cd][k%4]),f.g,6+k*5,9,5.6,false);
  LMK.plaza={patient:f.L(-12,-2.2),stop:curbStop(f,-4)}; MAP.poi.plaza=f.L(0,24); }
// 屯門大會堂（鄉事會路同屯喜路之間）
{ const f=placeLM(...RP(120,930),48,40,r=>r.name==='屯盛街');
  const tm=texMat('th',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#fff3c4'; g.fillRect(0,0,w,h); g.fillStyle='#d9a400'; for(let k=0;k<6;k++) g.fillRect(k*44+12,10,10,h-20); }));
  const c=f.rq(-22,12,22,38); boxQ(c,0.3,12,tm,M(0xe9c46a),20,8); addBldQ(c,12,'townhall');
  add(new THREE.CylinderGeometry(12,15,6,6),M(0xe9c46a),f.g,0,15,25,true);
  add(new THREE.CylinderGeometry(4,4.4,0.8,24),M(0xb8c4cf),f.g,14,0.7,5,false); add(new THREE.CylinderGeometry(3.4,3.4,0.2,24),M(0x7ec8f0,{e:0x113344}),f.g,14,1.15,5,false); markSeg(f.L(14,5),f.L(14,5),9,2);
  labelPlane('屯門大會堂',-4,9,11.9,Math.PI,'#d9a400',20,f.g);
  LMK.townhall={patient:f.L(-6,-2.2),stop:curbStop(f,2)}; MAP.poi.townhall=f.L(0,24); }
// 屯門公園（鄉事會路西面，有湖）
{ const f=placeLM(...RP(-60,880),56,30,r=>r.t==='avenue');
  boxQ(f.rq(-28,0,28,30),0,0.34,grassMat,grassMat);
  const pav=new THREE.Group(); pav.position.set(14,0.3,16); f.g.add(pav);
  [[-3,-3],[3,-3],[-3,3],[3,3]].forEach(([a,b])=>add(new THREE.CylinderGeometry(0.3,0.3,4,8),M(0xc1121f),pav,a,2,b));
  add(new THREE.ConeGeometry(6,3,4),M(0x2a9d8f),pav,0,5.4,0).rotation.y=Math.PI/4; markSeg(f.L(14,16),f.L(14,16),9,2);
  add(new THREE.BoxGeometry(6,0.3,2),M(0xffd166),f.g,-14,1.6,14,true); add(new THREE.BoxGeometry(0.4,3,0.4),M(0xff6b6b),f.g,-17,1.5,14,true);
  labelPlane('屯門公園',0,4,0.6,Math.PI,'#46a35e',14,f.g);
  LMK.park={patient:f.L(-4,-2.2),stop:curbStop(f,-10)}; MAP.poi.park=f.L(0,15);
  // 湖邊草地
  const L=LAKE; let cx=0,cz=0; L.forEach(([x,z])=>{cx+=x;cz+=z;}); cx/=L.length; cz/=L.length; const gr=[]; disc(gr,[cx,cz],34,24); flat(gr,M(0x9fd77c,{r:0.95}),0.05);
  for(let k=0;k<24;k++){ const a=rnd()*6.28, r=24+rnd()*12; const x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r; if(!(cellAt(x,z)&(1|4|16))){ props.tree.push([x,z,0,0.05]); } }
  for(let z=cz-36;z<=cz+36;z+=CELL) for(let x=cx-36;x<=cx+36;x+=CELL) if(Math.hypot(x-cx,z-cz)<34){ const k=gi(x,z); if(k>=0&&!(grid[k]&(1|16))) grid[k]|=8; }
  MAP.parks.push(f.rq(-28,0,28,30)); }
// 屯門街市（新墟）同學校
{ const f=placeLM(...RP(200,-180),40,28,r=>r.name==='新墟路');
  const c=f.rq(-20,2,20,26); boxQ(c,0.3,10,texMat('mk',shopTex()),M(0x6ab04c),24,4.5); addBldQ(c,10);
  labelPlane('屯門街市',0,8,1.9,Math.PI,'#2b9348',16,f.g);
  LMK.market={patient:f.L(-9,-2.2),stop:curbStop(f,-13)}; }
[[-330,-330,'震寰路'],[150,1000,'屯興路']].forEach(([x,z,nm])=>{ const f=placeLM(...RP(x,z),50,36,r=>r.name===nm);
  boxQ(f.rq(-23,4,4,32),0,0.4,M(0xe9824c),M(0xe9824c));
  const c=f.rq(8,4,24,34); boxQ(c,0.3,16,texMat('sch',housingTex('#dff3c8','#2a9d8f',1)),M(0x2a9d8f),8,3); addBldQ(c,16);
  labelPlane('小學',16,12,3.8,Math.PI,'#2a9d8f',10,f.g); });

/* ---------- 元朗區（簡化）：救護站、博愛醫院（上面）、YOHO Mall＋元朗站、元朗公園、元朗劇院 ---------- */
{ const f=placeLM(...RP(1440,-1590),56,40,r=>r.name==='擊壤路'); const D=buildDepot(f,'元 朗 救 護 站','YUEN LONG AMBULANCE DEPOT','YUEN LONG','yl');
  LMK.depotYL={pos:D.pos,a:D.a}; MAP.poi.depotYL=f.L(0,20); }
// YOHO Mall（形點）：玻璃幕牆商場＋上面住宅
{ const f=placeLM(...RP(1520,-2000),60,44,r=>r.name==='朗日路');
  const gm=texMat('yoho',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#e9eef2'; g.fillRect(0,0,w,h); g.fillStyle='#7fb7d9'; g.fillRect(0,14,w,80); g.fillStyle='rgba(255,255,255,.5)'; for(let k=0;k<10;k++) g.fillRect(k*26,14,3,80); g.fillStyle='#e4572e'; g.fillRect(0,100,w,10); }));
  let c=f.rq(-29,6,29,42); boxQ(c,0.3,15,gm,M(0xd9dee3),24,7); addBldQ(c,15,'plaza');
  [[-20,14],[2,14]].forEach(([x,z])=>{ const q=f.rq(x,z+6,x+16,z+22); boxQ(q,15,58,pick(housingMats),roofMat,8,3); });
  labelPlane('YOHO MALL 形點',-6,10.5,5.9,Math.PI,'#e4572e',26,f.g);
  LMK.yoho={patient:f.L(-12,-2.2),stop:curbStop(f,-4)}; MAP.poi.yoho=f.L(0,24); }
// 元朗站（屯馬綫）
{ const f=placeLM(...RP(1300,-2000),40,26,r=>r.name==='朗日路');
  const sm=texMat('ylstn',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#efe3dc'; g.fillRect(0,0,w,h); g.fillStyle='#9a3b26'; g.fillRect(0,h-20,w,20); g.fillStyle='#b9c9d6'; g.fillRect(10,14,236,46); }));
  const c=f.rq(-19,3,19,24); boxQ(c,0.3,13,sm,M(0x9a3b26),16,6); addBldQ(c,13,'station');
  boxQ(f.rq(-21,5,21,22),13,14.4,roofMat,M(0x9a3b26));
  labelPlane('元朗站',0,9.5,2.9,Math.PI,'#9a3b26',14,f.g);
  LMK.ylstation={patient:f.L(-9,-2.2),stop:curbStop(f,-13)}; }
// 元朗公園（寶塔）
{ const f=placeLM(...RP(1540,-1400),60,40,r=>r.name==='體育路');
  boxQ(f.rq(-30,0,30,40),0,0.34,grassMat,grassMat);
  const pg=new THREE.Group(); pg.position.set(12,0.3,24); f.g.add(pg);   // 七層寶塔
  for(let i=0;i<7;i++){ const r=4.2-i*0.45, y=i*3.0; add(new THREE.CylinderGeometry(r*0.78,r*0.82,2.4,8),M(0xf3e7c9),pg,0,y+1.2,0); add(new THREE.CylinderGeometry(r*0.55,r*1.12,0.8,8),M(0x2f7d5b),pg,0,y+2.7,0); }
  add(new THREE.ConeGeometry(0.9,2.4,8),M(0xd4a017),pg,0,22.6,0); markSeg(f.L(12,24),f.L(12,24),11,2);
  for(let k=0;k<10;k++){ const x=-26+(k%5)*7, z=10+(k>4?14:0); props.tree.push([...f.L(x,z),0,0.05]); }
  add(new THREE.BoxGeometry(6,0.3,2),M(0xffd166),f.g,-12,1.6,6,true);
  labelPlane('元朗公園',-6,4,0.6,Math.PI,'#46a35e',14,f.g);
  LMK.ylpark={patient:f.L(-6,-2.2),stop:curbStop(f,-10)}; MAP.poi.ylpark=f.L(0,18); MAP.parks.push(f.rq(-30,0,30,40)); }
// 元朗劇院（紅磚外牆、大斜頂）
{ const f=placeLM(...RP(1830,-1400),48,38,r=>r.name==='體育路');
  const tm=texMat('ylth',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#b5523b'; g.fillRect(0,0,w,h); g.fillStyle='rgba(0,0,0,.12)'; for(let y=0;y<h;y+=8) g.fillRect(0,y,w,2); g.fillStyle='#f1e3c8'; g.fillRect(0,h-26,w,26); g.fillStyle='#3c4656'; g.fillRect(90,h-56,76,30); }));
  const c=f.rq(-22,8,22,34); boxQ(c,0.3,14,tm,M(0x8f3d2c),20,8); addBldQ(c,14,'townhall');
  const rf=add(new THREE.CylinderGeometry(0.1,17,8,4),M(0x8f3d2c),f.g,0,18,21,true); rf.rotation.y=Math.PI/4; rf.scale.set(1.3,1,0.75);
  add(new THREE.BoxGeometry(20,0.5,6),M(0xf1e3c8),f.g,0,6,6,true); [-9,9].forEach(x=>add(new THREE.CylinderGeometry(0.4,0.4,5.6,8),M(0xf1e3c8),f.g,x,3,4,true));
  // 搭棚（劇院翻新）：竹棚＋綠色防護網，創傷分流關嘅出事地點
  const sc=new THREE.Group(); sc.position.set(-16,0.3,8); f.g.add(sc); for(let i=0;i<4;i++) for(let j=0;j<5;j++){ add(new THREE.BoxGeometry(0.15,0.15,10),M(0xc8a165),sc,0,j*3+0.5,-3+i*0.05,false).rotation.y=Math.PI/2; }
  for(let i=0;i<5;i++) add(new THREE.CylinderGeometry(0.08,0.08,14,5),M(0xc8a165),sc,-4+i*2,7,-3,false);
  const net=new THREE.Mesh(new THREE.PlaneGeometry(10,13),new THREE.MeshStandardMaterial({color:0x2e8b57,transparent:true,opacity:0.55,side:THREE.DoubleSide})); net.position.set(0,7,-3.3); sc.add(net);
  labelPlane('元朗劇院',2,9,2.8,Math.PI,'#8f3d2c',16,f.g);
  LMK.yltheatre={patient:f.L(-12,-2.2),stop:curbStop(f,-8)}; MAP.poi.yltheatre=f.L(0,24); }

/* ---------- 一般樓宇：沿街＋內街 ---------- */
const zoneOf=(x,z)=>x>20&&z<60?'old':(x>-10&&z>140?'centre':'res');
const ZMIX={old:['tong','tong','tong','shops','tong','estate'],centre:['tong','shops','estate','tong','shops','estate'],res:['estate','estate','tong','shops','estate','tong']};
function buildTong(c,front,nx,nz){ const h=13+rnd()*13; boxQ(c,0.3,4.8,pick(shopMats),roofMat,24,4.5,rnd()*4|0);
  const ci=c.map(([x,z])=>{ const cx=(c[0][0]+c[2][0])/2, cz=(c[0][1]+c[2][1])/2; return [x+(cx-x)*0.04,z+(cz-z)*0.04]; });
  boxQ(ci,4.8,h,pick(tongMats),roofMat,8.5,3); addBldQ(c,h);
  if(rnd()<0.7) signs.push({x:front[0]-nx*1.3,z:front[1]-nz*1.3,y:6.5+rnd()*5,a:Math.atan2(-nx,-nz)}); }
function buildShops(c){ boxQ(c,0.3,4.8,pick(shopMats),roofMat,24,4.5); boxQ(c,4.8,10,pick(tongMats),roofMat,8.5,3); addBldQ(c,10); }
function buildEstate(L,w,d){ const pod=4.8; let c=[L(0,0),L(w,0),L(w,d),L(0,d)]; boxQ(c,0.3,pod,pick(shopMats),podMat,24,4.5); addBldQ(c,pod);
  const hm=pick(housingMats); let top=pod; const n=w>30?2:1;
  for(let k=0;k<n;k++){ const tw=14, td=Math.min(14,d-6); const cx=n===1?w/2:(k?w-tw/2-3:tw/2+3); const h=pod+18+rnd()*16; top=Math.max(top,h);
    boxQ([L(cx-tw/2,d/2-td/2),L(cx+tw/2,d/2-td/2),L(cx+tw/2,d/2+td/2),L(cx-tw/2,d/2+td/2)],pod,h,hm,roofMat,8,3); }
  MAP.blds[MAP.blds.length-1].h=top; }
// 沿街
MAP.roads.forEach(r=>{ if(r.bridge||r.name==='元朗公路') return; const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,Lr]=dirn(A,B);
  [1,-1].forEach(side=>{ const nx=uz*side, nz=-ux*side; const off=r.w/2+5.2;
    let s=(DEG[a]>=2?NW[a]+5:2); const s1=Lr-(DEG[b]>=2?NW[b]+5:2);
    // 沿住路邊每隔一段放樹／街燈
    for(let q=s+3;q<s1-2;q+=11){ const x=A[0]+ux*q+nx*(r.w/2+1.4), z=A[1]+uz*q+nz*(r.w/2+1.4); ((q/11|0)%2?props.tree:props.lamp).push([x,z,Math.atan2(-nx,-nz),0.1]); }
    while(s<s1-6){ const x=A[0]+ux*s, z=A[1]+uz*s; const zn=zoneOf(x,z); let type=pick(ZMIX[zn]);
      let bw=type==='estate'?34+rnd()*8:type==='shops'?16+rnd()*8:9+rnd()*5, bd=type==='estate'?26:type==='shops'?12:13;
      if(s+bw>s1){ if(type==='estate'){ type='tong'; bw=9+rnd()*5; bd=13; } if(s+bw>s1) bw=s1-s; if(bw<7) break; }
      const L=(lx,lz)=>[x+ux*lx+nx*(off+lz),z+uz*lx+nz*(off+lz)];
      const c=[L(0,0),L(bw,0),L(bw,bd),L(0,bd)];
      if(quadFree(c,0.5)){ boxQ([L(0,-1.8),L(bw,-1.8),L(bw,0.2),L(0,0.2)],0,0.11,walkMat,walkMat); if(type==='tong') buildTong(c,L(bw/2,0),nx,nz); else if(type==='shops') buildShops(c); else buildEstate(L,bw,bd); s+=bw+0.3; }
      else s+=3; } }); });
const VCOL=['#fff1d6','#e8f4ff','#ffe3e3','#e9f7df','#f3e8ff'];
const villageMats=VCOL.map((w,k)=>texMat('v'+k,canvasTex(128,96,(g,W,H)=>{ g.fillStyle=w; g.fillRect(0,0,W,H); g.fillStyle='#8fb8d8'; g.fillRect(20,24,34,30); g.fillRect(74,24,34,30); g.fillStyle='#c9b8a6'; g.fillRect(0,H-6,W,6); g.fillStyle='rgba(0,0,0,.15)'; g.fillRect(20,52,34,4); g.fillRect(74,52,34,4); })));
// 郊區山丘（元朗公路兩邊）：高架附近唔起樓，改為一層層山
function hwDist(x,z){ const T=HW; let best=1e9; for(let i=1;i<T.pts.length;i++){ const A=T.pts[i-1],B=T.pts[i], dx=B[0]-A[0], dz=B[1]-A[1], L2=dx*dx+dz*dz||1; let t=((x-A[0])*dx+(z-A[1])*dz)/L2; t=t<0?0:t>1?1:t; best=Math.min(best,Math.hypot(x-A[0]-dx*t,z-A[1]-dz*t)); } return best; }
const nearHW=(x,z)=>rural(x,z)&&hwDist(x,z)<175;
{ const hm=[M(0x7fb069,{r:0.95}),M(0x6a9f58,{r:0.95}),M(0x8cbf73,{r:0.95}),M(0x5d8f4e,{r:0.95})];
  const tryHill=(x,z,r,h)=>{ if(!rural(x,z)) return; for(let a=0;a<6.28;a+=0.45) for(const q of [0.3,0.65,1]) if(cellAt(x+Math.cos(a)*r*q,z+Math.sin(a)*r*q)&(1|4|8|16)) return;
    hillQ(x,z,r,h,r*(0.75+rnd()*0.5),rnd()*6,pick(hm));
    for(let zz=z-r;zz<=z+r;zz+=CELL) for(let xx=x-r;xx<=x+r;xx+=CELL) if(Math.hypot(xx-x,zz-z)<r*0.95){ const q=gi(xx,zz); if(q>=0) grid[q]|=2|8; }
    for(let t=0;t<3;t++){ const a=rnd()*6.28, d=r*(0.15+rnd()*0.4); props.tree.push([x+Math.cos(a)*d,z+Math.sin(a)*d,0,h*0.75]); } };
  for(let s=10;s<HW.L;s+=16) for(const sd of [-1,1]) for(const [o0,o1,r0,r1,h0,h1] of [[30,60,12,20,7,14],[70,120,20,32,14,26],[130,175,28,42,22,40]]){
    const k=Math.max(1,Math.min(HW.pts.length-1,HW.cum.findIndex(c=>c>=s))); const A=HW.pts[k-1],B=HW.pts[k]; const [ux,uz]=dirn(A,B); const nx=uz*sd, nz=-ux*sd;
    const off=o0+rnd()*(o1-o0), x=A[0]+ux*(rnd()-0.5)*14+nx*off, z=A[1]+uz*(rnd()-0.5)*14+nz*off; tryHill(x,z,r0+rnd()*(r1-r0),h0+rnd()*(h1-h0)); } }
// 內街空地：補屋邨高樓或小公園（郊區就用低層建築、停車場、草地）
for(let z=BZ0+20;z<BZ1-20;z+=20) for(let x=BX0+20;x<BX1-20;x+=20){
  const E=nearestEdge(x,z); const ang=Math.atan2(E.nx,E.nz); const ux=Math.cos(ang), uz=-Math.sin(ang), nx=E.nx, nz=E.nz;
  const L=(lx,lz)=>[x+ux*lx+nx*lz,z+uz*lx+nz*lz];
  const c=[L(-11,-9),L(11,-9),L(11,9),L(-11,9)]; if(!quadFree(c,3)) continue; const rur=rural(x,z), q=rnd();
  if(nearHW(x,z)){ if(rnd()<0.3) props.tree.push([x+(rnd()-0.5)*16,z+(rnd()-0.5)*14,0,0]); continue; }
  if(rur&&q<0.25){ const h=8+rnd()*8; const cc=[L(-9,-7),L(9,-7),L(9,7),L(-9,7)]; boxQ(cc,0,h,pick(villageMats),roofMat,8,3); addBldQ(cc,h); boxQ(c,0,0.25,podMat,podMat); markQuad(c,8); }
  else if(rur&&q>0.6){ boxQ(c,0,0.25,grassMat,grassMat); markQuad(c,8); for(let k=0;k<3;k++) props.tree.push([x+(rnd()-0.5)*18,z+(rnd()-0.5)*14,0,0.25]); }
  else if(!rur&&rnd()<0.75){ const h=26+rnd()*20; boxQ([L(-8,-7),L(8,-7),L(8,7),L(-8,7)],0,h,pick(housingMats),roofMat,8,3); addBldQ([L(-8,-7),L(8,-7),L(8,7),L(-8,7)],h);
    boxQ(c,0,0.25,podMat,podMat); markQuad(c,8); }
  else if(rur||rnd()<0.5){ boxQ(c,0,0.25,M(0x8a919c,{r:0.9}),M(0x8a919c,{r:0.9})); markQuad(c,8); // 停車場
    for(let k=0;k<4;k++) for(const r of [-1,1]){ const p=L(-7.5+k*5,r*4.5); parked.push([p[0],p[1],Math.atan2(nx*r,nz*r)]); markSeg(p,p,4,2); } }
  else { boxQ(c,0,0.25,grassMat,grassMat); markQuad(c,8); for(let k=0;k<4;k++) props.tree.push([x+(rnd()-0.5)*18,z+(rnd()-0.5)*14,0,0.25]); } }
// 再細啲嘅空位：村屋／低層樓

for(let z=BZ0+10;z<BZ1-10;z+=11) for(let x=BX0+10;x<BX1-10;x+=11){
  const xx=x+(rnd()-0.5)*4, zz=z+(rnd()-0.5)*4; const E=nearestEdge(xx,zz); const ux=E.nz, uz=-E.nx;
  const w=7+rnd()*3, d=7+rnd()*3; const L=(lx,lz)=>[xx+ux*lx+E.nx*lz,zz+uz*lx+E.nz*lz]; const c=[L(-w/2,-d/2),L(w/2,-d/2),L(w/2,d/2),L(-w/2,d/2)];
  if(!quadFree(c,1.5)||nearHW(xx,zz)) continue; const h=6+(rnd()*3|0)*3; boxQ(c,0,h,pick(villageMats),roofMat,8,3); addBldQ(c,h); }
// 剩低嘅草地：散樹
for(let k=0;k<500;k++){ const x=BX0+rnd()*(BX1-BX0), z=BZ0+rnd()*(BZ1-BZ0); if(!cellAt(x,z)&&!cellAt(x+3,z)&&!cellAt(x-3,z)) props.tree.push([x,z,0,0]); }
flushBuckets();

/* ---------- 遠景：外圍樓群、海、山 ---------- */
function farScene(){
  const ring=(d0,d1,hmin,hmax,step,mats)=>{ for(let side=0;side<4;side++){ if(side===1) continue; const horiz=side<2; const a0=horiz?BX0-d1:BZ0-d1, a1=horiz?BX1+d1:BZ1+20;
      for(let a=a0;a<a1;a+=step*(0.8+rnd()*0.6)){ const w=step*(0.55+rnd()*0.3), dd=d0+rnd()*(d1-d0-w), h=hmin+rnd()*(hmax-hmin);
        let x0,z0; if(horiz){ x0=a; z0=BZ0-dd-w; } else { z0=a; x0=side===2?BX0-dd-w:BX1+dd; }
        boxQ(rectQ(x0,z0,x0+w,z0+w),0,h,pick(mats),roofMat,8,3); } } };
  ring(14,44,8,22,26,[...tongMats,...shopMats]); ring(60,150,30,60,30,housingMats); flushBuckets();
  // 南面：青山灣（海）、沙灘、船
  const sea=add(new THREE.PlaneGeometry(2600,1000),new THREE.MeshStandardMaterial({color:0x5fb8e6,roughness:0.3}),scene,(BX0+BX1)/2,0.02,BZ1+560,false); sea.rotation.x=-Math.PI/2;
  const sand=add(new THREE.PlaneGeometry(2600,40),M(0xf3e2b3,{r:1}),scene,(BX0+BX1)/2,0.04,BZ1+40,false); sand.rotation.x=-Math.PI/2;
  for(let k=0;k<7;k++){ const b=new THREE.Group(); b.position.set(BX0-200+k*130,0.4,BZ1+160+rnd()*260); scene.add(b);
    add(new THREE.BoxGeometry(4,1.4,12),M(0xffffff),b,0,0.5,0,false); add(new THREE.BoxGeometry(3,2,4),M([0xe63946,0x457b9d,0xf4a261][k%3]),b,0,2,1,false); b.rotation.y=rnd()*3; }
  const mt=(x,z,r,h,col)=>{ const g=new THREE.ConeGeometry(r*1.3,h*0.75,9,3); const pa=g.attributes.position; for(let q=0;q<pa.count;q++){ const y=pa.getY(q); if(y>-h*0.37&&y<h*0.37){ pa.setX(q,pa.getX(q)*(1.15+rnd()*0.2)); pa.setZ(q,pa.getZ(q)*(1.15+rnd()*0.2)); } } g.computeVertexNormals(); const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:col,flatShading:true,fog:false})); m.position.set(x,h/2-2,z); m.rotation.y=rnd()*3; scene.add(m); };
  const cols=[0x6fae84,0x7dba8c,0x5f9f78,0x86bf96];
  for(let k=0;k<11;k++) mt(BX0-420-rnd()*260, BZ0+k*150-150, 140+rnd()*90, 150+rnd()*170, pick(cols)); // 西：青山
  for(let k=0;k<9;k++) mt(BX0-200+k*150, BZ0-480-rnd()*240, 150+rnd()*90, 120+rnd()*160, pick(cols)); // 北
  for(let k=0;k<11;k++) mt(BX1+440+rnd()*260, BZ0+k*150-120, 140+rnd()*90, 130+rnd()*170, pick(cols)); // 東：九逕山
  mt(BX0-520,BZ0+700,260,380,0x5f9f78); // 青山主峰
  const hedge=[]; for(let x=BX0;x<=BX1;x+=6){ hedge.push([x,BZ0-3,0,0],[x,BZ1+3,0,0]); } for(let z=BZ0;z<=BZ1;z+=6){ hedge.push([BX0-3,z,0,0],[BX1+3,z,0,0]); }
  props.tree.push(...hedge.filter(([x,z])=>!(cellAt(x,z)&1)&&!(cellAt(x+4,z)&1)&&!(cellAt(x-4,z)&1)&&!(cellAt(x,z+4)&1)&&!(cellAt(x,z-4)&1)));
}
farScene(); flushBuckets();

/* ---------- 清走壓住馬路嘅街道物件（樹、街燈） ---------- */
const offRoad=(x,z,r)=>{ for(const [dx,dz] of [[0,0],[r,0],[-r,0],[0,r],[0,-r]]) if(cellAt(x+dx,z+dz)&1) return false; return true; };
props.tree=props.tree.filter(([x,z])=>offRoad(x,z,1.6)&&ELEV(x,z,15)<0.2); props.lamp=props.lamp.filter(([x,z])=>offRoad(x,z,0.8)&&ELEV(x,z,15)<0.2);
/* ---------- 街道物件 ---------- */
// 分區 instancing：每 200 米一格，各自有包圍球，鏡頭睇唔到嘅格就唔畫
const INSTC=[]; // 分區 instancing 清單（遠距離唔畫）
function instanced(geo,mat,list,place,cast=true,far=320){ if(!list.length) return; const groups=new Map();
  list.forEach(it=>{ const k=Math.floor(it[0]/CHUNK)+','+Math.floor(it[1]/CHUNK); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(it); });
  if(!geo.boundingSphere) geo.computeBoundingSphere(); const gr=geo.boundingSphere.radius+geo.boundingSphere.center.length();
  groups.forEach(items=>{ const g=geo.clone(); const m=new THREE.InstancedMesh(g,mat,items.length); const o=new THREE.Object3D(); const bb=new THREE.Box3();
    items.forEach((it,k)=>{ o.position.set(0,0,0); o.rotation.set(0,0,0); o.scale.set(1,1,1); place(o,it); o.updateMatrix(); m.setMatrixAt(k,o.matrix); bb.expandByPoint(o.position); });
    const sp=new THREE.Sphere(); bb.getBoundingSphere(sp); sp.radius+=gr*2; g.boundingSphere=sp;   // 用成格嘅包圍球做 culling
    m.castShadow=cast; m.receiveShadow=true; m.matrixAutoUpdate=false; scene.add(m); INSTC.push({m,c:sp.center,r:sp.radius,far}); }); }
const tl=props.tree.filter(([x,z])=>offRoad(x,z,1.6));
instanced(new THREE.CylinderGeometry(0.25,0.35,2.2,5,1,true),M(C.trunk),tl,(o,[x,z,,y=0.3])=>o.position.set(x,y+1.1,z),false);
instanced(new THREE.IcosahedronGeometry(1.9,0),M(C.tree,{r:0.9}),tl,(o,[x,z,,y=0.3])=>{o.position.set(x,y+3.2,z);o.scale.setScalar(0.85+((Math.abs(x*13+z*7))%10)/25);});
instanced(new THREE.CylinderGeometry(0.12,0.16,6,6),M(0x6b7380),props.lamp,(o,[x,z])=>o.position.set(x,3.2,z),false);
instanced(new THREE.BoxGeometry(0.5,0.3,1.8),M(0xfff6c4,{e:0x555533}),props.lamp,(o,[x,z,a])=>{o.position.set(x+Math.sin(a)*0.8,6.1,z+Math.cos(a)*0.8);o.rotation.y=a;},false);
{ const NEON=['酒家','冰室','藥房','金行','茶樓','涼茶','麵家','眼鏡','押','海鮮'];
  const mats=NEON.map((t,k)=>new THREE.MeshBasicMaterial({map:canvasTex(64,192,(g,w,h)=>{ const col=['#ff3d7f','#3dd6ff','#ffd23f','#7dff6a','#ff8c42'][k%5];
    g.fillStyle='#22252b'; rr(g,2,2,60,188,10); g.fill(); g.strokeStyle=col; g.lineWidth=5; rr(g,6,6,52,180,8); g.stroke();
    g.fillStyle=col; g.font='bold 40px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; const ch=[...t]; ch.forEach((c,q)=>g.fillText(c,32,96+(q-(ch.length-1)/2)*50)); },false)}));
  const geo=new THREE.PlaneGeometry(1.6,4.8);
  signs.forEach(s=>{ const mt=pick(mats); [1,-1].forEach(k=>{ const m=new THREE.Mesh(geo,mt); m.position.set(s.x,s.y,s.z); m.rotation.y=s.a+k*Math.PI/2; scene.add(m); }); }); }
const CLOUDMAT=new THREE.MeshBasicMaterial({color:0xffffff});
{ const cm=CLOUDMAT, cg=new THREE.SphereGeometry(1,10,8);
  for(let k=0;k<16;k++){ const g=new THREE.Group(); g.position.set(BX0+rnd()*(BX1-BX0),75+rnd()*30,BZ0+rnd()*(BZ1-BZ0)); scene.add(g);
    for(let q=0;q<4;q++){ const m=new THREE.Mesh(cg,cm); m.scale.setScalar(5+rnd()*4); m.position.set(q*6-9,rnd()*2,rnd()*4); g.add(m); } } }

/* ---------- 導航 ---------- */
function nearestNode(x,z){ let best=-1,bd=1e18; for(let i=0;i<NODES.length;i++){ if(!ADJ[i].length) continue; const d=(NODES[i][0]-x)**2+(NODES[i][1]-z)**2; if(d<bd){bd=d;best=i;} } return best; }
function route(from,to,ban){
  const n=NODES.length, dist=new Float64Array(n).fill(Infinity), prev=new Int32Array(n).fill(-1); const open=new Set([from]); dist[from]=0;
  while(open.size){ let u=-1,bd=Infinity; open.forEach(v=>{ if(dist[v]<bd){bd=dist[v];u=v;} }); open.delete(u); if(u===to) break;
    for(const [v,w] of ADJ[u]){ if(ban&&ban.some(e=>e.includes(u)&&e.includes(v))) continue; const nd=dist[u]+w; if(nd<dist[v]){dist[v]=nd;prev[v]=u;open.add(v);} } }
  if(!isFinite(dist[to])) return null; const path=[]; for(let u=to;u!==-1;u=prev[u]) path.push(u); path.reverse(); return {path,len:dist[to]}; }

/* ---------- 紅綠燈：每個路口分兩組方向輪流綠燈 ---------- */
const sigOff=NODES.map((n,k)=>((k*7)%9)*2.4);
const CYCLE=22;
const groupOf=(k,ang)=>Math.abs(Math.cos(ang-REF[k]))>0.707?0:1;
function lightState(k,ang,t){ if(!SIGNAL[k]) return 'g'; const ph=((t+sigOff[k])%CYCLE+CYCLE)%CYCLE;
  if(groupOf(k,ang)===0) return ph<8?'g':ph<10.5?'y':'r'; return ph<11?'r':ph<19?'g':ph<21.5?'y':'r'; }
const SIGS=[];
NODES.forEach((N,k)=>{ if(!SIGNAL[k]) return;
  ADJ[k].forEach(([o,,r])=>{ const O=NODES[o]; const [dx,dz]=dirn(O,N); // 車由 O 駛向 N
    const x=N[0]-dx*(CLR[k]+1.8)+dz*(r.w/2+1.3), z=N[1]-dz*(CLR[k]+1.8)-dx*(r.w/2+1.3);
    if(offRoad(x,z,0.6)) SIGS.push({k,ang:Math.atan2(dx,dz),x,z,fx:-dx,fz:-dz,a:Math.atan2(-dx,-dz)}); }); });
instanced(new THREE.CylinderGeometry(0.13,0.13,4.6,6),M(0x2b2d33),SIGS,(o,s)=>o.position.set(s.x,2.6,s.z),false);
instanced(new THREE.BoxGeometry(1.0,2.6,0.6),M(0x2b2d33),SIGS,(o,s)=>{o.position.set(s.x,5.2,s.z);o.rotation.y=s.a;},true);
const lampGeo=new THREE.SphereGeometry(0.36,12,8);
const LAMP=['r','y','g'].map((c,q)=>{ const m=new THREE.InstancedMesh(lampGeo,new THREE.MeshBasicMaterial({color:0xffffff}),SIGS.length); const o=new THREE.Object3D();
  SIGS.forEach((s,n)=>{ o.position.set(s.x+s.fx*0.3,6.0-q*0.8,s.z+s.fz*0.3); o.updateMatrix(); m.setMatrixAt(n,o.matrix); m.setColorAt(n,new THREE.Color(0x333333)); });
  scene.add(m); return m; });
const LCOL={r:new THREE.Color(0xff2a2a),y:new THREE.Color(0xffc21a),g:new THREE.Color(0x22e06a)}, LOFF=new THREE.Color(0x3a3d44);
function updateLights(t){ SIGS.forEach((s,n)=>{ const st=lightState(s.k,s.ang,t); ['r','y','g'].forEach((c,q)=>LAMP[q].setColorAt(n,st===c?LCOL[c]:LOFF)); }); LAMP.forEach(m=>m.instanceColor.needsUpdate=true); }

/* ---------- 輕鐵路線：屯門鄉事會路、元朗大馬路 ---------- */
function tramLine(start){ const seq=[start]; let cur=start, prev=-1;
  for(;;){ const nx=ADJ[cur].find(([o,,r])=>r.t==='avenue'&&o!==prev); if(!nx) break; prev=cur; cur=nx[0]; seq.push(cur); }
  const pts=seq.map(k=>NODES[k]); const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  return {seq,pts,cum,len:cum[cum.length-1]}; }
const TRAM=tramLine(LAY.J.N0), TRAM2=tramLine(LAY.J.YW), TRAMS=[TRAM,TRAM2];
function tramAt(s,T=TRAM){ s=Math.max(0,Math.min(T.len-0.01,s)); let i=1; while(i<T.cum.length-1&&T.cum[i]<s) i++;
  const A=T.pts[i-1],B=T.pts[i], k=(s-T.cum[i-1])/(T.cum[i]-T.cum[i-1]||1); return {x:A[0]+(B[0]-A[0])*k,z:A[1]+(B[1]-A[1])*k,a:Math.atan2(B[0]-A[0],B[1]-A[1]),i}; }
// 輕鐵站：揀一段直路中間，離所有路口（連斑馬線）至少 22+路口半徑+8 米，唔會阻住橫過嘅馬路
function lrtStop(T){ let best=T.len/2,bs=-1e9; for(let s=24;s<T.len-24;s+=2){ let m=1e9;
    T.seq.forEach((k,i)=>{ if(DEG[k]>=3) m=Math.min(m,Math.abs(T.cum[i]-s)-CLR[k]-8); });
    const a0=tramAt(s-20,T).a, a1=tramAt(s+20,T).a; const bend=Math.abs(Math.sin(a1-a0));
    const score=m-bend*80-Math.abs(s-T.len*0.45)*0.05; if(m>=22&&score>bs){ bs=score; best=s; } } return best; }
TRAM.lrt=LMK.lrt=lrtStop(TRAM); TRAM2.lrt=lrtStop(TRAM2);
[[TRAM,'輕鐵 屯門站'],[TRAM2,'輕鐵 元朗站']].forEach(([T,nm])=>{ const p=tramAt(T.lrt,T); const g=new THREE.Group(); g.position.set(p.x,0,p.z); g.rotation.y=p.a; scene.add(g);
  add(new THREE.BoxGeometry(3.2,0.9,40),M(0xd5d9de),g,0,0.6,0,false); add(new THREE.BoxGeometry(3.6,0.3,40),M(0xf2a65a),g,0,4.2,0,true);
  [-18,0,18].forEach(o=>add(new THREE.BoxGeometry(0.3,3.4,0.3),M(0x9aa1aa),g,0,2.5,o,false));
  labelPlane(nm,0,4.9,0,Math.PI/2,'#f08c2e',9,g); labelPlane(nm,0,4.9,0,-Math.PI/2,'#f08c2e',9,g);
  for(let s=-20;s<=20;s+=2){ const q=tramAt(T.lrt+s,T); markSeg([q.x,q.z],[q.x,q.z],3.2,2); } });
// 架空電線柱
TRAMS.forEach(T=>{ for(let s=8;s<T.len-8;s+=14){ const p=tramAt(s,T); let near=false; T.seq.forEach(k=>{ if(SIGNAL[k]&&Math.hypot(NODES[k][0]-p.x,NODES[k][1]-p.z)<CLR[k]+6) near=true; }); if(near||Math.abs(s-T.lrt)<24) continue;
  const m=add(new THREE.BoxGeometry(0.3,6.5,0.3),M(0x9aa1aa),scene,p.x,3.3,p.z,false); const arm=add(new THREE.BoxGeometry(9,0.15,0.15),M(0x9aa1aa),scene,p.x,6.4,p.z,false); arm.rotation.y=p.a; } });

/* ================= 遊戲玩法 ================= */
const hemi=new THREE.HemisphereLight(0xffffff,0xd8e6c8,0.78); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,0.75); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.shadow.radius=3;
Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,far:200}); scene.add(sun,sun.target);

const amb=ambulance(); amb.userData.body.scale.setScalar(0.85);
const crew=stretcherSet(); const patient=lyingPatient();
const bystander=person('bystander'); scene.add(bystander);

/* ---------- 個案 ---------- */
const CASES=[
 {id:'plaza',place:'屯門市廣場',poi:'plaza',title:'男子暈倒',call:'屯門市廣場外，一名男子突然暈倒，旁人致電 999。',
  steps:['救護員評估清醒程度、呼吸同脈搏','量血壓、檢查血糖','用車床將病人送上救護車'],
  quiz:[{q:'見到有人暈倒，第一步應該點做？',o:['確認環境安全，拍膊頭大聲叫佢，睇吓有冇反應','即刻餵佢飲水','搖醒佢，扶佢企起身'],why:'先確保自己安全，再檢查反應同呼吸。冇反應就即刻打 999。'},
        {q:'病人有呼吸但冇反應，等救護車期間應該點擺？',o:['擺復原臥式（側臥）','扶佢坐起身','俾佢俯伏瞓'],why:'側臥可以保持氣道暢通，防止嘔吐物阻塞。'}],
  equip:{q:'男子暈倒但有呼吸，救護員要即刻排除邊個常見原因？揀啱裝備：',o:['🩸 血糖機','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'暈倒可能係低血糖引起，用血糖機一驗就知，可以即刻處理。'},
  tips:['見到有人暈倒，即刻打 999','講清楚地點、病人狀況同聯絡電話','病人有呼吸就擺側臥，保持氣道暢通']},
 {id:'park',place:'屯門公園',poi:'park',title:'長者跌倒',call:'屯門公園內，一位婆婆跌倒，話腳好痛企唔起身。',
  steps:['救護員檢查受傷位置同感覺','用夾板固定懷疑骨折嘅腳','小心抬婆婆上車床'],
  quiz:[{q:'婆婆跌倒後話腳好痛、企唔起身，應該點做？',o:['唔好郁佢，陪住佢等救護員','即刻扶佢企起身試吓行','用力搓痛嘅位置'],why:'可能有骨折，亂郁會令傷勢加重。保持佢舒服、保暖，等救護員處理。'},
        {q:'救護員用夾板固定懷疑骨折嘅腳，係為咗？',o:['減少郁動，減輕痛楚同避免傷勢加重','令骨頭即刻癒合','代替止痛藥'],why:'固定傷處可以減少移動時嘅痛楚，避免進一步受傷。'}],
  equip:{q:'婆婆懷疑腳骨折，救護員應該用咩裝備？',o:['🦴 夾板','💨 霧化器','🩸 血糖機','🩹 燒傷敷料'],why:'用夾板固定懷疑骨折嘅位置，搬動時會少啲痛，亦避免傷勢加重。'},
  tips:['長者跌倒後唔好急住扶佢企起身','懷疑骨折就唔好隨便移動傷處','陪住長者，等救護員到場']},
 {id:'townhall',place:'屯門大會堂',poi:'townhall',title:'女士胸口痛',call:'屯門大會堂，一位女士胸口翳痛、出冷汗。',
  steps:['救護員問病歷：幾時開始痛、痛去邊','俾氧氣、做心電圖','安排病人半坐臥送院'],
  quiz:[{q:'女士胸口翳痛、出冷汗，最需要擔心係咩？',o:['可能係心臟病發','可能只係肚餓','可能係扭傷'],why:'胸口翳痛加出冷汗係心臟病發嘅警號，要盡快召救護車。'},
        {q:'等救護車期間，應該點樣幫佢？',o:['讓佢坐低或半坐臥休息，唔好走動','叫佢自己行去醫院','叫佢做運動舒緩下'],why:'休息可以減少心臟負擔。如果佢暈低冇反應，就要做心肺復甦。'}],
  equip:{q:'女士胸口痛，救護員要即刻檢查心臟，應該用咩裝備？',o:['💓 心電圖機','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'心電圖可以睇到心臟有冇出問題，資料仲可以預先通知醫院。'},
  tips:['胸口痛、出冷汗可能係心臟病發，即刻打 999','等候時讓病人坐低休息，唔好走動','如果病人暈低冇反應，盡快做心肺復甦']},
 {id:'station',place:'屯門站',poi:'station',title:'少年哮喘發作',call:'屯門站外，一名少年哮喘發作，透唔到氣。',
  steps:['救護員評估呼吸同血含氧量','用霧化器俾藥舒緩氣管','讓病人坐直送院'],
  quiz:[{q:'有人哮喘發作、透唔到氣，等救護車期間應該點做？',o:['讓佢坐直身，協助佢用自己嘅氣管舒張劑（如有）','叫佢平躺瞓低','叫佢跑兩步深呼吸'],why:'坐直有助呼吸；如果佢有醫生處方嘅噴劑，可以協助佢使用。'}],
  equip:{q:'少年哮喘發作，救護員應該用咩裝備幫佢舒緩氣管？',o:['💨 霧化器','🦴 夾板','🩸 血糖機','🩹 燒傷敷料'],why:'霧化器可以將舒緩氣管嘅藥物變成霧氣吸入，令呼吸暢順啲。'},
  tips:['哮喘發作要保持冷靜，讓病人坐直','協助病人使用自己嘅噴劑','情況冇改善或者講唔到嘢，即刻打 999']},
 {id:'market',place:'屯門街市',poi:'market',title:'檔主燙傷',call:'屯門街市，一位檔主俾滾水燙傷手臂。',
  steps:['救護員檢查燒傷範圍同深度','用清水降溫，再用燒傷敷料包紮','安撫病人，送院'],
  quiz:[{q:'俾滾水燙傷，第一時間應該點處理？',o:['用清涼嘅流動水沖洗傷處 10 至 20 分鐘','塗牙膏或者豉油','用冰塊直接敷'],why:'清涼流動水可以降溫止痛；唔好用冰或者偏方，會令傷勢更差。'}],
  equip:{q:'檔主手臂燙傷，救護員降溫之後應該用咩包紮？',o:['🩹 燒傷敷料','🦴 夾板','💓 心電圖機','💨 霧化器'],why:'燒傷敷料可以保護傷口、減少感染同痛楚。'},
  tips:['燙傷即刻用清涼流動水沖 10 至 20 分鐘','除去傷處附近嘅首飾，但唔好撕黐住嘅衫','唔好塗牙膏、豉油或者用冰']},
 {id:'crash',place:'青山公路',poi:'crash',title:'巴士小巴相撞',call:'青山公路一架雙層巴士同一架綠色小巴相撞，有乘客受傷，話頸痛。',
  steps:['救護員確保現場安全，評估傷者清醒程度','用頸托同脊椎板固定頸椎','小心將傷者抬上車床'],
  quiz:[{q:'你目擊交通意外，第一步應該點做？',o:['留意自身安全，喺安全位置打 999，唔好隨便移動傷者','即刻將傷者拉出車外','企喺馬路中間影相'],why:'先保障自己同其他人嘅安全；除非有即時危險（例如起火），唔好移動傷者，以免加重頸椎或脊椎受傷。'}],
  equip:{q:'傷者撞車後頸痛，懷疑頸椎受傷，救護員應該用咩裝備？',o:['🦺 頸托同脊椎板','💨 霧化器','🩸 血糖機','🩹 燒傷敷料'],why:'頸托同脊椎板可以固定頸椎同脊椎，搬動時減少進一步受傷。'},
  tips:['發生交通意外，先留意自身安全，再打 999','除非有即時危險，唔好移動傷者','講清楚意外地點、涉及車輛同傷者數目']},
 {id:'yltrauma',place:'元朗劇院',poi:'yltheatre',title:'工人高處墮下',call:'元朗劇院外牆翻新，一名男工人由約 9 米高嘅棚架墮下。GCS 14、血壓 118/76、呼吸每分鐘 20。最就近係博愛醫院。',
  steps:['救護員評估氣道、呼吸、清醒程度同生命表徵','用頸托同脊椎板固定','按創傷分流準則決定送邊間醫院'],
  quiz:[{q:'以下邊個情況，符合「創傷分流」要送去創傷中心？',o:['成人由 6 米（20 呎）以上高處墮下','成人由 1 米高樓梯跌落，手腕擦傷','GCS 15、血壓正常、冇特別致傷過程'],why:'資料庫創傷分流準則：成人（≥12 歲）由 6 米以上高處墮下，要送創傷中心；其他準則包括 GCS 3–13、收縮壓 <90、呼吸 <10 或 ≥30 等。'}],
  equip:{q:'工人由高處墮下，懷疑脊椎受傷，救護員應該用咩裝備？',o:['🦺 頸托同脊椎板','💨 霧化器','🩸 血糖機','🩹 燒傷敷料'],why:'高處墮下有機會傷及頸椎同脊椎，要先固定再搬動。'},
  triage:{q:'工人由約 9 米墮下，最就近係博愛醫院（非創傷中心）。應該送邊間？',o:['🏥 屯門醫院（創傷中心）','🏥 博愛醫院（最就近）'],dest:['tmh','poh'],why:'成人由 6 米以上墮下符合創傷分流準則，要送創傷中心；新界西嘅創傷中心係屯門醫院。例外：病人心臟驟停，或者用 BVM 後仍未能有效處理氣道／呼吸，就要送最就近醫院。'},
  tips:['見到有人由高處墮下，唔好隨便郁佢，即刻打 999','講清楚墮下高度同傷者情況','留意自身安全，遠離仍有危險嘅位置']},
 {id:'ylstroke',place:'元朗公園',poi:'ylpark',title:'伯伯懷疑中風',call:'元朗公園，一位 72 歲伯伯 40 分鐘前突然右邊手腳無力、講嘢唔清。血壓 168/92、GCS 15。屬區醫院係博愛醫院。',
  steps:['救護員驗血糖，排除血糖過低','做 FAST-ED 評分','預先通報醫院，按中風分流送院'],
  quiz:[{q:'伯伯單側嘴角下垂（1 分）、一邊手完全抬唔起（2 分）、只講到 1 樣動物（1 分），其餘正常。FAST-ED 總分係？',o:['4 分','2 分','9 分'],why:'F 1 分＋A 2 分＋S 1 分＝4 分。適用：突發單邊無力或語言障礙、4 小時內、18 歲或以上、SBP > 100、GCS ≥ 8，並已排除血糖過低（H\'stix > 4.0）。'}],
  equip:{q:'進行中風評估之前，救護員一定要先排除咩？揀啱裝備：',o:['🩸 血糖機','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'血糖過低可以引起類似中風嘅症狀，要先驗血糖（H\'stix > 4.0 mmol/L）先做中風評估。'},
  triage:{q:'FAST-ED 4 分，病發 40 分鐘，屬區係博愛醫院。應該點樣送院？',o:['🏥 通報後分流去屯門醫院','🏥 送屬區博愛醫院'],dest:['tmh','poh'],why:'院前中風通報及分流：博愛醫院屬區嘅病人 FAST-ED ≥ 4 分，分流至屯門醫院，並要預先通報醫院，方便盡快做溶栓治療。'},
  tips:['記住 FAST：面、手、講嘢、時間','發現懷疑中風，記低病發或者最後正常嘅時間，即刻打 999','唔好俾病人飲嘢食嘢，以免哽親']},
 {id:'ylarrest',place:'元朗站',poi:'ylstation',title:'墮下後心臟驟停',call:'元朗站外，一名男子由約 8 米高嘅行人天橋墮下。救護員到場時佢冇反應、冇正常呼吸，心臟驟停。最就近係博愛醫院。',
  steps:['救護員確認心臟驟停，即刻做心肺復甦','貼上自動心臟除顫器電極片，分析心律','繼續心肺復甦，盡快送院'],
  quiz:[{q:'為成人做心肺復甦，胸外按壓應該點做？',o:['每分鐘 100 至 120 下，按深 5 至 6 厘米','每分鐘 60 下，按深 2 厘米就夠','每分鐘 150 下，按完唔使等胸口回彈'],why:'用力、快速按壓胸口中央：每分鐘 100 至 120 下、深 5 至 6 厘米，每次按完讓胸口完全回彈，盡量減少中斷。'}],
  equip:{q:'傷者心臟驟停，救護員最需要即刻用咩裝備？',o:['⚡ 自動心臟除顫器（AED）','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'心臟驟停要盡快做心肺復甦同使用除顫器，越早除顫，存活機會越高。'},
  triage:{q:'傷者由 8 米墮下，本身符合創傷分流準則，但已經心臟驟停。應該送邊間？',o:['🏥 博愛醫院（最就近）','🏥 屯門醫院（創傷中心）'],dest:['poh','tmh'],why:'創傷分流第一步：病人心臟驟停，就要送最就近醫院，唔再按其他準則分流去創傷中心。另一個例外係用 BVM 後仍然未能有效處理氣道或呼吸。'},
  tips:['見到有人冇反應、冇正常呼吸，即刻打 999 並開始心肺復甦','附近有自動心臟除顫器就盡快攞嚟用，跟住機器語音指示','用力、快速按壓胸口中央，每分鐘 100 至 120 下']},
 {id:'mass',place:'屯門市廣場',poi:'plaza',title:'大量傷者事故',call:'屯門市廣場有扶手電梯意外，多人受傷！控制中心已派出多架救護車一齊前往。',
  steps:['救護員為傷者分流，貼上紅、黃、綠分流卡','先處理同運送傷勢最重（紅卡）嘅傷者','其他救護車接載餘下傷者'],
  quiz:[{q:'大量傷者事故，救護員到場後最先做咩？',o:['傷者分流：按傷勢輕重排先後','邊個叫得最大聲就先救邊個','將所有傷者送去同一間醫院'],why:'分流可以喺資源有限時，令傷勢最危急嘅傷者最快得到治療，傷者亦會分送唔同醫院。'}],
  equip:{q:'大量傷者現場，救護員用咩幫傷者分類？',o:['🏷️ 分流卡（紅黃綠標籤）','🦴 夾板','💨 霧化器','🩸 血糖機'],why:'分流卡用顏色標示傷勢緩急：紅色最危急、黃色次之、綠色傷勢較輕，方便其他救護人員一眼睇到。'},
  tips:['大量傷者現場要聽從救護員同警察指示','傷勢較輕又行到嘅人，可以按指示去指定位置等候','唔好圍觀，讓出通道俾救護車']}
];
/* ---------- 關卡 ---------- */
const LEVELS=[
 {id:'L1',caseId:'plaza',  tod:'day',  todName:'日間',      cars:16,works:0,jam:0,dash:0,limit:1.9},
 {id:'L2',caseId:'park',   tod:'day',  todName:'日間',      cars:22,works:1,jam:0,dash:1,limit:1.8},
 {id:'L3',caseId:'townhall',tod:'dusk',todName:'黃昏',      cars:26,works:1,jam:1,dash:1,limit:1.7},
 {id:'L4',caseId:'station',tod:'night',todName:'夜晚',      cars:22,works:1,jam:1,dash:2,limit:1.7},
 {id:'L5',caseId:'market', tod:'rain', todName:'夜晚落雨',  cars:24,works:2,jam:1,dash:2,limit:1.8},
 {id:'L6',caseId:'crash',  tod:'day',  todName:'日間',      cars:24,works:0,jam:1,dash:1,limit:1.7},
 {id:'L7',caseId:'mass',   tod:'dusk', todName:'黃昏',      cars:22,works:1,jam:0,dash:1,limit:1.7,escort:4},
 {id:'L8',caseId:'yltrauma',tod:'day', todName:'日間・元朗',  cars:22,works:0,jam:0,dash:1,limit:2.0,depot:'yl'},
 {id:'L9',caseId:'ylstroke',tod:'night',todName:'夜晚・元朗',  cars:20,works:0,jam:1,dash:1,limit:2.0,depot:'yl'},
 {id:'L10',caseId:'ylarrest',tod:'dusk',todName:'黃昏・元朗',  cars:20,works:0,jam:0,dash:1,limit:2.0,depot:'yl'}];
const caseOf=lv=>CASES.find(c=>c.id===lv.caseId);

/* ---------- 地點 ---------- */
const HOSPS={tmh:{stop:LMK.ae.stop,door:LMK.ae.door,name:'屯門醫院'},poh:{stop:LMK.ae2.stop,door:LMK.ae2.door,name:'博愛醫院'}};
const DEPOTS={tm:{pos:LMK.depot.pos,a:LMK.depot.a},yl:{pos:LMK.depotYL.pos,a:LMK.depotYL.a}};
let AE=HOSPS.tmh, DEPOT=DEPOTS.tm;
const PARKED=LMK.parkedAmb.map(([[x,z],ang],i)=>{ const a=ambulance(['A245','A272'][i]||'A281'); a.userData.body.scale.setScalar(0.85); a.position.set(x,0.34,z); a.rotation.y=ang;
  a.userData.pB.intensity=a.userData.pR.intensity=0; a.userData.pB.visible=a.userData.pR.visible=false; a.userData.len=6; return {m:a,home:[x,z,ang]}; });

/* ---------- 畫面可見範圍：車同行人只喺鏡頭睇唔到嘅地方出現／消失 ---------- */
function spawnOK(x,z,r){ if(S.mode==='menu'||S.spawnFree) return true; if(inView(x,z,r)) return false; const c=S.car, dx=x-c.x, dz=z-c.z;
  return dx*Math.sin(c.a)+dz*Math.cos(c.a)<-10||Math.hypot(dx,dz)>150; } // 喺車後面或者好遠先出現
const FR=new THREE.Frustum(), FRM=new THREE.Matrix4(), FRS=new THREE.Sphere(new THREE.Vector3(),8);
function updFrustum(){ cam.updateMatrixWorld(); FRM.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse); FR.setFromProjectionMatrix(FRM); }
function inView(x,z,r=8){ r+=14; // 預留位：鏡頭轉動時都唔會見到出現／消失
  if(Math.hypot(x-cam.position.x,z-cam.position.z)>scene.fog.far+30) return false; FRS.center.set(x,2,z); FRS.radius=r; return FR.intersectsSphere(FRS); }
/* ---------- 交通車輛 ---------- */
/* ---------- 香港交通工具（參考相片：雙層巴士、綠色小巴、紅／綠的士、輕鐵） ---------- */
const VT={}; // 貼圖快取
function vtex(key,w,h,draw){ if(!VT[key]){ const t=canvasTex(w,h,draw,false); VT[key]=new THREE.MeshStandardMaterial({map:t,roughness:0.55}); } return VT[key]; }
// 六面盒：[+x, -x, 上, 下, 前(+z), 後(-z)]
function vbox(w,h,d,mats,parent,x,y,z,cast=true){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats); m.position.set(x,y,z); m.castShadow=cast; m.receiveShadow=true; parent.add(m); return m; }
const solid=c=>M(c,{r:0.5});
function wheelsAt(body,list,r=0.45,wd=0.35){ list.forEach(([x,z])=>{ const w=add(cyl(r,r,wd,12),M(C.dark),body,x,r,z,false); w.rotation.z=Math.PI/2;
  add(cyl(r*0.55,r*0.55,wd+0.02,10),M(0xc9ced4),body,x,r,z,false).rotation.z=Math.PI/2; }); }
const led=(g,txt,x,y,size,col)=>{ g.fillStyle=col; g.font='bold '+size+'px sans-serif'; g.textBaseline='middle'; g.fillText(txt,x,y); };

/* 雙層巴士：紅色（銀色斜紋）／香檳金色（舊款） */
function busSide(style,frontLeft){ return vtex('bus'+style+frontLeft,1024,384,(g,W,H)=>{
  const X=x=>frontLeft?x:W-x, rect=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); g.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
  if(style==='red'){ g.fillStyle='#e8343a'; g.fillRect(0,0,W,H);
    g.fillStyle='#c3c3c3'; g.beginPath(); g.moveTo(X(470),H); g.lineTo(X(560),H); g.lineTo(X(860),0); g.lineTo(X(800),0); g.fill(); // 銀色斜紋
    g.fillStyle='#16181c'; rect(20,40,950,150); rect(60,220,700,320); rect(830,220,1000,320); rect(860,40,1010,180); // 上下層窗、車頭
  } else { g.fillStyle='#bba98a'; g.fillRect(0,0,W,H);
    g.fillStyle='#1c1e22'; rect(40,40,1000,150); rect(260,220,1000,330); rect(30,220,150,360); rect(170,220,240,360);
    g.fillStyle='#f4f4f0'; rect(300,165,940,210); g.fillStyle='#2a8f4a'; g.font='bold 30px sans-serif'; g.textAlign='center'; g.fillText('環保人人想',X(620),188); }
  g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(0,H-14,W,14); }); }
function busFront(style){ return vtex('busF'+style,256,384,(g,W,H)=>{ g.fillStyle=style==='red'?'#e8343a':'#bba98a'; g.fillRect(0,0,W,H);
  g.fillStyle='#16181c'; g.fillRect(14,14,W-28,140); g.fillRect(14,170,W-28,150);
  g.fillStyle='#000'; g.fillRect(36,170,W-72,50); led(g,style==='red'?'屯門 60X':'天瑞 69X',48,196,30,style==='red'?'#ffa31a':'#3ddc6a');
  g.fillStyle=style==='red'?'#c8c8c8':'#a8977a'; g.fillRect(10,330,W-20,22); g.fillStyle='#fffbe8'; g.fillRect(20,334,34,14); g.fillRect(W-54,334,34,14); }); }
function busModel(){ const g=new THREE.Group(), body=new THREE.Group(); g.add(body); const st=Math.random()<0.6?'red':'gold';
  const bc=st==='red'?'#e8343a':'#bba98a', bd=st==='red'?'#b3262b':'#94866b';
  const base=solid(st==='red'?0xe8343a:0xbba98a), back=vtex('busB2'+st,256,384,(c,W,H)=>{ c.fillStyle=bc; c.fillRect(0,0,W,H);
    c.fillStyle='#16181c'; c.fillRect(28,30,W-56,84);                                   // 上層車尾窗
    c.fillStyle='rgba(255,255,255,.14)'; c.beginPath(); c.moveTo(40,104); c.lineTo(90,38); c.lineTo(120,38); c.lineTo(70,104); c.fill();
    c.fillStyle='#16181c'; c.fillRect(150,126,82,30); led(c,'60X',162,142,22,'#ffb020');     // 路線牌
    c.fillStyle='#16181c'; c.fillRect(28,170,W-56,56);                                  // 下層車尾窗
    c.fillStyle=bd; c.fillRect(34,240,W-68,84); c.fillStyle='rgba(0,0,0,.28)'; for(let y=250;y<318;y+=11) c.fillRect(48,y,W-96,5);   // 引擎蓋散熱格
    [8,W-30].forEach(x=>{ c.fillStyle='#ff3030'; c.fillRect(x,236,22,34); c.fillStyle='#ffa31a'; c.fillRect(x,274,22,22); c.fillStyle='#f4f4f4'; c.fillRect(x,300,22,16); });
    c.fillStyle='#ffd400'; c.fillRect(92,334,72,22); c.fillStyle='#111'; c.font='bold 16px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('TM 60X',128,346); c.textAlign='left';
    c.fillStyle='#1c1e22'; c.fillRect(0,362,W,22); });
  const roof=vtex('busT'+st,256,1024,(c,W,H)=>{ c.fillStyle=bc; c.fillRect(0,0,W,H); c.fillStyle='rgba(255,255,255,.75)'; c.fillRect(0,0,W,H); c.fillStyle=bc; c.fillRect(0,0,14,H); c.fillRect(W-14,0,14,H); c.fillRect(0,0,W,14); c.fillRect(0,H-14,W,14);
    c.strokeStyle='rgba(0,0,0,.12)'; c.lineWidth=3; for(let y=60;y<H;y+=90){ c.beginPath(); c.moveTo(18,y); c.lineTo(W-18,y); c.stroke(); }
    [[150,220],[620,220]].forEach(([y,h])=>{ c.fillStyle='#c9ced4'; c.fillRect(56,y,W-112,h); c.strokeStyle='#8a9098'; c.lineWidth=5; c.strokeRect(56,y,W-112,h); c.fillStyle='rgba(0,0,0,.2)'; for(let yy=y+16;yy<y+h-10;yy+=18) c.fillRect(72,yy,W-144,6);
      c.fillStyle='#5b6270'; c.beginPath(); c.arc(W/2,y+h/2,34,0,7); c.fill(); c.fillStyle='#9aa1ab'; c.beginPath(); c.arc(W/2,y+h/2,10,0,7); c.fill(); });   // 冷氣機
    [430,900].forEach(y=>{ c.fillStyle='#e9ecef'; c.fillRect(86,y,84,70); c.strokeStyle='#6f7884'; c.lineWidth=4; c.strokeRect(86,y,84,70); });                   // 太平門
  });
  vbox(2.55,4.3,11.2,[busSide(st,true),busSide(st,false),roof,base,busFront(st),back],body,0,2.6,0);
  wheelsAt(body,[[-1.2,3.6],[1.2,3.6],[-1.2,-2.6],[1.2,-2.6],[-1.2,-3.9],[1.2,-3.9]],0.56,0.4);
  body.children[0].castShadow=true; scene.add(g); g.userData.len=11.2; return g; }

/* 綠色專線小巴：米色車身、綠色車頂、車頭頂電子牌 */
function minibusModel(body){
  const side=f=>vtex('mb'+f,512,192,(g,W,H)=>{ const X=x=>f?x:W-x; g.fillStyle='#f1e2b4'; g.fillRect(0,0,W,H); g.fillStyle='#2fb07a'; g.fillRect(0,0,W,46);
    g.fillStyle='#fff'; g.font='bold 18px sans-serif'; g.textAlign='center'; g.fillText('公共小型巴士十九座位',X(300),30);
    g.fillStyle='#1c1e22'; const a=X(30),b=X(400); g.fillRect(Math.min(a,b),56,Math.abs(b-a),60); const c=X(410),d=X(480); g.fillRect(Math.min(c,d),56,Math.abs(d-c),70);
    g.fillStyle='rgba(0,0,0,.15)'; g.fillRect(0,H-10,W,10); });
  const front=vtex('mbF',256,192,(g,W,H)=>{ g.fillStyle='#f1e2b4'; g.fillRect(0,0,W,H); g.fillStyle='#2fb07a'; g.fillRect(0,0,W,46); g.fillStyle='#1c1e22'; g.fillRect(14,52,W-28,70);
    g.fillStyle='#d9d9d9'; g.fillRect(24,140,40,18); g.fillRect(W-64,140,40,18); g.fillStyle='#2a2a2a'; g.fillRect(84,140,W-168,22); });
  const green=solid(0x2fb07a), cream=solid(0xf1e2b4);
  vbox(2.3,2.5,7.0,[side(true),side(false),green,cream,front,cream],body,0,1.55,0);
  vbox(1.5,0.5,0.8,[green,green,green,green,vtex('mbLed',128,48,(g,W,H)=>{ g.fillStyle='#2fb07a'; g.fillRect(0,0,W,H); g.fillStyle='#111'; g.fillRect(8,6,W-16,H-12); led(g,'44M 屯門',16,24,22,'#ffa31a'); }),green],body,0,3.0,3.0,false);
  wheelsAt(body,[[-1.05,2.3],[1.05,2.3],[-1.05,-2.2],[1.05,-2.2]],0.48,0.35); }

/* 的士：市區紅的（銀頂）／新界綠的（白頂），車頂 TAXI 牌 */
function taxiModel(body,green){
  const c=green?'#2bb04a':'#e3262e', top=green?0xf4f4f4:0xc9ccd0;
  const side=f=>vtex('tx'+green+f,256,96,(g,W,H)=>{ const X=x=>f?x:W-x; g.fillStyle=c; g.fillRect(0,0,W,H); g.fillStyle='#fff'; g.font='bold 20px sans-serif'; g.textAlign='center'; g.fillText('的士',X(150),36); g.font='bold 16px sans-serif'; g.fillText('TAXI',X(150),58);
    g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(0,H-10,W,10); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(X(128)-1,10,2,H-24); });
  const front=vtex('txF'+green,256,96,(g,W,H)=>{ g.fillStyle=c; g.fillRect(0,0,W,H); g.fillStyle='#fff6d0'; g.fillRect(14,24,46,22); g.fillRect(W-60,24,46,22); g.fillStyle='#222'; g.fillRect(80,30,W-160,26); g.fillStyle='#fff'; g.fillRect(90,62,W-180,22); });
  const base=solid(green?0x2bb04a:0xe3262e);
  vbox(2.15,1.0,4.5,[side(true),side(false),base,base,front,base],body,0,0.95,0);
  const roofM=solid(top), glass=M(C.glass,{r:0.2});
  vbox(1.9,0.85,green?2.3:2.9,[glass,glass,roofM,roofM,glass,glass],body,0,1.85,green?-0.25:-0.45);
  vbox(1.92,0.12,green?2.34:2.94,roofM,body,0,2.29,green?-0.25:-0.45,false);
  vbox(0.9,0.3,0.4,[solid(0xffffff),solid(0xffffff),solid(0xffffff),solid(0xffffff),vtex('taxiSign',128,48,(g,W,H)=>{ g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.fillStyle='#d8202a'; g.font='bold 34px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('TAXI',W/2,H/2+2); }),solid(0xffffff)],body,0,2.5,-0.2,false);
  wheelsAt(body,[[-1.05,1.5],[1.05,1.5],[-1.05,-1.5],[1.05,-1.5]]); }

function carModel(kind){
  if(kind==='bus') return busModel();
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  if(kind==='minibus') minibusModel(body);
  else if(kind==='taxi') taxiModel(body,Math.random()<0.5);
  else { const col=[0x7fb8ff,0xffb3c1,0xc3a6ff,0xfff1a8,0xa8e6cf,0xe9edf2,0x5b6270][Math.random()*7|0];
    add(rbox(2.2,1.0,4.4,0.45),M(col),body,0,0.95,0); add(rbox(1.9,0.85,2.3,0.4),M(col),body,0,1.75,-0.2);
    add(new THREE.BoxGeometry(1.94,0.55,2.0),M(C.glass,{r:0.2}),body,0,1.78,-0.2,false);
    wheelsAt(body,[[-1.05,1.5],[1.05,1.5],[-1.05,-1.5],[1.05,-1.5]]); }
  g.traverse(o=>{ if(o.isMesh) o.castShadow=false; }); body.children[0].castShadow=true;
  if(kind==='minibus') g.userData.len=7.0;
  scene.add(g); return g; }

/* 輕鐵：銀白車身、紅色腰線、紫綠間條、車頭黑色擋風、橙字路線牌、紅色集電弓 */
function lrtSide(cabLeft){ return vtex('lrt'+cabLeft,1024,256,(g,W,H)=>{ const X=x=>cabLeft?x:W-x, rect=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); g.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
  g.fillStyle='#e9ebee'; g.fillRect(0,0,W,H);
  g.fillStyle='#c8102e'; rect(220,44,1024,62); g.fillStyle='#c8102e'; rect(196,44,232,62);
  g.fillStyle='#1f2328'; rect(240,70,1010,152); for(let x=330;x<1010;x+=96){ g.fillStyle='#cfd3d8'; rect(x,70,x+8,152); }
  for(let y=160;y<230;y+=6){ g.fillStyle=y%12?'#d7dade':'#c3c7cc'; rect(230,y,1024,y+3); }
  g.fillStyle='#b9a6e6'; rect(230,190,1024,195); g.fillStyle='#9bd23a'; rect(230,198,1024,203); g.fillStyle='#6c2c91'; rect(230,206,1024,210);
  // 車頭位置
  g.fillStyle='#f5f6f7'; rect(0,0,230,236); g.fillStyle='#1f2328'; rect(40,70,170,170);
  g.strokeStyle='#b9a6e6'; g.lineWidth=5; g.beginPath(); g.moveTo(X(20),205); g.quadraticCurveTo(X(140),185,X(230),192); g.stroke();
  g.strokeStyle='#9bd23a'; g.beginPath(); g.moveTo(X(20),213); g.quadraticCurveTo(X(140),195,X(230),200); g.stroke();
  g.strokeStyle='#6c2c91'; g.beginPath(); g.moveTo(X(20),221); g.quadraticCurveTo(X(140),203,X(230),208); g.stroke();
  g.fillStyle='#222'; g.font='bold 22px sans-serif'; g.textAlign='center'; g.fillText('1018',X(205),165);
  g.fillStyle='#4a4f56'; g.fillRect(0,236,W,20); }); }
const lrtFront=()=>vtex('lrtF',256,256,(g,W,H)=>{ g.fillStyle='#f5f6f7'; g.fillRect(0,0,W,H); g.fillStyle='#1f2328'; g.fillRect(18,10,W-36,150);
  g.fillStyle='#111'; g.fillRect(30,16,W-60,40); led(g,'元朗 610',44,37,26,'#ff8a1f'); led(g,'063',36,72,18,'#ff8a1f');
  g.fillStyle='#c8102e'; g.fillRect(40,168,W-80,26); g.fillStyle='#fff6d8'; g.fillRect(30,206,34,18); g.fillRect(W-64,206,34,18);
  g.fillStyle='#b9a6e6'; g.fillRect(0,228,W,4); g.fillStyle='#9bd23a'; g.fillRect(0,234,W,4); g.fillStyle='#4a4f56'; g.fillRect(0,240,W,16); });
function tramModel(){ const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const white=solid(0xeef0f2), grey=solid(0x4a4f56);
  [[6.4,1],[-6.4,-1]].forEach(([z,dir])=>{ // 兩卡背對背，兩頭都係車頭
    const fr=lrtFront(); const mats=dir>0?[lrtSide(true),lrtSide(false),white,grey,fr,white]:[lrtSide(false),lrtSide(true),white,grey,white,fr];
    vbox(2.65,3.3,12.4,mats,body,0,2.05,z);
    add(new THREE.BoxGeometry(1.6,0.45,2.2),solid(0x5c6168),body,0,3.95,z-dir*3,false);  // 冷氣機
    add(new THREE.BoxGeometry(1.6,0.45,2.2),solid(0x5c6168),body,0,3.95,z-dir*0.4,false); });
  add(new THREE.BoxGeometry(2.4,3.0,0.6),grey,body,0,2.0,0,false);
  // 集電弓（紅色）同架空電線接觸
  const pm=solid(0xa3262e); const p1=add(new THREE.BoxGeometry(0.12,0.12,2.4),pm,body,0,4.8,5.0,false); p1.rotation.x=-0.75;
  const p2=add(new THREE.BoxGeometry(0.12,0.12,2.4),pm,body,0,4.8,3.6,false); p2.rotation.x=0.75; add(new THREE.BoxGeometry(1.8,0.1,0.25),solid(0x333333),body,0,5.65,4.3,false);
  body.children[0].castShadow=true; scene.add(g); g.userData.len=25; return g; }

// 停車場嘅車
parked.forEach(([x,z,a],k)=>{ const c=carModel(['car','car','taxi','minibus'][k%4]); c.position.set(x,0.34,z); c.rotation.y=a; });
const cars=[]; const CAR_N=26;
function placeCar(c,nearX,nearZ){
  for(let tries=0;tries<40;tries++){
    const r=MAP.roads[Math.random()*MAP.roads.length|0]; if(r.closed) continue;
    const i=1+(Math.random()*(r.n.length-1)|0); const a=r.n[i-1], b=r.n[i];
    const A=NODES[a]; const d=Math.hypot(A[0]-nearX,A[1]-nearZ); if(d<60||d>340) continue;
    const fr=Math.random()<0.5?a:b, to=fr===a?b:a, t0=Math.random()*0.6; const P=NODES[fr],Q=NODES[to], px=P[0]+(Q[0]-P[0])*t0, pz=P[1]+(Q[1]-P[1])*t0;
    if(cars.some(o=>o!==c&&o.pose&&Math.hypot(o.pose.x-px,o.pose.z-pz)<16)) continue; // 唔好喺其他車上面出現
    if(!spawnOK(px,pz)) continue; // 唔好喺鏡頭前面突然出現
    Object.assign(c,{from:fr,to,road:r,t:t0,v:7+Math.random()*3,yield:0,pose:null,blockedBy:null}); return true; }
  return false;
}
function nextEdge(c){
  const opts=ADJ[c.to].filter(e=>e[0]!==c.from&&!e[2].closed);
  if(!opts.length){ c.t=1; c.waitEnd=true; return; } // 地圖盡頭：停喺度，等鏡頭睇唔到先喺第二度出現
  const e=opts[Math.random()*opts.length|0];
  c.from=c.to; c.to=e[0]; c.road=e[2]; c.t=0;
}
function carPose(c){
  const A=NODES[c.from],B=NODES[c.to]; const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1; const ux=dx/L,uz=dz/L;
  const off=c.yield>0?c.road.w/2-(c.m.userData.len?1.9:1.5):laneOff(c.road);
  c.off=(c.off??off)+(off-(c.off??off))*0.08;
  return {x:A[0]+dx*c.t+uz*c.off, z:A[1]+dz*c.t-ux*c.off, a:Math.atan2(ux,uz), L};
}
/* ---------- 行人 ---------- */
const peds=[]; const PED_N=34;
function placePed(p,nearX,nearZ){
  for(let tries=0;tries<50;tries++){
    if(Math.random()<0.4){ const c=MAP.crossings[Math.random()*MAP.crossings.length|0]; const d=Math.hypot(c.p[0]-nearX,c.p[1]-nearZ); if(d<60||d>280) continue; if(!spawnOK(c.p[0],c.p[1],4)) continue;
      Object.assign(p,{mode:'cross',cx:c.p[0],cz:c.p[1],nx:c.n[0],nz:c.n[1],half:c.half,s:-c.half,dir:1,wait:Math.random()*4,node:SIGNAL[c.node]?c.node:null,ang:c.ang}); return true; }
    const r=MAP.roads[Math.random()*MAP.roads.length|0]; if(r.bridge) continue;
    const A=NODES[r.n[0]],B=NODES[r.n[1]]; const d=Math.hypot((A[0]+B[0])/2-nearX,(A[1]+B[1])/2-nearZ); if(d<50||d>280) continue;
    const L=Math.hypot(B[0]-A[0],B[1]-A[1]); const side=Math.random()<0.5?1:-1; if(!spawnOK(A[0],A[1],4)||!spawnOK(B[0],B[1],4)) continue;
    const lo=SIGNAL[r.n[0]]?CLR[r.n[0]]+5:1, hi=L-(SIGNAL[r.n[1]]?CLR[r.n[1]]+5:1); if(hi-lo<6) continue;
    if(r.name==='元朗公路') continue; Object.assign(p,{mode:'walk',A,B,L,s:lo+Math.random()*(hi-lo),lo,hi,dir:Math.random()<0.5?1:-1,off:(r.w/2+1.9)*side}); return true; }
  return false;
}
const PCOL=[0x7ec8e3,0xa78bfa,0xf9a8d4,0x86efac,0xfcd34d,0xfda4af,0x93c5fd];
const PG={body:new THREE.CylinderGeometry(0.42,0.5,1.0,10),head:new THREE.SphereGeometry(0.6,12,10),hair:new THREE.SphereGeometry(0.62,12,8,0,Math.PI*2,0,Math.PI/2),leg:new THREE.CylinderGeometry(0.15,0.15,0.6,6)};
const PM={skin:M(C.skin),hair:M(C.hair),leg:M(0x50586a)}, PCM=PCOL.map(c=>M(c));
function pedModel(){ // 簡化行人：5 件，唔投影，慳手機效能
  const g=new THREE.Group(); const mk=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); g.add(m); return m;};
  mk(PG.body,PCM[Math.random()*PCM.length|0],0,1.05,0); mk(PG.head,PM.skin,0,2.05,0); mk(PG.hair,PM.hair,0,2.1,-0.04);
  const legL=mk(PG.leg,PM.leg,-0.2,0.3,0), legR=mk(PG.leg,PM.leg,0.2,0.3,0);
  g.userData={legL,legR}; g.scale.setScalar(0.9); scene.add(g); return g; }

/* ---------- 高架路：車輛高度同斜度 ---------- */
function groundPose(m,x,y0,z,a,len){ const h=ELEV(x,z); m.rotation.order='YXZ'; m.position.set(x,y0+h,z); m.rotation.y=a;
  if(h>0||ELEV(x+Math.sin(a)*2,z+Math.cos(a)*2)>0){ const k=(len||4)/2, hf=ELEV(x+Math.sin(a)*k,z+Math.cos(a)*k), hb=ELEV(x-Math.sin(a)*k,z-Math.cos(a)*k); m.rotation.x=-Math.atan2(hf-hb,2*k); } else m.rotation.x=0; }
/* ---------- 輕鐵 ---------- */
const trams=[0,1,2,3].map(k=>({L:TRAM,m:tramModel(),dir:k%2?-1:1,s:k*TRAM.len/4,wait:0,cur:9})).concat([0,1].map(k=>({L:TRAM2,m:tramModel(),dir:k%2?-1:1,s:k*TRAM2.len/2+20,wait:0,cur:9})));
function tramTick(dt){ const c=S.car, tt=clock.elapsedTime, SV=window.__SV||[];
  for(const T of trams){
    let target=9; const TL=T.L; const p0=tramAt(T.s,TL); const off=T.dir>0?3.2:-3.2; // 靠左：同方向偏左
    const fx=Math.sin(p0.a)*T.dir, fz=Math.cos(p0.a)*T.dir, lx=fz, lz=-fx; const px=p0.x+lx*3.2, pz=p0.z+lz*3.2;
    const ex=c.x-px, ez=c.z-pz, ah=ex*fx+ez*fz; if(ah>0&&ah<22&&Math.abs(ex*lx+ez*lz)<3.6) target=0;
    for(const o of trams) if(o!==T&&o.L===T.L&&o.dir===T.dir){ const d=(o.s-T.s)*T.dir; if(d>0&&d<34) target=0; }
    if(T.pose) for(const o of cars){ if(!o.pose) continue; const qx=o.pose.x-T.pose.x, qz=o.pose.z-T.pose.z; const sa=Math.sin(T.pose.a), ca=Math.cos(T.pose.a); const al=qx*sa+qz*ca, ac=qx*ca-qz*sa; if(al>12&&al<24&&Math.abs(ac)<3) { target=0; break; } }
    // 紅燈
    for(let i=0;i<TL.seq.length;i++){ const k=TL.seq[i]; if(!SIGNAL[k]) continue; const rem=(TL.cum[i]-T.s)*T.dir, sd=CLR[k]+4.6+12.5;
      if(rem>sd-1&&rem<sd+20){ const st=lightState(k,p0.a,tt); if(st!=='g') target=Math.min(target,Math.max(0,(rem-sd)*0.8)); } }
    // 讓救護車：前面或者下一個路口附近有響警號嘅救護車就停
    if(T.pose) for(const sv of SV){ const qx=sv.x-T.pose.x, qz=sv.z-T.pose.z, d=Math.hypot(qx,qz); const ah=qx*Math.sin(T.pose.a)+qz*Math.cos(T.pose.a); if(d<38&&ah>-14) { target=0; break; } }
    const ds=(TL.lrt-T.s)*T.dir; if(T.wait>0){ T.wait-=dt; target=0; } else if(ds>0&&ds<0.5+T.cur*dt){ T.wait=5; T.s=TL.lrt; target=0; }
    else if(ds>0&&ds<20) target=Math.min(target,2+ds*0.35);
    T.cur+=(target-T.cur)*Math.min(1,dt*(target<T.cur?4:1)); T.s+=T.cur*T.dir*dt;
    if(T.s>TL.len+40) T.s=-40; if(T.s<-40) T.s=TL.len+40;
    const p=tramAt(T.s,TL); const ang=T.dir>0?p.a:p.a+Math.PI; const ux=Math.sin(ang), uz=Math.cos(ang);
    const x=p.x+uz*3.2, z=p.z-ux*3.2; T.pose={x,z,a:ang}; T.m.position.set(x,0.12,z); T.m.rotation.y=ang;
    T.m.visible=T.s>-5&&T.s<TL.len+5; if(!T.m.visible) T.pose=null; } }

/* ---------- 狀態 ---------- */
const S={mode:'menu',kase:null,step:0,car:{x:0,z:0,a:0,v:0},t0:0,tScene:0,tHosp:0,collided:false,collisions:0,
  target:null,route:null,routeT:0,seq:0,hold:{L:false,R:false,G:false,B:false},siren:false,camYaw:0,stars:0,ideal:0,lastHit:-9};
const routeMat=new THREE.MeshBasicMaterial({color:0xffc48a,transparent:true,opacity:0.55,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
let routeMesh=null;
function drawRoute(pts){
  if(routeMesh){scene.remove(routeMesh);routeMesh.geometry.dispose();}
  const pos=[];
  for(let i=1;i<pts.length;i++){ const a=pts[i-1],b=pts[i]; const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1; const nx=-dz/L*1.3,nz=dx/L*1.3;
    const ya=0.24+ELEV(a[0],a[1]), yb=0.24+ELEV(b[0],b[1]); pos.push(a[0]+nx,ya,a[1]+nz, b[0]+nx,yb,b[1]+nz, b[0]-nx,yb,b[1]-nz, a[0]+nx,ya,a[1]+nz, b[0]-nx,yb,b[1]-nz, a[0]-nx,ya,a[1]-nz); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); routeMesh=new THREE.Mesh(g,routeMat); routeMesh.renderOrder=2; scene.add(routeMesh);
}
const ring=add(new THREE.TorusGeometry(5,0.45,12,48),M(0xff7a1a,{e:0x662200}),scene,0,0.5,0,false); ring.rotation.x=Math.PI/2; ring.visible=false;
const beacon=add(new THREE.CylinderGeometry(1.2,1.2,40,16,1,true),new THREE.MeshBasicMaterial({color:0xff7a1a,transparent:true,opacity:0.22,depthWrite:false,side:THREE.DoubleSide}),scene,0,20,0,false); beacon.visible=false;
const arrow=new THREE.Group(); scene.add(arrow); arrow.visible=false;
{ const sh=(k)=>{ const g=new THREE.Shape(); g.moveTo(0,2.2*k); g.lineTo(1.7*k,0.2*k); g.lineTo(0.6*k,0.2*k); g.lineTo(0.6*k,-1.8*k); g.lineTo(-0.6*k,-1.8*k); g.lineTo(-0.6*k,0.2*k); g.lineTo(-1.7*k,0.2*k); g.closePath(); return g; };
  const tilt=new THREE.Group(); tilt.rotation.x=Math.PI/2-0.75; tilt.scale.setScalar(0.95); arrow.add(tilt); // 箭嘴指向前，斜向鏡頭
  const body=new THREE.Mesh(new THREE.ExtrudeGeometry(sh(1),{depth:0.35,bevelEnabled:false}),M(0xff7a1a,{e:0x662200})); tilt.add(body);
  const rim=new THREE.Mesh(new THREE.ShapeGeometry(sh(1.18)),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide})); rim.position.z=0.175; tilt.add(rim);
  tilt.position.z=0.3; }

function setTarget(xz){ S.arrowA=null; S.target=xz; ring.position.set(xz[0],0.5,xz[1]); beacon.position.set(xz[0],20,xz[1]); ring.visible=beacon.visible=arrow.visible=true; S.routeT=0; }
// 路線點：車位 → 路口 … → 目的地（略過車已經行過嘅第一個路口、目的地之後嘅最後一個路口）
function onSeg(px,pz,A,B){ const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; const t=((px-A[0])*dx+(pz-A[1])*dz)/L2; const qx=A[0]+dx*t-px,qz=A[1]+dz*t-pz; return t>0&&t<1&&qx*qx+qz*qz<16*16; }
function refreshRoute(force){
  const c=S.car, T=S.target;
  const segCand=(x,z)=>{ const A=nearestNode(x,z); const out=[A]; ADJ[A].forEach(e=>{ if(onSeg(x,z,NODES[A],NODES[e[0]])) out.push(e[0]); }); return out; };
  // 起點：喺車後面嘅路口要掉頭，加罰分；終點：最後一段要令目的地喺左手邊（靠左行），否則加罰分
  const fx=Math.sin(c.a), fz=Math.cos(c.a); let best=null;
  const ends=segCand(T[0],T[1]), starts=segCand(c.x,c.z);
  const ban=CLOSED.map(r=>r.n); if(ends.length>1) ban.push(ends); if(starts.length>1) ban.push(starts); // 唔准喺起點／終點嗰段兜返轉頭
  for(const n of starts) for(const m of ends){ const r=route(n,m,ban); if(!r) continue;
    const N=NODES[n], E=NODES[m]; const dx=N[0]-c.x, dz=N[1]-c.z;
    const ex=T[0]-E[0], ez=T[1]-E[1], el=Math.hypot(ex,ez)||1; let side=1; { const o=ends.find(q=>q!==m); if(o!=null){ const O=NODES[o]; const [ux,uz]=dirn(E,O); side=ex*uz-ez*ux; } } // 正數 = 喺左手邊
    let cost=r.len+Math.hypot(dx,dz)+el+(dx*fx+dz*fz<-4?250:0)+(side<0?600:0);
    if(n===m&&starts.length>1&&ends.length>1&&starts.includes(ends[0])&&starts.includes(ends[1])) cost=Math.hypot(T[0]-c.x,T[1]-c.z)+((T[0]-c.x)*fx+(T[1]-c.z)*fz<0?400:0); // 同一段路
    if(!best||cost<best.cost) best={r,cost}; }
  if(!best) return; const r=best.r; let path=r.path.slice();
  if(path.length>1&&onSeg(c.x,c.z,NODES[path[0]],NODES[path[1]])) path.shift();
  if(path.length>1&&onSeg(T[0],T[1],NODES[path[path.length-2]],NODES[path[path.length-1]])) path.pop();
  if(path.length===1&&onSeg(T[0],T[1],[c.x,c.z],NODES[path[0]])) path=[];
  const raw=[[c.x,c.z],...path.map(i=>NODES[i]),T];
  // 靠左行（香港）：路口位置向左偏到行車線中間
  const lane=(p,q,i)=>{ const r=EDGE[path[i-2]+'-'+path[i-1]]; return r?laneOff(r):3.4; };
  const pts=[raw[0]];
  for(let i=1;i<raw.length-1;i++){ const p=raw[i], a=raw[i-1], q=raw[i+1];
    let d1=[p[0]-a[0],p[1]-a[1]], d2=[q[0]-p[0],q[1]-p[1]]; const l1=Math.hypot(...d1)||1, l2=Math.hypot(...d2)||1; d1=[d1[0]/l1,d1[1]/l1]; d2=[d2[0]/l2,d2[1]/l2];
    const n1=[d1[1],-d1[0]], n2=[d2[1],-d2[0]]; const o1=i>=2?lane(a,p,i):(i+1<raw.length-1?lane(p,q,i+1):3.4), o2=i+1<raw.length-1?lane(p,q,i+1):o1;
    const cr=d1[0]*d2[1]-d1[1]*d2[0], dot=d1[0]*d2[0]+d1[1]*d2[1];
    if(dot<-0.7){ pts.push([p[0]+n1[0]*o1,p[1]+n1[1]*o1]); pts.push([p[0]+n2[0]*o2,p[1]+n2[1]*o2]); }
    else if(Math.abs(cr)<0.08) pts.push([p[0]+(n1[0]*o1+n2[0]*o2)/2,p[1]+(n1[1]*o1+n2[1]*o2)/2]);
    else { // 兩條偏移線相交
      const P1=[p[0]+n1[0]*o1,p[1]+n1[1]*o1], P2=[p[0]+n2[0]*o2,p[1]+n2[1]*o2]; const tt=((P2[0]-P1[0])*d2[1]-(P2[1]-P1[1])*d2[0])/cr; pts.push([P1[0]+d1[0]*tt,P1[1]+d1[1]*tt]); } }
  pts.push(T);
  let len=0; for(let i=1;i<pts.length;i++) len+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
  const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  S.route={path:r.path,pts,len,cum,idx:0}; drawRoute(pts);
}
// 沿路線向前望 ahead 米，畀箭嘴指
// 車喺路線上嘅位置（只向前搵，唔會因為經過路口而跳返轉頭）
function routeProj(){ const c=S.car, R=S.route, P=R.pts; let best=null;
  for(let i=Math.max(1,R.idx);i<P.length&&i<R.idx+6;i++){ const A=P[i-1],B=P[i]; const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1;
    let t=((c.x-A[0])*dx+(c.z-A[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); const d=Math.hypot(A[0]+dx*t-c.x,A[1]+dz*t-c.z);
    if(!best||d<best.d-0.5) best={i,t,d,s:R.cum[i-1]+Math.sqrt(L2)*t}; }
  if(best) R.idx=best.i; return best; }
function pointAt(s){ const R=S.route, P=R.pts; s=Math.min(s,R.len); let i=1; while(i<P.length-1&&R.cum[i]<s) i++;
  const A=P[i-1],B=P[i], L=R.cum[i]-R.cum[i-1]||1, k=(s-R.cum[i-1])/L; return [A[0]+(B[0]-A[0])*k,A[1]+(B[1]-A[1])*k]; }
function lookAhead(ahead){ const pr=routeProj(); if(!pr) return S.target; return pointAt(pr.s+ahead); }
/* ---------- UI ---------- */
function show(id,on){ $(id).classList.toggle('show',on); }
function hud(title,sub){ $('hTitle').textContent=title; $('hSub').textContent=sub; }
function caption(txt){ const el=$('cap'); if(!txt){el.classList.remove('show');return;} el.textContent=txt; el.classList.add('show'); }
let toastT=0; function toast(txt){ const el=$('toast'); el.textContent=txt; el.classList.add('show'); toastT=2.2; }
/* ---------- 流程 ---------- */
function dropModel(m){ scene.remove(m); m.traverse(o=>{ if(o.geometry&&!o.geometry.userData.shared) o.geometry.dispose(); }); }
function resetActors(){ clearScene();
  cars.forEach(c=>dropModel(c.m)); cars.length=0; peds.forEach(p=>scene.remove(p.m)); peds.length=0;
  crew.visible=false; scene.attach(patient); patient.visible=false; bystander.visible=false;
  amb.userData.doors.forEach(d=>d.rotation.y=0); amb.visible=true;
}
function startCase(i){
  ensureAudio(); sirenSet(false);
  const lv=LEVELS[i]; S.lvl=i; S.level=lv; const k=caseOf(lv); S.kase=k; S.kase.loc=LMK[k.poi]; DEPOT=DEPOTS[lv.depot||'tm']; AE=HOSPS.tmh; S.dest='tmh';
  resetActors(); setTOD(lv.tod); clearEvents();
  const d=DEPOT.pos;
  Object.assign(S.car,{x:d[0],z:d[1],a:DEPOT.a,v:0}); S.camYaw=S.car.a;
  Object.assign(S,{mode:'drive',step:1,leftDepot:false,sirenUsed:false,equipOk:false,quizOk:false,lives:5,onTime:0,overT:false,stab:100,stabLow:100,dashLeft:lv.dash,dashT:14+Math.random()*10,newAch:[],log:[],pedLast:-9,collided:false,redRun:false,inX:-1,quizOpen:false,qDone:[false,false,!k.triage],qScore:0,qPending:0,collisions:0,t0:performance.now()/1000,tScene:0,tHosp:0,lastHit:-9});
  S.spawnFree=true; // 開局一次過擺好（之後先避開鏡頭）
  for(let n=0;n<lv.cars;n++){ const c={m:carModel(['taxi','car','bus','car','minibus','taxi','car'][n%7])}; if(placeCar(c,d[0],d[1])) cars.push(c); else dropModel(c.m); }
  for(let n=0;n<PED_N;n++){ const p={m:pedModel()}; if(placePed(p,d[0],d[1])) peds.push(p); else scene.remove(p.m); }
  S.spawnFree=false; setupScene(k,lv);
  const L=k.loc; patient.visible=true; patient.position.set(L.patient[0],0.3,L.patient[1]); patient.rotation.set(0,Math.random()*6,0);
  patient.userData.blanket.visible=false; patient.userData.p.position.set(0,0.5,1.2); patient.userData.p.rotation.set(-Math.PI/2,0,0);
  bystander.visible=true; bystander.position.set(L.patient[0]+2,0.2,L.patient[1]+1.5);
  setTarget(L.stop); refreshRoute(true); startLeg(); S.escRoute=S.route?{pts:S.route.pts.map(p=>p.slice()),cum:S.route.cum.slice(),len:S.route.len}:null; // 其他救護車跟住呢條橙色線
  caption(null); show('menu',false); show('result',false); show('over',false); show('quiz',false); show('hudWrap',true); drawLives();
  hud(lv.id.replace('L','第 ')+' 關 · '+k.place,'① 出車 · '+k.title+' · '+lv.todName); $('call').textContent='控制中心：'+k.call; show('callBox',true); setTimeout(()=>show('callBox',false),4200);
  alarm();
}
function arriveScene(){
  S.mode='seq'; S.seq=0; S.step=2; S.tScene=performance.now()/1000-S.t0; endLeg(); S.car.v=0; ring.visible=beacon.visible=arrow.visible=false;
  if(routeMesh) routeMesh.visible=false;

  hud('任務：'+S.kase.place,'② 到場 · 救護員處理');
}
function toHospital(){
  AE=HOSPS[S.dest||'tmh']; S.mode='drive'; S.step=4; clearEvents(); setTarget(AE.stop); refreshRoute(true); if(routeMesh) routeMesh.visible=true; S.stab=100; S.stabLow=100; show('stabBox',true); startLeg();
  hud('送院：'+AE.name+'急症室','④ 送院 · 跟住橙色路線'); caption(null);
  // 重新分佈車同行人到新位置附近
  // 只搬鏡頭睇唔到嘅車同行人（其他會喺行遠咗之後先自然重新分佈）
  cars.forEach(c=>{ if(!c.pose||!inView(c.pose.x,c.pose.z)) placeCar(c,S.car.x,S.car.z); }); peds.forEach(p=>{ if(!p.pos||!inView(p.pos[0],p.pos[1],4)) placePed(p,S.car.x,S.car.z); });
}
function arriveHospital(){ sirenSet(false); S.mode='hseq'; S.seq=0; S.step=5; S.tHosp=performance.now()/1000-S.t0; endLeg(); show('stabBox',false); clearEvents(); S.car.v=0; ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false;
  hud(AE.name+'急症室','⑤ 交接病人'); }
function finish(){
  S.stars=S.lives; S.mode='result'; caption(null); sirenSet(false);
  const lv=S.level; saveBest(lv.id,S.stars); markDone(lv.id);
  // 成就
  ach('first'); if(S.lives===5) ach('perfect'); if(S.onTime>=2) ach('ontime'); if(S.stabLow>=85) ach('steady'); if(S.qScore>=2) ach('quiz');
  if(lv.tod==='night'||lv.tod==='rain') ach('night'); if(LEVELS.every(l=>isDone(l.id))) ach('all'); if(!S.redRun&&S.sirenUsed) ach('siren');
  $('rStars').textContent='♥'.repeat(S.stars)+'♡'.repeat(5-S.stars);
  $('rTime').textContent='到場 '+fmt(S.tScene)+' · 送院完成 '+fmt(S.tHosp);
  const ex=[];
  ex.push((S.onTime>=2?'⏱️ 兩段都準時':'⏱️ 準時 '+S.onTime+' / 2 段'));
  ex.push('🛏️ 病人穩定度最低 '+Math.round(S.stabLow)+'%');
  ex.push('🧰 裝備 '+(S.equipOk?'揀啱':'揀錯')+' · 小測 '+(S.quizOk?'答啱':'答錯'));
  $('rNote').innerHTML=(S.lives===5?'完美！全程冇犯錯。':'扣咗 '+(5-S.lives)+' 粒：'+S.log.join('、'))+'<br><small>'+ex.join(' · ')+'</small>';
  $('rAch').innerHTML=S.newAch.length?'<b>🏆 新成就：</b>'+S.newAch.map(a=>ACH[a].name).join('、'):'';
  const nx=LEVELS[S.lvl+1]; $('rNext').style.display=nx?'block':'none'; if(nx) $('rNext').textContent='下一關：'+caseOf(nx).place+'（'+nx.todName+'）';
  $('rTips').innerHTML='<b>📗 已收集知識卡：'+S.kase.title+'</b><ul>'+S.kase.tips.map(t=>'<li>'+t+'</li>').join('')+'</ul>';
  $('rName').value=getName(); $('rSave').disabled=false; $('rSave').textContent='儲存到排行榜';
  show('result',true); show('hudWrap',false); checkLiveryUnlock(); fireworks(S.stars);
}
/* ---------- 任務完成：按剩低幾多粒心心放煙花（5 粒最多，0 粒冇） ---------- */
let FW=null;
function fireworks(n){ const cv=$('fw'); if(FW){ cancelAnimationFrame(FW.raf); FW=null; } const g=cv.getContext('2d'); const W=cv.width=innerWidth*Math.min(2,devicePixelRatio||1), H=cv.height=innerHeight*Math.min(2,devicePixelRatio||1);
  g.clearRect(0,0,W,H); if(!n||n<1||matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const total=[0,2,4,7,11,18][Math.min(5,n)], dur=1.2+total*0.32, cols=['#ff4d6d','#ffd166','#06d6a0','#4cc9f0','#f72585','#ffffff','#ff9f1c'];
  const shots=[...Array(total)].map((_,i)=>({t:i*(dur/total)*0.9+Math.random()*0.2,x:W*(0.15+Math.random()*0.7),y:H*(0.12+Math.random()*0.35),c:cols[Math.random()*cols.length|0],big:n===5&&i%4===0,done:false}));
  const parts=[]; const t0=performance.now(); FW={raf:0};
  const pop=()=>{ try{ ensureAudio(); if(!actx) return; const o=actx.createOscillator(), gg=actx.createGain(); o.type='triangle'; o.frequency.setValueAtTime(380+Math.random()*200,actx.currentTime); o.frequency.exponentialRampToValueAtTime(90,actx.currentTime+0.25); gg.gain.value=0.025; gg.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.3); o.connect(gg); gg.connect(master); o.start(); o.stop(actx.currentTime+0.3); }catch(e){} };
  const step=()=>{ const t=(performance.now()-t0)/1000; g.globalCompositeOperation='source-over'; g.fillStyle='rgba(0,0,0,0)'; g.clearRect(0,0,W,H);
    shots.forEach(s=>{ if(!s.done&&t>=s.t){ s.done=true; pop(); const k=s.big?90:48, sp=(s.big?7:5)*(W/800+0.6);
      for(let i=0;i<k;i++){ const a=i/k*Math.PI*2+Math.random()*0.1, v=sp*(0.6+Math.random()*0.5); parts.push({x:s.x,y:s.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,c:Math.random()<0.2?'#ffffff':s.c,heart:s.big&&i%6===0}); } } });
    g.globalCompositeOperation='lighter';
    for(let i=parts.length-1;i>=0;i--){ const p=parts[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.06*(W/800+0.6); p.vx*=0.985; p.vy*=0.985; p.life-=0.012; if(p.life<=0){ parts.splice(i,1); continue; }
      g.globalAlpha=Math.max(0,p.life); g.fillStyle=p.c; if(p.heart){ g.font=(14*(W/800+0.6))+'px sans-serif'; g.fillText('♥',p.x,p.y); } else { g.beginPath(); g.arc(p.x,p.y,2.2*(W/800+0.6),0,7); g.fill(); } }
    g.globalAlpha=1; if(t<dur+3||parts.length) FW.raf=requestAnimationFrame(step); else g.clearRect(0,0,W,H); };
  FW.raf=requestAnimationFrame(step); }
function stopFireworks(){ if(FW){ cancelAnimationFrame(FW.raf); FW=null; } const cv=$('fw'); cv.getContext('2d').clearRect(0,0,cv.width,cv.height); }
/* ---------- 心心：做錯一樣扣一粒，扣晒就遊戲結束 ---------- */
function drawLives(lost){ $('lives').innerHTML=[0,1,2,3,4].map(i=>'<span class="'+(i<S.lives?'on':'off')+(i===lost?' lost':'')+'" style="animation-delay:'+(i*0.12)+'s">♥</span>').join(''); $('lives').setAttribute('aria-label','心心 '+S.lives+' / 5'); }
function loseLife(why,msg){ if(S.lives<=0) return; S.lives--; S.log.push(why); drawLives(S.lives); toast(msg+'  −1 ❤');
  const el=$('lives'); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  if(S.lives<=0) setTimeout(()=>gameOver(why),700); }
function gameOver(why){ if(S.mode==='result') return; S.mode='over'; S.car.v=0; sirenSet(false); show('quiz',false); S.quizOpen=false;
  $('oWhy').textContent='最後一次犯錯：'+why+'。'; show('over',true); show('hudWrap',false); }
const fmt=s=>{s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};

/* ---------- 輸入 ---------- */
function bindHold(id,key){ const b=$(id); const on=e=>{e.preventDefault();S.hold[key]=true;b.classList.add('on')}, off=()=>{S.hold[key]=false;b.classList.remove('on')};
  b.addEventListener('pointerdown',on); ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,off)); }
bindHold('bL','L'); bindHold('bR','R'); bindHold('bG','G'); bindHold('bB','B');
const KEYS={ArrowLeft:'L',ArrowRight:'R',ArrowUp:'G',ArrowDown:'B',a:'L',d:'R',w:'G',s:'B'};
addEventListener('keydown',e=>{ if(KEYS[e.key]) S.hold[KEYS[e.key]]=true; if(e.key==='h') $('bH').click(); });
addEventListener('keyup',e=>{ if(KEYS[e.key]) S.hold[KEYS[e.key]]=false; });
$('bH').addEventListener('click',()=>{ if(!VSPEC.siren){ horn(); return; } sirenSet(!S.siren); if(S.siren) S.sirenUsed=true; });
$('rAgain').onclick=()=>{ stopFireworks(); startCase(S.lvl); }; $('rNext').onclick=()=>{ stopFireworks(); startCase(S.lvl+1); }; $('rMenu').onclick=()=>{ stopFireworks(); show('result',false);toMenu();};
$('oAgain').onclick=()=>startCase(S.lvl); $('oMenu').onclick=()=>{show('over',false);toMenu();};
$('bMenu').onclick=()=>{ sirenSet(false); toMenu(); };
function toMenu(){ clearEvents(); setTOD('day'); show('stabBox',false); show('quiz',false); S.quizOpen=false; S.mode='menu'; resetActors(); ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false; caption(null); show('hudWrap',false); renderMenu(); show('menu',true); }

/* ---------- 聲音：警號（撳一下開／關）、出車鐘聲 ---------- */
let actx=null, osc=null, gain=null, sirenTimer=null;
let master=null;
function ensureAudio(){ try{ if(!actx){ actx=new (window.AudioContext||window.webkitAudioContext)(); master=actx.createGain(); master.gain.value=1; master.connect(actx.destination);
      // iOS 解鎖：喺第一次撳嘅時候播一段無聲音訊
      const b=actx.createBuffer(1,1,22050), src=actx.createBufferSource(); src.buffer=b; src.connect(master); src.start(0); }
    if(actx.state!=='running') actx.resume(); initFx(); }catch(e){} }
// 每次撳畫面都確保聲音開咗（有啲瀏覽器會自動暫停音訊）
['pointerdown','touchend','click','keydown'].forEach(ev=>addEventListener(ev,()=>{ if(actx&&actx.state!=='running'){ try{ actx.resume(); }catch(e){} } },{passive:true}));
// 引擎聲（鋸齒波＋低通）同倒車嗶嗶聲，音量都細過警號（0.04）
let eng=null, rev=null;
function initFx(){ if(eng||!actx) return;
  const o=actx.createOscillator(), o2=actx.createOscillator(), f=actx.createBiquadFilter(), g=actx.createGain(); o.type='sawtooth'; o2.type='square'; o2.detune.value=-1200;
  f.type='lowpass'; f.frequency.value=420; g.gain.value=0; o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start(); eng={o,o2,f,g};
  const r=actx.createOscillator(), rg=actx.createGain(); r.type='square'; r.frequency.value=1150; rg.gain.value=0; r.connect(rg); rg.connect(master); r.start(); rev={o:r,g:rg}; }
function audioTick(t){ if(!eng) return; const c=S.car, now=actx.currentTime, driving=S.mode==='drive';
  const gas=driving&&S.hold.G&&!S.hold.B; const v=Math.abs(c.v);
  eng.o.frequency.setTargetAtTime(48+v*4.2,now,0.08); eng.o2.frequency.setTargetAtTime(48+v*4.2,now,0.08); eng.f.frequency.setTargetAtTime(300+v*22,now,0.1);
  eng.g.gain.setTargetAtTime(gas?0.03:(driving&&v>1?0.012:0),now,gas?0.05:0.25);
  const back=driving&&S.hold.B&&c.v<=0.5; const beep=back&&(t*2.4%1)<0.5;
  rev.g.gain.setTargetAtTime(beep?0.025:0,now,0.01); }
function horn(){ ensureAudio(); if(!actx) return; try{ [0,0.22].forEach(d=>{ [392,494].forEach(f=>{ const o=actx.createOscillator(), g=actx.createGain(); o.type='sawtooth'; o.frequency.value=f*(VSPEC.kind==='bus'?0.62:1); g.gain.value=0.02; o.connect(g); g.connect(master); o.start(actx.currentTime+d); o.stop(actx.currentTime+d+0.16); }); }); }catch(e){} }
function sirenSet(on){ if(on&&!VSPEC.siren) on=false; S.siren=on; $('bH').classList.toggle('siren',on); $('bH').setAttribute('aria-pressed',on);
  if(on){ ensureAudio(); if(!actx||osc) return; osc=actx.createOscillator(); gain=actx.createGain(); osc.type='triangle'; gain.gain.value=0.0001; osc.connect(gain); gain.connect(master); osc.start();
    gain.gain.exponentialRampToValueAtTime(0.04,actx.currentTime+0.05); let hi=true; const step=()=>{ if(osc){osc.frequency.setValueAtTime(hi?VSPEC.tone[0]:VSPEC.tone[1],actx.currentTime); hi=!hi;} }; step(); sirenTimer=setInterval(step,VSPEC.tone[2]); }
  else { clearInterval(sirenTimer); if(gain&&actx){ gain.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.08); const o=osc; setTimeout(()=>{try{o.stop()}catch(e){}},120);} osc=null; gain=null; } }
function alarm(){ if(!actx) return; try{ for(let i=0;i<6;i++){ const o=actx.createOscillator(),g=actx.createGain(); o.type='square'; o.frequency.value=1200; g.gain.value=0.04;
  o.connect(g); g.connect(master); o.start(actx.currentTime+i*0.25); o.stop(actx.currentTime+i*0.25+0.12); } }catch(e){} }
document.addEventListener('visibilitychange',()=>{ try{ if(master) master.gain.setTargetAtTime(document.hidden?0:1,actx.currentTime,0.05); if(!document.hidden&&actx&&actx.state!=='running') actx.resume(); }catch(e){} if(document.hidden&&S.siren){ const was=true; sirenSet(false); S._resume=was; } else if(!document.hidden&&S._resume){ S._resume=false; if(S.mode==='drive') sirenSet(true); } });

/* ---------- 小地圖 ---------- */
const MM=document.createElement('canvas'); const MMS=0.35; MM.width=Math.ceil((BX1-BX0+120)*MMS); MM.height=Math.ceil((BZ1-BZ0+120)*MMS);
{ const g=MM.getContext('2d'); g.fillStyle='#eef2e8'; g.fillRect(0,0,MM.width,MM.height); const T=([x,z])=>[(x-BX0+60)*MMS,(z-BZ0+60)*MMS];
  g.fillStyle='#bfe6a8'; MAP.parks.forEach(p=>{g.beginPath();p.forEach((q,i)=>{const [a,b]=T(q);i?g.lineTo(a,b):g.moveTo(a,b)});g.fill();});
  g.fillStyle='#8fd0f2'; MAP.water.forEach(p=>{g.beginPath();p.forEach((q,i)=>{const [a,b]=T(q);i?g.lineTo(a,b):g.moveTo(a,b)});g.fill();});
  g.strokeStyle='#9aa1ad'; g.lineCap='round'; MAP.roads.forEach(r=>{ g.lineWidth=Math.max(1.5,r.w*MMS); g.beginPath(); r.n.forEach((i,k)=>{const [a,b]=T(NODES[i]); k?g.lineTo(a,b):g.moveTo(a,b)}); g.stroke(); });
  g.fillStyle='#d8dee6'; MAP.blds.forEach(b=>{ g.fillStyle=b.lm?'#ffb07a':'#d8dee6'; g.beginPath(); b.p.forEach((q,i)=>{const [a,c]=T(q);i?g.lineTo(a,c):g.moveTo(a,c)}); g.fill(); }); }
const mmc=$('mini'), mg=mmc.getContext('2d');
function drawMini(){
  const W=mmc.width, Hh=mmc.height, c=S.car, sc=2.0; mg.save(); mg.clearRect(0,0,W,Hh);
  mg.beginPath(); mg.arc(W/2,Hh/2,W/2-2,0,Math.PI*2); mg.clip(); mg.fillStyle='#eef2e8'; mg.fillRect(0,0,W,Hh);
  mg.translate(W/2,Hh/2); mg.rotate(Math.PI+c.a); mg.scale(sc,sc);
  mg.drawImage(MM,-(c.x-BX0+60)*MMS,-(c.z-BZ0+60)*MMS);
  if(S.route&&S.mode==='drive'){ mg.strokeStyle='#ff7a1a'; mg.lineWidth=3/sc; mg.beginPath(); mg.moveTo(0,0); S.route.pts.forEach((n,k)=>{ if(k) mg.lineTo((n[0]-c.x)*MMS,(n[1]-c.z)*MMS)}); mg.stroke(); }
  if(S.target){ mg.fillStyle='#e8323c'; mg.beginPath(); mg.arc((S.target[0]-c.x)*MMS,(S.target[1]-c.z)*MMS,4/sc,0,Math.PI*2); mg.fill(); }
  mg.restore(); mg.fillStyle='#1f4fbf'; mg.beginPath(); mg.moveTo(W/2,Hh/2-8); mg.lineTo(W/2+6,Hh/2+6); mg.lineTo(W/2-6,Hh/2+6); mg.fill();
  mg.strokeStyle='#fff'; mg.lineWidth=3; mg.beginPath(); mg.arc(W/2,Hh/2,W/2-2,0,Math.PI*2); mg.stroke();
}

/* ---------- 碰撞 ---------- */
function ambCircles(x,z,a){ const ux=Math.sin(a),uz=Math.cos(a); return VSPEC.circ.map(o=>[x+ux*o,z+uz*o]); }
function hitBuilding(x,z,a){ const ux=Math.sin(a),uz=Math.cos(a), rx=uz, rz=-ux;
  for(const o0 of [-3,-1,1,3]) for(const s0 of [-1.1,1.1]){ const o=o0*VSPEC.kl, s=s0*VSPEC.kw; if(cellAt(x+ux*o+rx*s,z+uz*o+rz*s)&6) return true; } return false; }
function bump(why){ const now=performance.now()/1000; S.collided=true; if(now-S.lastHit>2.5){ S.collisions++; S.lastHit=now; loseLife(why,why+'！'); } }

/* ---------- 主迴圈 ---------- */
function clampCam(want,look){
  // 鏡頭同目標之間有建築物：拉近並升高，避免被樓宇遮住
  const dx=want.x-look.x, dz=want.z-look.z; let f=1;
  for(let k=0.08;k<=1.0;k+=0.04){ if(cellAt(look.x+dx*k,look.z+dz*k)&2){ f=k; break; } }
  if(f<1){ const k=Math.max(0.22,f-0.08); want.x=look.x+dx*k; want.z=look.z+dz*k; want.y=Math.max(want.y,44); }
  return want;
}

const clock=new THREE.Clock(); const camLook=new THREE.Vector3(); const lerp=(a,b,t)=>a+(b-a)*Math.min(1,Math.max(0,t));
function walk(g,t,on,ph=0){ const k=on&&!reduce?Math.sin(t*9+ph):0; g.userData.legL.rotation.x=k*0.5; g.userData.legR.rotation.x=-k*0.5; }
function resize(){ const w=innerWidth,h=innerHeight; R.setSize(w,h); cam.aspect=w/h; cam.fov=w<h?64:52; cam.updateProjectionMatrix(); }
addEventListener('resize',resize); resize();
function tick(){
  const dt=Math.min(0.05,clock.getDelta()), t=clock.elapsedTime; const c=S.car, U=amb.userData;
  // 閃燈：出勤期間長開
  const on=Math.floor(t*5)%2===0, lit=S.siren; // 閃燈跟警號一齊開關
  CURL.forEach((b,i)=>b.material.emissive.setHex(lit&&((i%2===0)===on)?(b.userData.on||0x1550ff):0)); U.pB.intensity=lit&&on?1.4:0; U.pR.intensity=lit&&!on?1.4:0;
  if(S.mode==='drive'){
    const H=S.hold, steer=(H.L?1:0)-(H.R?1:0);
    const onRoad=cellAt(c.x,c.z)&1, vmax=onRoad?VSPEC.vmax:12, AK=VSPEC.acc;
    if(H.G&&!H.B) c.v=Math.min(vmax,c.v+(c.v<0?34:(c.v<12?26:17)*AK)*dt); else if(H.B&&!H.G) c.v=Math.max(-7,c.v-(c.v>0?34:14)*dt);
    else c.v=c.v>0?Math.max(0,c.v-(S.wet?9:14)*dt):Math.min(0,c.v+(S.wet?9:14)*dt);
    if(c.v>vmax) c.v=Math.max(vmax,c.v-20*dt);
    aebTick(dt);
    c.a+=steer*dt*VSPEC.steer*(S.wet?0.82:1)*Math.min(1,Math.abs(c.v)/5+0.35)*(c.v<-0.1?-1:1); stabilityTick(dt,steer);
    const nx=c.x+Math.sin(c.a)*c.v*dt, nz=c.z+Math.cos(c.a)*c.v*dt;
    if(hitBuilding(nx,nz,c.a)){ if(Math.abs(c.v)>3){ bump('撞到建築物'); stabHit(14); } c.v=-c.v*0.25; } else { c.x=nx; c.z=nz; }
    // 同車碰撞
    const AC=ambCircles(c.x,c.z,c.a);
    for(const k of [...cars,...trams,...ESC]){ if(!k.pose) continue; const dx=k.pose.x-c.x, dz=k.pose.z-c.z; const half=(k.m.userData.len||4)/2; if(dx*dx+dz*dz>(half+6)**2) continue;
      const kx=Math.sin(k.pose.a), kz=Math.cos(k.pose.a);
      for(const q of AC){ const pr=Math.max(-half+1.3,Math.min(half-1.3,(q[0]-k.pose.x)*kx+(q[1]-k.pose.z)*kz)); const ex=k.pose.x+kx*pr-q[0], ez=k.pose.z+kz*pr-q[1]; if(ex*ex+ez*ez<3.0*3.0){ if(Math.abs(c.v)>2) bump('撞到車'); if(Math.abs(c.v)>2) stabHit(14); c.v=-c.v*0.3; const L=Math.hypot(ex,ez)||1; c.x-=ex/L*0.6; c.z-=ez/L*0.6; k.hit=1.5; break; } } }
    // 撞到行人 → 遊戲結束
    for(const p of peds){ if(!p.pos) continue; for(const q of AC){ const ex=p.pos[0]-q[0], ez=p.pos[1]-q[1]; if(ex*ex+ez*ez<1.7*1.7&&Math.abs(c.v)>1.2){ c.v=0; p.mode='down'; p.m.rotation.set(-Math.PI/2,p.m.rotation.y,0); loseLife('撞到行人','不能傷害市民！'); break; } } if(S.mode!=='drive') break; }
    U.wheels.forEach(w=>w.rotation.x+=c.v*dt/0.6);
    // 過路口：冇開警號衝紅燈要扣分
    { let inX=-1; for(let kk=0;kk<NODES.length;kk++){ if(SIGNAL[kk]&&Math.hypot(NODES[kk][0]-c.x,NODES[kk][1]-c.z)<CLR[kk]-1.5){ inX=kk; break; } }
      if(inX>=0&&inX!==S.inX&&c.v>2){ const st=lightState(inX,c.a,t);
        if(st==='r'&&!S.siren){ S.redRun=true; loseLife('冇開警號衝紅燈','冇開警號衝紅燈！'); } else if(st==='r'&&S.siren) toast('開咗警號，小心慢駛過燈'); }
      S.inX=inX; }
    // 導航
    // 偏離路線先重新計（唔會每秒都重畫）
    S.routeT+=dt; { const pr=S.route&&routeProj(); if((pr&&pr.d>11&&S.routeT>0.4)||S.routeT>8){ S.routeT=0; refreshRoute(); } }
    const d=Math.hypot(c.x-S.target[0],c.z-S.target[1]);
    $('hDist').textContent=d>1000?(d/1000).toFixed(1)+' 公里':Math.round(d)+' 米';
    legTimer(); dashTick(dt);
    if(S.route){ const n=d<22?S.target:lookAhead(18); const want=Math.atan2(n[0]-c.x,n[1]-c.z);
      if(S.arrowA==null) S.arrowA=want; S.arrowA+=(((want-S.arrowA)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*7);
      arrow.position.set(c.x,7.8+ELEV(c.x,c.z)+Math.sin(t*4)*0.25,c.z); arrow.rotation.y=S.arrowA; }
    if(d<7.5){ S.step===1?arriveScene():arriveHospital(); }
  }
  groundPose(amb,c.x,0.12,c.z,c.a,VSPEC.kl*6);
  ring.scale.setScalar(1+Math.sin(t*4)*0.06);
  /* --- 交通 --- */
  const SV=[]; if(S.siren&&S.mode==='drive') SV.push({x:c.x,z:c.z}); ESC.forEach(e=>{ if(e.pose&&e.m.visible&&!e.done) SV.push({x:e.pose.x,z:e.pose.z}); }); window.__SV=SV;
  for(const k of cars){
    if(!k.road) continue;
    let pose=carPose(k);
    if(k.stuck){ k.pose=pose; groundPose(k.m,pose.x,0.1,pose.z,pose.a,k.m.userData.len); if(k.haz) k.haz.forEach(h=>h.visible=Math.floor(t*3)%2===0); continue; }
    const dx=pose.x-c.x, dz=pose.z-c.z, dd=Math.hypot(dx,dz);
    if(k.waitEnd){ k.pose=pose; if(!inView(pose.x,pose.z)&&placeCar(k,c.x,c.z)) k.waitEnd=false; else { groundPose(k.m,pose.x,0.1,pose.z,pose.a,k.m.userData.len); continue; } pose=carPose(k); }
    if((dd>230||k.evict)&&!inView(pose.x,pose.z)&&S.mode==='drive'){ if(placeCar(k,c.x,c.z)){ k.evict=false; pose=carPose(k); k.cur=k.v; } }
    // 前面有救護車就停；開警號時靠邊減速讓路
    const fx=Math.sin(pose.a), fz=Math.cos(pose.a); const ahead=(-dx)*fx+(-dz)*fz, lat=Math.abs((-dx)*fz-(-dz)*fx);
    let target=k.v0||(k.v0=k.v);
    // 讓救護車：附近有響警號嘅救護車（玩家或者其他救護車）就靠邊減速；未入路口就喺停車線前等
    for(const sv of SV){ const d2=Math.hypot(pose.x-sv.x,pose.z-sv.z); if(d2<55) k.yield=2.5;
      if(SIGNAL[k.to]||DEG[k.to]>=3){ const N=NODES[k.to], rem=(1-k.t)*pose.L, sd=CLR[k.to]+4.6; if(rem>sd-1&&rem<sd+16&&Math.hypot(N[0]-sv.x,N[1]-sv.z)<50) target=Math.min(target,Math.max(0,(rem-sd)*0.9)); } }
    if(k.yield>0){ k.yield-=dt; target=Math.min(target,2.5); }
    if(ahead>0&&ahead<14&&lat<3.5) target=0;
    // 紅綠燈：喺停車線前停
    if(SIGNAL[k.to]){ const stopD=CLR[k.to]+4.6;
      const rem=(1-k.t)*pose.L, st=lightState(k.to,pose.a,t); if(st!=='g'&&rem>stopD-0.8&&rem<stopD+18&&!(st==='y'&&rem<stopD+4)) target=Math.min(target,Math.max(0,(rem-stopD)*0.9)); }
    // 防重疊：前面路徑上（任何方向）有車／輕鐵就停低等；兩架互相擋住就號碼細嗰架先行
    k.id=k.id??cars.indexOf(k); let blocker=null;
    for(const o of [...cars,...trams,...ESC]){ if(o===k||!o.pose) continue; const ex=o.pose.x-pose.x, ez=o.pose.z-pose.z; if(ex*ex+ez*ez>900) continue;
      const oL=(o.m.userData.len||4.4)/2+0.6, oW=(o.m.userData.len?1.4:1.2)+1.25, sa=Math.sin(o.pose.a), ca=Math.cos(o.pose.a), myL=(k.m.userData.len||4.4)/2;
      for(let q=myL;q<=myL+6;q+=1.5){ const px=pose.x+fx*q-o.pose.x, pz=pose.z+fz*q-o.pose.z; const al=px*sa+pz*ca, ac=px*ca-pz*sa;
        if(Math.abs(al)<oL&&Math.abs(ac)<oW){ blocker=o; break; } } if(blocker) break; }
    if(blocker&&!(blocker.blockedBy===k&&k.id<(blocker.id??99))) target=0;
    k.blockedBy=blocker;
    // 跟車：同方向前面有車就減速排隊
    const myLen=(k.m.userData.len||4.4)/2;
    for(const o of cars){ if(o===k||!o.pose) continue; const ex=o.pose.x-pose.x, ez=o.pose.z-pose.z; const ah=ex*fx+ez*fz; if(ah<=0||ah>26) continue;
      if(Math.abs(ex*fz-ez*fx)>2.2||Math.cos(o.pose.a-pose.a)<0.6) continue; const gap=ah-myLen-(o.m.userData.len||4.4)/2-2.2; target=Math.min(target,Math.max(0,gap*1.1)); }
    for(const p of peds){ if(p.mode!=='cross'||!p.pos||!p.onRoad) continue; const ex=p.pos[0]-pose.x, ez=p.pos[1]-pose.z; const ah=ex*fx+ez*fz; if(ah>0&&ah<12&&Math.abs(ex*fz-ez*fx)<3){ target=0; break; } }
    if(k.hit>0){ k.hit-=dt; target=0; }
    k.cur=(k.cur??target)+(target-(k.cur??target))*Math.min(1,dt*2);
    k.t+=k.cur*dt/(pose.L||1); if(k.t>=1){ nextEdge(k); }
    pose=carPose(k); k.pose=pose; groundPose(k.m,pose.x,0.1,pose.z,pose.a,k.m.userData.len);
    const da=((pose.a-k.m.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI; k.m.rotation.y+=da*Math.min(1,dt*6);
  }
  tramTick(dt); rainTick(dt); escortTick(dt,t); audioTick(t); updFrustum(); S.lightT=(S.lightT||0)+dt; if(S.lightT>0.25){ S.lightT=0; updateLights(t); }
  /* --- 行人 --- */
  for(const p of peds){
    if(p.mode==='down'||p.mode==='idle'){ walk(p.m,t,false); if(!inView(p.pos[0],p.pos[1],4)&&Math.hypot(p.pos[0]-c.x,p.pos[1]-c.z)>40){ p.m.rotation.set(0,0,0); placePed(p,c.x,c.z); } p.m.position.set(p.pos[0],p.mode==='down'?0.5:0.15,p.pos[1]); continue; }
    if(p.mode==='dash'){ p.s+=3.4*dt; walk(p.m,t,true,p.s*3); p.pos=[p.x0+p.nx*p.s,p.z0+p.nz*p.s]; p.m.rotation.y=Math.atan2(p.nx,p.nz); if(p.s>p.len){ p.mode='idle'; } p.m.position.set(p.pos[0],0.15,p.pos[1]); continue; }
    if(p.mode==='walk'){ p.s+=p.dir*1.3*dt; if(p.s<p.lo||p.s>p.hi){p.dir*=-1; p.s=Math.max(p.lo,Math.min(p.hi,p.s));}
      const ux=(p.B[0]-p.A[0])/p.L, uz=(p.B[1]-p.A[1])/p.L; p.pos=[p.A[0]+ux*p.s+uz*p.off, p.A[1]+uz*p.s-ux*p.off];
      p.m.rotation.y=Math.atan2(ux*p.dir,uz*p.dir); walk(p.m,t,true,p.s); }
    else { // 過馬路：救護車響號接近時唔開始過
      const near=Math.hypot(p.cx-c.x,p.cz-c.z);
      if(p.wait>0){ p.wait-=dt; walk(p.m,t,false); if(S.siren&&near<40) p.wait=Math.max(p.wait,1); }
      else if(Math.abs(p.s)>=p.half-0.01&&p.node!=null&&lightState(p.node,p.ang,t)!=='r'){ walk(p.m,t,false); } // 等綠公仔（即係車行嘅方向紅燈）
      else { p.s+=p.dir*1.3*dt; walk(p.m,t,true,p.s); if(Math.abs(p.s)>p.half){ p.s=Math.sign(p.s)*p.half; p.dir*=-1; p.wait=2+Math.random()*5; } }
      p.pos=[p.cx+p.nx*p.s, p.cz+p.nz*p.s]; p.onRoad=Math.abs(p.s)<p.half-2.4; p.m.rotation.y=Math.atan2(p.nx*p.dir,p.nz*p.dir);
      if(Math.hypot(p.cx-c.x,p.cz-c.z)>220&&S.mode==='drive'&&!inView(p.pos[0],p.pos[1],4)) placePed(p,c.x,c.z); }
    if(p.mode==='walk'&&Math.hypot(p.pos[0]-c.x,p.pos[1]-c.z)>220&&S.mode==='drive'&&!inView(p.pos[0],p.pos[1],4)) placePed(p,c.x,c.z);
    p.m.position.set(p.pos[0],0.15,p.pos[1]);
  }
  /* --- 到場／醫院動畫 --- */
  if(S.mode==='seq'||S.mode==='hseq') sequence(dt,t);
  bystander.userData.arms[1].rotation.x=-2.6+Math.sin(t*8)*0.4;
  /* --- 鏡頭 --- */
  const portrait=innerWidth<innerHeight;
  const inDepot=S.mode==='drive'&&S.step===1&&!S.leftDepot&&Math.hypot(c.x-DEPOT.pos[0],c.z-DEPOT.pos[1])<24;
  if(inDepot){ // 開波：鏡頭喺救護站門口，影住救護車由車房駛出嚟
    const fx=Math.sin(DEPOT.a), fz=Math.cos(DEPOT.a); S.camYaw=c.a;
    cam.position.lerp(new THREE.Vector3(DEPOT.pos[0]+fx*34,12,DEPOT.pos[1]+fz*34),Math.min(1,dt*3)); // 正對車房門口，避開招牌同牆
    camLook.lerp(new THREE.Vector3(c.x,2,c.z),Math.min(1,dt*6));
    if(!S.hold.G&&c.v<0.5) caption(VSPEC.siren?'按住「油」出車；撳「警號」開閃燈同警號':'按住「油」出車；呢款車冇警號，其他車唔會讓路，要守交通燈'); else caption(null);
  } else if(S.mode==='drive'||S.mode==='over'){
    if(S.step===1&&S.leftDepot!==true){ S.leftDepot=true; caption(null); if(S.level&&S.level.escort) launchEscorts(S.level.escort); }
    S.camYaw+=((c.a-S.camYaw+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*4.5);
    const back=portrait?19:16, up=portrait?14:10.5;
    const eh=ELEV(c.x,c.z); cam.position.lerp(clampCam(new THREE.Vector3(c.x-Math.sin(S.camYaw)*back,up+eh,c.z-Math.cos(S.camYaw)*back),new THREE.Vector3(c.x,0,c.z)),Math.min(1,dt*6));
    camLook.lerp(new THREE.Vector3(c.x+Math.sin(S.camYaw)*6,1.5+eh,c.z+Math.cos(S.camYaw)*6),Math.min(1,dt*9));
  } else if(S.mode==='seq'||S.mode==='hseq'||S.mode==='result'){
    const P=S.mode==='hseq'?AE.door:S.kase.loc.patient; const rear=[c.x-Math.sin(c.a)*4,c.z-Math.cos(c.a)*4];
    const mx=(rear[0]+P[0])/2, mz=(rear[1]+P[1])/2; let dx=mx-P[0], dz=mz-P[1]; const L=Math.hypot(dx,dz)||1; dx/=L; dz/=L;
    const want=new THREE.Vector3(mx+dx*(portrait?11:10),portrait?34:26,mz+dz*(portrait?11:10));
    cam.position.lerp(clampCam(want,new THREE.Vector3(mx,0,mz)),Math.min(1,dt*1.5)); camLook.lerp(new THREE.Vector3(mx,1,mz),Math.min(1,dt*2));
  } else { // 主選單：喺救護站上空慢慢轉
    const d=DEPOT.pos; const a=t*0.08; cam.position.set(d[0]+Math.sin(a)*80,55,d[1]+Math.cos(a)*80); camLook.set(d[0],0,d[1]);
    amb.position.set(d[0],0.12,d[1]); amb.rotation.y=DEPOT.a; }
  cam.lookAt(camLook);
  sun.position.set(cam.position.x+30,60,cam.position.z+20); sun.target.position.set(camLook.x,0,camLook.z);
  if(toastT>0){ toastT-=dt; if(toastT<=0) $('toast').classList.remove('show'); }
  if(S.mode==='drive') drawMini();
  { const px=cam.position.x, pz=cam.position.z; for(const q of INSTC){ const d=Math.hypot(q.c.x-px,q.c.z-pz)-q.r; q.m.visible=d<q.far; } }   // 遠嘅樹同街燈唔畫
  R.render(scene,cam); requestAnimationFrame(tick);
}
/* ---------- 到場：揀裝備、急救小測（各一題，錯就扣一粒） ---------- */
function openChoice(kind){ S.quizOpen=true; S.qKind=kind; caption(null); const Q=kind==='equip'?S.kase.equip:kind==='triage'?S.kase.triage:S.kase.quiz[0]; const n=Q.o.length;
  const order=[...Array(n).keys()].sort(()=>Math.random()-0.5);
  $('qNum').textContent=kind==='equip'?'🧰 到場揀裝備':kind==='triage'?'🏥 分流：送邊間醫院？':'📝 急救小測'; $('qText').textContent=Q.q; $('qWhy').textContent=''; $('qNext').style.display='none';
  $('qOpts').innerHTML=order.map(i=>'<button class="qo" data-i="'+i+'"></button>').join('');
  $('qOpts').querySelectorAll('.qo').forEach(b=>{ b.textContent=Q.o[+b.dataset.i]; b.onclick=()=>{ if($('qNext').style.display!=='none') return; const ok=+b.dataset.i===0;
    if(ok) S.qScore++; else S.qPending=1; if(kind==='equip') S.equipOk=ok; else if(kind==='triage'){ S.triageOk=ok; S.dest=Q.dest[0]; } else S.quizOk=ok;
    $('qOpts').querySelectorAll('.qo').forEach(x=>{ x.disabled=true; if(+x.dataset.i===0) x.classList.add('ok'); else if(x===b) x.classList.add('bad'); });
    $('qWhy').innerHTML='<b>'+(ok?'答啱！':(kind==='equip'?'揀錯裝備，扣 1 粒心心。':kind==='triage'?'分流揀錯醫院，扣 1 粒心心，改送正確醫院。':'答錯咗，扣 1 粒心心。'))+'</b> '; $('qWhy').append(Q.why); $('qNext').style.display='block'; $('qNext').focus(); }; });
  show('quiz',true); }
$('qNext').onclick=()=>{ show('quiz',false); const k=S.qKind==='equip'?0:S.qKind==='triage'?2:1; S.qDone[k]=true; S.quizOpen=false;
  if(S.qPending){ S.qPending=0; const why=['揀錯裝備','急救小測答錯','分流揀錯醫院'][k]; loseLife(why,why); } };

/* ---------- 動畫序列 ---------- */
function sequence(dt,t){
  if(S.quizOpen){ walk(crew.userData.c1,t,false); walk(crew.userData.c2,t,false); return; }
  S.seq+=dt;
  if(S.mode==='seq'&&S.seq>=3.2){ if(!S.qDone[0]){ S.seq=3.2; openChoice('equip'); return; } if(!S.qDone[1]){ S.seq=3.2; openChoice('quiz'); return; } if(!S.qDone[2]){ S.seq=3.2; openChoice('triage'); return; } }
  const s=S.seq, c=S.car, U=amb.userData, C1=crew.userData;
  const rear=new THREE.Vector3(c.x-Math.sin(c.a)*4.8,0.12,c.z-Math.cos(c.a)*4.8);
  const doorA=s<0.8?s/0.8:1; const close=S.mode==='seq'?(s>9.6?Math.min(1,(s-9.6)/0.6):0):(s>8?Math.min(1,(s-8)/0.6):0);
  U.doors.forEach(d=>d.rotation.y=-d.userData.s*1.65*doorA*(1-close));
  const look=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
  if(S.mode==='seq'){
    const P=new THREE.Vector3(S.kase.loc.patient[0]+1.4,0.15,S.kase.loc.patient[1]);
    const st=S.kase.steps;
    if(s<0.8){ crew.visible=false; caption('救護員落車，攞車床同急救裝備'); }
    else if(s<3.2){ crew.visible=true; const k=(s-0.8)/2.4; crew.position.lerpVectors(rear,P,k); crew.rotation.y=look(rear,P); walk(C1.c1,t,true); walk(C1.c2,t,true,1); caption('救護員落車，攞車床同急救裝備'); }
    else if(s<5.0){ walk(C1.c1,t,false); walk(C1.c2,t,false); caption(st[0]); C1.c1.userData.arms.forEach(a=>a.rotation.x=-0.8-Math.sin(s*5)*0.4); }
    else if(s<6.6){ caption(st[1]); if(patient.parent!==C1.st){ C1.st.attach(patient); patient.position.set(0,0.7,0.3); patient.rotation.set(0,0,0); patient.userData.blanket.visible=true; } }
    else if(s<9.0){ const k=(s-6.6)/2.4; crew.position.lerpVectors(P,rear,k); crew.rotation.y=look(P,rear); walk(C1.c1,t,true); walk(C1.c2,t,true,1); caption(st[2]); }
    else if(s<9.6){ crew.visible=false; }
    else if(s>10.6){ toHospital(); bystander.visible=false; }
  } else {
    const D=new THREE.Vector3(AE.door[0],0.15,AE.door[1]); const P=rear.clone().lerp(D,0.85);
    if(s<0.8){ caption('到達急症室，準備交接病人'); }
    else if(s<4.2){ crew.visible=true; const k=(s-0.8)/3.4; crew.position.lerpVectors(rear,P,k); crew.rotation.y=look(rear,D); walk(C1.c1,t,true); walk(C1.c2,t,true,1); caption('推病人入急症室'); }
    else if(s<7.0){ walk(C1.c1,t,false); walk(C1.c2,t,false); caption('向醫護人員交代病人情況同處理'); }
    else if(s<8.0){ crew.visible=false; caption('任務完成！'); }
    else if(s>9.0){ finish(); }
  }
}
/* ================= 遊戲性：限時、突發事件、病人穩定度、日夜天氣、成就、車款、排行榜 ================= */
const store={ get(k,d){ try{ const v=localStorage.getItem('a188.'+k); return v?JSON.parse(v):d; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem('a188.'+k,JSON.stringify(v)); }catch(e){} } };
function bestStars(){ return store.get('best2',{}); }
function saveBest(id,st){ const b=bestStars(); if(!(b[id]>=st)){ b[id]=st; store.set('best2',b); } }
function markDone(id){ const d=store.get('done',{}); d[id]=1; store.set('done',d); }
function isDone(id){ return !!store.get('done',{})[id]; }
const getName=()=>store.get('name','')||'';
const totalStars=()=>Object.values(bestStars()).reduce((a,b)=>a+b,0);

/* ---------- 日夜同天氣 ---------- */
const TOD={day:{sky:0xbfe4fb,hemi:[0xffffff,0xd8e6c8,0.78],sun:[0xffffff,0.75],fog:[200,560],cloud:0xffffff},
  dusk:{sky:0xf6b993,hemi:[0xffe0c8,0xb89a88,0.62],sun:[0xffa060,0.7],fog:[180,520],cloud:0xffd6c0},
  night:{sky:0x18213b,hemi:[0x8090c8,0x202838,0.34],sun:[0x9fb0ff,0.16],fog:[150,460],cloud:0x3a4460,night:true},
  rain:{sky:0x2a3446,hemi:[0x8a9ab0,0x303840,0.38],sun:[0xaab4c8,0.18],fog:[90,330],cloud:0x505a68,night:true,wet:true}};
const headL=new THREE.SpotLight(0xfff4d0,0,70,0.55,0.6,1); headL.position.set(0,2.2,2.5); amb.add(headL); const headT=new THREE.Object3D(); headT.position.set(0,0,30); amb.add(headT); headL.target=headT;
const rain=(()=>{ const N=1400, pos=new Float32Array(N*6); for(let i=0;i<N;i++){ const x=(Math.random()-0.5)*140, y=Math.random()*60, z=(Math.random()-0.5)*140; pos.set([x,y,z,x+0.15,y-1.4,z],i*6); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xb8c8e8,transparent:true,opacity:0.55})); m.visible=false; m.frustumCulled=false; scene.add(m); return m; })();
function rainTick(dt){ if(!rain.visible) return; const p=rain.geometry.attributes.position.array; for(let i=0;i<p.length;i+=6){ p[i+1]-=55*dt; p[i+4]-=55*dt; if(p[i+4]<0){ p[i+1]+=60; p[i+4]+=60; } }
  rain.geometry.attributes.position.needsUpdate=true; rain.position.set(cam.position.x,0,cam.position.z); }
function setTOD(k){ const T=TOD[k]; scene.background.setHex(T.sky); scene.fog.color.setHex(T.sky); scene.fog.near=T.fog[0]; scene.fog.far=T.fog[1]; cam.far=T.fog[1]+60; cam.updateProjectionMatrix();
  hemi.color.setHex(T.hemi[0]); hemi.groundColor.setHex(T.hemi[1]); hemi.intensity=T.hemi[2]; sun.color.setHex(T.sun[0]); sun.intensity=T.sun[1]; CLOUDMAT.color.setHex(T.cloud);
  Object.values(MAT).forEach(m=>{ if(m.map&&m.emissive){ m.emissiveMap=T.night?m.map:null; m.emissive.setHex(T.night?0x2a261c:0); m.needsUpdate=true; } }); // 夜晚：窗口有燈
  headL.intensity=T.night?2.4:0; rain.visible=!!T.wet; S.wet=!!T.wet; }

/* ---------- 限時：每段路程有時限，準時到 +1 ❤，超時 −1 ❤ ---------- */
function startLeg(){ setupEvents(); const len=S.route?S.route.len:400; S.legLimit=Math.round(len/16*S.level.limit/1.4+15); S.legStart=performance.now()/1000; S.overT=false; }
function legLeft(){ return S.legLimit-(performance.now()/1000-S.legStart); }
function legTimer(){ const r=legLeft(), el=$('hTime');
  if(r>=0){ el.textContent=fmt(r); el.classList.toggle('warn',r<15); }
  else { el.textContent='超時 +'+fmt(-r); el.classList.add('warn'); if(!S.overT){ S.overT=true; loseLife('超時','超時！病人等得太耐'); } } }
function endLeg(){ if(legLeft()>=0){ S.onTime++; if(S.lives<5){ S.lives++; drawLives(); toast('準時到達！獎勵 +1 ❤'); } else toast('準時到達！'); } }

/* ---------- 病人穩定度（送院途中） ---------- */
function drawStab(){ const v=Math.max(0,S.stab); $('stabBar').style.width=v+'%'; $('stabBar').style.background=v>60?'#21b46b':v>30?'#f5a623':'#e8323c'; $('stabBox').setAttribute('aria-label','病人穩定度 '+Math.round(v)+'%'); }
function stabHit(n){ if(S.step!==4) return; S.stab-=n; S.stabLow=Math.min(S.stabLow,S.stab); drawStab(); }
function stabilityTick(dt,steer){ if(S.step!==4||S.mode!=='drive') return; const c=S.car, v=Math.abs(c.v);
  let drop=0; const lat=v*Math.abs(steer)*2.2*Math.min(1,v/5+0.35); if(lat>26) drop+=(lat-26)*0.35;
  if(S.hold.B&&c.v>12) drop+=9; if(!(cellAt(c.x,c.z)&1)&&v>8) drop+=6;
  if(drop>0){ S.stab-=drop*dt; if(!S.stabWarn||performance.now()-S.stabWarn>4000){ S.stabWarn=performance.now(); if(drop>6) caption('轉彎同煞車要慢慢嚟，病人喺車廂入面！'); } }
  else { S.stab=Math.min(100,S.stab+3*dt); if(S.stabWarn&&performance.now()-S.stabWarn>2500){ caption(null); S.stabWarn=0; } }
  S.stabLow=Math.min(S.stabLow,S.stab); if(S.stab<=0){ S.stab=55; loseLife('病人情況轉差','揸得太急，病人情況轉差！'); } drawStab(); }

/* ---------- 突發事件：修路封路、壞車塞車、行人衝出馬路 ---------- */
const CLOSED=[], EVT={meshes:[],cells:[],stuck:[]};
function routeEdges(){ const P=S.route?S.route.path:[]; const out=[]; for(let i=2;i<P.length-3;i++){ const r=EDGE[P[i]+'-'+P[i+1]]; if(r&&!r.bridge&&!r.closed&&r.t!=='avenue'){ const A=NODES[P[i]],B=NODES[P[i+1]]; if(Math.hypot(B[0]-A[0],B[1]-A[1])>16) out.push([P[i],P[i+1],r]); } } return out; }
function closeRoad(a,b,r){ r.closed=true; CLOSED.push(r); const A=NODES[a],B=NODES[b]; const [ux,uz]=dirn(A,B), nx=uz, nz=-ux, M0=[(A[0]+B[0])/2,(A[1]+B[1])/2];
  const g=new THREE.Group(); g.position.set(M0[0],0,M0[1]); g.rotation.y=Math.atan2(ux,uz); scene.add(g); EVT.meshes.push(g);
  const stripe=canvasTex(128,32,(c,w,h)=>{ for(let i=0;i<8;i++){ c.fillStyle=i%2?'#ffffff':'#ff6a13'; c.beginPath(); c.moveTo(i*16,0); c.lineTo(i*16+16,0); c.lineTo(i*16,32); c.lineTo(i*16-16,32); c.fill(); } },true);
  stripe.repeat.set(r.w/4,1); [-1.2,1.2].forEach(z=>{ add(new THREE.BoxGeometry(r.w,0.9,0.25),new THREE.MeshStandardMaterial({map:stripe}),g,0,1.1,z,true);
    for(let x=-r.w/2+0.5;x<=r.w/2;x+=r.w/3) add(new THREE.BoxGeometry(0.2,1.2,0.2),M(0x9aa1aa),g,x,0.6,z,false); });
  for(let x=-r.w/2+1;x<r.w/2;x+=2.2) add(new THREE.ConeGeometry(0.4,1.1,10),M(0xff6a13),g,x,0.7,-3.2,false);
  labelPlane('修路 請改道',0,2.8,-1.45,Math.PI,'#ff6a13',6,g); labelPlane('修路 請改道',0,2.8,1.45,0,'#ff6a13',6,g);
  // 碰撞：封住成條路
  for(let o=-r.w/2;o<=r.w/2;o+=1){ for(const z of [-1.2,0,1.2]){ const x=M0[0]+nx*o+ux*z, zz=M0[1]+nz*o+uz*z; const k=gi(x,zz); if(k>=0&&!(grid[k]&2)){ EVT.cells.push(k); grid[k]|=2; } } }
  cars.forEach(c=>{ if(c.road===r&&!c.stuck) c.evict=true; }); return r; } // 封路上面嘅車：出咗鏡頭先搬走
function hazardCar(a,b,r,t,broken){ const m=carModel(broken?'car':['car','taxi','minibus'][Math.random()*3|0]); const c={m,from:a,to:b,road:r,t,stuck:true,yield:0,id:900+EVT.stuck.length};
  if(broken){ c.haz=[[-1,-2.25],[1,-2.25],[-1,2.25],[1,2.25]].map(([x,z])=>add(new THREE.BoxGeometry(0.4,0.25,0.15),new THREE.MeshBasicMaterial({color:0xffa31a}),m.children[0],x*0.85,1.0,z,false));
    const tri=add(new THREE.ConeGeometry(0.5,0.9,3),M(0xff3b30),scene,0,0,0,false); c.tri=tri; EVT.meshes.push(tri); }
  cars.push(c); EVT.stuck.push(c); const p=carPose(c); c.pose=p; m.position.set(p.x,0.1,p.z); m.rotation.y=p.a;
  if(c.tri){ c.tri.position.set(p.x-Math.sin(p.a)*7,0.6,p.z-Math.cos(p.a)*7); } return c; }
function setupEvents(){ const lv=S.level; if(!lv) return; const msgs=[];
  for(let n=0;n<lv.works;n++){ const E=routeEdges(); if(!E.length) break; const [a,b,r]=E[(E.length*(0.35+Math.random()*0.4))|0]; closeRoad(a,b,r); msgs.push((r.name||'前面')+'修路封路'); refreshRoute(true); }
  if(lv.jam&&Math.random()<0.9){ const E=routeEdges(); if(E.length){ const [a,b,r]=E[(E.length*(0.2+Math.random()*0.5))|0]; const L=Math.hypot(NODES[b][0]-NODES[a][0],NODES[b][1]-NODES[a][1]);
      cars.forEach(c=>{ if(c.road===r&&!c.stuck&&!(c.pose&&inView(c.pose.x,c.pose.z))) placeCar(c,S.car.x,S.car.z); });
      hazardCar(a,b,r,0.7,true); for(let q=1;q<=3;q++){ const t=0.7-q*6.5/L; if(t>0.08) hazardCar(a,b,r,t,false); } msgs.push((r.name||'前面')+'有壞車，車龍好長'); } }
  if(msgs.length){ setTimeout(()=>{ if(S.mode!=='drive') return; $('call').textContent='控制中心：'+msgs.join('；')+'。跟住新路線，或者開警號小心越過。'; show('callBox',true); setTimeout(()=>show('callBox',false),4500); },S.step===1?4600:600); } }
function clearEvents(){ EVT.meshes.forEach(m=>scene.remove(m)); EVT.meshes.length=0; EVT.cells.forEach(k=>grid[k]&=~2); EVT.cells.length=0;
  CLOSED.forEach(r=>r.closed=false); CLOSED.length=0; EVT.stuck.forEach(c=>{ scene.remove(c.m); const i=cars.indexOf(c); if(i>=0) cars.splice(i,1); }); EVT.stuck.length=0; }
function dashTick(dt){ if(!(S.dashLeft>0)||!S.leftDepot) return; S.dashT-=dt; const c=S.car; if(S.dashT>0||c.v<10) return;
  const fx=Math.sin(c.a), fz=Math.cos(c.a), P=[c.x+fx*34,c.z+fz*34]; if(!(cellAt(P[0],P[1])&1)){ S.dashT=2; return; }
  const p=peds.find(q=>q.mode!=='dash'&&q.mode!=='down'&&q.pos&&Math.hypot(q.pos[0]-c.x,q.pos[1]-c.z)>60&&!inView(q.pos[0],q.pos[1],4)); if(!p){ S.dashT=2; return; }
  const side=Math.random()<0.5?1:-1, nx=fz*side, nz=-fx*side; Object.assign(p,{mode:'dash',x0:P[0]-nx*10,z0:P[1]-nz*10,nx,nz,s:0,len:20});
  S.dashLeft--; S.dashT=18+Math.random()*14; toast('⚠️ 小心！有人衝出馬路！'); }

/* ---------- 成就同車款 ---------- */
const ACH={first:{ic:'🚑',name:'首次出車',d:'完成任何一關'},perfect:{ic:'💖',name:'完美任務',d:'保住全部 5 粒心心完成一關'},
  ontime:{ic:'⏱️',name:'分秒必爭',d:'到場同送院兩段都準時'},steady:{ic:'🛏️',name:'穩如泰山',d:'送院途中病人穩定度保持 85% 以上'},
  quiz:{ic:'🧠',name:'急救達人',d:'一關入面裝備同小測都答啱'},siren:{ic:'🚨',name:'鳴笛開路',d:'有開警號，而且冇衝紅燈'},
  night:{ic:'🌙',name:'夜更英雄',d:'完成夜晚或者落雨嘅關卡'},all:{ic:'🏅',name:'屯門元朗守護者',d:'完成全部關卡'}};
function ach(id){ const a=store.get('ach',{}); if(a[id]) return; a[id]=Date.now(); store.set('ach',a); S.newAch.push(id); }
/* ---------- 車款：救護車（黃／經典白）、救護電單車、警車、消防車、的士、巴士 ---------- */
// vmax 最高速、acc 加速倍數、steer 轉向、siren 有冇警號、lc 閃燈顏色、tone 警號音 [高,低,間隔ms]
// circ 車身碰撞圓心（沿車身）、kl/kw 車身長闊比例、nose 車頭距離車中心
const LIVERY=[
 {id:'yellow',kind:'amb',name:'救護車（標準黃色）',col:0xffe500,sw:'#ffe500',need:0,vmax:31,acc:1,steer:2.2,siren:true,lc:[0x3a88ff,0x3a88ff],tone:[960,770,560],circ:[-2.2,0,2.2],kl:1,kw:1,nose:2.6,d:'標準性能'},
 {id:'white',kind:'amb',name:'救護車（經典白色）',col:0xf4f6f8,sw:'#f4f6f8',need:4,vmax:31,acc:1,steer:2.2,siren:true,lc:[0x3a88ff,0x3a88ff],tone:[960,770,560],circ:[-2.2,0,2.2],kl:1,kw:1,nose:2.6,d:'舊款紅黃斜紋塗裝，標準性能'},
 {id:'moto',kind:'moto',name:'救護電單車',sw:'#d7ff2e',need:8,vmax:38,acc:1.35,steer:2.75,siren:true,lc:[0x3a88ff,0x3a88ff],tone:[960,770,560],circ:[-0.7,0.7],kl:0.42,kw:0.4,nose:1.4,d:'最快最靈活，藍色閃燈'},
 {id:'police',kind:'police',name:'警車',sw:'linear-gradient(#fff 35%,#d8202a 35%,#d8202a 50%,#1f4fbf 50%,#1f4fbf 70%,#fff 70%)',need:12,vmax:34,acc:1.15,steer:2.4,siren:true,lc:[0x3a88ff,0xff2a2a],tone:[1150,820,330],circ:[-1.9,0,1.9],kl:0.9,kw:0.9,nose:3.0,d:'快少少，紅藍閃燈'},
 {id:'fire',kind:'fire',name:'消防車',sw:'linear-gradient(#ffc400 30%,#d8202a 30%)',need:17,vmax:28,acc:0.85,steer:1.95,siren:true,lc:[0xff2a2a,0xff2a2a],tone:[720,540,640],circ:[-2.2,0,2.2],kl:1,kw:1,nose:3.3,d:'車身重、較慢，紅色閃燈'},
 {id:'taxi',kind:'taxi',name:'的士',sw:'#2bb04a',need:22,vmax:33,acc:1.1,steer:2.5,siren:false,lc:[0,0],tone:[0,0,500],circ:[-1.4,1.4],kl:0.7,kw:0.85,nose:2.25,d:'冇警號冇閃燈：其他車唔會讓路，要守交通燈'},
 {id:'bus',kind:'bus',name:'雙層巴士',sw:'#e8343a',need:27,vmax:24,acc:0.65,steer:1.6,siren:false,lc:[0,0],tone:[0,0,500],circ:[-3.4,-1.2,1.2,3.4],kl:1.45,kw:1,nose:4.5,d:'又大又慢、冇警號：最高難度'}];
let VSPEC=LIVERY[0], CURL=amb.userData.blues;
amb.add(amb.userData.pB,amb.userData.pR);   // 閃燈光源搬去車組，換車身都照用
const AMB_Y=[]; amb.traverse(o=>{ if(o.isMesh&&o.material&&o.material.color&&o.material.color.getHex()===0xffe500&&!AMB_Y.includes(o.material)) AMB_Y.push(o.material); });
const lamp=(w,h,d,col,on,par,x,y,z)=>{ const m=add(rbox(w,h,d,0.05),M(col),par,x,y,z,false); m.userData.on=on; return m; };
const ptex=(key,w,h,draw)=>vtex('pv'+key,w,h,draw);
const chev=(g,x0,y0,w,h,sw,c1,c2)=>{ g.save(); g.beginPath(); g.rect(x0,y0,w,h); g.clip(); for(let i=-2;i*sw<w+h;i++){ g.fillStyle=(i&1)?c1:c2; g.beginPath(); g.moveTo(x0+i*sw,y0+h); g.lineTo(x0+i*sw+h,y0); g.lineTo(x0+i*sw+h+sw,y0); g.lineTo(x0+i*sw+sw,y0+h); g.fill(); } g.restore(); };
const SKB={
 /* 消防車（輕型泵車款）：紅車身、黃色車頂邊、銀色捲閘、車頂紅色燈排 */
 fire(){ const g=new THREE.Group(); const red='#d8202a', yel='#ffc400';
  const side=f=>ptex('fireS'+f,1024,368,(c,W,H)=>{ const X=x=>f?x:W-x, R=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); c.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
    c.fillStyle=red; c.fillRect(0,0,W,H); c.fillStyle=yel; c.fillRect(0,0,W,46);
    [[40,330],[350,640]].forEach(([a,b])=>{ c.fillStyle='#c9ced4'; R(a,70,b,300); c.fillStyle='rgba(0,0,0,.16)'; for(let y=78;y<300;y+=12) R(a,y,b,y+3); c.strokeStyle='#8a9098'; c.lineWidth=5; c.strokeRect(Math.min(X(a),X(b)),70,Math.abs(b-a),230); });
    c.fillStyle='#20262e'; R(700,74,790,170); R(830,74,990,180);                    // 後座窗、駕駛室窗
    c.strokeStyle='rgba(0,0,0,.3)'; c.lineWidth=4; c.strokeRect(Math.min(X(815),X(1000)),60,185,270);
    chev(c,Math.min(X(690),X(1010)),236,320,40,26,yel,red);
    c.fillStyle=yel; c.font='bold 30px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('RESCUE',X(910),208);
    c.fillStyle='rgba(0,0,0,.35)'; c.fillRect(0,H-26,W,26); });
  const front=ptex('fireF',256,236,(c,W,H)=>{ c.fillStyle=red; c.fillRect(0,0,W,H); c.fillStyle=yel; c.fillRect(0,0,W,28);
    c.fillStyle='#20262e'; c.fillRect(22,36,W-44,78); c.fillStyle=yel; c.fillRect(50,122,W-100,22); c.fillRect(34,150,W-68,24);
    c.fillStyle=red; c.font='bold 17px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('救 RESCUE 援',W/2,134); c.fillText('消 FIRE SERVICES 防',W/2,163);
    c.fillStyle='#16181c'; c.fillRect(60,182,W-120,34); c.fillStyle='#fff6d0'; c.fillRect(18,186,34,26); c.fillRect(W-52,186,34,26); });
  const rear=ptex('fireR',256,236,(c,W,H)=>{ c.fillStyle=red; c.fillRect(0,0,W,H); c.fillStyle=yel; c.fillRect(0,0,W,30); c.fillStyle='#c9ced4'; c.fillRect(30,40,W-60,150);
    c.fillStyle='rgba(0,0,0,.16)'; for(let y=46;y<190;y+=10) c.fillRect(30,y,W-60,3); c.strokeStyle='#e8ecef'; c.lineWidth=4; c.strokeRect(150,36,50,170); for(let y=52;y<200;y+=22){ c.beginPath(); c.moveTo(150,y); c.lineTo(200,y); c.stroke(); }
    c.fillStyle='#ff4040'; c.fillRect(10,196,30,18); c.fillRect(W-40,196,30,18); c.fillStyle=yel; c.fillRect(96,200,64,20); });
  const base=solid(0xd8202a);
  vbox(2.55,2.5,6.5,[side(true),side(false),base,base,front,rear],g,0,1.85,0);
  vbox(2.6,0.14,6.55,base,g,0,3.15,0,false);
  [-0.75,0.75].forEach(x=>{ const r=add(cyl(0.05,0.05,5.0,6),M(0xc9ced4),g,x,3.42,-0.6,false); r.rotation.x=Math.PI/2; });
  [-2.6,-1.4,-0.2,1.0].forEach(z=>add(new THREE.BoxGeometry(1.5,0.05,0.06),M(0xc9ced4),g,0,3.42,z,false));
  [[-1.1,-2.9],[1.1,-2.9],[-1.1,1.4],[1.1,1.4]].forEach(([x,z])=>add(cyl(0.04,0.04,0.3,6),M(0xc9ced4),g,x,3.3,z,false));
  const blues=[lamp(0.9,0.24,0.34,0xb81818,0xff1a1a,g,-0.62,3.36,2.7), lamp(0.9,0.24,0.34,0xb81818,0xff1a1a,g,0.62,3.36,2.7), lamp(0.5,0.2,0.2,0xb81818,0xff1a1a,g,-0.9,3.3,-3.1), lamp(0.5,0.2,0.2,0xb81818,0xff1a1a,g,0.9,3.3,-3.1)];
  { const s=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.2),new THREE.MeshBasicMaterial({map:tex([{t:'FIRE',f:'bold 44px sans-serif'}],'#ffffff','#d8202a',128,56)})); s.position.set(0,3.36,2.88); g.add(s); }
  wheelsAt(g,[[-1.15,2.05],[1.15,2.05],[-1.15,-1.95],[1.15,-1.95]],0.58,0.42); g.userData.blues=blues; return g; },
 /* 警車（白色客貨車）：紅藍紅腰帶、「警 POLICE 察」、車頂藍紅閃燈 */
 police(){ const g=new THREE.Group(); const red='#d8202a', blu='#1f3fa8';
  const side=f=>ptex('polS'+f,1024,400,(c,W,H)=>{ const X=x=>f?x:W-x, R=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); c.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
    c.fillStyle='#f4f6f8'; c.fillRect(0,0,W,H);
    c.fillStyle='#20262e'; R(40,50,300,170); R(320,50,560,170); R(600,50,740,170); R(770,56,900,170);
    c.fillStyle='rgba(255,255,255,.14)'; for(let x=44;x<560;x+=14) R(x,50,x+3,170);     // 車窗鐵網
    c.fillStyle=red; R(0,196,930,300); c.fillStyle=blu; R(0,222,930,274);
    c.fillStyle='#fff'; c.font='bold 40px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(f?'警 POLICE 察':'警 POLICE 察',X(420),250);
    c.strokeStyle='rgba(0,0,0,.22)'; c.lineWidth=4; c.strokeRect(Math.min(X(590),X(750)),40,160,320); c.strokeRect(Math.min(X(760),X(910)),40,150,320);
    c.fillStyle='rgba(0,0,0,.3)'; c.fillRect(0,H-22,W,22); });
  const front=ptex('polF',256,200,(c,W,H)=>{ c.fillStyle='#f4f6f8'; c.fillRect(0,0,W,H); c.fillStyle=red; c.fillRect(0,20,W,50); c.fillStyle=blu; c.fillRect(0,32,W,26);
    c.fillStyle='#fff'; c.font='bold 22px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('POLICE',W/2,46);
    c.fillStyle='#16181c'; c.fillRect(70,92,W-140,50); c.fillStyle='#fff6d0'; c.fillRect(14,96,46,34); c.fillRect(W-60,96,46,34); c.fillStyle='#16181c'; c.fillRect(0,160,W,40); });
  const rear=ptex('polR',256,400,(c,W,H)=>{ c.fillStyle='#f4f6f8'; c.fillRect(0,0,W,H); c.fillStyle='#20262e'; c.fillRect(24,50,96,120); c.fillRect(136,50,96,120);
    c.fillStyle=red; c.fillRect(0,196,W,104); c.fillStyle=blu; c.fillRect(0,222,W,52); c.fillStyle='#fff'; c.font='bold 34px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('POLICE',W/2,250);
    c.fillStyle='#ff4040'; c.fillRect(6,310,22,50); c.fillRect(W-28,310,22,50); c.strokeStyle='rgba(0,0,0,.25)'; c.lineWidth=3; c.beginPath(); c.moveTo(W/2,30); c.lineTo(W/2,380); c.stroke(); });
  const wh=solid(0xf4f6f8), gl=M(C.glass,{r:0.2});
  vbox(2.3,2.3,5.2,[side(true),side(false),wh,wh,wh,rear],g,0,1.65,-0.45);
  vbox(2.28,1.15,0.95,[wh,wh,wh,wh,front,wh],g,0,1.08,2.6);
  const ws=add(new THREE.BoxGeometry(2.1,1.15,0.08),gl,g,0,2.18,2.36,false); ws.rotation.x=-0.5;
  const fill=add(new THREE.BoxGeometry(2.28,0.2,0.5),wh,g,0,2.72,2.0,false);
  const blues=[lamp(0.85,0.2,0.32,0x2f6bff,0x1550ff,g,-0.5,2.92,1.5), lamp(0.85,0.2,0.32,0xc22020,0xff1a1a,g,0.5,2.92,1.5), lamp(0.3,0.14,0.1,0xc22020,0xff1a1a,g,-0.6,1.42,3.09), lamp(0.3,0.14,0.1,0x2f6bff,0x1550ff,g,0.6,1.42,3.09)];
  add(new THREE.BoxGeometry(2.0,0.08,0.4),M(0x2b2d33),g,0,2.82,1.5,false);
  wheelsAt(g,[[-1.05,1.9],[1.05,1.9],[-1.05,-1.9],[1.05,-1.9]],0.5,0.38); g.userData.blues=blues; return g; },
 /* 救護電單車：螢光黃車身、紅色斜紋、尾箱生命之星、藍色閃燈 */
 moto(){ const g=new THREE.Group(); const Yf=M(0xd7ff2e,{r:0.4,e:0x1c2400}), dk=M(C.dark), red=M(0xe8202a);
  const pan=ptex('motoP',128,96,(c,W,H)=>{ c.fillStyle='#d7ff2e'; c.fillRect(0,0,W,H); chev(c,0,30,W,36,22,'#e8202a','#d7ff2e'); c.fillStyle='#1c1c1c'; c.fillRect(0,0,W,10); c.fillRect(0,H-10,W,10); });
  const topT=ptex('motoT',128,96,(c,W,H)=>{ c.fillStyle='#d7ff2e'; c.fillRect(0,0,W,H); c.fillStyle='#e8202a'; c.fillRect(0,H-26,W,26); drawStar(c,W/2,38,28); });
  [1.0,-1.0].forEach(z=>{ const w=add(cyl(0.44,0.44,0.2,16),dk,g,0,0.44,z); w.rotation.z=Math.PI/2; add(cyl(0.2,0.2,0.22,10),M(0xc9ced4),g,0,0.44,z,false).rotation.z=Math.PI/2; });
  add(rbox(0.42,0.5,1.05,0.1),M(0x5b6270),g,0,0.62,0.0);                      // 引擎
  add(rbox(0.62,0.5,1.0,0.18),Yf,g,0,1.08,0.38);                               // 油缸
  add(rbox(0.5,0.12,0.4,0.05),red,g,0,1.2,0.5,false);
  add(rbox(0.56,0.42,0.55,0.15),Yf,g,0,1.25,0.98);                             // 車頭罩
  add(rbox(0.3,0.16,0.3,0.06),Yf,g,0,0.95,1.3);                                // 鳥嘴
  const ws=add(new THREE.BoxGeometry(0.5,0.6,0.05),M(C.glass,{r:0.15,op:0.6}),g,0,1.72,1.02,false); ws.rotation.x=-0.35;
  add(sph(0.11),M(0xfff6c4,{e:0x554400}),g,0,1.3,1.27,false);
  const fk=add(cyl(0.05,0.05,0.95,8),M(0xc9ced4),g,0,0.85,1.05,false); fk.rotation.x=0.35;
  const hb=add(cyl(0.035,0.035,0.9,8),dk,g,0,1.5,0.72,false); hb.rotation.z=Math.PI/2;
  add(rbox(0.44,0.16,0.85,0.06),dk,g,0,1.02,-0.4);                             // 座位
  add(rbox(0.4,0.3,0.5,0.08),Yf,g,0,0.86,-1.0);                                // 尾殼
  [-1,1].forEach(s=>vbox(0.34,0.6,0.85,[pan,pan,solid(0x1c1c1c),solid(0x1c1c1c),pan,pan],g,s*0.5,0.86,-0.92));
  vbox(0.62,0.46,0.6,[topT,topT,solid(0xd7ff2e),solid(0xd7ff2e),topT,topT],g,0,1.42,-1.08);
  add(cyl(0.02,0.02,0.6,6),M(0x9aa1ab),g,0.26,1.95,-1.3,false);
  const blues=[lamp(0.14,0.18,0.14,0x2f6bff,0x1550ff,g,0.26,2.3,-1.3), lamp(0.16,0.12,0.1,0x2f6bff,0x1550ff,g,-0.34,1.42,1.08), lamp(0.16,0.12,0.1,0x2f6bff,0x1550ff,g,0.34,1.42,1.08)];
  // 救護員（頭盔）
  const r=person('crew'); r.scale.set(0.62,0.62,0.62); r.position.set(0,0.78,-0.38); r.rotation.x=0.12; g.add(r);
  r.children.forEach(o=>{ if(o.position.y>1.9) o.scale.multiplyScalar(0.01); });   // 收起大頭，換細頭盔
  const hm=add(sph(0.27),M(0xf4f6f8,{r:0.3}),g,0,1.98,-0.2); hm.scale.set(1,0.95,1.1); add(new THREE.BoxGeometry(0.36,0.13,0.08),M(C.glass,{r:0.1}),g,0,1.96,0.07,false);
  g.userData.blues=blues; return g; },
 /* 的士：綠色新界的士（同路面嗰款一樣），冇警號 */
 taxi(){ const g=new THREE.Group(); taxiModel(g,true); g.scale.setScalar(1.05); g.userData.blues=[]; return g; },
 /* 雙層巴士：紅色，縮細少少方便出入車房，冇警號 */
 bus(){ const r=Math.random; Math.random=()=>0; const g=busModel(); Math.random=r; g.scale.setScalar(0.78); g.userData.blues=[]; return g; }
};
const SKINS={};
function applyLivery(id){ const L=LIVERY.find(l=>l.id===id)||LIVERY[0]; VSPEC=L; const U=amb.userData, isAmb=L.kind==='amb';
  U.body.visible=isAmb; for(const k in SKINS) SKINS[k].visible=false;
  if(isAmb){ AMB_Y.forEach(m=>{ m.color.setHex(L.col); m.emissive.setHex(L.id==='white'?0x262626:0x3a3300); }); U.setClassic(L.id==='white'); CURL=U.blues; }
  else { let s=SKINS[L.kind]; if(!s){ s=SKINS[L.kind]=SKB[L.kind](); amb.add(s); s.position.set(0,0,0); s.rotation.set(0,0,0); s.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); } s.visible=true; CURL=s.userData.blues; }
  U.pB.color.setHex(L.lc[0]||0x3a88ff); U.pR.color.setHex(L.lc[1]||0x3a88ff);
  const bh=$('bH'); bh.textContent=L.siren?'警號':'響咹'; bh.setAttribute('aria-label',L.siren?'警號開關':'響咹');
  try{ if(S.siren) sirenSet(false); }catch(e){}
  store.set('livery',L.id); }

function checkLiveryUnlock(){ const tot=totalStars(), seen=store.get('livSeen',0); const nu=LIVERY.filter(l=>l.need>seen&&l.need<=tot);
  if(nu.length){ $('rAch').innerHTML+=(($('rAch').innerHTML)?'<br>':'')+'<b>🚑 新車款：</b>'+nu.map(l=>l.name).join('、')+'（去「車款」換）'; } store.set('livSeen',Math.max(seen,tot)); }
applyLivery(store.get('livery','yellow'));

/* ---------- 排行榜：本機＋（如有）網上 ---------- */
let DB=null, UID=null;
(async()=>{ try{ if(typeof claude==='undefined'||!claude.use) return; const db=await claude.use('db'), u=await claude.use('user'); if(db&&u){ const id=await u.id(); if(id){ DB=db; UID=id; if(S.mode==='menu'&&S.tab==='board') renderMenu('board'); } } }catch(e){} })();
function rankSort(a,b){ return b.st-a.st||a.tm-b.tm; }
async function saveScore(){ const n=($('rName').value||'').trim().slice(0,12)||'無名救護員'; store.set('name',n); const lv=S.level.id; const rec={n,st:S.stars,tm:Math.round(S.tHosp),d:Date.now()};
  const lb=store.get('lb',{}); lb[lv]=(lb[lv]||[]).concat([rec]).sort(rankSort).slice(0,5); store.set('lb',lb);
  $('rSave').disabled=true; $('rSave').textContent='已儲存 ✓';
  if(DB&&UID){ try{ const ref=DB.doc('board/'+UID); const cur=await ref.get(); const body=cur.exists?JSON.parse(JSON.stringify(cur.data())):{lv:{}};
      body.n=n; body.lv=body.lv||{}; const old=body.lv[lv]; if(!old||rankSort(rec,old)<0) body.lv[lv]={st:rec.st,tm:rec.tm}; await ref.set(body); $('rSave').textContent='已儲存（網上）✓'; }catch(e){} } }
$('rSave').onclick=saveScore;
async function onlineBoard(lv,box){ if(!DB){ box.textContent='（網上排行榜：分享俾朋友，佢哋有「可使用」權限就可以一齊上榜）'; return; }
  box.textContent='載入緊…'; let done=false; const tmo=setTimeout(()=>{ if(!done) box.textContent='暫時連唔到網上排行榜'; },10000);
  try{ const q=await DB.collection('board').limit(300).get(); done=true; clearTimeout(tmo);
    const rows=q.docs.map(d=>{ const v=d.data()||{}; const r=v.lv&&v.lv[lv]; return r?{n:String(v.n||'無名').slice(0,12),st:+r.st||0,tm:+r.tm||0,me:d.id===UID}:null; }).filter(Boolean).sort(rankSort).slice(0,10);
    box.textContent=''; if(!rows.length){ box.textContent='暫時未有人上榜，做第一個！'; return; } box.append(boardTable(rows)); }catch(e){ done=true; clearTimeout(tmo); box.textContent='暫時連唔到網上排行榜'; } }
function boardTable(rows){ const t=document.createElement('table'); t.className='board'; rows.forEach((r,i)=>{ const tr=t.insertRow(); const c0=tr.insertCell(); c0.textContent=(i+1)+'.';
  const c1=tr.insertCell(); c1.className='n'; c1.textContent=r.n+(r.me?'（你）':''); const c2=tr.insertCell(); c2.textContent='♥'.repeat(r.st); c2.style.color='#ff3b5c';
  const c3=tr.insertCell(); c3.className='r'; c3.textContent=fmt(r.tm); }); return t; }

/* ---------- 選單 ---------- */
function renderMenu(tab){ tab=tab||S.tab||'levels'; S.tab=tab; const B=$('tabBody'); B.innerHTML='';
  document.querySelectorAll('#tabs button').forEach(b=>{ b.setAttribute('aria-selected',b.dataset.t===tab); b.onclick=()=>renderMenu(b.dataset.t); });
  const best=bestStars(), el=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };
  if(S.unlockMsg){ S.unlockMsg=false; B.append(el('p','ach-new','🔓 已解鎖全部關卡、知識卡同車款！')); }
  if(tab==='levels'){ B.append(el('p',null,'由屯門救護站出車，到場處理，再送去屯門醫院急症室。完成一關解鎖下一關：'));
    const box=el('div'); box.id='cases'; LEVELS.forEach((lv,i)=>{ const k=caseOf(lv), lock=!unlockedAll()&&i>0&&!isDone(LEVELS[i-1].id), st=best[lv.id]||0;
      const b=el('button','case'+(lock?' locked':'')); b.disabled=lock;
      b.append(el('span','pl','第 '+(i+1)+' 關 · '+lv.todName+(lv.works?' · 修路':'')+(lv.jam?' · 塞車':'')), el('b',null,(lock?'🔒 ':'')+k.place+'：'+k.title), el('span','st','♥'.repeat(st)+'♡'.repeat(5-st)));
      b.onclick=()=>startCase(i); box.append(b); }); B.append(box);
    const r=el('div','rules'); r.innerHTML='<b>點玩：</b>◀ ▶ 轉彎，按住「油」前進，「倒」倒車；撳「警號」開閃燈同警號，其他車會讓路，可以安全過紅燈。<br><b>限時：</b>準時到 +1 ❤，超時 −1 ❤。<br><b>心心：</b>5 粒；撞車、撞樓、撞人、冇警號衝紅燈、揀錯裝備、答錯小測、病人穩定度跌晒，每次 −1 ❤，扣晒遊戲結束。<br><b>送院：</b>轉彎同煞車要慢慢嚟，保持病人穩定。'; B.append(r); }
  if(tab==='cards'){ B.append(el('p',null,'完成關卡就收集到嗰個個案嘅急救知識卡：'));
    LEVELS.forEach((lv,i)=>{ const k=caseOf(lv), d=el('div','kcard'+(isDone(lv.id)||unlockedAll()?'':' lock'));
      if(isDone(lv.id)||unlockedAll()){ d.append(el('b',null,'📗 '+k.title+'（'+k.place+'）')); const ul=el('ul'); k.tips.forEach(t=>ul.append(el('li',null,t))); d.append(ul); }
      else d.append(el('b',null,'🔒 完成第 '+(i+1)+' 關解鎖')); B.append(d); }); }
  if(tab==='ach'){ const got=store.get('ach',{}); B.append(el('p',null,'已解鎖 '+Object.keys(got).length+' / '+Object.keys(ACH).length+' 個成就'));
    const l=el('div','achl'); Object.entries(ACH).forEach(([id,a])=>{ const d=el('div','achi'+(got[id]?'':' lock')); d.append(el('span','ic',got[id]?a.ic:'🔒')); const t=el('div'); t.append(el('b',null,a.name),el('small',null,a.d)); d.append(t); l.append(d); }); B.append(l); }
  if(tab==='board'){ const sel=el('div','lvsel'); S.boardLv=S.boardLv||'L1'; LEVELS.forEach((lv,i)=>{ const b=el('button',lv.id===S.boardLv?'on':null,'第'+(i+1)+'關'); b.onclick=()=>{ S.boardLv=lv.id; renderMenu('board'); }; sel.append(b); }); B.append(sel);
    B.append(el('div','bhead','📱 呢部機嘅紀錄')); const lb=store.get('lb',{})[S.boardLv]||[]; if(lb.length) B.append(boardTable(lb)); else B.append(el('p',null,'未有紀錄。完成關卡後喺結算畫面儲存。'));
    B.append(el('div','bhead','🌐 網上排行榜')); const ob=el('div'); B.append(ob); onlineBoard(S.boardLv,ob); }
  if(tab==='livery'){ const tot=totalStars(), cur=(LIVERY.find(l=>l.id===store.get('livery','yellow'))||LIVERY[0]).id; B.append(el('p',null,'累積最佳心心數：'+tot+' 粒。儲夠星數就解鎖新車款，每款性能唔同：'));
    LIVERY.forEach(L=>{ const lock=tot<L.need&&!unlockedAll(); const b=el('button','liv'+(L.id===cur?' on':'')); b.disabled=lock; const sw=el('span','sw'); sw.style.background=L.sw;
      const bar=n=>'●'.repeat(n)+'○'.repeat(5-n), sp=Math.max(1,Math.min(5,Math.round((L.vmax-20)/3.6))), ag=Math.max(1,Math.min(5,Math.round((L.steer-1.3)/0.29)));
      const t=el('div'); t.append(el('b',null,L.name+(L.id===cur?'（使用中）':'')),el('small',null,lock?' 🔒 需要 '+L.need+' 粒心心':' 已解鎖'),el('br'),el('small',null,'速度 '+bar(sp)+'　靈活 '+bar(ag)+'　'+(L.siren?'有警號':'冇警號')),el('br'),el('small',null,L.d)); b.append(sw,t); b.onclick=()=>{ applyLivery(L.id); renderMenu('livery'); }; B.append(b); }); }
}

/* ---------- 交通意外現場：青山公路（巴士同小巴相撞） ---------- */
LMK.crash=(()=>{ const E=nearestEdge(...RP(330,300),r=>r.name==='青山公路'); const ux=-E.nz, uz=E.nx; // 行車方向：現場喺左手邊
  const lo=laneOff(E.r), R=E.R, P=(a,b)=>[R[0]+ux*a+E.nx*b,R[1]+uz*a+E.nz*b];
  return {stop:P(-6,lo),patient:P(4,E.r.w/2+2),ux,uz,nx:E.nx,nz:E.nz,P,w:E.r.w}; })();
const SCN={meshes:[],statics:[]};
function staticVeh(m,x,z,a){ m.position.set(x,0.1,z); m.rotation.y=a; const o={m,stuck:true,road:null,pose:{x,z,a},id:800+SCN.statics.length}; cars.push(o); SCN.statics.push(o); return o; }
function setupScene(k,lv){ clearScene();
  if(k.id==='crash'){ const C0=LMK.crash, P=C0.P, base=Math.atan2(C0.ux,C0.uz);
    const bp=P(16,laneOff({t:'main',w:C0.w})); staticVeh(carModel('bus'),bp[0],bp[1],base+0.35);
    const mp=P(23,-1.5); staticVeh(carModel('minibus'),mp[0],mp[1],base-1.25);
    for(let i=0;i<14;i++){ const d=P(18+Math.random()*7,Math.random()*6-2); const g=add(new THREE.BoxGeometry(0.3+Math.random()*0.5,0.08,0.3+Math.random()*0.5),M([0xd8dde3,0x9aa1aa,0xffd23f][i%3]),scene,d[0],0.2,d[1],false); g.rotation.y=Math.random()*3; SCN.meshes.push(g); } // 碎片
    [P(4,C0.w/2-1),P(32,C0.w/2-1)].forEach(p=>{ const t=add(new THREE.ConeGeometry(0.45,0.9,3),M(0xff3b30),scene,p[0],0.6,p[1],false); SCN.meshes.push(t); }); // 警告三角
    for(let i=0;i<3;i++){ const pp=person('bystander'); const q=P(20+i*2.5,C0.w/2+2.5); pp.position.set(q[0],0.2,q[1]); pp.rotation.y=Math.random()*6; SCN.meshes.push(pp); } }
  if(k.id==='mass'){ const P0=LMK.plaza.patient; const col=[0xe8323c,0xffc21a,0x21b46b,0xffc21a,0x21b46b];
    for(let i=0;i<5;i++){ const lp=lyingPatient(); const x=P0[0]+Math.cos(i*1.3)*(4+i*1.2), z=P0[1]+Math.sin(i*1.3)*2.2; lp.position.set(x,0.3,z); lp.rotation.set(0,Math.random()*6,0);
      lp.userData.blanket.visible=false; lp.userData.p.position.set(0,0.5,1.2); lp.userData.p.rotation.set(-Math.PI/2,0,0);
      add(new THREE.BoxGeometry(0.5,0.05,0.35),new THREE.MeshBasicMaterial({color:col[i]}),lp,0,0.95,0.6,false); SCN.meshes.push(lp); }
    for(let i=0;i<4;i++){ const pp=person('bystander'); pp.position.set(P0[0]-6+i*3,0.2,P0[1]+3.5); pp.rotation.y=Math.random()*6; SCN.meshes.push(pp); } } }
function clearScene(){ SCN.meshes.forEach(m=>scene.remove(m)); SCN.meshes.length=0; SCN.statics.forEach(o=>{ scene.remove(o.m); const i=cars.indexOf(o); if(i>=0) cars.splice(i,1); }); SCN.statics.length=0; clearEscorts(); }

/* ---------- 大量傷者：其他救護車由救護站一齊出發 ---------- */
const ESC=[];
function clearEscorts(){ ESC.forEach(e=>{ if(e.parked){ const h=e.parked.home; e.m.position.set(h[0],0.34,h[1]); e.m.rotation.y=h[2]; e.m.visible=true; e.m.userData.blues.forEach(b=>b.material.emissive.setHex(0)); } else scene.remove(e.m); }); ESC.length=0; }
const ESC_NO=['A319','A167','A203','A256'];
function launchEscorts(n){ const R=S.escRoute; if(!R) return;
  // 車隊：先係門口兩架（A245、A272），再由車房出其他救護車；行靠近中線嗰邊，方便其他車靠邊讓路
  const units=[...PARKED.map(p=>({m:p.m,start:[p.home[0],p.home[1]],parked:p}))];
  for(let i=0;units.length<n;i++){ const m=ambulance(ESC_NO[i%ESC_NO.length]); m.userData.body.scale.setScalar(0.85); m.userData.pB.intensity=0; m.userData.pR.intensity=0; m.userData.pB.visible=m.userData.pR.visible=false; m.userData.len=6; m.visible=false; units.push({m,start:DEPOT.pos.slice()}); }
  units.slice(0,n).forEach((u,i)=>{ const stopAt=Math.max(20,R.len-11*(i+1)); const pts=[], cum=[];
    for(let j=0;j<R.pts.length;j++){ if(R.cum[j]<=stopAt){ pts.push(R.pts[j].slice()); cum.push(R.cum[j]); } else { const A=R.pts[j-1],B=R.pts[j],k=(stopAt-R.cum[j-1])/((R.cum[j]-R.cum[j-1])||1); pts.push([A[0]+(B[0]-A[0])*k,A[1]+(B[1]-A[1])*k]); cum.push(stopAt); break; } }
    for(let j=1;j<pts.length-1;j++){ const [ux,uz]=dirn(pts[j-1],pts[j+1]); pts[j]=[pts[j][0]-uz*1.6,pts[j][1]+ux*1.6]; } // 向中線靠 1.6 米
    pts[0]=u.start.slice(); for(let j=1;j<pts.length;j++) cum[j]=cum[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]);
    ESC.push({m:u.m,pts,cum,s:0,delay:1+i*3.2,v:0,pose:null,done:false,parked:u.parked}); });
  toast('🚑 救護車隊跟住你出發！'); }
function escortTick(dt,t){ const on=Math.floor(t*5)%2===0;
  for(const e of ESC){ e.m.userData.blues.forEach((b,i)=>b.material.emissive.setHex((i%2===0)===on?0x1550ff:0));
    if(e.delay>0){ e.delay-=dt; if(e.delay<=0){ e.m.visible=true; } else continue; }
    if(e.done){ e.m.userData.wheels.forEach(()=>{}); }
    const L=e.cum[e.cum.length-1]; let target=e.done?0:14; if(L-e.s<12) target=Math.min(target,(L-e.s)*1.2);
    // 前面有車或者玩家就停
    if(e.pose){ const fx=Math.sin(e.pose.a), fz=Math.cos(e.pose.a); for(const o of [...cars,...trams,{pose:{x:S.car.x,z:S.car.z}},...ESC]){ if(o===e||!o.pose) continue; const qx=o.pose.x-e.pose.x, qz=o.pose.z-e.pose.z, ah=qx*fx+qz*fz;
      if(ah>0&&ah<10&&Math.abs(qx*fz-qz*fx)<2.2){ target=0; break; } } }
    e.v+=(target-e.v)*Math.min(1,dt*2); e.s=Math.min(L,e.s+e.v*dt); if(L-e.s<0.3) e.done=true;
    let j=1; while(j<e.cum.length-1&&e.cum[j]<e.s) j++; const A=e.pts[j-1],B=e.pts[j],k=(e.s-e.cum[j-1])/((e.cum[j]-e.cum[j-1])||1);
    const x=A[0]+(B[0]-A[0])*k, z=A[1]+(B[1]-A[1])*k, a=Math.atan2(B[0]-A[0],B[1]-A[1]);
    const prevA=e.pose?e.pose.a:a; const na=prevA+(((a-prevA)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*5);
    e.pose={x,z,a:na}; groundPose(e.m,x,0.12,z,na,6); e.m.userData.wheels.forEach(w=>w.rotation.x+=e.v*dt/0.6); } }

/* ---------- 隱藏解鎖：撳左上角 A188 五下 ---------- */
let badgeN=0, badgeT=0;
document.querySelector('#menu .badge').addEventListener('click',()=>{ const now=Date.now(); if(now-badgeT>4000) badgeN=0; badgeT=now; badgeN++;
  if(badgeN>=5){ badgeN=0; store.set('unlockAll',1); S.unlockMsg=true; renderMenu(S.tab); } });
const unlockedAll=()=>!!store.get('unlockAll',0);

/* ---------- 防撞探測：前面（倒車時後面）有人、車或者障礙物就自動煞車 ---------- */
S.aeb=store.get('aeb',true);
const aebFan=(()=>{ const g=new THREE.PlaneGeometry(2.6,1); g.rotateX(-Math.PI/2); g.translate(0,0,0.5);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x22e06a,transparent:true,opacity:0.22,depthWrite:false})); m.renderOrder=3; scene.add(m); m.visible=false; return m; })();
function aebSense(c,dir,look){ const fx=Math.sin(c.a)*dir, fz=Math.cos(c.a)*dir, rx=fz, rz=-fx; let best=Infinity;
  const test=(x,z,hw)=>{ const qx=x-c.x, qz=z-c.z, ah=qx*fx+qz*fz, lat=Math.abs(qx*rx+qz*rz); if(ah>VSPEC.nose-0.4&&ah<look+VSPEC.nose&&lat<1.3*VSPEC.kw+hw) best=Math.min(best,ah-VSPEC.nose); };
  peds.forEach(p=>{ if(p.pos) test(p.pos[0],p.pos[1],0.5); });
  [...cars,...trams,...ESC].forEach(o=>{ if(!o.pose) return; const half=(o.m.userData.len||4.4)/2, sa=Math.sin(o.pose.a), ca=Math.cos(o.pose.a);
    for(let q=-half;q<=half;q+=1.5) test(o.pose.x+sa*q,o.pose.z+ca*q,1.2); });
  for(let d=VSPEC.nose+0.2;d<look+VSPEC.nose;d+=1) for(const l0 of [-1.1,0,1.1]){ const l=l0*VSPEC.kw; if(cellAt(c.x+fx*d+rx*l,c.z+fz*d+rz*l)&6){ best=Math.min(best,d-VSPEC.nose); break; } }
  return best; }
function aebTick(dt){ const c=S.car; aebFan.visible=false; if(!S.aeb||S.mode!=='drive'||!S.leftDepot) return;
  const dir=c.v<-0.3||(S.hold.B&&c.v<=0.5)?-1:1, v=Math.abs(c.v), look=Math.max(6,v*v/(2*30)+6);
  const d=aebSense(c,dir,look); const hit=d<look;
  aebFan.visible=true; { const ax=c.x+Math.sin(c.a)*VSPEC.nose*dir, az=c.z+Math.cos(c.a)*VSPEC.nose*dir; aebFan.position.set(ax,0.32+ELEV(ax,az),az); } aebFan.rotation.y=c.a+(dir<0?Math.PI:0); aebFan.scale.set(1,1,Math.min(look,hit?Math.max(0.5,d):look));
  aebFan.material.color.setHex(hit?0xff3b30:0x22e06a);
  if(hit&&((dir>0&&c.v>0)||(dir<0&&c.v<0)||v<0.3)){ // 自動煞車；太近就唔准再向前
    if(dir>0){ c.v=Math.max(0,c.v-(d<3?80:48)*dt); if(d<2.5&&S.hold.G) c.v=0; } else { c.v=Math.min(0,c.v+(d<3?80:48)*dt); if(d<2.5&&S.hold.B) c.v=0; }
    if(v>2&&(!S.aebT||performance.now()-S.aebT>2500)){ S.aebT=performance.now(); toast('⚠️ 偵測到障礙，自動煞車'); } } }
$('bAEB').onclick=()=>{ S.aeb=!S.aeb; store.set('aeb',S.aeb); $('bAEB').textContent='防撞 '+(S.aeb?'開':'關'); $('bAEB').setAttribute('aria-pressed',S.aeb); };
$('bAEB').textContent='防撞 '+(S.aeb?'開':'關'); $('bAEB').setAttribute('aria-pressed',S.aeb);

renderMenu(); show('menu',true); tick();
window.__S=S; window.__veh=applyLivery; window.__LMK=LMK; window.__fwTest=fireworks; window.__R=R; window.__scene=scene; window.__cam=cam; window.__startCase=startCase; window.__peds=peds;

})();