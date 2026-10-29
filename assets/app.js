/* MotorAI — non-parametric reverse design console. Scenario player + visualizations driven by the real test3 campaign (assets/data.js). */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const C=window.CAMPAIGN||{points:[],gens:[],grid:[],prompts:{},baseline:{iron:1.1782,tq:285.5}};
const I18N=window.I18N;
const GENCOL=['#5b8cff','#22d3ee','#34d399','#f5a524','#fb6f84'];
const TH=t=>`assets/d/${t}.png`;
const pctOf=(v,b)=>(v/b-1)*100;
const fp=(x,d=1)=>(x>0?'+':x<0?'−':'')+Math.abs(x).toFixed(d)+' %';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const BY_T={};C.points.forEach(p=>{BY_T[p.t]=p;});
const BASE=C.baseline;
const tip=document.getElementById('tip');

/* ============================================================== i18n */
let lang=(()=>{try{return localStorage.getItem('motorai-rd-lang')||'en';}catch(e){return 'en';}})();
if(!I18N[lang])lang='en';
const ABBR={design:'de',generation:'ge',evaluation:'ev',campaign:'ga'};
function t(k){return (I18N[lang]&&I18N[lang][k]!=null)?I18N[lang][k]:(I18N.en[k]!=null?I18N.en[k]:k);}
function applyTopbar(which){
  if(which==='overview'){$('#topTitle').textContent=t('top.ov.t');$('#topSub').textContent=t('top.ov.s');return;}
  const a=ABBR[which];$('#topTitle').textContent=t('top.'+a+'.t');$('#topSub').textContent=t('top.'+a+'.s');$('#vizTitle').textContent=t('viz.'+a);
}
function applyLang(l){
  lang=I18N[l]?l:'en';try{localStorage.setItem('motorai-rd-lang',lang);}catch(e){}
  document.documentElement.lang=lang;
  $$('#langToggle button').forEach(b=>b.classList.toggle('on',b.dataset.lang===lang));
  $$('[data-i18n]').forEach(el=>{const k=el.getAttribute('data-i18n');if(I18N[lang][k]!=null)el.textContent=I18N[lang][k];});
  $$('[data-i18n-html]').forEach(el=>{const k=el.getAttribute('data-i18n-html');if(I18N[lang][k]!=null)el.innerHTML=I18N[lang][k];});
  $$('[data-i18n-ph]').forEach(el=>{const k=el.getAttribute('data-i18n-ph');if(I18N[lang][k]!=null)el.placeholder=I18N[lang][k];});
  updatePauseBtn();
  if($('#view-agent').classList.contains('active')&&player.agent){applyTopbar(player.agent);playAgent(player.agent);}
  else applyTopbar('overview');
}

