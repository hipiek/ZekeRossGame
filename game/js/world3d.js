/* ============================================================
   SNAP SQUAD — 3D farm world ("zekeross tycoon" edition)
   Three.js (vendored ESM). Exposes window.World for game.js.

   - Huge gridded map with camera controls:
       1 finger drag  = twist / orbit the camera
       2 finger drag  = pan   ·  pinch = zoom  ·  wheel = zoom
       short tap      = forwarded to game (hatch / place building)
   - Trucks drive the road facing the right way; depot stores parked ones.
   - Chickens roam free, avoid building footprints, and funnel into
     the coop door in a visible stream.
   - Building placement API (grid cells) for the tycoon build mode.
   ============================================================ */
import * as THREE from "./vendor/three.module.min.js";

const MAX_VISIBLE = 150;
const GRID = 4;                                   // grid cell size (world units)
const REGION = { x0:-48, x1:48, z0:-44, z1:22 };  // buildable area (north of road)
const ROAM   = { x0:-34, x1:26, z0:-16, z1:24 };  // chicken freedom zone
const DOOR   = { x:11, z:1.4 };                   // coop entrance (funnel target)

const World = { ready:false, _pop:0, goldTint:false, onFrame:null };

let scene, camera, renderer, clock;
let flock = [], flockRoot, fxRoot, effects = [];
let trucks = [];
let parts = null;
let blocks = [];                    // AABBs chickens avoid: {x0,x1,z0,z1}
let placedRoot;                     // player-placed buildings
const anchors = {};
const _pv = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);

/* camera rig: orbit around target */
const cam = { theta: Math.PI/4, hDist: 70, height: 44, view: 32, target: new THREE.Vector3(0,0,8) };

/* ---------- helpers ---------- */
function mat(color){ return new THREE.MeshLambertMaterial({ color }); }
function at(m,x,y,z){ m.position.set(x,y,z); return m; }
function box(w,h,d,color){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color)); }
function cyl(rt,rb,h,seg,color){ return new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat(color)); }
function addBlock(x,z,w,d){ blocks.push({ x0:x-w/2, x1:x+w/2, z0:z-d/2, z1:z+d/2 }); }

