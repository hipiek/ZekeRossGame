/* ============================================================
   SNAP SQUAD: Clout Empire — game engine
   Vanilla JS. No dependencies. Mobile-first.
   ============================================================ */
'use strict';

const SAVE_KEY = "snapsquad.save.v1";
const TICK_MS = 100;            // simulation tick
const COMBO_WINDOW = 900;       // ms to keep a combo alive
const COMBO_MAX = 30;           // max combo multiplier contribution
const CRIT_CHANCE = 0.08;
const CRIT_MULT = 12;
const GOLD_INTERVAL = [16000, 34000]; // random golden-snap spawn window (ms)

/* ---------------- number formatting ---------------- */
const SUFFIX = ["","K","M","B","T","Qa","Qi","Sx","Sp","Oc","No","Dc","Ud","Dd","Td"];
function fmt(n){
  if(n < 1000) return (Math.floor(n*10)/10 % 1 === 0) ? String(Math.floor(n)) : n.toFixed(1);
  let t = 0;
  while(n >= 1000 && t < SUFFIX.length-1){ n /= 1000; t++; }
  return (n >= 100 ? n.toFixed(1) : n.toFixed(2)) + SUFFIX[t];
}
function fmtTime(s){
  s = Math.max(0, Math.floor(s));
  if(s < 60) return s+"s";
  if(s < 3600) return Math.floor(s/60)+"m "+(s%60)+"s";
  return Math.floor(s/3600)+"h "+Math.floor((s%3600)/60)+"m";
}

/* ---------------- default state ---------------- */
function freshState(){
  const squad = {};
  ROSTER.forEach(c => squad[c.id] = { owned:false, level:0 });
  squad.closer.owned = true; squad.closer.level = 1; // free starter
  return {
    clout: 0,
    gems: 3,
    featured: "closer",
    squad,
    influence: 0,          // permanent prestige multiplier source
    abilityReady: {},      // id -> timestamp when ready
    activeBoosts: [],      // {type,until,mult,kind}
    daily: { streak:0, last:0, claimedToday:false },
    achievements: {},      // id -> true
    stats: { totalTaps:0, totalClout:0, goldCaught:0, bestCombo:0, rebrands:0, playStart:Date.now() },
    lastSeen: Date.now(),
    settings: { sfx:true, haptics:true },
    version: 1,
  };
}

let S = freshState();

/* ---------------- persistence ---------------- */
function save(){
  S.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch(e){}
}
function load(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    S = Object.assign(freshState(), data);
    // make sure newly-added roster members exist in old saves
    ROSTER.forEach(c => { if(!S.squad[c.id]) S.squad[c.id] = { owned:false, level:0 }; });
    return true;
  } catch(e){ return false; }
}

/* ---------------- derived numbers ---------------- */
function influenceMult(){ return 1 + S.influence * 0.02; } // +2% per influence point

function levelCps(c, lvl){
  const r = RARITY[c.rarity].mult;
  return c.baseCps * r * lvl * Math.pow(1.0, 0); // linear in level, rarity-scaled
}
function memberCps(id){
  const st = S.squad[id]; if(!st.owned) return 0;
  const c = ROSTER_BY_ID[id];
  return levelCps(c, st.level);
}
function baseCps(){
  let sum = 0;
  for(const id in S.squad) sum += memberCps(id);
  return sum;
}
function idleMult(){
  let m = influenceMult();
  for(const b of S.activeBoosts){
    if(b.kind==="idle" || b.kind==="all") m *= b.mult;
  }
  return m;
}
function cps(){ return baseCps() * idleMult(); }

function tapBase(){
  let sum = 1;
  for(const id in S.squad){
    const st = S.squad[id];
    if(st.owned){ sum += ROSTER_BY_ID[id].tapBonus * RARITY[ROSTER_BY_ID[id].rarity].mult * (1 + (st.level-1)*0.5); }
  }
  // tapping also benefits a little from your empire's income
  sum += baseCps() * 0.15;
  return sum * influenceMult();
}
function tapMult(){
  let m = 1;
  for(const b of S.activeBoosts){
    if(b.kind==="tap" || b.kind==="all") m *= b.mult;
  }
  return m;
}

