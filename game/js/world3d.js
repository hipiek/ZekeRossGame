/* ============================================================
   SNAP SQUAD — 3D isometric farm world (Egg Inc style)
   Three.js (vendored ESM). Exposes window.World for game.js.
   Low-poly flat scene: off-center coop, feed silos, hatchery,
   a delivery depot with trucks driving the road, and a bounded
   yard of chickens with light separation. Building tops are
   exposed as projected screen anchors for tappable upgrades.
   ============================================================ */
import * as THREE from "./vendor/three.module.min.js";

const MAX_VISIBLE = 150;
const YARD = { x0:-9, x1:6, z0:5, z1:20 };   // where chickens may roam

const World = { ready:false, _pop:0, goldTint:false };

let scene, camera, renderer, clock;
let flock = [], flockRoot, fxRoot, effects = [];
let trucks = [], truckTimer = 0;
let parts = null;
let viewSize = 32;
const anchors = {};                 // name -> THREE.Vector3 (top of a building)
const _pv = new THREE.Vector3();

/* ---------- helpers ---------- */
function mat(color){ return new THREE.MeshLambertMaterial({ color }); }
function at(m,x,y,z){ m.position.set(x,y,z); return m; }
function box(w,h,d,color){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color)); }
function cyl(rt,rb,h,seg,color){ return new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat(color)); }

function buildChickenParts(){
  const body = new THREE.SphereGeometry(0.62, 8, 6); body.scale(1, 0.9, 1.15);
  const catBody = new THREE.SphereGeometry(0.72, 9, 7); catBody.scale(1, 0.94, 1.02);
  return {
    body, catBody,
    head:new THREE.SphereGeometry(0.34,7,6),
    humanHead:new THREE.SphereGeometry(0.42,8,7),
    hair:new THREE.SphereGeometry(0.46,8,6,0,Math.PI*2,0,Math.PI*0.62),
    beak:new THREE.ConeGeometry(0.12,0.28,6),
    ear:new THREE.ConeGeometry(0.16,0.32,4),
    arm:new THREE.BoxGeometry(0.13,0.5,0.13),
    tail:new THREE.ConeGeometry(0.13,0.42,5),
    foot:new THREE.BoxGeometry(0.1,0.06,0.22), comb:new THREE.BoxGeometry(0.1,0.16,0.28),
    white:mat(0xffffff), cream:mat(0xf7e0b0), cat:mat(0xd58a3c), gold:mat(0xffd15a),
    skin:mat(0xd9a679), shirt:mat(0x515c6b), hairM:mat(0x2a1e16),
    beakM:mat(0xf2a53a), footM:mat(0xe08a2a), combM:mat(0xe4574e),
  };
}
function feet(g){
  const f1=new THREE.Mesh(parts.foot,parts.footM); f1.position.set(-0.16,0.03,0.08); g.add(f1);
  const f2=new THREE.Mesh(parts.foot,parts.footM); f2.position.set(0.16,0.03,0.08); g.add(f2);
}
/* type: 0 normal bird · 1 cat-blob (cookiecat) · 2 summoner-head */
function makeChicken(type){
  const g = new THREE.Group();
  if(type===1){
    const bm = World.goldTint ? parts.gold : parts.cat;
    const body=new THREE.Mesh(parts.catBody,bm); body.position.y=0.68; g.add(body);
    const head=new THREE.Mesh(parts.head,bm); head.position.set(0,1.12,0.28); g.add(head);
    [-0.22,0.22].forEach(x=>{ const e=new THREE.Mesh(parts.ear,bm); e.position.set(x,1.44,0.24); g.add(e); });
    const tail=new THREE.Mesh(parts.tail,bm); tail.position.set(0,0.7,-0.72); tail.rotation.x=-1.0; g.add(tail);
    feet(g); g.userData.body=body;
  } else if(type===2){
    const bm = World.goldTint ? parts.gold : parts.shirt;
    const body=new THREE.Mesh(parts.body,bm); body.position.y=0.56; g.add(body);
    const head=new THREE.Mesh(parts.humanHead,parts.skin); head.position.set(0,1.28,0.06); g.add(head);
    const hair=new THREE.Mesh(parts.hair,parts.hairM); hair.position.set(0,1.34,0.02); hair.scale.set(1.05,1,1.05); g.add(hair);
    [-0.52,0.52].forEach(x=>{ const a=new THREE.Mesh(parts.arm,parts.skin); a.position.set(x,0.9,0); a.rotation.z=x>0?-0.9:0.9; g.add(a); });
    feet(g); g.userData.body=body;
  } else {
    const bm = World.goldTint ? parts.gold : Math.random()<0.28 ? parts.cream : parts.white;
    const body=new THREE.Mesh(parts.body,bm); body.position.y=0.62; g.add(body);
    const head=new THREE.Mesh(parts.head,bm); head.position.set(0,1.15,0.34); g.add(head);
    const beak=new THREE.Mesh(parts.beak,parts.beakM); beak.position.set(0,1.12,0.66); beak.rotation.x=Math.PI/2; g.add(beak);
    const comb=new THREE.Mesh(parts.comb,parts.combM); comb.position.set(0,1.42,0.3); g.add(comb);
    feet(g); g.userData.body=body;
  }
  g.scale.setScalar(0.5 + Math.random()*0.12);
  return g;
}