/* ---------- chickens (3 model types) ---------- */
function buildChickenParts(){
  const body = new THREE.SphereGeometry(0.62, 8, 6); body.scale(1, 0.9, 1.15);
  const catBody = new THREE.SphereGeometry(0.72, 9, 7); catBody.scale(1, 0.94, 1.02);
  return {
    body, catBody,
    head:new THREE.SphereGeometry(0.34,7,6), humanHead:new THREE.SphereGeometry(0.42,8,7),
    hair:new THREE.SphereGeometry(0.46,8,6,0,Math.PI*2,0,Math.PI*0.62),
    beak:new THREE.ConeGeometry(0.12,0.28,6), ear:new THREE.ConeGeometry(0.16,0.32,4),
    arm:new THREE.BoxGeometry(0.13,0.5,0.13), tail:new THREE.ConeGeometry(0.13,0.42,5),
    foot:new THREE.BoxGeometry(0.1,0.06,0.22), comb:new THREE.BoxGeometry(0.1,0.16,0.28),
    white:mat(0xffffff), cream:mat(0xf7e0b0), cat:mat(0xd58a3c), gold:mat(0xffd15a),
    skin:mat(0xd9a679), shirt:mat(0x515c6b), hairM:mat(0x2a1e16),
    beakM:mat(0xf2a53a), footM:mat(0xe08a2a), combM:mat(0xe4574e),
  };
}
function feetFor(g){
  const f1=new THREE.Mesh(parts.foot,parts.footM); f1.position.set(-0.16,0.03,0.08); g.add(f1);
  const f2=new THREE.Mesh(parts.foot,parts.footM); f2.position.set(0.16,0.03,0.08); g.add(f2);
}
function makeChicken(type){
  const g = new THREE.Group();
  if(type===1){ // cookiecat blob
    const bm = World.goldTint ? parts.gold : parts.cat;
    const body=new THREE.Mesh(parts.catBody,bm); body.position.y=0.68; g.add(body);
    const head=new THREE.Mesh(parts.head,bm); head.position.set(0,1.12,0.28); g.add(head);
    [-0.22,0.22].forEach(x=>{ const e=new THREE.Mesh(parts.ear,bm); e.position.set(x,1.44,0.24); g.add(e); });
    const tail=new THREE.Mesh(parts.tail,bm); tail.position.set(0,0.7,-0.72); tail.rotation.x=-1.0; g.add(tail);
  } else if(type===2){ // summoner head-man
    const bm = World.goldTint ? parts.gold : parts.shirt;
    const body=new THREE.Mesh(parts.body,bm); body.position.y=0.56; g.add(body);
    const head=new THREE.Mesh(parts.humanHead,parts.skin); head.position.set(0,1.28,0.06); g.add(head);
    const hair=new THREE.Mesh(parts.hair,parts.hairM); hair.position.set(0,1.34,0.02); hair.scale.set(1.05,1,1.05); g.add(hair);
    [-0.52,0.52].forEach(x=>{ const a=new THREE.Mesh(parts.arm,parts.skin); a.position.set(x,0.9,0); a.rotation.z=x>0?-0.9:0.9; g.add(a); });
  } else { // classic bird
    const bm = World.goldTint ? parts.gold : Math.random()<0.28 ? parts.cream : parts.white;
    const body=new THREE.Mesh(parts.body,bm); body.position.y=0.62; g.add(body);
    const head=new THREE.Mesh(parts.head,bm); head.position.set(0,1.15,0.34); g.add(head);
    const beak=new THREE.Mesh(parts.beak,parts.beakM); beak.position.set(0,1.12,0.66); beak.rotation.x=Math.PI/2; g.add(beak);
    const comb=new THREE.Mesh(parts.comb,parts.combM); comb.position.set(0,1.42,0.3); g.add(comb);
  }
  feetFor(g);
  g.userData.body = g.children[0];
  g.scale.setScalar(0.5 + Math.random()*0.12);
  return g;
}

/* ---------- trucks (front is +x) ---------- */
function makeTruck(color){
  const t = new THREE.Group();
  t.add(at(box(5.2,2.4,2.4,color),-0.6,1.7,0));
  t.add(at(box(1.8,1.9,2.3,0x2c2f36),2.6,1.4,0));
  t.add(at(box(1.8,0.9,2.2,color),2.6,2.35,0));
  const win = at(box(0.15,0.7,1.8,0x9fd8ff),3.55,1.7,0); t.add(win);
  [[-2],[1],[2.6]].forEach(([x])=>{ [-1.25,1.25].forEach(zz=>{
    const w=cyl(0.55,0.55,0.4,10,0x14161c); w.rotation.x=Math.PI/2; w.position.set(x,0.55,zz); t.add(w); }); });
  return t;
}
function spawnTruck(x, dir){
  const colors=[0xf2c53d,0xffffff,0x3da9fc,0xe4574e];
  const t = makeTruck(colors[Math.floor(Math.random()*colors.length)]);
  const lane = dir>0 ? 33.4 : 28.6;                    // right-hand traffic
  t.position.set(x, 0, lane);
  t.rotation.y = dir>0 ? 0 : Math.PI;                  // face travel direction
  scene.add(t);
  trucks.push({ mesh:t, x, dir, speed:9+Math.random()*6 });
}