function upgradeCost(c, lvl){
  // lvl 0 -> recruit cost; lvl n -> next level cost
  return Math.ceil(c.baseCost * Math.pow(1.16, lvl));
}

/* influence you'd gain by rebranding now */
function pendingInfluence(){
  const tc = S.stats.totalClout;
  if(tc < 1e9) return 0;
  return Math.floor(Math.pow(tc / 1e9, 0.45));
}

/* ---------------- combo ---------------- */
let combo = 0, comboExpire = 0;
function comboMult(){ return 1 + Math.min(combo, COMBO_MAX) * 0.15; }

/* ============================================================
   RENDERING
   ============================================================ */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; };

function imgFor(id){ return `assets/chars/${id}.webp`; }

/* floating combat text */
function floatText(x, y, text, cls){
  const f = el("div", "floater "+(cls||""), text);
  f.style.left = x+"px"; f.style.top = y+"px";
  $("#fx-layer").appendChild(f);
  setTimeout(()=>f.remove(), 1100);
}
function burstParticles(x, y, color, n){
  if(!S.settings.sfx) return;
  for(let i=0;i<n;i++){
    const p = el("div","particle");
    const ang = Math.random()*Math.PI*2, dist = 30+Math.random()*70;
    p.style.left=x+"px"; p.style.top=y+"px"; p.style.background=color;
    p.style.setProperty("--dx",(Math.cos(ang)*dist)+"px");
    p.style.setProperty("--dy",(Math.sin(ang)*dist)+"px");
    $("#fx-layer").appendChild(p);
    setTimeout(()=>p.remove(),700);
  }
}
function haptic(ms){ if(S.settings.haptics && navigator.vibrate) navigator.vibrate(ms); }
function shake(intensity){
  if(!S.settings.sfx) return;
  const s = $("#hero-stage");
  s.style.setProperty("--shake", intensity+"px");
  s.classList.remove("shaking"); void s.offsetWidth; s.classList.add("shaking");
}

/* ---------- HUD ---------- */
function renderHUD(){
  $("#clout-amt").textContent = fmt(S.clout);
  $("#cps-amt").textContent = fmt(cps());
  $("#gem-amt").textContent = fmt(S.gems);
  const im = influenceMult();
  $("#infl-amt").textContent = "×"+im.toFixed(2);
}

/* ---------- TAP screen ---------- */
function renderTapScreen(){
  const c = ROSTER_BY_ID[S.featured];
  const stage = $("#hero-stage");
  if(stage.dataset.cur !== S.featured){
    stage.dataset.cur = S.featured;
    $("#hero-img").src = imgFor(S.featured);
    $("#hero-img").style.boxShadow = `0 0 0 6px ${RARITY[c.rarity].ring}, 0 18px 50px rgba(0,0,0,.6)`;
    $("#hero-name").textContent = c.name;
    $("#hero-name").style.color = RARITY[c.rarity].ring;
    $("#hero-rarity").textContent = RARITY[c.rarity].name.toUpperCase();
    $("#hero-rarity").style.background = RARITY[c.rarity].ring;
    $("#hero-quote").textContent = "“"+c.quote+"”";
  }
  $("#tap-power").textContent = fmt(tapBase()*tapMult()*comboMult());
}

let comboBarTimer=null;
function updateComboUI(){
  const bar = $("#combo-wrap");
  if(combo > 1){
    bar.classList.add("show");
    $("#combo-mult").textContent = comboMult().toFixed(2)+"×";
    $("#combo-count").textContent = combo+" combo";
    const pct = Math.min(combo, COMBO_MAX)/COMBO_MAX*100;
    $("#combo-fill").style.width = pct+"%";
  } else {
    bar.classList.remove("show");
  }
}

/* ---------- handle a tap ---------- */
function doTap(clientX, clientY){
  const now = Date.now();
  if(now < comboExpire) combo++; else combo = 1;
  comboExpire = now + COMBO_WINDOW;
  if(combo > S.stats.bestCombo) S.stats.bestCombo = combo;

  let val = tapBase() * tapMult() * comboMult();
  let crit = Math.random() < CRIT_CHANCE;
  if(crit) val *= CRIT_MULT;

  S.clout += val;
  S.stats.totalClout += val;
  S.stats.totalTaps++;

  floatText(clientX, clientY, (crit?"CRIT! ":"+")+fmt(val), crit?"crit":"");
  burstParticles(clientX, clientY, crit?"#ffd166":"#3da9fc", crit?14:6);
  haptic(crit?28:10);
  shake(crit?7:3);
  $("#hero-img").classList.remove("pop"); void $("#hero-img").offsetWidth; $("#hero-img").classList.add("pop");
  updateComboUI();
}

