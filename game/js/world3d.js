/* ============================================================
   SNAP SQUAD — 3D isometric farm world (Egg Inc style)
   Three.js (vendored ESM). Exposes window.World for game.js.
   Low-poly: flat-shaded primitives, orthographic iso camera,
   a coop + silos + road, and a wandering flock of chickens.
   ============================================================ */
import * as THREE from "./vendor/three.module.min.js";

const MAX_VISIBLE = 160;   // cap rendered chickens for perf
const FIELD = 24;          // half-extent chickens roam within

const World = { ready:false, _pop:0, _accent:0xffb23e };

let scene, camera, renderer, clock;
let flock = [];            // {group, vx, vz, phase, tint}
let flockRoot, fxRoot, effects = [];
let parts = null;          // shared chicken geometries/materials
let viewSize = 30;

/* ---------- helpers ---------- */
function mat(color, opts){ return new THREE.MeshLambertMaterial(Object.assign({ color }, opts||{})); }

function buildChickenParts(){
  const body = new THREE.SphereGeometry(0.62, 8, 6); body.scale(1, 0.9, 1.15);
  const head = new THREE.SphereGeometry(0.34, 7, 6);
  const beak = new THREE.ConeGeometry(0.12, 0.28, 6);
  const foot = new THREE.BoxGeometry(0.1, 0.06, 0.22);
  const comb = new THREE.BoxGeometry(0.1, 0.16, 0.28);
  return { body, head, beak, foot, comb,
    white: mat(0xffffff), cream: mat(0xf7e0b0), cat: mat(0xd58a3c),
    beakM: mat(0xf2a53a), footM: mat(0xe08a2a), combM: mat(0xe4574e) };
}

function makeChicken(tint){
  const g = new THREE.Group();
  const bodyM = tint===1 ? parts.cat : tint===2 ? parts.cream : parts.white;
  const body = new THREE.Mesh(parts.body, bodyM); body.position.y = 0.62; g.add(body);
  const head = new THREE.Mesh(parts.head, bodyM); head.position.set(0, 1.15, 0.34); g.add(head);
  const beak = new THREE.Mesh(parts.beak, parts.beakM);
  beak.position.set(0, 1.12, 0.66); beak.rotation.x = Math.PI/2; g.add(beak);
  const comb = new THREE.Mesh(parts.comb, parts.combM); comb.position.set(0, 1.42, 0.3); g.add(comb);
  const f1 = new THREE.Mesh(parts.foot, parts.footM); f1.position.set(-0.16, 0.03, 0.08); g.add(f1);
  const f2 = new THREE.Mesh(parts.foot, parts.footM); f2.position.set(0.16, 0.03, 0.08); g.add(f2);
  g.scale.setScalar(0.5 + Math.random()*0.12);
  g.userData.body = body;
  return g;
}

function box(w,h,d,color){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color)); }
function cyl(rt,rb,h,seg,color){ return new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat(color)); }