/* ---------- environment ---------- */
function tree(x,z,s){
  const g=new THREE.Group();
  g.add(at(cyl(0.35,0.45,1.6,6,0x8a5a2b),0,0.8,0));
  g.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.7,2.6,7),mat(0x3f9b3f)),0,2.6,0));
  g.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.25,2.0,7),mat(0x4fb54a)),0,3.9,0));
  g.position.set(x,0,z); g.scale.setScalar(s||1); scene.add(g);
  addBlock(x,z,2.4*(s||1),2.4*(s||1));
  return g;
}
function buildEnvironment(){
  // huge ground + variation patches
  scene.add(at(box(400,1,400,0x6fc64a),0,-0.5,0));
  for(let i=0;i<30;i++){
    const s=10+Math.random()*24, p=box(s,1.02,s,0x62b840);
    p.position.set((Math.random()-0.5)*320,-0.49,(Math.random()-0.5)*320); p.rotation.y=Math.random()*Math.PI; scene.add(p);
  }
  // subtle build grid over the region
  const grid = new THREE.GridHelper((REGION.x1-REGION.x0), (REGION.x1-REGION.x0)/GRID, 0xffffff, 0xffffff);
  grid.material.transparent = true; grid.material.opacity = 0.07;
  grid.position.set((REGION.x0+REGION.x1)/2, 0.02, (REGION.z0+REGION.z1)/2);
  grid.scale.z = (REGION.z1-REGION.z0)/(REGION.x1-REGION.x0);
  scene.add(grid);

  // road (two lanes) + shoulders
  scene.add(at(box(400,0.2,12,0x3c4048),0,0.05,31));
  scene.add(at(box(400,0.16,0.7,0xd8dce2),0,0.1,25.4));
  scene.add(at(box(400,0.16,0.7,0xd8dce2),0,0.1,36.6));
  for(let x=-196;x<=196;x+=9) scene.add(at(box(3.4,0.22,0.5,0xf2f2f2),x,0.12,31));

  // dirt path: coop door straight down to the road
  scene.add(at(box(4,0.15,25,0xc79a5b),DOOR.x,0.03,13));

  // COOP (habitat) — grid aligned, windows + awning
  const coop = new THREE.Group();
  coop.add(at(box(13,5,8,0xf2c53d),0,2.5,0));
  coop.add(at(box(13.1,1.3,8.1,0xffffff),0,4.55,0));
  coop.add(at(box(13.8,0.7,8.8,0x3a3f47),0,5.35,0));
  coop.add(at(box(2.4,3,0.3,0x2c2f36),-3,1.6,4.05));           // door (front, faces +z)
  coop.add(at(box(3.2,0.35,1.3,0xe4574e),-3,3.35,4.4));        // awning
  [1.5,4.5].forEach(x=> coop.add(at(box(1.6,1.4,0.25,0x9fd8ff),x,2.7,4.05)) ); // windows
  coop.position.set(14,0,-4); scene.add(coop);
  addBlock(14,-4,13.6,8.6);
  anchors.hab = new THREE.Vector3(14,6.4,-4);

  // FEED silos — banded, with ladder
  [[-14,-6,1],[-19,0,0.82]].forEach(([x,z,s],i)=>{
    const g=new THREE.Group();
    g.add(at(cyl(2.6,2.6,9,14,0xc0392b),0,4.5,0));
    [1.8,4.4,7].forEach(y=> g.add(at(cyl(2.66,2.66,0.28,14,0x8e2a1e),0,y,0)) );
    const dome=new THREE.Mesh(new THREE.SphereGeometry(2.6,14,8,0,Math.PI*2,0,Math.PI/2),mat(0xb0b6bf)); dome.position.y=9; g.add(dome);
    g.add(at(box(0.18,8,0.5,0x77808d),2.62,4,0));
    g.position.set(x,0,z); g.scale.setScalar(s); scene.add(g);
    addBlock(x,z,5.6*s,5.6*s);
    if(i===0) anchors.feed = new THREE.Vector3(x,10.5,z);
  });

  // HATCHERY — moved well off the path
  const hatchery = new THREE.Group();
  hatchery.add(at(box(6.5,3.2,4.6,0xdedfe4),0,1.6,0));
  hatchery.add(at(box(6.9,0.6,5,0x2c8f5a),0,3.5,0));
  hatchery.add(at(box(1.2,1.2,1.2,0x2c8f5a),1.8,4.1,0));
  hatchery.add(at(box(1.2,1.1,0.22,0x9fd8ff),-1.6,1.8,2.35));
  hatchery.position.set(24,0,12); scene.add(hatchery);
  addBlock(24,12,7.2,5.4);
  anchors.hatch = new THREE.Vector3(24,4.2,12);

  // VEHICLE DEPOT — storage lot by the road with parked trucks
  const depot = new THREE.Group();
  depot.add(at(box(10,4,6,0x8a95a5),0,2,0));
  depot.add(at(box(10.5,0.5,6.5,0x5b6577),0,4.2,0));
  depot.add(at(box(7.6,3.1,0.3,0x2c2f36),0,1.55,3.1));          // big open bay
  depot.position.set(-22,0,18); scene.add(depot);
  addBlock(-22,18,10.8,6.8);
  anchors.veh = new THREE.Vector3(-22,5,18);
  scene.add(at(box(14,0.12,9,0x545a66),-21,0.06,25));            // parking pad
  const p1 = makeTruck(0xf2c53d); p1.position.set(-24,0,24.6); p1.rotation.y=Math.PI/2; scene.add(p1);
  const p2 = makeTruck(0x3da9fc); p2.position.set(-18.6,0,24.6); p2.rotation.y=Math.PI/2; scene.add(p2);

  // trees & greenery around the lot
  [[-34,-14,1.1],[-30,8,0.9],[34,-12,1.2],[32,4,0.9],[38,16,1],[-38,4,1],[4,-18,1.1],[-4,-22,0.9],[22,-16,1]]
    .forEach(([x,z,s])=>tree(x,z,s));

  // moving traffic — both directions, correct lanes
  spawnTruck(-80, 1); spawnTruck(10, 1); spawnTruck(60, -1); spawnTruck(-30, -1);
}