function makeTruck(color){
  const t = new THREE.Group();
  const trailer = box(5.2, 2.4, 2.4, color); trailer.position.set(-0.6, 1.7, 0); t.add(trailer);
  const cab = box(1.8, 1.9, 2.3, 0x2c2f36); cab.position.set(2.6, 1.4, 0); t.add(cab);
  const cabTop = box(1.8, 0.9, 2.2, color); cabTop.position.set(2.6, 2.35, 0); t.add(cabTop);
  [[-2, 1.1],[1, 1.1],[2.6,1.1]].forEach(([x,z])=>{
    [-1.25,1.25].forEach(zz=>{ const w=cyl(0.55,0.55,0.4,10,0x14161c); w.rotation.x=Math.PI/2; w.position.set(x,0.55,zz); t.add(w); });
  });
  return t;
}

function buildEnvironment(){
  scene.add(at(box(160,1,160,0x6fc64a),0,-0.5,0));
  for(let i=0;i<12;i++){
    const s=8+Math.random()*16, p=box(s,1.02,s,0x62b840);
    p.position.set((Math.random()-0.5)*120,-0.49,(Math.random()-0.5)*120); p.rotation.y=Math.random()*Math.PI; scene.add(p);
  }
  // road across the front (trucks drive here)
  scene.add(at(box(200,0.2,11,0x3c4048),0,0.05,31));
  for(let x=-96;x<=96;x+=9){ scene.add(at(box(3.4,0.22,0.6,0xf2f2f2),x,0.07,31)); }
  // dirt path
  scene.add(at(box(5,0.15,36,0xc79a5b),7,0.03,12));

  // COOP (habitat) — back-right
  const coop = new THREE.Group();
  coop.add(at(box(11,5,7,0xf2c53d),0,2.5,0));
  coop.add(at(box(11.1,1.3,7.1,0xffffff),0,4.55,0));
  coop.add(at(box(11.8,0.7,7.8,0x3a3f47),0,5.35,0));
  coop.add(at(box(2.2,3,0.3,0x2c2f36),-2.6,1.6,3.6));
  coop.position.set(10,0,-2); coop.rotation.y=-0.22; scene.add(coop);
  anchors.hab = new THREE.Vector3(10,6.2,-2);

  // FEED silos (back-left)
  [[-10,-4,1],[-13,3,0.82]].forEach(([x,z,s],i)=>{
    const g=new THREE.Group();
    g.add(at(cyl(2.6,2.6,9,14,0xc0392b),0,4.5,0));
    const dome=new THREE.Mesh(new THREE.SphereGeometry(2.6,14,8,0,Math.PI*2,0,Math.PI/2),mat(0xb0b6bf)); dome.position.y=9; g.add(dome);
    g.position.set(x,0,z); g.scale.setScalar(s); scene.add(g);
    if(i===0) anchors.feed = new THREE.Vector3(x,10.5,z);
  });

  // HATCHERY shed (front-right)
  const hatchery = new THREE.Group();
  hatchery.add(at(box(6.5,3.2,4.6,0xdedfe4),0,1.6,0));
  hatchery.add(at(box(6.9,0.6,5,0x2c8f5a),0,3.5,0));
  hatchery.add(at(box(1.2,1.2,1.2,0x2c8f5a),1.8,4.1,0));
  hatchery.position.set(9,0,15); scene.add(hatchery);
  anchors.hatch = new THREE.Vector3(9,4.2,15);

  // DEPOT (vehicles) near the road
  const depot = new THREE.Group();
  depot.add(at(box(7,3,5.4,0x8a95a5),0,1.5,0));
  depot.add(at(box(7.4,0.5,5.8,0x5b6577),0,3.2,0));
  depot.add(at(box(2.4,2.2,0.3,0x2c2f36),0,1.1,2.8));
  depot.position.set(-9,0,23); scene.add(depot);
  anchors.veh = new THREE.Vector3(-9,4,23);

  // start a few trucks
  for(let i=0;i<3;i++) spawnTruck(-60 + i*45);
}