/* ============================================================
   SQUAD screen
   ============================================================ */
function renderSquad(){
  const wrap = $("#squad-list"); wrap.innerHTML="";
  // sort: owned first then by roster order
  ROSTER.forEach(c=>{
    const st = S.squad[c.id];
    const r = RARITY[c.rarity];
    const card = el("div","sqcard rarity-"+c.rarity+(st.owned?" owned":" locked"));
    const cost = upgradeCost(c, st.level);
    const affordable = S.clout >= cost;
    const isFeatured = S.featured===c.id;
    card.innerHTML = `
      <div class="sq-portrait" style="--ring:${r.ring}">
        <img src="${imgFor(c.id)}" loading="lazy" alt="${c.name}">
        ${st.owned?`<span class="lvl">Lv ${st.level}</span>`:`<span class="lock">🔒</span>`}
      </div>
      <div class="sq-info">
        <div class="sq-top">
          <span class="sq-name">${st.owned?c.name:"???"}</span>
          <span class="sq-rar" style="background:${r.ring}">${r.name}</span>
        </div>
        <div class="sq-sub">${st.owned?`${fmt(memberCps(c.id))}/s · +${fmt(ROSTER_BY_ID[c.id].tapBonus*r.mult*(1+(st.level-1)*0.5))}/tap`:`Recruit to reveal`}</div>
        <div class="sq-actions">
          <button class="btn-up ${affordable?'':'cant'}" data-up="${c.id}">
            ${st.owned?`Upgrade`:`Recruit`} · ${fmt(cost)}
          </button>
          ${st.owned?`<button class="btn-feat ${isFeatured?'on':''}" data-feat="${c.id}">${isFeatured?'★ Featured':'Feature'}</button>`:``}
        </div>
      </div>`;
    wrap.appendChild(card);
  });
  $("#squad-count").textContent = `${ownedCount(S)}/${ROSTER.length}`;
}

function buyUpgrade(id){
  const c = ROSTER_BY_ID[id], st = S.squad[id];
  const cost = upgradeCost(c, st.level);
  if(S.clout < cost){ toast("Not enough Clout"); return; }
  S.clout -= cost;
  const wasOwned = st.owned;
  st.owned = true; st.level++;
  if(!wasOwned){
    toast(`Recruited ${c.name}!`, RARITY[c.rarity].ring);
    haptic(40);
    if(S.featured==="closer" && c.rarity!=="common"){} // keep closer default
  }
  checkAchievements();
  renderSquad(); renderHUD(); renderBoosts();
  save();
}

/* ============================================================
   SUMMON (gacha) screen
   ============================================================ */
const PULL_COST = 5;     // gems for single
const PULL10_COST = 45;  // gems for 10

function weightedRarity(){
  const total = Object.values(RARITY).reduce((a,r)=>a+r.weight,0);
  let roll = Math.random()*total;
  for(const key of Object.keys(RARITY)){ roll -= RARITY[key].weight; if(roll<=0) return key; }
  return "common";
}
function pullOne(){
  const rar = weightedRarity();
  const pool = ROSTER.filter(c=>c.rarity===rar);
  const c = pool[Math.floor(Math.random()*pool.length)];
  const st = S.squad[c.id];
  let result;
  if(!st.owned){ st.owned = true; st.level = Math.max(1, st.level); result = {c, kind:"new"}; }
  else { st.level += 1; result = {c, kind:"dupe"}; } // dupe = instant +1 level
  return result;
}
function summon(n){
  const cost = n===1?PULL_COST:PULL10_COST;
  if(S.gems < cost){ toast("Not enough Snaps 💎"); return; }
  S.gems -= cost;
  const results = [];
  for(let i=0;i<n;i++) results.push(pullOne());
  checkAchievements();
  renderHUD(); renderSquad(); renderBoosts();
  save();
  showSummonReveal(results);
}