/* ---------- placeable buildings (tycoon) ---------- */
const PLACEABLE = {
  tree:     { w:1, d:1, make(){ const g=new THREE.Group();
      g.add(at(cyl(0.35,0.45,1.6,6,0x8a5a2b),0,0.8,0));
      g.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.6,2.5,7),mat(0x3f9b3f)),0,2.5,0));
      g.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.15,1.9,7),mat(0x4fb54a)),0,3.7,0)); return g; } },
  barn:     { w:2, d:2, make(){ const g=new THREE.Group();
      g.add(at(box(6.5,3.6,5.5,0xc0392b),0,1.8,0));
      g.add(at(box(7,1.1,6,0xffffff),0,3.9,0));
      g.add(at(box(7.3,0.6,6.3,0x3a3f47),0,4.7,0));
      g.add(at(box(2,2.4,0.3,0x7d2318),0,1.2,2.8)); return g; } },
  statue:   { w:1, d:1, make(){ const g=new THREE.Group();
      g.add(at(cyl(1.4,1.7,1,10,0xb0b6bf),0,0.5,0));
      const c=makeChicken(0); c.scale.setScalar(1.5); c.position.y=1;
      c.traverse(o=>{ if(o.isMesh) o.material=parts.gold; }); g.add(c); return g; } },
  fountain: { w:2, d:2, make(){ const g=new THREE.Group();
      g.add(at(cyl(3,3.3,0.9,14,0xb0b6bf),0,0.45,0));
      g.add(at(cyl(2.6,2.6,0.25,14,0x5bc8f5),0,0.95,0));
      g.add(at(cyl(0.5,0.7,1.6,8,0xb0b6bf),0,1.6,0));
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.55,8,7),mat(0x5bc8f5)),0,2.5,0)); return g; } },
};
function cellFree(gx,gz,w,d){
  const x=gx*GRID, z=gz*GRID, hw=w*GRID/2+0.2, hd=d*GRID/2+0.2;
  if(x-hw<REGION.x0||x+hw>REGION.x1||z-hd<REGION.z0||z+hd>REGION.z1) return false;
  for(const b of blocks){ if(x+hw>b.x0 && x-hw<b.x1 && z+hd>b.z0 && z-hd<b.z1) return false; }
  return true;
}
World.canPlace = function(type,gx,gz){
  const t=PLACEABLE[type]; return !!t && cellFree(gx,gz,t.w,t.d);
};
World.addBuilding = function(type,gx,gz,skipCheck){
  const t=PLACEABLE[type]; if(!t) return false;
  if(!skipCheck && !cellFree(gx,gz,t.w,t.d)) return false;
  const g=t.make(); g.position.set(gx*GRID,0,gz*GRID); placedRoot.add(g);
  addBlock(gx*GRID,gz*GRID,t.w*GRID,t.d*GRID);
  return true;
};
/* screen px -> grid cell (raycast onto the ground plane) */
World.gridFromScreen = function(px,py){
  if(!World.ready) return null;
  const el=renderer.domElement;
  _pv.set((px/el.clientWidth)*2-1, -(py/el.clientHeight)*2+1, 0);
  _ray.setFromCamera(_pv, camera);
  const hit=new THREE.Vector3();
  if(!_ray.ray.intersectPlane(_plane, hit)) return null;
  return { gx:Math.round(hit.x/GRID), gz:Math.round(hit.z/GRID) };
};