function spawnTruck(x){
  const colors=[0xf2c53d,0xffffff,0x3da9fc,0xe4574e];
  const t = makeTruck(colors[Math.floor(Math.random()*colors.length)]);
  t.position.set(x, 0, 31 + (Math.random()<0.5?-2.2:2.2));
  const dir = Math.random()<0.5?1:-1;
  t.rotation.y = dir>0 ? Math.PI/2 : -Math.PI/2;
  scene.add(t);
  trucks.push({ mesh:t, x, dir, speed:8+Math.random()*6 });
}

/* ---------- public API ---------- */
World.init = function(canvas){
  if(World.ready) return true;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias:true }); }
  catch(e){ console.warn("WebGL init failed", e); return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  const w = canvas.clientWidth||innerWidth, h = canvas.clientHeight||innerHeight;
  renderer.setSize(w, h, false);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd3ff);
  scene.fog = new THREE.Fog(0x8fd3ff, 80, 150);

  const aspect = w/h;
  camera = new THREE.OrthographicCamera(-viewSize*aspect, viewSize*aspect, viewSize, -viewSize, 0.1, 500);
  camera.position.set(50, 44, 50); camera.lookAt(0, 2, 8);

  scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x6a8a4a, 0.95));
  const sun = new THREE.DirectionalLight(0xfff4d6, 1.05); sun.position.set(30, 55, 18); scene.add(sun);

  parts = buildChickenParts();
  buildEnvironment();
  flockRoot = new THREE.Group(); scene.add(flockRoot);
  fxRoot = new THREE.Group(); scene.add(fxRoot);

  clock = new THREE.Clock();
  renderer.setAnimationLoop(tick);
  addEventListener("resize", World.resize);
  World.ready = true;
  World.setPopulation(this._pop);
  return true;
};

function spawnChicken(){
  const r = Math.random();
  const type = r<0.16 ? 1 : r<0.28 ? 2 : 0;   // ~16% cat, ~12% summoner, rest birds
  const g = makeChicken(type);
  g.position.set(YARD.x0 + Math.random()*(YARD.x1-YARD.x0), 0, YARD.z0 + Math.random()*(YARD.z1-YARD.z0));
  g.rotation.y = Math.random()*Math.PI*2;
  flockRoot.add(g);
  flock.push({ group:g, vx:(Math.random()-0.5)*3, vz:(Math.random()-0.5)*3, phase:Math.random()*Math.PI*2, speed:0.6+Math.random()*0.7 });
}

World.setPopulation = function(n){
  World._pop = n;
  if(!World.ready) return;
  const target = Math.max(0, Math.min(MAX_VISIBLE, Math.round(n)));
  while(flock.length < target) spawnChicken();
  while(flock.length > target){ flockRoot.remove(flock.pop().group); }
};

World.setGoldChickens = function(on){
  World.goldTint = on;
  if(!World.ready) return;
  const bodyM = on ? parts.gold : parts.white;
  flock.forEach(c=>{ const b=c.group.userData.body; if(b) b.material = on ? parts.gold : (c.group.userData.baseM||b.material); });
};

World.pulse = function(){ for(const c of flock) c.hopKick = 1; };

/* project a named building anchor to screen px (for tappable hotspots) */
World.getScreen = function(name){
  const p = anchors[name]; if(!p || !renderer) return null;
  _pv.copy(p).project(camera);
  const el = renderer.domElement;
  return { x:(_pv.x*0.5+0.5)*el.clientWidth, y:(-_pv.y*0.5+0.5)*el.clientHeight, vis:_pv.z<1 };
};