function showSummonReveal(results){
  const ov = $("#summon-overlay");
  const stage = $("#summon-cards"); stage.innerHTML="";
  ov.classList.add("show");
  results.forEach((res,i)=>{
    const r = RARITY[res.c.rarity];
    const card = el("div","reveal-card rarity-"+res.c.rarity);
    card.style.animationDelay = (i*0.12)+"s";
    card.innerHTML = `
      <div class="rv-glow" style="--ring:${r.ring}"></div>
      <img src="${imgFor(res.c.id)}" alt="">
      <div class="rv-rar" style="color:${r.ring}">${r.name}</div>
      <div class="rv-name">${res.c.name}</div>
      <div class="rv-tag">${res.kind==="new"?"NEW!":"+1 LEVEL"}</div>`;
    stage.appendChild(card);
    if(res.c.rarity==="legendary"||res.c.rarity==="mythic"){
      setTimeout(()=>{ burstParticles(window.innerWidth/2, window.innerHeight/2, r.ring, 30); haptic(60); }, i*120+250);
    }
  });
}

function renderSummon(){
  $("#single-cost").textContent = PULL_COST;
  $("#ten-cost").textContent = PULL10_COST;
  // odds list
  const odds = $("#odds-list"); odds.innerHTML="";
  const total = Object.values(RARITY).reduce((a,r)=>a+r.weight,0);
  Object.keys(RARITY).forEach(k=>{
    const r=RARITY[k];
    odds.appendChild(el("div","odd","<span style='color:"+r.ring+"'>"+r.name+"</span><span>"+(r.weight/total*100).toFixed(1)+"%</span>"));
  });
}

/* ============================================================
   BOOSTS (active abilities) screen
   ============================================================ */
function abilityList(){
  // unique abilities from owned members
  const owned = ROSTER.filter(c=>S.squad[c.id].owned);
  const seen = {};
  const list = [];
  owned.forEach(c=>{
    if(seen[c.ability]) return;
    seen[c.ability]=true;
    list.push({ ability:c.ability, owner:c });
  });
  return list;
}
function triggerAbility(type){
  const now = Date.now();
  const ready = S.abilityReady[type] || 0;
  if(now < ready){ toast("On cooldown"); return; }
  const A = ABILITIES[type];
  S.abilityReady[type] = now + A.cd*1000;
  if(type==="frenzy")    S.activeBoosts.push({type, until:now+A.dur*1000, mult:8, kind:"tap"});
  if(type==="overdrive") S.activeBoosts.push({type, until:now+A.dur*1000, mult:4, kind:"idle"});
  if(type==="blackout")  S.activeBoosts.push({type, until:now+A.dur*1000, mult:10, kind:"all"});
  if(type==="goldrush"){ for(let i=0;i<6;i++) setTimeout(spawnGold, i*350); }
  if(type==="cloutbomb"){ const amt = cps()*90; S.clout+=amt; S.stats.totalClout+=amt; floatText(window.innerWidth/2, window.innerHeight*0.4, "+"+fmt(amt), "crit"); }
  toast(A.icon+" "+A.name+"!", "#ffb23e");
  haptic(50);
  renderBoosts(); renderHUD();
  save();
}
function renderBoosts(){
  const wrap = $("#boost-list"); wrap.innerHTML="";
  const list = abilityList();
  if(list.length===0){ wrap.innerHTML="<p class='muted'>Recruit squad members to unlock their abilities.</p>"; }
  const now = Date.now();
  list.forEach(({ability,owner})=>{
    const A = ABILITIES[ability];
    const ready = S.abilityReady[ability]||0;
    const cd = Math.max(0, (ready-now)/1000);
    const pct = cd>0 ? (1 - cd/A.cd)*100 : 100;
    const card = el("div","boost-card"+(cd>0?" cooling":""));
    card.innerHTML = `
      <div class="boost-icon">${A.icon}</div>
      <div class="boost-meta">
        <div class="boost-name">${A.name}</div>
        <div class="boost-desc">${A.desc}</div>
        <div class="cd-bar"><div class="cd-fill" style="width:${pct}%"></div></div>
      </div>
      <button class="boost-go" data-ability="${ability}" ${cd>0?'disabled':''}>${cd>0?fmtTime(cd):"GO"}</button>`;
    wrap.appendChild(card);
  });
  // active boost chips
  const chips = $("#active-boosts"); chips.innerHTML="";
  S.activeBoosts.forEach(b=>{
    const A=ABILITIES[b.type];
    const left=Math.max(0,(b.until-now)/1000);
    chips.appendChild(el("div","boost-chip",`${A.icon} ${A.name} ${left.toFixed(0)}s`));
  });
}