/* ---------- camera ---------- */
function applyCamera(){
  const t=cam.target;
  camera.position.set(t.x+Math.cos(cam.theta)*cam.hDist, cam.height, t.z+Math.sin(cam.theta)*cam.hDist);
  camera.lookAt(t.x, 1, t.z);
  const el=renderer.domElement, aspect=(el.clientWidth||innerWidth)/(el.clientHeight||innerHeight);
  camera.left=-cam.view*aspect; camera.right=cam.view*aspect; camera.top=cam.view; camera.bottom=-cam.view;
  camera.updateProjectionMatrix();
}
function clampTarget(){
  cam.target.x=Math.max(-90,Math.min(90,cam.target.x));
  cam.target.z=Math.max(-80,Math.min(80,cam.target.z));
}

/* touch / mouse controls on an overlay element */
World.attachControls = function(el, opts){
  const onTap = opts && opts.onTap;
  const ptrs = new Map();
  let start=null, moved=0, lastMid=null, lastDist=0, twoUsed=false;
  el.addEventListener("pointerdown", e=>{
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===1){ start={x:e.clientX,y:e.clientY,t:Date.now()}; moved=0; twoUsed=false; }
    if(ptrs.size===2){ const a=[...ptrs.values()]; lastMid={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};
      lastDist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); twoUsed=true; }
  });
  el.addEventListener("pointermove", e=>{
    const p=ptrs.get(e.pointerId); if(!p) return;
    const dx=e.clientX-p.x, dy=e.clientY-p.y;
    p.x=e.clientX; p.y=e.clientY;
    moved+=Math.abs(dx)+Math.abs(dy);
    if(!World.ready) return;
    if(ptrs.size===1 && !twoUsed){          // one finger: twist / orbit
      cam.theta -= dx*0.006;
      cam.height = Math.max(24, Math.min(70, cam.height + dy*0.15));
      applyCamera();
    } else if(ptrs.size===2){               // two fingers: pan + pinch zoom
      const a=[...ptrs.values()];
      const mid={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};
      const dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      if(lastMid){
        const mdx=mid.x-lastMid.x, mdy=mid.y-lastMid.y;
        const k=cam.view/(innerHeight/2);
        const fx=Math.cos(cam.theta), fz=Math.sin(cam.theta);       // toward camera
        // screen-right and screen-up on the ground plane
        cam.target.x += (-mdx*(-fz) + mdy*fx) * k;
        cam.target.z += (-mdx*( fx) + mdy*fz) * k;
        clampTarget();
      }
      if(lastDist>0 && dist>0){ cam.view=Math.max(14,Math.min(60,cam.view*lastDist/dist)); }
      lastMid=mid; lastDist=dist;
      applyCamera();
    }
  });
  const end = e=>{
    ptrs.delete(e.pointerId);
    if(ptrs.size<2){ lastMid=null; lastDist=0; }
    if(ptrs.size===0 && start && !twoUsed && moved<10 && Date.now()-start.t<400 && onTap)
      onTap(e.clientX, e.clientY);
    if(ptrs.size===0) start=null;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("wheel", e=>{ if(!World.ready) return;
    cam.view=Math.max(14,Math.min(60,cam.view*(e.deltaY>0?1.1:0.9))); applyCamera(); }, {passive:true});
};