/* manager ability VFX */
World.playAbility = function(type){
  if(!World.ready) return;
  if(type==="blackout") lightningStrike();
  else if(type==="overdrive") ring(0x3da9fc);
  else if(type==="cloutbomb") ring(0xffb23e);
  else if(type==="goldrush") rain(0xffd166);
  else ring(0xffffff);
};
function ring(color){
  const m=new THREE.Mesh(new THREE.RingGeometry(0.5,1.2,32), new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.9,side:THREE.DoubleSide}));
  m.rotation.x=-Math.PI/2; m.position.set(0,0.3,14); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"ring"});
}
function lightningStrike(){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.4,44,6), new THREE.MeshBasicMaterial({color:0xbfe0ff,transparent:true,opacity:1}));
  m.position.set((Math.random()-0.5)*22,22,10+(Math.random()-0.5)*14); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"bolt"});
  scene.background=new THREE.Color(0xffffff); setTimeout(()=>scene&&(scene.background=new THREE.Color(0x8fd3ff)),90);
}
function rain(color){
  for(let i=0;i<26;i++){ const d=new THREE.Mesh(new THREE.SphereGeometry(0.25,6,5),new THREE.MeshBasicMaterial({color}));
    d.position.set((Math.random()-0.5)*32,18+Math.random()*8,12+(Math.random()-0.5)*22); fxRoot.add(d); effects.push({mesh:d,t:0,kind:"drop",vy:-(8+Math.random()*8)}); }
}

/* ---------- signature VFX (epic / legendary / mythic) ---------- */
const CX = 0, CZ = 11;   // scene focal point
function flashBg(color, ms){ scene.background=new THREE.Color(color); setTimeout(()=>scene&&(scene.background=new THREE.Color(0x8fd3ff)), ms||90); }
function bolt(x,z){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.45,44,6), new THREE.MeshBasicMaterial({color:0xcdebff,transparent:true,opacity:1}));
  m.position.set(x,22,z); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"bolt"}); }
function groundRing(color,x,z,scale){ const m=new THREE.Mesh(new THREE.RingGeometry(0.5,1.4,36), new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.95,side:THREE.DoubleSide}));
  m.rotation.x=-Math.PI/2; m.position.set(x,0.3,z); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"ring",gs:scale||10}); }
function orb(x,y,z,color,vy,life){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.28,7,6), new THREE.MeshBasicMaterial({color,transparent:true}));
  m.position.set(x,y,z); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"drop",vy,life:life||1.1}); }
function bubble(color,x,z){ const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,10), new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.5}));
  m.position.set(x,1.5,z); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"sphere"}); }
function burst(x,y,z,color,n){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, sp=6+Math.random()*10;
  orb(x,y,z,color,Math.sin(a)*sp*0.4+ (Math.random()*6), 0.9); const e=effects[effects.length-1]; e.vx=Math.cos(a)*sp; e.vz=Math.sin(a)*sp; } }

function sig_storm(){ for(let i=0;i<6;i++) setTimeout(()=>{ if(!scene)return; bolt((Math.random()-0.5)*22, CZ+(Math.random()-0.5)*16); flashBg(0xffffff,70); }, i*170); }
function sig_meteor(){ const m=new THREE.Mesh(new THREE.SphereGeometry(1.1,10,9), new THREE.MeshBasicMaterial({color:0xff7a3c}));
  m.position.set(CX,40,CZ); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"meteor"}); }
function sig_blizzard(){ flashBg(0xd7ecff,400); for(let i=0;i<60;i++) setTimeout(()=>orb((Math.random()-0.5)*40,18+Math.random()*10,CZ+(Math.random()-0.5)*26,0xffffff,-(6+Math.random()*8),1.6), i*10); }
function sig_evaporate(){ flashBg(0xe8fbff,120); for(let i=0;i<40;i++){ const x=(Math.random()-0.5)*20, z=CZ+(Math.random()-0.5)*16; orb(x,0.5,z,0xbfefff,(4+Math.random()*7),1.4); } }
function sig_gold(){ groundRing(0xffd15a,CX,CZ,9); for(let i=0;i<40;i++){ const x=CX+(Math.random()-0.5)*8, z=CZ+(Math.random()-0.5)*8; orb(x,0.6,z,0xffd15a,(7+Math.random()*9),1.3); } }
function sig_toxic(){ bubble(0x6be04a,CX,CZ); groundRing(0x8bef5a,CX,CZ,8); }
function sig_chaos(){ const cols=[0xff4d6d,0x3da9fc,0xffd15a,0xb06bff,0x34d399];
  for(let i=0;i<6;i++) setTimeout(()=>{ if(!scene)return; const c=cols[i%cols.length]; groundRing(c,(Math.random()-0.5)*14,CZ+(Math.random()-0.5)*12,7); flashBg(c,60); }, i*140);
  burst(CX,2,CZ,0xffffff,24); }

World.playSignature = function(vfx){
  if(!World.ready) return;
  ({ storm:sig_storm, meteor:sig_meteor, blizzard:sig_blizzard, evaporate:sig_evaporate,
     gold:sig_gold, toxic:sig_toxic, chaos:sig_chaos }[vfx] || (()=>ring(0xffffff)))();
};