/* ============================================================== player */
const player={token:0,paused:false,speed:1,agent:null};
function sleep(totalMs,tok){
  return new Promise(res=>{
    let acc=0,last=performance.now();
    function tick(now){
      if(tok!==player.token){res();return;}
      if(!player.paused)acc+=(now-last)*player.speed;
      last=now;
      if(acc>=totalMs){res();return;}
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
const computeDur=txt=>clamp(1000+txt.replace(/<[^>]+>/g,'').length*16,1000,4600);
/* timers that respect pause / speed */
const timers=[];
function after(ms,fn){const tok=player.token;timers.push({ms,fn,tok});sleep(ms,tok).then(()=>{if(tok===player.token)fn();});}
function tween(ms,step,done){
  const tok=player.token;let acc=0,last=performance.now();
  function f(now){if(tok!==player.token)return;if(!player.paused)acc+=(now-last)*player.speed;last=now;const k=clamp(acc/ms,0,1);step(k);if(k<1)requestAnimationFrame(f);else if(done)done();}
  requestAnimationFrame(f);
}
function animNum(el,from,to,ms,fmt){tween(ms,k=>{el.textContent=(fmt||Math.round)(lerp(from,to,k));});}

/* ============================================================== chat */
const chatEl=()=>$('#chat');
function clearChat(){chatEl().innerHTML='';}
function scrollChat(){const c=chatEl();c.scrollTop=c.scrollHeight;}
function addBubble(who,html){
  const m=document.createElement('div');m.className='msg '+who;
  m.innerHTML=`<div class="ava">${who==='user'?'HJ':'AI'}</div><div class="bubble">${html}</div>`;
  chatEl().appendChild(m);scrollChat();return m;
}
function addTyping(){
  const m=document.createElement('div');m.className='msg agent';
  m.innerHTML=`<div class="ava">AI</div><div class="bubble"><div class="typing"><i></i><i></i><i></i></div></div>`;
  chatEl().appendChild(m);scrollChat();return m;
}
function buildStepper(n){const s=$('#stepper');s.innerHTML='';for(let i=0;i<n;i++){const d=document.createElement('div');d.className='sd';d.innerHTML='<b></b>';s.appendChild(d);}}
function markStep(i){$$('#stepper .sd').forEach((d,k)=>{d.classList.toggle('done',k<i);d.classList.toggle('cur',k===i);});}

/* ============================================================== scene runner */
const PACE={design:.55,generation:.85,evaluation:.85,campaign:.95};
async function renderStep(step,tok,pace){
  const txt=t(step.key);
  if(step.who==='user'){addBubble('user',txt);}
  else{const tp=addTyping();await sleep(520*pace,tok);if(tok!==player.token){tp.remove();return;}tp.remove();addBubble('agent',txt);}
  if(step.after)step.after();
}
async function runScene(agent,tok){
  const scene=SCENES[agent],pace=PACE[agent]||1;
  buildStepper(scene.length);
  for(let i=0;i<scene.length;i++){
    if(tok!==player.token)return;
    markStep(i);
    await renderStep(scene[i],tok,pace);
    if(tok!==player.token)return;
    await sleep((scene[i].dur??computeDur(t(scene[i].key)))*pace,tok);
  }
  if(tok===player.token)markStep(scene.length);
}
function playAgent(agent){
  player.token++;player.paused=false;updatePauseBtn();player.agent=agent;
  clearChat();resetViz(agent);runScene(agent,player.token);
}
function replayCurrent(){if($('#view-agent').classList.contains('active')&&player.agent)playAgent(player.agent);}
function togglePause(){player.paused=!player.paused;updatePauseBtn();}
function updatePauseBtn(){const b=$('#pauseBtn');b.querySelector('span').textContent=player.paused?t('ctrl.resume'):t('ctrl.pause');b.classList.toggle('primary',player.paused);}
$('#speeds').addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;$$('#speeds button').forEach(x=>x.classList.remove('on'));btn.classList.add('on');player.speed=parseFloat(btn.dataset.sp);});

/* ============================================================== viz switch */
function resetViz(agent){
  if(typeof hybStop==="function")hybStop();
  stopGal();
  ['design','generation','evaluation','campaign'].forEach(a=>{$('#viz-'+a).style.display=a===agent?'block':'none';});
  $('#vizBody').scrollTop=0;
  if(agent==='design')resetDesign();
  if(agent==='generation')resetGen();
  if(agent==='evaluation'){resetEval();cadDraw();}
  if(agent==='campaign')resetGA();
}

/* ============================================================== DESIGN */
function resetDesign(){
  ['dc-ref','dc-space','dc-obj'].forEach(id=>$('#'+id).classList.remove('on'));
  $$('#dc-space .dim,#dc-obj .objline,#dc-obj .cst').forEach(d=>d.classList.remove('show'));
  $('#readybtn').classList.remove('show');
}
function flyToken(text,targetSel){
  const src=$$('#chat .msg .bubble').slice(-1)[0],tgt=$(targetSel);if(!src||!tgt)return;
  const s=src.getBoundingClientRect(),r=tgt.getBoundingClientRect();
  const f=document.createElement('div');f.className='token-fly';f.textContent=text;
  f.style.left=s.left+20+'px';f.style.top=s.top+10+'px';document.body.appendChild(f);
  requestAnimationFrame(()=>{f.style.left=r.left+r.width/2-30+'px';f.style.top=r.top+14+'px';f.style.opacity='0';f.style.transform='scale(.7)';});
  setTimeout(()=>f.remove(),1100);
}
function fillRef(){$('#dc-ref').classList.add('on');flyToken('reference image','#dc-ref');}
function fillSpace(){$('#dc-space').classList.add('on');flyToken('rotor · stator · PM','#dc-space');$$('#dc-space .dim').forEach((d,i)=>after(120+i*160,()=>d.classList.add('show')));}
function fillObj(){$('#dc-obj').classList.add('on');flyToken('iron ↓ · torque ↑','#dc-obj');$$('#dc-obj .objline,#dc-obj .cst').forEach((d,i)=>after(120+i*220,()=>d.classList.add('show')));}
function finishDesign(){$('#readybtn').classList.add('show');}

/* ============================================================== GENERATION (generation 2 of the campaign) */
const G=C.gens, G1=G[0], G2=G[1]||G[0];
const GAL=C.gallery||{explore:[],exploit:[]};
const galIdx={ex:0,xp:0};
let galTimers=[];
function stopGal(){galTimers.forEach(clearInterval);galTimers=[];}
/* keep the edit token and the WHERE / EDIT / ALSO lines; the preamble and KEEP line are the same in every gradient */
function shortDirection(txt){
  const lines=txt.split('\n'),tok=(lines[0].match(/^\[[A-Z_]+\]/)||[''])[0];
  return [tok].concat(lines.filter(l=>/^(WHERE|EDIT|ALSO):/.test(l)&&!/^ALSO:\s*none/.test(l))).join('\n');
}
function galList(kind){return kind==='ex'?GAL.explore:GAL.exploit;}
function showGal(kind,i){
  const list=galList(kind);if(!list.length)return;
  const k=i%list.length,x=list[k];
  $$('#'+kind+'Grid img').forEach((im,n)=>im.classList.toggle('cur',n===k));
  if(kind==='ex'){$('#exOp').textContent=x.op;$('#exMove').textContent=x.txt||'';}
  else{$('#xpArm').textContent=x.arm==='tr'?'transfer':'library';$('#xpGrad').innerHTML=fmtDirection(shortDirection(x.txt||''));}
}
function buildGallery(kind){
  const box=$('#'+kind+'Grid');box.innerHTML='';
  galList(kind).forEach((x,k)=>{
    const im=document.createElement('img');im.src=TH(x.t);im.alt='';im.title=`gen ${x.it}${x.op?' · '+x.op:''}`;
    im.addEventListener('click',()=>{galIdx[kind]=k;showGal(kind,k);});
    box.appendChild(im);
  });
}
function revealGallery(kind){$$('#'+kind+'Grid img').forEach((im,i)=>after(60+i*55,()=>im.classList.add('in')));}
function startGal(kind){
  const list=galList(kind);if(!list.length)return;
  showGal(kind,galIdx[kind]);
  galTimers.push(setInterval(()=>{if(player.paused)return;galIdx[kind]=(galIdx[kind]+1)%list.length;showGal(kind,galIdx[kind]);},3200));
}
/* embedding space: t-SNE of the generation-2 N11 vectors, FPS picks drawn in pick order */
const EMB=C.emb||{pts:[]};
const EW=400,EH=300,EPD=16;
const ex_=v=>EPD+v*(EW-2*EPD), ey_=v=>EPD+(1-v)*(EH-2*EPD);
const ACOL={to:'#6ee7b7',li:'#ffce86',tr:'#fb6f84'};
function drawEmb(show,pick){
  const s=[];
  if(show)EMB.pts.forEach(p=>{
    const picked=p.kept&&(p.o||60)<=pick;
    s.push(`<circle class="ep" data-t="${p.t}" cx="${ex_(p.x).toFixed(1)}" cy="${ey_(p.y).toFixed(1)}" r="${picked?4.4:3.6}" fill="${ACOL[p.arm]||'#9aa0b8'}" opacity="${pick?(picked?1:.3):.9}"/>`);
  });
  if(pick)EMB.pts.filter(p=>p.kept&&(p.o||60)<=pick).forEach(p=>s.push(`<circle cx="${ex_(p.x).toFixed(1)}" cy="${ey_(p.y).toFixed(1)}" r="7.2" fill="none" stroke="${p.forced?'#22d3ee':'#fff'}" stroke-width="1.6" pointer-events="none"/>`));
  $('#embSvg').innerHTML=s.join('');
}
function buildPool(){
  const pool=$('#pool');pool.innerHTML='';
  C.grid.forEach(g=>{
    const d=document.createElement('div');d.className='tile '+(g.arm==='to'?'ex':g.arm==='tr'?'xp tr':'xp');
    d.innerHTML=`<img src="${TH(g.t)}" alt="">`;d.title=(g.arm==='to'?'exploration · ':g.arm==='tr'?'transfer · ':'library · ')+(g.op||'');
    pool.appendChild(d);
  });
}
function resetGen(){
  stopGal();galIdx.ex=0;galIdx.xp=0;
  ['g-explore','g-exploit','g-pool'].forEach(id=>$('#'+id).classList.remove('on'));
  buildGallery('ex');buildGallery('xp');showGal('ex',0);showGal('xp',0);
  $('#exRole').textContent=C.role||'';
  $('#embInstr').textContent='“'+(EMB.instruction||'')+'”';
  drawEmb(false,0);
  buildPool();
  ['psGen','psGate','psEmb','psKept'].forEach(id=>$('#'+id).textContent='0');$('#poolInfo').textContent='0 / '+(EMB.n||196);
  $('#genReady').classList.remove('show');
}
function genExplore(){$('#g-explore').classList.add('on');revealGallery('ex');startGal('ex');}
function fmtDirection(txt){
  return esc(txt).replace(/^\[([A-Z_]+)\]/,'<span class="tk">[$1]</span>').replace(/\n(WHERE|EDIT|ALSO|KEEP):/g,'\n<span class="kw">$1:</span>');
}
function typeInto(el,html,ms){
  const tmp=document.createElement('div');tmp.innerHTML=html;const full=tmp.textContent;
  tween(ms,k=>{if(k<1)el.textContent=full.slice(0,Math.floor(full.length*k));else el.innerHTML=html;});
}
function genExploit(){$('#g-exploit').classList.add('on');revealGallery('xp');startGal('xp');}
function genPool(){
  $('#g-pool').classList.add('on');
  const tiles=$$('#pool .tile');
  tiles.forEach((d,i)=>after(60+i*55,()=>d.classList.add('in')));
  animNum($('#psGen'),0,G2.generated+G2.gate_dropped,60+tiles.length*55);
}
function genGate(){
  const tiles=$$('#pool .tile');
  C.grid.forEach((g,i)=>{if(g.gated)after(200+i*40,()=>tiles[i].classList.add('gated'));});
  after(900,()=>{animNum($('#psGate'),0,G2.gate_dropped,500);});
}
function genEmbed(){
  const tiles=$$('#pool .tile');
  C.grid.forEach((g,i)=>{if(!g.gated)after(80+i*40,()=>tiles[i].classList.add('emb'));});
  animNum($('#psEmb'),0,G2.generated,1800);
  $('#embSvg').style.opacity=0;drawEmb(true,0);requestAnimationFrame(()=>$('#embSvg').style.opacity=1);
}
function genFilter(){
  const tiles=$$('#pool .tile');
  after(300,()=>{C.grid.forEach((g,i)=>{if(g.gated)return;if(g.kept){after(i*45,()=>{tiles[i].classList.remove('emb');tiles[i].classList.add('kept');if(g.forced)tiles[i].classList.add('forced');});}else after(i*45,()=>{tiles[i].classList.remove('emb');tiles[i].classList.add('dim');});});});
  after(600,()=>animNum($('#psKept'),0,G2.kept,1200));
  tween(2600,k=>{const n=Math.ceil(k*G2.kept);drawEmb(true,n);$('#poolInfo').textContent=`${n} / ${EMB.n||G2.generated}`;});
}
function finishGen(){$('#genReady').classList.add('show');}

/* ============================================================== EVALUATION */
const CAD=C.cad||{pm:[],void:[],template:{},result:{},wave:[]}, HYB=C.hybrid||{rounds:[]};
const SV='http://www.w3.org/2000/svg';
/* polygons in mm (y up) -> svg path in a viewBox whose y axis points down */
const pth=pts=>pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+(-p[1]).toFixed(2)).join(' ')+'Z';
function bboxOf(list,pad){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;list.forEach(poly=>poly.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}));return [x0-pad,-y1-pad,x1-x0+2*pad,y1-y0+2*pad];}
function setVB(svg,vb){svg.setAttribute('viewBox',vb.map(v=>v.toFixed(2)).join(' '));svg.setAttribute('preserveAspectRatio','xMidYMid meet');}
function cadEdges(){
  const svg=$('#cadEdges');setVB(svg,bboxOf(CAD.pm.concat(CAD.void),1.2));let s='';
  CAD.void.forEach(p=>{s+=`<path d="${pth(p)}" fill="none" stroke="#2cf04a" stroke-width=".22"/>`;});
  CAD.pm.forEach(p=>{s+=`<path d="${pth(p)}" fill="none" stroke="#5b8cff" stroke-width=".22"/>`;});
  CAD.void.concat(CAD.pm).forEach(p=>p.forEach(([x,y])=>{s+=`<circle cx="${x.toFixed(2)}" cy="${(-y).toFixed(2)}" r=".32" fill="#fff"/>`;}));
  svg.innerHTML=s;
}
function cadStep(){
  const svg=$('#cadStep');const vb=bboxOf(CAD.pm.concat(CAD.void),1.2);setVB(svg,vb);let s='';
  CAD.void.forEach(p=>{s+=`<path d="${pth(p)}" fill="#2cf04a" fill-opacity=".85"/>`;});
  CAD.pm.forEach(p=>{s+=`<path d="${pth(p)}" fill="#2b5cff"/>`;});
  s+=`<line x1="0" y1="${vb[1]}" x2="0" y2="${vb[1]+vb[3]}" stroke="#fff" stroke-width=".18" stroke-dasharray=".8 .6" opacity=".8"/>`;
  s+=`<text x="${vb[0]+.8}" y="${vb[1]+2.4}" fill="#9db8ff" font-size="2.1" font-weight="800">PM.step</text><text x="${vb[0]+.8}" y="${vb[1]+4.9}" fill="#6ee7b7" font-size="2.1" font-weight="800">Void.step</text>`;
  svg.innerHTML=s;
}
const TPL=CAD.template;const R_IN=(TPL.rt_din||50)/2,R_OUT=(TPL.rt_dout||132)/2,S_IN=R_OUT+(TPL.airgap||.8),S_OUT=(TPL.st_dout||200)/2,NP=TPL.n_pole||8,NS=TPL.n_slot||48;
const pol=(r,a)=>[r*Math.sin(a),r*Math.cos(a)];   /* angle measured from +y (pole axis) */
function sectorPath(r0,r1,a){const p=[pol(r0,-a),pol(r1,-a)],q=[pol(r1,a),pol(r0,a)];
  return `M${p[0][0]} ${-p[0][1]} L${p[1][0]} ${-p[1][1]} A${r1} ${r1} 0 0 1 ${q[0][0]} ${-q[0][1]} L${q[1][0]} ${-q[1][1]} A${r0} ${r0} 0 0 0 ${p[0][0]} ${-p[0][1]}Z`;}