/* ---------- public API ---------- */
World.init = function(canvas){
  if(World.ready) return true;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias:true }); }
  catch(e){ console.warn("WebGL init failed", e); return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.setSize(canvas.clientWidth||innerWidth, canvas.clientHeight||innerHeight, false);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd3ff);
  scene.fog = new THREE.Fog(0x8fd3ff, 110, 240);

  camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,600);

  scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x6a8a4a, 0.95));
  const sun = new THREE.DirectionalLight(0xfff4d6, 1.05); sun.position.set(30, 55, 18); scene.add(sun);

  parts = buildChickenParts();
  placedRoot = new THREE.Group(); scene.add(placedRoot);
  buildEnvironment();
  flockRoot = new THREE.Group(); scene.add(flockRoot);
  fxRoot = new THREE.Group(); scene.add(fxRoot);

  applyCamera();
  clock = new THREE.Clock();
  renderer.setAnimationLoop(tick);
  addEventListener("resize", World.resize);
  World.ready = true;
  World.setPopulation(this._pop);
  return true;
};

function spawnChicken(){
  const r = Math.random();
  const type = r<0.16 ? 1 : r<0.28 ? 2 : 0;
  const g = makeChicken(type);
  // hatch out of the coop door
  g.position.set(DOOR.x+(Math.random()-0.5)*2, 0, DOOR.z+1+Math.random()*2);
  g.rotation.y = Math.random()*Math.PI*2;
  flockRoot.add(g);
  flock.push({ group:g, vx:(Math.random()-0.5)*3, vz:1+Math.random()*2,
    phase:Math.random()*Math.PI*2, speed:0.6+Math.random()*0.7, mode:"wander" });
}

World.setPopulation = function(n){
  World._pop = n;
  if(!World.ready) return;
  const target = Math.max(0, Math.min(MAX_VISIBLE, Math.round(n)));
  while(flock.length < target) spawnChicken();
  while(flock.length > target){ flockRoot.remove(flock.pop().group); }
};
World.setGoldChickens = function(on){ World.goldTint = on; };
World.pulse = function(){ for(const c of flock) c.hopKick = 1; };

World.getScreen = function(name){
  const p = anchors[name]; if(!p || !renderer) return null;
  _pv.copy(p).project(camera);
  const el = renderer.domElement;
  return { x:(_pv.x*0.5+0.5)*el.clientWidth, y:(-_pv.y*0.5+0.5)*el.clientHeight, vis:_pv.z<1 };
};

/* ---------- ability + signature VFX ---------- */
World.playAbility = function(type){
  if(!World.ready) return;
  if(type==="blackout") sig_storm();
  else if(type==="overdrive") groundRing(0x3da9fc,0,10,10);
  else if(type==="cloutbomb") groundRing(0xffb23e,0,10,10);
  else if(type==="goldrush") rainFx(0xffd166);
  else groundRing(0xffffff,0,10,10);
};
function flashBg(color, ms){ scene.background=new THREE.Color(color); setTimeout(()=>scene&&(scene.background=new THREE.Color(0x8fd3ff)), ms||90); }
function boltFx(x,z){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.45,44,6), new THREE.MeshBasicMaterial({color:0xcdebff,transparent:true,opacity:1}));
  m.position.set(x,22,z); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"bolt"}); }