World.setActive = function(on){
  if(!World.ready||!renderer) return;
  renderer.setAnimationLoop(on?tick:null);
  if(on) renderer.render(scene, camera);
};
World.resize = function(){
  if(!World.ready) return;
  const el = renderer.domElement, w=el.clientWidth||innerWidth, h=el.clientHeight||innerHeight;
  renderer.setSize(w,h,false);
  const aspect=w/h;
  camera.left=-viewSize*aspect; camera.right=viewSize*aspect; camera.top=viewSize; camera.bottom=-viewSize; camera.updateProjectionMatrix();
};

/* ---------- render loop ---------- */
function tick(){
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

  // chickens: wander, stay in yard, gentle separation, hop
  for(let i=0;i<flock.length;i++){
    const c=flock[i], g=c.group;
    g.position.x += c.vx*dt*c.speed; g.position.z += c.vz*dt*c.speed;
    if(Math.random()<0.012){ c.vx=(Math.random()-0.5)*3; c.vz=(Math.random()-0.5)*3; }
    if(g.position.x<YARD.x0){ g.position.x=YARD.x0; c.vx=Math.abs(c.vx); }
    if(g.position.x>YARD.x1){ g.position.x=YARD.x1; c.vx=-Math.abs(c.vx); }
    if(g.position.z<YARD.z0){ g.position.z=YARD.z0; c.vz=Math.abs(c.vz); }
    if(g.position.z>YARD.z1){ g.position.z=YARD.z1; c.vz=-Math.abs(c.vz); }
    // separation vs a few neighbours
    for(let k=1;k<=4;k++){
      const o=flock[(i+k)%flock.length]; if(!o) continue;
      const dx=g.position.x-o.group.position.x, dz=g.position.z-o.group.position.z;
      const d2=dx*dx+dz*dz;
      if(d2>0.001 && d2<0.85){ const f=0.6/Math.sqrt(d2); c.vx+=dx*f*dt*10; c.vz+=dz*f*dt*10; }
    }
    if(c.vx||c.vz) g.rotation.y=Math.atan2(c.vx,c.vz);
    let hop=Math.abs(Math.sin(t*4*c.speed+c.phase));
    if(c.hopKick){ hop=Math.min(1,hop+c.hopKick); c.hopKick=Math.max(0,c.hopKick-dt*2); }
    g.position.y=hop*0.35;
    if(g.userData.body) g.userData.body.scale.y=0.9+hop*0.12;
  }

  // trucks along the road
  for(const tr of trucks){
    tr.x += tr.dir*tr.speed*dt; tr.mesh.position.x = tr.x;
    if(tr.x>95) tr.x=-95; if(tr.x<-95) tr.x=95;
  }

  // effects
  for(let i=effects.length-1;i>=0;i--){
    const e=effects[i]; e.t+=dt;
    const life = e.life || 1.1;
    if(e.kind==="ring"){ const s=1+e.t*(e.gs||10); e.mesh.scale.set(s,s,s); e.mesh.material.opacity=Math.max(0,0.9-e.t*1.2); }
    else if(e.kind==="bolt"){ e.mesh.material.opacity=Math.max(0,1-e.t*3); }
    else if(e.kind==="drop"){ e.mesh.position.y+=e.vy*dt; if(e.vx) e.mesh.position.x+=e.vx*dt; if(e.vz) e.mesh.position.z+=e.vz*dt; e.mesh.material.opacity=Math.max(0,1-e.t/life); }
    else if(e.kind==="sphere"){ const s=1+e.t*7; e.mesh.scale.set(s,s,s); e.mesh.material.opacity=Math.max(0,0.5-e.t*0.5); }
    else if(e.kind==="meteor"){
      e.mesh.position.y -= 90*dt;
      if(e.mesh.position.y<=1.2){ fxRoot.remove(e.mesh); effects.splice(i,1);
        groundRing(0xff7a3c, e.mesh.position.x, e.mesh.position.z, 14); burst(e.mesh.position.x,1.5,e.mesh.position.z,0xffb23e,26); flashBg(0xffe0b0,90); screenShakeHint(); continue; }
    }
    if(e.t>life && e.kind!=="meteor"){ fxRoot.remove(e.mesh); effects.splice(i,1); }
  }

  renderer.render(scene, camera);
}
function screenShakeHint(){ /* game.js handles DOM shake via haptic; noop hook */ }

window.World = World;
export default World;