function buildEnvironment(){
  // ground
  const ground = box(120, 1, 120, 0x6fc64a); ground.position.y = -0.5; scene.add(ground);
  // darker grass patches for texture
  for(let i=0;i<10;i++){
    const s = 8+Math.random()*14;
    const p = box(s, 1.02, s, 0x62b840);
    p.position.set((Math.random()-0.5)*90, -0.49, (Math.random()-0.5)*90);
    p.rotation.y = Math.random()*Math.PI; scene.add(p);
  }
  // road across the front
  const road = box(120, 0.2, 9, 0x3c4048); road.position.set(0, 0.05, 30); scene.add(road);
  for(let x=-56; x<=56; x+=8){ const dash = box(3,0.22,0.5,0xf2f2f2); dash.position.set(x,0.07,30); scene.add(dash); }
  // dirt path from coop outward
  const path = box(6, 0.15, 60, 0xc79a5b); path.position.set(-2, 0.03, -2); path.rotation.y = 0.35; scene.add(path);

  // coop (yellow building like the screenshot)
  const coop = new THREE.Group();
  const base = box(14, 5, 8, 0xf2c53d); base.position.y = 2.5; coop.add(base);
  const stripe = box(14.05, 1.4, 8.05, 0xffffff); stripe.position.y = 4.6; coop.add(stripe);
  const roof = box(14.6, 0.7, 8.6, 0x3a3f47); roof.position.y = 5.35; coop.add(roof);
  const door = box(2.4, 3, 0.3, 0x2c2f36); door.position.set(-3, 1.6, 4.05); coop.add(door);
  const vent1 = box(1.6,1.2,1.6,0x2c2f36); vent1.position.set(2,6,0); coop.add(vent1);
  coop.position.set(0, 0, 6); coop.rotation.y = -0.15; scene.add(coop);

  // two red silos
  [[-20,-6],[-26,2]].forEach(([x,z],i)=>{
    const s = new THREE.Group();
    const tank = cyl(3,3,10,14,0xc0392b); tank.position.y = 5; s.add(tank);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3,14,8,0,Math.PI*2,0,Math.PI/2), mat(0xb0b6bf));
    dome.position.y = 10; s.add(dome);
    s.position.set(x,0,z); s.scale.setScalar(i? 0.8:1); scene.add(s);
  });

  // a few fences near the front
  for(let x=-8;x<=10;x+=2){ const post = box(0.3,1.6,0.3,0x8a8f98); post.position.set(x,0.8,16); scene.add(post); }
  const rail = box(20,0.3,0.3,0xaab0ba); rail.position.set(1,1.2,16); scene.add(rail);
}

/* ---------- public API ---------- */
World.init = function(canvas){
  if(World.ready) return true;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
  } catch(e){ console.warn("WebGL init failed", e); return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  const w = canvas.clientWidth||window.innerWidth, h = canvas.clientHeight||window.innerHeight;
  renderer.setSize(w, h, false);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd3ff);
  scene.fog = new THREE.Fog(0x8fd3ff, 70, 130);

  const aspect = w/h;
  camera = new THREE.OrthographicCamera(-viewSize*aspect, viewSize*aspect, viewSize, -viewSize, 0.1, 400);
  camera.position.set(52, 42, 52);
  camera.lookAt(-1, 1, 7);

  scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x6a8a4a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff4d6, 1.1); sun.position.set(30, 50, 20); scene.add(sun);

  parts = buildChickenParts();
  buildEnvironment();
  flockRoot = new THREE.Group(); scene.add(flockRoot);
  fxRoot = new THREE.Group(); scene.add(fxRoot);

  clock = new THREE.Clock();
  renderer.setAnimationLoop(tick);
  window.addEventListener("resize", World.resize);
  World.ready = true;
  World.setPopulation(this._pop);
  return true;
};

function spawnChicken(){
  const tint = Math.random()<0.18 ? 1 : Math.random()<0.25 ? 2 : 0;
  const g = makeChicken(tint);
  const a = Math.random()*Math.PI*2, r = 3+Math.random()*FIELD;
  g.position.set(Math.cos(a)*r*0.6, 0, 6 + Math.sin(a)*r*0.5 + 6);
  g.rotation.y = Math.random()*Math.PI*2;
  flockRoot.add(g);
  flock.push({ group:g, vx:(Math.random()-0.5)*2, vz:(Math.random()-0.5)*2,
    phase:Math.random()*Math.PI*2, speed:0.6+Math.random()*0.8 });
}

World.setPopulation = function(n){
  World._pop = n;
  if(!World.ready) return;
  const target = Math.max(0, Math.min(MAX_VISIBLE, Math.round(n)));
  while(flock.length < target) spawnChicken();
  while(flock.length > target){ const c = flock.pop(); flockRoot.remove(c.group); }
};

World.setAccent = function(hex){ World._accent = hex; };

/* a little burst when the player hatches */
World.pulse = function(){
  if(!World.ready) return;
  for(let i=0;i<flock.length;i++){ flock[i].hopKick = 1; }
};