function groundRing(color,x,z,scale){ const m=new THREE.Mesh(new THREE.RingGeometry(0.5,1.4,36), new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.95,side:THREE.DoubleSide}));
  m.rotation.x=-Math.PI/2; m.position.set(x,0.3,z); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"ring",gs:scale||10}); }
function orbFx(x,y,z,color,vy,life){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.28,7,6), new THREE.MeshBasicMaterial({color,transparent:true}));
  m.position.set(x,y,z); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"drop",vy,life:life||1.1}); }
function rainFx(color){ for(let i=0;i<26;i++) orbFx((Math.random()-0.5)*32,18+Math.random()*8,10+(Math.random()-0.5)*22,color,-(8+Math.random()*8),1.2); }
function burstFx(x,y,z,color,n){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, sp=6+Math.random()*10;
  orbFx(x,y,z,color,Math.random()*6,0.9); const e=effects[effects.length-1]; e.vx=Math.cos(a)*sp; e.vz=Math.sin(a)*sp; } }
function sig_storm(){ for(let i=0;i<6;i++) setTimeout(()=>{ if(!scene)return; boltFx((Math.random()-0.5)*24, 10+(Math.random()-0.5)*16); flashBg(0xffffff,70); }, i*170); }
function sig_meteor(){ const m=new THREE.Mesh(new THREE.SphereGeometry(1.1,10,9), new THREE.MeshBasicMaterial({color:0xff7a3c}));
  m.position.set(0,40,10); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"meteor"}); }
function sig_blizzard(){ flashBg(0xd7ecff,400); for(let i=0;i<60;i++) setTimeout(()=>orbFx((Math.random()-0.5)*40,18+Math.random()*10,10+(Math.random()-0.5)*26,0xffffff,-(6+Math.random()*8),1.6), i*10); }
function sig_evaporate(){ flashBg(0xe8fbff,120); for(let i=0;i<40;i++) orbFx((Math.random()-0.5)*20,0.5,10+(Math.random()-0.5)*16,0xbfefff,4+Math.random()*7,1.4); }
function sig_gold(){ groundRing(0xffd15a,0,10,9); for(let i=0;i<40;i++) orbFx((Math.random()-0.5)*8,0.6,10+(Math.random()-0.5)*8,0xffd15a,7+Math.random()*9,1.3); }
function sig_toxic(){ const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,10), new THREE.MeshBasicMaterial({color:0x6be04a,transparent:true,opacity:0.5}));
  m.position.set(0,1.5,10); fxRoot.add(m); effects.push({mesh:m,t:0,kind:"sphere"}); groundRing(0x8bef5a,0,10,8); }
function sig_chaos(){ const cols=[0xff4d6d,0x3da9fc,0xffd15a,0xb06bff,0x34d399];
  for(let i=0;i<6;i++) setTimeout(()=>{ if(!scene)return; const c=cols[i%cols.length]; groundRing(c,(Math.random()-0.5)*14,10+(Math.random()-0.5)*12,7); flashBg(c,60); }, i*140);
  burstFx(0,2,10,0xffffff,24); }
World.playSignature = function(vfx){
  if(!World.ready) return;
  ({ storm:sig_storm, meteor:sig_meteor, blizzard:sig_blizzard, evaporate:sig_evaporate,
     gold:sig_gold, toxic:sig_toxic, chaos:sig_chaos }[vfx] || (()=>groundRing(0xffffff,0,10,10)))();
};

World.setActive = function(on){
  if(!World.ready||!renderer) return;
  renderer.setAnimationLoop(on?tick:null);
  if(on) renderer.render(scene, camera);
};
World.resize = function(){ if(World.ready) applyCamera(); };