function feaAlign(){
  const svg=$('#feaAlign');const a=Math.PI/NP;setVB(svg,[-30,-70,60,74]);let s='';
  s+=`<path d="${sectorPath(R_IN,R_OUT,a)}" fill="#3a1414" stroke="#ff6b6b" stroke-width=".5"/>`;
  CAD.void.forEach(p=>{s+=`<path d="${pth(p)}" fill="#2cf04a" fill-opacity=".85"/>`;});
  CAD.pm.forEach(p=>{s+=`<path d="${pth(p)}" fill="#2b5cff"/>`;});
  s+=`<line x1="0" y1="2" x2="0" y2="-69" stroke="#fff" stroke-width=".35" stroke-dasharray="2 1.4"/>`;
  s+=`<line x1="0" y1="0" x2="14" y2="0" stroke="#ffce86" stroke-width=".7"/><line x1="0" y1="0" x2="0" y2="-14" stroke="#ffce86" stroke-width=".7"/>`;
  s+=`<circle cx="0" cy="0" r="1.6" fill="#ffce86"/><text x="2.4" y="3.6" fill="#ffce86" font-size="4" font-weight="800">(0, 0)</text>`;
  s+=`<text x="1.6" y="-62" fill="#fff" font-size="3.6" font-weight="800">x = 0</text>`;
  svg.innerHTML=s;
}
/* magnetisation: centre magnet radial (+y); side magnets normal to their long edge, pointing outward */
function magArrows(polys){return polys.map(p=>{
  let cx=0,cy=0;p.forEach(([x,y])=>{cx+=x;cy+=y;});cx/=p.length;cy/=p.length;
  let best=0,dir=[1,0];for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length],dx=q[0]-p[i][0],dy=q[1]-p[i][1],L=Math.hypot(dx,dy);if(L>best){best=L;dir=[dx/L,dy/L];}}
  let n=[-dir[1],dir[0]];if(n[0]*cx+n[1]*cy<0)n=[-n[0],-n[1]];
  if(Math.abs(cx)<1.5)n=[0,1];
  return {cx,cy,n};});}