/* ============================================================
   GOLDEN SNAPS
   ============================================================ */
let goldTimer = 0;
function spawnGold(){
  const g = el("div","gold-snap","👻");
  const startY = 20 + Math.random()*60; // vh
  g.style.top = startY+"vh";
  g.style.left = "-12vw";
  $("#fx-layer").appendChild(g);
  const dur = 5200 + Math.random()*2200;
  g.animate([
    { transform:"translateX(0) rotate(0deg)" },
    { transform:`translateX(124vw) rotate(${Math.random()<.5?360:-360}deg)` }
  ], { duration:dur, easing:"linear" });
  let caught=false;
  g.addEventListener("pointerdown", e=>{
    if(caught) return; caught=true;
    e.stopPropagation();
    const rect = g.getBoundingClientRect();
    catchGold(rect.left+rect.width/2, rect.top+rect.height/2);
    g.remove();
  });
  setTimeout(()=>g.remove(), dur+50);
}
function catchGold(x,y){
  S.stats.goldCaught++;
  const roll = Math.random();
  if(roll < 0.5){
    // big clout — 30..120s of income or tap burst
    const amt = Math.max(cps()*60, tapBase()*120);
    S.clout += amt; S.stats.totalClout+=amt;
    floatText(x,y,"+"+fmt(amt)+" CLOUT","gold");
  } else if(roll < 0.82){
    // temporary all-income frenzy
    S.activeBoosts.push({type:"goldfrenzy", until:Date.now()+15000, mult:7, kind:"all"});
    floatText(x,y,"×7 FRENZY 15s","gold");
  } else {
    // gems!
    const g = 1+Math.floor(Math.random()*3);
    S.gems += g;
    floatText(x,y,"+"+g+" 💎","gold");
  }
  burstParticles(x,y,"#ffd166",24);
  haptic(45);
  checkAchievements();
  renderHUD();
  save();
}

/* ============================================================
   PRESTIGE / REBRAND
   ============================================================ */
function renderPrestige(){
  const pend = pendingInfluence();
  $("#infl-have").textContent = fmt(S.influence);
  $("#infl-pending").textContent = "+"+fmt(pend);
  $("#infl-bonus").textContent = "×"+(1+(S.influence+pend)*0.02).toFixed(2);
  $("#rebrand-btn").disabled = pend<=0;
  $("#rebrand-note").textContent = pend<=0
    ? "Reach 1B total Clout to Rebrand."
    : `Rebranding resets Clout & squad levels but grants permanent income.`;
}
function rebrand(){
  const pend = pendingInfluence();
  if(pend<=0) return;
  if(!confirm(`Rebrand for +${fmt(pend)} Influence? Your Clout and squad levels reset, but you keep gems, achievements, and gain a permanent ×${(1+(S.influence+pend)*0.02).toFixed(2)} multiplier.`)) return;
  S.influence += pend;
  S.stats.rebrands++;
  // reset
  S.clout = 0;
  S.stats.totalClout = 0;
  S.activeBoosts = [];
  S.abilityReady = {};
  const squad = {};
  ROSTER.forEach(c => squad[c.id] = { owned:false, level:0 });
  squad.closer.owned=true; squad.closer.level=1;
  S.squad = squad;
  S.featured = "closer";
  combo=0;
  toast("Rebranded! New era begins ✨","#b06bff");
  checkAchievements();
  save();
  renderAll();
}

/* ============================================================
   ACHIEVEMENTS + DAILY
   ============================================================ */