/* manager ability visual effects */
World.playAbility = function(type){
  if(!World.ready) return;
  if(type==="blackout" || type==="storm") lightningStrike();
  else if(type==="overdrive") ring(0x3da9fc);
  else if(type==="cloutbomb") ring(0xffb23e);
  else if(type==="goldrush") rain(0xffd166);
  else ring(World._accent);
};

function ring(color){
  const geo = new THREE.RingGeometry(0.5, 1.2, 32);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.9, side:THREE.DoubleSide }));
  m.rotation.x = -Math.PI/2; m.position.set(0,0.3,6);
  fxRoot.add(m); effects.push({ mesh:m, t:0, kind:"ring" });
}
function lightningStrike(){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.4,40,6),
    new THREE.MeshBasicMaterial({ color:0xbfe0ff, transparent:true, opacity:1 }));
  m.position.set((Math.random()-0.5)*20, 20, 6+(Math.random()-0.5)*16);
  fxRoot.add(m); effects.push({ mesh:m, t:0, kind:"bolt" });
  scene.background = new THREE.Color(0xffffff);
  setTimeout(()=>scene && (scene.background = new THREE.Color(0x8fd3ff)), 90);
}
function rain(color){
  for(let i=0;i<24;i++){
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.25,6,5), new THREE.MeshBasicMaterial({ color }));
    d.position.set((Math.random()-0.5)*30, 18+Math.random()*8, 6+(Math.random()-0.5)*24);
    fxRoot.add(d); effects.push({ mesh:d, t:0, kind:"drop", vy:-(8+Math.random()*8) });
  }
}

World.setActive = function(on){
  if(!World.ready || !renderer) return;
  renderer.setAnimationLoop(on ? tick : null);
  if(on) renderer.render(scene, camera); // draw one frame immediately (no black flash)
};

World.resize = function(){
  if(!World.ready) return;
  const canvas = renderer.domElement;
  const w = canvas.clientWidth||window.innerWidth, h = canvas.clientHeight||window.innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w/h;
  camera.left = -viewSize*aspect; camera.right = viewSize*aspect;
  camera.top = viewSize; camera.bottom = -viewSize; camera.updateProjectionMatrix();
};

/* ---------- render loop ---------- */
function tick(){
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  for(let i=0;i<flock.length;i++){
    const c = flock[i], g = c.group;
    // wander
    g.position.x += c.vx*dt*c.speed; g.position.z += c.vz*dt*c.speed;
    if(Math.random()<0.01){ c.vx=(Math.random()-0.5)*2; c.vz=(Math.random()-0.5)*2; }
    // keep inside a soft circle around the coop area
    const dx=g.position.x, dz=g.position.z-8;
    if(dx*dx+dz*dz > FIELD*FIELD){ c.vx-=dx*0.02*dt*60; c.vz-=dz*0.02*dt*60; }
    if(c.vx||c.vz) g.rotation.y = Math.atan2(c.vx, c.vz);
    // hop
    let hop = Math.abs(Math.sin(t*4*c.speed + c.phase));
    if(c.hopKick){ hop = Math.min(1, hop + c.hopKick); c.hopKick = Math.max(0, c.hopKick-dt*2); }
    g.position.y = hop*0.35;
    if(g.userData.body) g.userData.body.scale.y = 0.9 + hop*0.12;
  }

  // effects
  for(let i=effects.length-1;i>=0;i--){
    const e = effects[i]; e.t += dt;
    if(e.kind==="ring"){ const s=1+e.t*10; e.mesh.scale.set(s,s,s); e.mesh.material.opacity=Math.max(0,0.9-e.t*1.2); }
    if(e.kind==="bolt"){ e.mesh.material.opacity=Math.max(0,1-e.t*3); }
    if(e.kind==="drop"){ e.mesh.position.y += e.vy*dt; e.mesh.material.opacity=Math.max(0,1-e.t); }
    if(e.t>1.1){ fxRoot.remove(e.mesh); effects.splice(i,1); }
  }

  renderer.render(scene, camera);
}

window.World = World;
export default World;