function arrow(x,y,dx,dy,len,col,w){const x2=x+dx*len,y2=y+dy*len,hx=-dy,hy=dx,h=len*.32;
  return `<line x1="${x.toFixed(2)}" y1="${(-y).toFixed(2)}" x2="${x2.toFixed(2)}" y2="${(-y2).toFixed(2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`+
    `<path d="M${(x2+dx*h*.9).toFixed(2)} ${(-(y2+dy*h*.9)).toFixed(2)} L${(x2+hx*h*.6).toFixed(2)} ${(-(y2+hy*h*.6)).toFixed(2)} L${(x2-hx*h*.6).toFixed(2)} ${(-(y2-hy*h*.6)).toFixed(2)}Z" fill="${col}"/>`;}
function feaMag(){
  const svg=$('#feaMag');setVB(svg,bboxOf(CAD.pm.concat(CAD.void),2.2));let s='';
  CAD.void.forEach(p=>{s+=`<path d="${pth(p)}" fill="#2cf04a" fill-opacity=".35"/>`;});
  CAD.pm.forEach(p=>{s+=`<path d="${pth(p)}" fill="#2b5cff"/>`;});
  magArrows(CAD.pm).forEach(m=>{s+=arrow(m.cx,m.cy,m.n[0],m.n[1],5.4,"#ff5d5d",.95);});
  svg.innerHTML=s;
}
const rot=(p,a)=>[p[0]*Math.cos(a)+p[1]*Math.sin(a),-p[0]*Math.sin(a)+p[1]*Math.cos(a)];
function feaMotor(){
  const svg=$('#feaMotor');setVB(svg,[-S_OUT-2,-S_OUT-2,2*S_OUT+4,2*S_OUT+4]);let s='';
  s+=`<circle cx="0" cy="0" r="${S_OUT}" fill="#2a2f45" stroke="#4b5478" stroke-width=".6"/><circle cx="0" cy="0" r="${S_IN}" fill="#05070f"/>`;
  const sw=TPL.sl_width||4.48,sh=TPL.sl_height||13.2,so=TPL.shoe_h||2;
  for(let k=0;k<NS;k++){const a=(k+.5)*2*Math.PI/NS;const pts=[[-sw/2,S_IN+so],[sw/2,S_IN+so],[sw/2,S_IN+so+sh],[-sw/2,S_IN+so+sh]].map(p=>rot(p,a));
    s+=`<path d="${pth(pts)}" fill="#c9762e" opacity=".9"/>`;
    const op=[[-(TPL.sl_open||1.4)/2,S_IN-.1],[(TPL.sl_open||1.4)/2,S_IN-.1],[(TPL.sl_open||1.4)/2,S_IN+so+.2],[-(TPL.sl_open||1.4)/2,S_IN+so+.2]].map(p=>rot(p,a));
    s+=`<path d="${pth(op)}" fill="#05070f"/>`;}
  s+=`<circle cx="0" cy="0" r="${R_OUT}" fill="#3a1414" stroke="#ff6b6b" stroke-width=".4"/><circle cx="0" cy="0" r="${R_IN}" fill="#05070f" stroke="#4b5478" stroke-width=".4"/>`;
  const arr=magArrows(CAD.pm);
  for(let k=0;k<NP;k++){const a=k*2*Math.PI/NP,sign=k%2?-1:1,op=k?.42:1;
    let g=`<g opacity="${op}">`;
    CAD.void.forEach(p=>{g+=`<path d="${pth(p.map(q=>rot(q,a)))}" fill="#2cf04a" fill-opacity=".85"/>`;});
    CAD.pm.forEach(p=>{g+=`<path d="${pth(p.map(q=>rot(q,a)))}" fill="#2b5cff"/>`;});
    arr.forEach(m=>{const c=rot([m.cx,m.cy],a),n=rot(m.n,a);g+=arrow(c[0],c[1],n[0]*sign,n[1]*sign,6,sign>0?'#ff5d5d':'#ffffff',1.1);});
    s+=g+'</g>';}
  const b=Math.PI/NP;[-b,b].forEach(x=>{const p=pol(S_OUT+1,x);s+=`<line x1="0" y1="0" x2="${p[0].toFixed(2)}" y2="${(-p[1]).toFixed(2)}" stroke="#ffce86" stroke-width=".8" stroke-dasharray="3 2"/>`;});
  svg.innerHTML=s;
}
function svWave(){
  const w=CAD.wave||[];if(w.length<2)return;const xs=w.map(p=>p[0]),ys=w.map(p=>p[1]);
  const x0=Math.min(...xs),x1=Math.max(...xs),y1=Math.max(...ys)*1.08;
  const d=w.map((p,i)=>(i?'L':'M')+((p[0]-x0)/(x1-x0)*200).toFixed(1)+' '+(68-p[1]/y1*64).toFixed(1)).join(' ');
  $('#svWave').innerHTML=`<path d="${d}" fill="none" stroke="#ffce86" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
}
function cadDraw(){cadEdges();cadStep();feaAlign();feaMag();feaMotor();svWave();}
function resetEval(){
  ['e-cad','e-fea','e-hyb'].forEach(id=>$('#'+id).classList.remove('on'));
  $$('#viz-evaluation .cs').forEach(n=>n.classList.remove('on'));
  $('#svIron').textContent='—';$('#svTq').textContent='—';
  hybReset();
  $('#evReady').classList.remove('show');
}
function lightSteps(from,to){for(let i=from;i<=to;i++)after(200+(i-from)*650,()=>{const n=$(`#viz-evaluation .cs[data-s="${i}"]`);if(n)n.classList.add('on');});}
function evCad(){$('#e-cad').classList.add('on');lightSteps(0,4);}
function evFea(){$('#e-fea').classList.add('on');lightSteps(5,8);
  after(200+3*650,()=>{animNum($('#svIron'),0,CAD.result.iron_kW||0,900,v=>v.toFixed(3));animNum($('#svTq'),0,CAD.result.torque_Nm||0,900,v=>v.toFixed(1));});}

/* ---------- FEA-AI hybrid router (ported from the study-01 console) ---------- */
const HY={tokens:[],queue:[],tau:0,fea:0,ai:0,raf:null,last:0,spawn:0,round:-1,active:false};
const SIG_LO=95,SIG_HI=150;
function hybAnchors(){const r=$('#router').getBoundingClientRect(),W=r.width,H=r.height;
  return {POP:[.11*W,.5*H],GATE:[.40*W,.5*H],FEA:[.74*W,.25*H],AI:[.74*W,.75*H],SUR:[.40*W,.86*H]};}
function hybPlace(){
  const set=(id,fx,fy)=>{const e=$(id);e.style.left=fx*100+'%';e.style.top=fy*100+'%';};
  set('#n-pop',.11,.5);set('#n-gate',.40,.5);set('#n-fea',.74,.25);set('#n-ai',.74,.75);set('#n-sur',.40,.86);
  const a=hybAnchors(),L=(p,q,c,d)=>`<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${c}" stroke-width="1.8" ${d?'stroke-dasharray="6 6"':''} opacity=".55"/>`;
  $('#wires').innerHTML=L(a.POP,a.GATE,'#6366f1')+L(a.GATE,a.FEA,'#f5a524')+L(a.GATE,a.AI,'#34d399')+L(a.FEA,a.SUR,'#22d3ee')+L(a.AI,a.SUR,'#22d3ee')+L(a.SUR,a.POP,'#22d3ee',true);
}
function setTau(v){HY.tau=v;$('#tauVal').textContent=v.toFixed(1)+' W';$('#gateMark').style.left=((v-SIG_LO)/(SIG_HI-SIG_LO)*100)+'%';drawSig();}
function drawSig(){
  const R=HYB.rounds[Math.max(HY.round,0)];if(!R){$('#sigSvg').innerHTML='';return;}
  const X=v=>20+(v-SIG_LO)/(SIG_HI-SIG_LO)*560;let s='';
  for(const v of [100,110,120,130,140,150])s+=`<line x1="${X(v)}" y1="12" x2="${X(v)}" y2="66" stroke="rgba(255,255,255,.06)"/><text x="${X(v)}" y="84" fill="#9aa0b8" font-size="12" text-anchor="middle">${v} W</text>`;
  const shown=HY.round>=0;
  R.sig.forEach((v,i)=>{const y=22+((i*37)%40);const f=v>=HY.tau;s+=`<circle cx="${X(v).toFixed(1)}" cy="${y}" r="5" fill="${shown?(f?'#f5a524':'#34d399'):'#646a86'}" opacity=".9"/>`;});
  s+=`<line x1="${X(HY.tau)}" y1="6" x2="${X(HY.tau)}" y2="70" stroke="#c9b6ff" stroke-width="2.2"/><text x="${X(HY.tau)+6}" y="16" fill="#c9b6ff" font-size="12.5" font-weight="800">τ</text>`;
  s+=`<text x="${X(SIG_LO)}" y="8" fill="#6ee7b7" font-size="12" font-weight="800">AI ←</text><text x="${X(SIG_HI)}" y="8" fill="#ffce86" font-size="12" font-weight="800" text-anchor="end">→ FEA</text>`;
  $('#sigSvg').innerHTML=s;
}
function hybReset(){
  hybStop();HY.tokens.forEach(t=>t.el.remove());HY.tokens=[];HY.queue=[];HY.fea=0;HY.ai=0;HY.round=-1;
  $('#reason').classList.remove('show');$('#llmChip').classList.remove('act');$('#roundInfo').textContent='';
  setTau(HYB.tau_init||118.9);hybCounters();
}
function hybCounters(){
  $('#cFea').textContent=HY.fea;$('#cAi').textContent=HY.ai;$('#mFea').textContent=HY.fea;$('#mAi').textContent=HY.ai;
  const tot=HY.fea+HY.ai;$('#mShare').textContent=tot?Math.round(HY.ai/tot*100)+' %':'0 %';
  $('#mSave').textContent=Math.round(HY.ai*(CAD.result.sec||53)/60)+' min';
}
function hybRound(k){
  const R=HYB.rounds[k];if(!R)return;HY.round=k;setTau(R.tau);
  $('#roundInfo').textContent=`round ${k+1} · τ ${R.tau.toFixed(1)} W · FEA ${R.n_fea} / AI ${R.n_ai}`;
  R.sig.forEach((v,i)=>HY.queue.push({v,f:R.fea[i]}));
  if(!HY.active){HY.active=true;HY.last=performance.now();HY.raf=requestAnimationFrame(hybLoop);}
}
function hybStop(){HY.active=false;if(HY.raf){cancelAnimationFrame(HY.raf);HY.raf=null;}}
function hybLoop(now){
  if(!HY.active||!$('#router'))return;
  const dt=player.paused?0:(now-HY.last)*player.speed;HY.last=now;HY.spawn+=dt;
  const a=hybAnchors();
  if(HY.spawn>130&&HY.queue.length&&HY.tokens.length<26){HY.spawn=0;const q=HY.queue.shift();
    const el=document.createElement('div');el.className='particle';el.textContent=Math.round(q.v)+' W';$('#router').appendChild(el);
    HY.tokens.push({q,el,seg:0,t:0,wp:[a.POP,a.GATE],routed:false,done:false});}
  HY.tokens.forEach(tk=>{
    if(tk.done)return;tk.t+=dt/520;
    if(tk.t>=1){tk.t=0;tk.seg++;
      if(!tk.routed&&tk.seg===1){tk.routed=true;tk.wp.push(tk.q.f?a.FEA:a.AI,a.SUR);tk.el.classList.add(tk.q.f?'f':'a');
        if(tk.q.f)HY.fea++;else HY.ai++;hybCounters();}
      if(tk.seg>=tk.wp.length-1){tk.done=true;tk.el.style.opacity='0';setTimeout(()=>tk.el.remove(),320);return;}}
    const p=tk.wp[tk.seg],q=tk.wp[tk.seg+1]||p;tk.el.style.left=lerp(p[0],q[0],tk.t)+'px';tk.el.style.top=lerp(p[1],q[1],tk.t)+'px';
  });
  HY.tokens=HY.tokens.filter(t=>!t.done);
  if(!HY.queue.length&&!HY.tokens.length){HY.active=false;HY.raf=null;return;}
  HY.raf=requestAnimationFrame(hybLoop);
}
function evHybrid(){$('#e-hyb').classList.add('on');hybPlace();hybRound(0);}
function evLLM(){
  const R1=HYB.rounds[0],R2=HYB.rounds[1];if(!R2)return;
  $('#llmChip').classList.add('act');
  $('#reason').innerHTML=`ρ = |error| / σ = <b>${R1.calib.toFixed(2)}</b> &lt; 1 → τ <b>${R1.tau.toFixed(1)} → ${R2.tau.toFixed(1)} W</b><br>“${esc(R2.reasoning)}”`;
  $('#reason').classList.add('show');
  const from=HY.tau,to=R2.tau;tween(1000,k=>{HY.tau=lerp(from,to,k);$('#tauVal').textContent=HY.tau.toFixed(1)+' W';$('#gateMark').style.left=((HY.tau-SIG_LO)/(SIG_HI-SIG_LO)*100)+'%';});
  after(5200,()=>{$('#reason').classList.remove('show');$('#llmChip').classList.remove('act');});
}
function evRound2(){hybRound(1);}
function evDone(){after(1500,()=>$('#evReady').classList.add('show'));}
let rzT;window.addEventListener('resize',()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(player.agent==='evaluation')hybPlace();},150);});
/* ============================================================== CAMPAIGN */
const GA={W:820,H:360,pl:58,pr:18,pt:18,pb:40,x0:0.6,x1:1.8,y0:40,y1:360};
const gx=v=>GA.pl+(v-GA.x0)/(GA.x1-GA.x0)*(GA.W-GA.pl-GA.pr);
const gy=v=>GA.H-GA.pb-(v-GA.y0)/(GA.y1-GA.y0)*(GA.H-GA.pt-GA.pb);
const HVREF=[BASE.iron*C.hv_ref[0],BASE.tq*C.hv_ref[1]];
const inBox=p=>p.iron<=HVREF[0]&&p.tq>=HVREF[1];
let gaK=0;
function okUpTo(k){return C.points.filter(p=>p.ok&&p.it<=k);}
function frontOf(pts){
  const b=pts.filter(inBox).sort((a,c)=>a.iron-c.iron);const f=[];let best=-1;
  b.forEach(p=>{if(p.tq>best){f.push(p);best=p.tq;}});return f;
}
function resetGA(){
  gaK=0;
  const gens=$('#gens');gens.innerHTML='';
  G.forEach((g,i)=>{const d=document.createElement('div');d.className='gp';d.style.setProperty('--c',GENCOL[i]);d.innerHTML=`<b>${t('ga.gen')} ${g.it}</b><em>HV ${g.hv.toFixed(2)}</em><span>ε ${g.succ} · front ${g.front_size}</span>`;gens.appendChild(d);});
  drawPareto(0,false);drawHV(0);$('#gallery').innerHTML='';$('#galInfo').textContent='';$('#armbars').innerHTML='';
  ['kFea','kSucc','kFront','kHV'].forEach(id=>$('#'+id).textContent='—');$('#parStat').textContent='';$('#hvStat').textContent='';
}
function drawPareto(k,pop){
  const s=[];const x0=gx(GA.x0),x1=gx(GA.x1),y0=gy(GA.y0),y1=gy(GA.y1);
  for(const v of [0.8,1.0,1.2,1.4,1.6])s.push(`<line x1="${gx(v)}" y1="${y1}" x2="${gx(v)}" y2="${y0}" stroke="rgba(255,255,255,.05)"/><text x="${gx(v)}" y="${y0+15}" fill="#646a86" font-size="11" text-anchor="middle">${v.toFixed(1)}</text>`);
  for(const v of [100,150,200,250,300,350])s.push(`<line x1="${x0}" y1="${gy(v)}" x2="${x1}" y2="${gy(v)}" stroke="rgba(255,255,255,.05)"/><text x="${x0-7}" y="${gy(v)+4}" fill="#646a86" font-size="11" text-anchor="end">${v}</text>`);
  s.push(`<text x="${(x0+x1)/2}" y="${GA.H-5}" fill="#9aa0b8" font-size="11" text-anchor="middle">iron loss (kW) · lower is better</text>`);
  s.push(`<text x="13" y="${(y0+y1)/2}" fill="#9aa0b8" font-size="11" text-anchor="middle" transform="rotate(-90 13 ${(y0+y1)/2})">mean torque (Nm) · higher is better</text>`);
  // HV reference box
  s.push(`<rect x="${x0}" y="${y1}" width="${gx(HVREF[0])-x0}" height="${gy(HVREF[1])-y1}" fill="rgba(34,211,238,.04)" stroke="rgba(34,211,238,.35)" stroke-dasharray="4 4"/>`);
  s.push(`<text class="halo" x="${x0+8}" y="${y1+16}" fill="rgba(34,211,238,.8)" font-size="10.5">HV reference box · iron ×1.2 / torque ×0.8</text>`);
  const pts=okUpTo(k);
  pts.forEach(p=>{
    const col=GENCOL[p.it-1],last=p.it===k,ib=inBox(p);
    s.push(`<circle class="pp" data-t="${p.t}" cx="${gx(clamp(p.iron,GA.x0,GA.x1))}" cy="${gy(clamp(p.tq,GA.y0,GA.y1))}" r="${last?4.4:3.4}" fill="${ib?col:'none'}" stroke="${col}" stroke-width="${ib?0:1.3}" opacity="${last?.95:.6}">${pop&&last?'<animate attributeName="r" values="0;8;4.4" dur="0.5s"/>':''}</circle>`);
  });
  // Pareto front stair
  const f=frontOf(pts);
  if(f.length){
    let d='';f.forEach((p,i)=>{const X=gx(p.iron),Y=gy(p.tq);if(i===0)d+=`M${X} ${Y}`;else d+=` H${X} V${Y}`;});
    s.push(`<path d="${d}" fill="none" stroke="#fff" stroke-width="1.6" opacity=".85" stroke-linejoin="round"/>`);
    f.forEach(p=>s.push(`<circle cx="${gx(p.iron)}" cy="${gy(p.tq)}" r="5.6" fill="none" stroke="#fff" stroke-width="1.5"/>`));
  }
  // baseline
  const bx=gx(BASE.iron),by=gy(BASE.tq);
  s.push(`<path d="M${bx} ${by-8} L${bx+8} ${by} L${bx} ${by+8} L${bx-8} ${by} Z" fill="#fff" stroke="#070a11" stroke-width="1.4"/>`);
  $('#paretoSvg').innerHTML=s.join('');
}
const HV={W:300,H:150,pl:38,pr:12,pt:14,pb:28,x0:0,x1:300,y0:10,y1:46};
const hx=v=>HV.pl+(v-HV.x0)/(HV.x1-HV.x0)*(HV.W-HV.pl-HV.pr);
const hy=v=>HV.H-HV.pb-(v-HV.y0)/(HV.y1-HV.y0)*(HV.H-HV.pt-HV.pb);
function drawHV(k){
  const s=[];const x0=hx(HV.x0),x1=hx(HV.x1),y0=hy(HV.y0),y1=hy(HV.y1);
  for(const v of [20,30,40])s.push(`<line x1="${x0}" y1="${hy(v)}" x2="${x1}" y2="${hy(v)}" stroke="rgba(255,255,255,.06)"/><text x="${x0-5}" y="${hy(v)+3}" fill="#646a86" font-size="8.5" text-anchor="end">${v}</text>`);
  for(const v of [0,100,200,300])s.push(`<text x="${hx(v)}" y="${y0+12}" fill="#646a86" font-size="8.5" text-anchor="middle">${v}</text>`);
  s.push(`<text x="${(x0+x1)/2}" y="${HV.H-2}" fill="#9aa0b8" font-size="8.5" text-anchor="middle">cumulative FEA solves</text>`);
  s.push(`<line x1="${x0}" y1="${hy(G1.hv_base)}" x2="${x1}" y2="${hy(G1.hv_base)}" stroke="rgba(255,255,255,.3)" stroke-dasharray="3 3"/><text x="${x1}" y="${hy(G1.hv_base)-4}" fill="#9aa0b8" font-size="8.5" text-anchor="end">baseline alone ${G1.hv_base.toFixed(2)}</text>`);
  let cum=0;const pts=[[0,G1.hv_base]];
  for(let i=0;i<k;i++){cum+=C.points.filter(p=>p.ok&&p.it===i+1).length;pts.push([cum,G[i].hv]);}
  const d=pts.map((p,i)=>(i?'L':'M')+hx(p[0]).toFixed(1)+' '+hy(p[1]).toFixed(1)).join(' ');
  s.push(`<path d="${d}" fill="none" stroke="url(#hvg)" stroke-width="2.2" stroke-linejoin="round"/>`);
  s.push(`<defs><linearGradient id="hvg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#10b981"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>`);
  pts.forEach((p,i)=>{if(i===0)return;s.push(`<circle cx="${hx(p[0])}" cy="${hy(p[1])}" r="3.4" fill="${GENCOL[i-1]}" stroke="#070a11" stroke-width="1"/>`);});
  if(k>0){const p=pts[pts.length-1];s.push(`<text x="${hx(p[0])-6}" y="${hy(p[1])-8}" fill="#eef0f7" font-size="10" text-anchor="end" font-weight="700">${p[1].toFixed(2)}</text>`);}
  $('#hvSvg').innerHTML=s.join('');
}
function gaInit(){drawPareto(0,false);$('#parStat').textContent='archive 1 · baseline';}
function gaStep(k){
  gaK=k;const g=G[k-1];
  $$('#gens .gp').forEach((d,i)=>{d.classList.toggle('on',i<k);d.classList.toggle('cur',i===k-1);});
  // animate the new generation's points in
  const prev=okUpTo(k-1).length,now=okUpTo(k).length;
  const newPts=C.points.filter(p=>p.ok&&p.it===k);
  tween(1500,kk=>{const n=Math.ceil(kk*newPts.length);const sub=C.points.filter(p=>p.ok&&(p.it<k||(p.it===k&&newPts.indexOf(p)<n)));drawParetoSub(sub,k);},()=>drawPareto(k,false));
  drawHV(k);
  const pts=okUpTo(k),f=frontOf(pts);
  $('#parStat').textContent=`archive ${pts.length+1} · front ${g.front_size} (${f.length} in box)`;
  $('#hvStat').textContent=`×${(g.hv/g.hv_base).toFixed(2)}`;
  // gallery
  const gal=$('#gallery');gal.innerHTML='';
  f.slice(0,8).forEach((p,i)=>{const d=document.createElement('div');d.className='gi';d.innerHTML=`<img class="thumb" src="${TH(p.t)}" alt=""><b>${p.c}</b><span>${fp(pctOf(p.iron,BASE.iron))} / ${fp(pctOf(p.tq,BASE.tq))}</span>`;gal.appendChild(d);after(80+i*90,()=>d.classList.add('show'));});
  $('#galInfo').textContent=`${f.length} designs`;
  // KPIs
  const att=C.points.filter(p=>p.it<=k).length,succ=G.slice(0,k).reduce((a,x)=>a+x.succ,0);
  $('#kFea').textContent=`${pts.length} / ${att}`;$('#kSucc').textContent=succ;$('#kFront').textContent=`${g.front_size} (${f.length})`;
  animNum($('#kHV'),k>1?G[k-2].hv/g.hv_base:1,g.hv/g.hv_base,900,v=>'×'+v.toFixed(2));
  // arms
  const ab=$('#armbars');ab.innerHTML='';
  Object.entries(g.arms).forEach(([nm,v],i)=>{const r=document.createElement('div');r.className='ab '+(nm==='topology'?'to':nm==='transfer'?'tr':'li');r.innerHTML=`<span>${nm}</span><div class="bar"><i></i></div><span class="v">${v.success} / ${v.n}</span>`;ab.appendChild(r);after(100+i*80,()=>{r.querySelector('i').style.width=(v.n?v.success/v.n*100:0)+'%';});});
}
function drawParetoSub(sub,k){
  // same as drawPareto but with an explicit subset (used while a generation streams in)
  const keep=C.points;C.points=sub;try{drawPareto(k,true);}finally{C.points=keep;}
}
function gaFinal(){
  const svg=$('#paretoSvg');
  // rightmost design takes the top row, so the leader lines never cross
  const picks=['PM_1038','PM_1214','PM_1340'].map(c=>C.points.find(p=>p.c===c)).filter(Boolean).sort((a,b)=>b.iron-a.iron);
  const yBox=gy(HVREF[1]),colX=gx(1.13);
  picks.forEach((p,i)=>{
    const X=gx(p.iron),Y=gy(p.tq),ry=yBox+22+i*22;
    const lbl=`${p.c}   iron ${fp(pctOf(p.iron,BASE.iron))} · torque ${fp(pctOf(p.tq,BASE.tq))}`;
    svg.insertAdjacentHTML('beforeend',`<g class="callout" style="opacity:0;transition:opacity .5s ${i*.15}s">`+
      `<path d="M${X} ${Y+7} V${ry} H${colX}" fill="none" stroke="#f5a524" stroke-width="1.1" opacity=".75"/>`+
      `<circle cx="${X}" cy="${Y}" r="7" fill="none" stroke="#f5a524" stroke-width="1.8"/>`+
      `<circle cx="${colX}" cy="${ry}" r="2.4" fill="#f5a524"/>`+
      `<text class="halo" x="${colX+8}" y="${ry+4}" fill="#ffce86" font-size="11.5" font-weight="800">${lbl}</text></g>`);
  });
  requestAnimationFrame(()=>$$('#paretoSvg .callout').forEach(g=>g.style.opacity=1));
}
/* tooltip for the embedding map */
$('#embSvg').addEventListener('mousemove',e=>{
  const c=e.target.closest('circle.ep');if(!c){tip.classList.remove('show');return;}
  const p=EMB.pts.find(q=>q.t===c.dataset.t);if(!p)return;
  tip.innerHTML=`<img src="${TH(p.t)}" alt=""><b>${p.arm==='to'?'exploration':p.arm==='tr'?'transfer':'library'}</b>${p.kept?' · FPS pick #'+(p.o||'—'):''}${p.forced?' · predicted front':''}`;
  tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY+12)+'px';tip.classList.add('show');
});
$('#embSvg').addEventListener('mouseleave',()=>tip.classList.remove('show'));
/* tooltip for FEA points */
$('#paretoSvg').addEventListener('mousemove',e=>{
  const c=e.target.closest('circle.pp');if(!c){tip.classList.remove('show');return;}
  const p=BY_T[c.dataset.t];if(!p)return;
  tip.innerHTML=`<img src="${TH(p.t)}" alt=""><b>${p.c}</b> · gen ${p.it} · ${p.arm==='to'?'exploration':p.arm==='tr'?'transfer':'library'} ${esc(p.op)}<br>${p.iron.toFixed(3)} kW (${fp(pctOf(p.iron,BASE.iron))}) · ${p.tq.toFixed(0)} Nm (${fp(pctOf(p.tq,BASE.tq))})`;
  tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY+12)+'px';tip.classList.add('show');
});
$('#paretoSvg').addEventListener('mouseleave',()=>tip.classList.remove('show'));