function checkAchievements(){
  let gained=0;
  ACHIEVEMENTS.forEach(a=>{
    if(!S.achievements[a.id] && a.check(S)){
      S.achievements[a.id]=true;
      S.gems += a.gems;
      gained += a.gems;
      toast(`🏆 ${a.name} (+${a.gems}💎)`, "#ffd166");
    }
  });
  if(gained){ renderHUD(); renderAchievements(); }
}
function renderAchievements(){
  const wrap=$("#ach-list"); if(!wrap) return; wrap.innerHTML="";
  ACHIEVEMENTS.forEach(a=>{
    const done=!!S.achievements[a.id];
    const c=el("div","ach-row"+(done?" done":""));
    c.innerHTML=`<div class="ach-ico">${done?"🏆":"🔒"}</div>
      <div class="ach-txt"><b>${a.name}</b><span>${a.desc}</span></div>
      <div class="ach-rew">+${a.gems}💎</div>`;
    wrap.appendChild(c);
  });
}

function dayNumber(t){ return Math.floor((t - new Date(new Date(t).getFullYear(),0,0).getTimezoneOffset()*60000)/86400000); }
function checkDaily(){
  const today = Math.floor(Date.now()/86400000);
  const last = S.daily.last||0;
  if(last === today){ S.daily.claimedToday=true; return; }
  if(today - last === 1) S.daily.streak += 1;
  else S.daily.streak = 1;
  S.daily.last = today;
  S.daily.claimedToday = false;
}
function dailyReward(){
  const s = S.daily.streak;
  return { gems: 2 + Math.min(s,7), clout: 0 };
}
function claimDaily(){
  if(S.daily.claimedToday){ toast("Already claimed today"); return; }
  const rw = dailyReward();
  S.gems += rw.gems;
  S.daily.claimedToday = true;
  toast(`Day ${S.daily.streak} reward: +${rw.gems}💎`, "#ffd166");
  checkAchievements();
  renderHUD(); renderDaily(); save();
}
function renderDaily(){
  const box=$("#daily-box"); if(!box) return;
  const rw=dailyReward();
  box.innerHTML = `
    <div class="daily-streak">🔥 ${S.daily.streak}-day streak</div>
    <button id="daily-claim" class="big-btn ${S.daily.claimedToday?'cant':''}">
      ${S.daily.claimedToday?"Come back tomorrow":"Claim +"+rw.gems+" 💎"}
    </button>`;
  const b=$("#daily-claim"); if(b) b.onclick=claimDaily;
}

/* ============================================================
   STATS screen
   ============================================================ */