/* ---------- render loop ---------- */
function tick(){
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

  for(let i=0;i<flock.length;i++){
    const c=flock[i], g=c.group;
    // a slow trickle of chickens funnels back into the coop door
    if(c.mode==="wander" && Math.random()<0.0012) c.mode="funnel";
    if(c.mode==="funnel"){
      const dx=DOOR.x-g.position.x, dz=DOOR.z-g.position.z, d=Math.hypot(dx,dz);
      if(d<1.4){ // entered — cycle back out of the door
        g.position.set(DOOR.x+(Math.random()-0.5)*1.5, 0, DOOR.z+0.6);
        c.vx=(Math.random()-0.5)*2; c.vz=1.5+Math.random()*2; c.mode="wander";
      } else { c.vx=dx/d*2.2; c.vz=dz/d*2.2; }
    } else if(Math.random()<0.012){ c.vx=(Math.random()-0.5)*3; c.vz=(Math.random()-0.5)*3; }

    g.position.x += c.vx*dt*c.speed; g.position.z += c.vz*dt*c.speed;

    // free-roam bounds
    if(g.position.x<ROAM.x0){ g.position.x=ROAM.x0; c.vx=Math.abs(c.vx); }
    if(g.position.x>ROAM.x1){ g.position.x=ROAM.x1; c.vx=-Math.abs(c.vx); }
    if(g.position.z<ROAM.z0){ g.position.z=ROAM.z0; c.vz=Math.abs(c.vz); }
    if(g.position.z>ROAM.z1){ g.position.z=ROAM.z1; c.vz=-Math.abs(c.vz); }

    // never walk into buildings (skip when funneling to the door)
    if(c.mode!=="funnel"){
      for(const b of blocks){
        if(g.position.x>b.x0-0.5 && g.position.x<b.x1+0.5 && g.position.z>b.z0-0.5 && g.position.z<b.z1+0.5){
          const pushL=g.position.x-(b.x0-0.5), pushR=(b.x1+0.5)-g.position.x;
          const pushT=g.position.z-(b.z0-0.5), pushB=(b.z1+0.5)-g.position.z;
          const m=Math.min(pushL,pushR,pushT,pushB);
          if(m===pushL){ g.position.x=b.x0-0.5; c.vx=-Math.abs(c.vx); }
          else if(m===pushR){ g.position.x=b.x1+0.5; c.vx=Math.abs(c.vx); }
          else if(m===pushT){ g.position.z=b.z0-0.5; c.vz=-Math.abs(c.vz); }
          else { g.position.z=b.z1+0.5; c.vz=Math.abs(c.vz); }
        }
      }
    }
    // gentle separation
    for(let k=1;k<=3;k++){
      const o=flock[(i+k)%flock.length]; if(!o||o===c) continue;
      const dx=g.position.x-o.group.position.x, dz=g.position.z-o.group.position.z, d2=dx*dx+dz*dz;
      if(d2>0.001 && d2<0.8){ const f=0.5/Math.sqrt(d2); c.vx+=dx*f*dt*10; c.vz+=dz*f*dt*10; }
    }
    if(c.vx||c.vz) g.rotation.y=Math.atan2(c.vx,c.vz);
    let hop=Math.abs(Math.sin(t*4*c.speed+c.phase));
    if(c.hopKick){ hop=Math.min(1,hop+c.hopKick); c.hopKick=Math.max(0,c.hopKick-dt*2); }
    g.position.y=hop*0.35;
    if(g.userData.body) g.userData.body.scale.y=0.9+hop*0.12;
  }

  for(const tr of trucks){
    tr.x += tr.dir*tr.speed*dt; tr.mesh.position.x = tr.x;
    if(tr.x>195) tr.x=-195; if(tr.x<-195) tr.x=195;
  }

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
        groundRing(0xff7a3c,e.mesh.position.x,e.mesh.position.z,14); burstFx(e.mesh.position.x,1.5,e.mesh.position.z,0xffb23e,26); flashBg(0xffe0b0,90); continue; }
    }
    if(e.t>life && e.kind!=="meteor"){ fxRoot.remove(e.mesh); effects.splice(i,1); }
  }

  renderer.render(scene, camera);
  if(World.onFrame) World.onFrame();
}

window.World = World;
export default World;