/* ============================================================== SCENES */
const SCENES={
  design:[
    {who:'user',key:'de.s1'},
    {who:'agent',key:'de.s2',after:fillRef},
    {who:'agent',key:'de.s3'},
    {who:'user',key:'de.s4'},
    {who:'agent',key:'de.s5',after:fillSpace},
    {who:'agent',key:'de.s6'},
    {who:'user',key:'de.s7'},
    {who:'agent',key:'de.s8',after:fillObj},
    {who:'agent',key:'de.s9',after:finishDesign},
  ],
  generation:[
    {who:'agent',key:'ge.s2'},
    {who:'agent',key:'ge.s3',after:genExplore},
    {who:'agent',key:'ge.s4',after:genExploit},
    {who:'agent',key:'ge.s5',after:()=>{genPool();after(2600,genGate);},dur:4200},
    {who:'agent',key:'ge.s6',after:()=>{genEmbed();after(2200,genFilter);},dur:5200},
    {who:'agent',key:'ge.s7',after:finishGen},
  ],
  evaluation:[
    {who:'agent',key:'ev.s2',after:evCad,dur:4600},
    {who:'agent',key:'ev.s3',after:evFea,dur:4600},
    {who:'agent',key:'ev.s4',after:evHybrid,dur:5200},
    {who:'agent',key:'ev.s5'},
    {who:'agent',key:'ev.s6',after:evLLM,dur:5200},
    {who:'agent',key:'ev.s7',after:evRound2,dur:6000},
    {who:'agent',key:'ev.s8',after:evDone},
  ],
  campaign:[
    {who:'agent',key:'ga.s2',after:gaInit},
    {who:'agent',key:'ga.s3',after:()=>gaStep(1)},
    {who:'agent',key:'ga.s4',after:()=>gaStep(2)},
    {who:'agent',key:'ga.s5',after:()=>gaStep(3)},
    {who:'agent',key:'ga.s6',after:()=>gaStep(4)},
    {who:'agent',key:'ga.s7',after:()=>gaStep(5)},
    {who:'agent',key:'ga.s8',after:gaFinal},
  ],
};

/* ============================================================== navigation */
function setView(view,agent){
  $$('.view').forEach(v=>v.classList.remove('active'));
  if(view==='overview'){$('#view-overview').classList.add('active');applyTopbar('overview');player.token++;player.agent=null;stopGal();}
  else{$('#view-agent').classList.add('active');applyTopbar(agent);playAgent(agent);}
}
$('#nav').addEventListener('click',e=>{
  const it=e.target.closest('.nav-item');if(!it)return;
  $$('.nav-item').forEach(x=>x.classList.remove('active'));it.classList.add('active');
  setView(it.dataset.view,it.dataset.agent);
});
function gotoAgent(agent){$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.agent===agent));setView('agent',agent);}
$$('[data-go]').forEach(c=>c.addEventListener('click',()=>gotoAgent(c.dataset.go)));
$('#langToggle').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;applyLang(b.dataset.lang);});
window.replayCurrent=replayCurrent;window.togglePause=togglePause;window.gotoAgent=gotoAgent;

/* boot */
buildPool();
applyLang(lang);
})();