function renderStats(){
  const wrap=$("#stats-list"); if(!wrap) return;
  const rows = [
    ["Total Clout earned", fmt(S.stats.totalClout)],
    ["Clout / second", fmt(cps())],
    ["Clout / tap", fmt(tapBase()*tapMult())],
    ["Total taps", fmt(S.stats.totalTaps)],
    ["Best combo", S.stats.bestCombo+"×"],
    ["Golden Snaps caught", S.stats.goldCaught],
    ["Squad recruited", ownedCount(S)+"/"+ROSTER.length],
    ["Influence", fmt(S.influence)+" (×"+influenceMult().toFixed(2)+")"],
    ["Rebrands", S.stats.rebrands],
    ["Snaps (gems)", fmt(S.gems)],
  ];
  wrap.innerHTML = rows.map(r=>`<div class="stat-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("");
  renderAchievements();
}

/* ============================================================
   TOASTS
   ============================================================ */
let toastTimer=null;
function toast(msg, color){
  const t=$("#toast");
  t.textContent=msg;
  t.style.borderColor = color||"#3da9fc";
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove("show"),1900);
}

/* ============================================================
   NAV / SCREENS
   ============================================================ */
const SCREENS = ["tap","squad","summon","boosts","stats"];
function showScreen(name){
  SCREENS.forEach(s=>{
    $("#screen-"+s).classList.toggle("active", s===name);
    const nav=$(`[data-nav="${s}"]`); if(nav) nav.classList.toggle("on", s===name);
  });
  if(name==="squad") renderSquad();
  if(name==="summon") renderSummon();
  if(name==="boosts") renderBoosts();
  if(name==="stats"){ renderStats(); renderDaily(); renderPrestige(); }
  if(name==="tap") renderTapScreen();
}

function renderAll(){
  renderHUD(); renderTapScreen(); renderSquad(); renderSummon(); renderBoosts();
  renderStats(); renderDaily(); renderPrestige();
}

/* ============================================================
   MAIN LOOP
   ============================================================ */
let lastTick = Date.now();
function tick(){
  const now = Date.now();
  const dt = (now - lastTick)/1000;
  lastTick = now;

  // expire boosts
  if(S.activeBoosts.length){
    S.activeBoosts = S.activeBoosts.filter(b=>b.until>now);
  }
  // idle income
  const gain = cps()*dt;
  if(gain>0){ S.clout += gain; S.stats.totalClout += gain; }

  // combo decay
  if(combo>0 && now>comboExpire){ combo=0; updateComboUI(); }

  // golden snap scheduler
  goldTimer -= dt*1000;
  if(goldTimer<=0){
    spawnGold();
    goldTimer = GOLD_INTERVAL[0] + Math.random()*(GOLD_INTERVAL[1]-GOLD_INTERVAL[0]);
  }

  renderHUD();
  if($("#screen-tap").classList.contains("active")) $("#tap-power").textContent = fmt(tapBase()*tapMult()*comboMult());
  if($("#screen-boosts").classList.contains("active")) renderBoosts();

  // periodic checks
  if(Math.random()<0.02) checkAchievements();
}

/* ============================================================
   OFFLINE EARNINGS
   ============================================================ */
function applyOffline(){
  const now = Date.now();
  const away = (now - (S.lastSeen||now))/1000;
  if(away < 60) return;
  const rate = cps();
  const capped = Math.min(away, 8*3600); // cap 8h
  const earned = rate * capped * 0.5; // 50% efficiency offline
  if(earned <= 0) return;
  S.clout += earned; S.stats.totalClout += earned;
  setTimeout(()=>{
    const ov=$("#offline-overlay");
    $("#offline-time").textContent = fmtTime(away);
    $("#offline-amt").textContent = fmt(earned);
    ov.classList.add("show");
  }, 400);
}

/* ============================================================
   BOOT
   ============================================================ */
function bindEvents(){
  // tap the hero
  const stage = $("#hero-stage");
  stage.addEventListener("pointerdown", e=>{
    if(e.target.closest(".gold-snap")) return;
    doTap(e.clientX, e.clientY);
  });

  // bottom nav
  $$("[data-nav]").forEach(b=> b.addEventListener("click",()=>showScreen(b.dataset.nav)));

  // squad actions (delegated)
  $("#squad-list").addEventListener("click", e=>{
    const up=e.target.closest("[data-up]"); if(up){ buyUpgrade(up.dataset.up); return; }
    const ft=e.target.closest("[data-feat]"); if(ft){ S.featured=ft.dataset.feat; renderTapScreen(); renderSquad(); save(); toast("Featured updated"); }
  });

  // summon buttons
  $("#pull-1").addEventListener("click",()=>summon(1));
  $("#pull-10").addEventListener("click",()=>summon(10));
  $("#summon-overlay").addEventListener("click",()=>$("#summon-overlay").classList.remove("show"));

  // boosts (delegated)
  $("#boost-list").addEventListener("click", e=>{
    const b=e.target.closest("[data-ability]"); if(b) triggerAbility(b.dataset.ability);
  });

  // prestige
  $("#rebrand-btn").addEventListener("click", rebrand);

  // offline overlay dismiss
  $("#offline-collect").addEventListener("click",()=>$("#offline-overlay").classList.remove("show"));

  // settings
  $("#opt-sfx").addEventListener("change",e=>{S.settings.sfx=e.target.checked;save();});
  $("#opt-haptics").addEventListener("change",e=>{S.settings.haptics=e.target.checked;save();});
  $("#wipe-btn").addEventListener("click",()=>{
    if(confirm("Erase ALL progress? This cannot be undone.")){ localStorage.removeItem(SAVE_KEY); location.reload(); }
  });

  // save on hide
  document.addEventListener("visibilitychange",()=>{ if(document.hidden) save(); });
  window.addEventListener("beforeunload", save);
}

function boot(){
  const had = load();
  checkDaily();
  applyOffline();
  bindEvents();
  $("#opt-sfx").checked = S.settings.sfx;
  $("#opt-haptics").checked = S.settings.haptics;
  renderAll();
  showScreen("tap");
  checkAchievements();
  lastTick = Date.now();
  setInterval(tick, TICK_MS);
  setInterval(save, 15000);
  // register PWA service worker
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("service-worker.js").catch(()=>{});
  }
}

document.addEventListener("DOMContentLoaded", boot);
