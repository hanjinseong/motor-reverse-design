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
  ['design','generation','evaluation','campaign'].forEach(a=>{$('#viz-'+a).style.display=a===agent?'block':'none';});
  $('#vizBody').scrollTop=0;
  if(agent==='design')resetDesign();
  if(agent==='generation')resetGen();
  if(agent==='evaluation')resetEval();
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
function buildGallery(id,list){
  const box=$('#'+id);box.innerHTML='';
  list.forEach(x=>{const im=document.createElement('img');im.src=TH(x.t);im.alt='';im.title=`gen ${x.it}${x.op?' · '+x.op:''}`;box.appendChild(im);});
}
function revealGallery(id){$$('#'+id+' img').forEach((im,i)=>after(60+i*55,()=>im.classList.add('in')));}
function buildPool(){
  const pool=$('#pool');pool.innerHTML='';
  C.grid.forEach(g=>{
    const d=document.createElement('div');d.className='tile '+(g.arm==='to'?'ex':g.arm==='tr'?'xp tr':'xp');
    d.innerHTML=`<img src="${TH(g.t)}" alt="">`;d.title=(g.arm==='to'?'exploration · ':g.arm==='tr'?'transfer · ':'library · ')+(g.op||'');
    pool.appendChild(d);
  });
}
function resetGen(){
  ['g-explore','g-exploit','g-pool'].forEach(id=>$('#'+id).classList.remove('on'));
  buildGallery('exGrid',GAL.explore);buildGallery('xpGrid',GAL.exploit);
  buildPool();
  ['psGen','psGate','psEmb','psKept'].forEach(id=>$('#'+id).textContent='0');$('#poolInfo').textContent='0 / 200';
  $('#genReady').classList.remove('show');
}
function genExplore(){$('#g-explore').classList.add('on');revealGallery('exGrid');}
function fmtDirection(txt){
  return esc(txt).replace(/^\[([A-Z_]+)\]/,'<span class="tk">[$1]</span>').replace(/\n(WHERE|EDIT|ALSO|KEEP):/g,'\n<span class="kw">$1:</span>');
}
function typeInto(el,html,ms){
  const tmp=document.createElement('div');tmp.innerHTML=html;const full=tmp.textContent;
  tween(ms,k=>{if(k<1)el.textContent=full.slice(0,Math.floor(full.length*k));else el.innerHTML=html;});
}
function genExploit(){$('#g-exploit').classList.add('on');revealGallery('xpGrid');}
function genPool(){
  $('#g-pool').classList.add('on');
  const tiles=$$('#pool .tile');
  tiles.forEach((d,i)=>after(60+i*55,()=>d.classList.add('in')));
  animNum($('#psGen'),0,G2.generated+G2.gate_dropped,60+tiles.length*55);
  after(60+tiles.length*55,()=>{$('#poolInfo').textContent=`${G2.generated+G2.gate_dropped} / 200`;});
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
}
function genFilter(){
  const tiles=$$('#pool .tile');
  after(300,()=>{C.grid.forEach((g,i)=>{if(g.gated)return;if(g.kept){after(i*45,()=>{tiles[i].classList.remove('emb');tiles[i].classList.add('kept');if(g.forced)tiles[i].classList.add('forced');});}else after(i*45,()=>{tiles[i].classList.remove('emb');tiles[i].classList.add('dim');});});});
  after(600,()=>animNum($('#psKept'),0,G2.kept,1200));
  after(1900,()=>{$('#poolInfo').textContent=`${G2.kept} / ${G2.generated}`;});
}
function finishGen(){$('#genReady').classList.add('show');}

/* ============================================================== EVALUATION (generation 1 of the campaign) */
const P1=C.points.filter(p=>p.it===1);
function resetEval(){
  ['e-chain','e-eps','e-sur','e-dir','e-score','e-report'].forEach(id=>$('#'+id).classList.remove('on'));
  $$('#e-chain .cn,#e-chain .carr').forEach(n=>n.classList.remove('on'));
  $('#feaFill').style.width='0';$('#feaInfo').textContent='0 / 60';
  drawEps(0);$('#epsInfo').textContent='';
  $('#surLabels').textContent='200';$('#surRho').textContent='— / —';$('#rhoBar').style.width='0';
  $('#dirOut').innerHTML='';$('#dirInfo').textContent='';
  $('#scores').innerHTML='';
  ['rpFront','rpHV','rpSucc','rpBest'].forEach(id=>$('#'+id).textContent='—');
  $('#evReady').classList.remove('show');
}
function evChain(){
  $('#e-chain').classList.add('on');
  const nodes=$$('#e-chain .cn'),arrs=$$('#e-chain .carr');
  nodes.forEach((n,i)=>{after(150+i*520,()=>{n.classList.add('on');if(arrs[i-1])arrs[i-1].classList.add('on');});});
}
function evFEA(){
  const okN=P1.filter(p=>p.ok).length,fail=P1.length-okN;
  tween(3200,k=>{const n=Math.floor(k*P1.length);$('#feaFill').style.width=(k*100)+'%';const f=Math.round(k*fail);$('#feaInfo').textContent=`${Math.min(n,okN)+Math.min(n,fail)-Math.min(n,fail)+0} / 60 · ${f} failed`;},
    ()=>{$('#feaInfo').textContent=`${okN} / 60 solved · ${fail} mesh failed`;});
}
function evSurrogate(){
  $('#e-sur').classList.add('on');
  const ok=P1.filter(p=>p.ok).length;
  animNum($('#surLabels'),200,200+ok,1200);
  after(600,()=>{$('#surRho').textContent=`${G1.rho.iron.toFixed(2)} / ${G1.rho.tq.toFixed(2)}`;$('#rhoBar').style.width=(G1.rho.iron*100)+'%';});
}
const EPS={W:420,H:300,pl:46,pr:14,pt:14,pb:34,x0:-30,x1:25,y0:-30,y1:20};
const ex=v=>EPS.pl+(v-EPS.x0)/(EPS.x1-EPS.x0)*(EPS.W-EPS.pl-EPS.pr);
const ey=v=>EPS.H-EPS.pb-(v-EPS.y0)/(EPS.y1-EPS.y0)*(EPS.H-EPS.pt-EPS.pb);
function drawEps(n){
  const s=[];const x0=ex(EPS.x0),x1=ex(EPS.x1),y0=ey(EPS.y0),y1=ey(EPS.y1);
  // epsilon regions: iron better by >=5% with torque not worse than 1%  |  torque better by >=1% with iron not worse than 5%
  s.push(`<rect x="${x0}" y="${y1}" width="${ex(-5)-x0}" height="${ey(-1)-y1}" fill="rgba(52,211,153,.07)"/>`);
  s.push(`<rect x="${x0}" y="${y1}" width="${ex(5)-x0}" height="${ey(1)-y1}" fill="rgba(52,211,153,.07)"/>`);
  for(const gx of [-20,-10,0,10,20])s.push(`<line x1="${ex(gx)}" y1="${y1}" x2="${ex(gx)}" y2="${y0}" stroke="rgba(255,255,255,${gx===0?.18:.05})"/><text x="${ex(gx)}" y="${y0+14}" fill="#646a86" font-size="9" text-anchor="middle">${gx>0?'+':''}${gx}%</text>`);
  for(const gy of [-20,-10,0,10])s.push(`<line x1="${x0}" y1="${ey(gy)}" x2="${x1}" y2="${ey(gy)}" stroke="rgba(255,255,255,${gy===0?.18:.05})"/><text x="${x0-5}" y="${ey(gy)+3}" fill="#646a86" font-size="9" text-anchor="end">${gy>0?'+':''}${gy}%</text>`);
  s.push(`<text x="${(x0+x1)/2}" y="${EPS.H-3}" fill="#9aa0b8" font-size="9.5" text-anchor="middle">Δ iron loss vs parent (← better)</text>`);
  s.push(`<text x="11" y="${(y0+y1)/2}" fill="#9aa0b8" font-size="9.5" text-anchor="middle" transform="rotate(-90 11 ${(y0+y1)/2})">Δ torque vs parent (↑ better)</text>`);
  s.push(`<line x1="${ex(-5)}" y1="${y1}" x2="${ex(-5)}" y2="${y0}" stroke="rgba(52,211,153,.5)" stroke-dasharray="3 3"/><line x1="${x0}" y1="${ey(1)}" x2="${x1}" y2="${ey(1)}" stroke="rgba(52,211,153,.5)" stroke-dasharray="3 3"/>`);
  const pts=P1.filter(p=>p.ok&&p.pv);
  pts.slice(0,n).forEach((p,i)=>{
    const dx=clamp(pctOf(p.iron,p.pv[0]),EPS.x0,EPS.x1),dy=clamp(pctOf(p.tq,p.pv[1]),EPS.y0,EPS.y1);
    const col=p.s?'#34d399':'#646a86';
    s.push(`<circle cx="${ex(dx)}" cy="${ey(dy)}" r="${p.s?4.2:3}" fill="${col}" opacity="${p.s?.95:.55}" ${p.s?'stroke="#fff" stroke-width="1"':''}><title>${p.c} · ${p.arm==='to'?'exploration':p.arm==='tr'?'transfer':'library'} ${p.op} · iron ${fp(dx)} · torque ${fp(dy)}</title>${i===n-1?'<animate attributeName="r" values="0;7;'+(p.s?4.2:3)+'" dur="0.45s"/>':''}</circle>`);
  });
  $('#epsSvg').innerHTML=s.join('');
}
function evEps(){
  $('#e-eps').classList.add('on');
  const pts=P1.filter(p=>p.ok&&p.pv);const succ=pts.filter(p=>p.s).length;
  tween(2600,k=>{const n=Math.ceil(k*pts.length);drawEps(n);$('#epsInfo').textContent=`${pts.slice(0,n).filter(p=>p.s).length} success / ${n}`;},()=>{$('#epsInfo').textContent=`${succ} success / ${pts.length}`;});
}
function evDirections(){
  $('#e-dir').classList.add('on');
  typeInto($('#dirOut'),fmtDirection(C.prompts.transfer||''),2400);
  after(400,()=>animNum($('#dirInfo'),0,G1.directions||19,1600,v=>Math.round(v)+' written'));
}
const SCORE1=[['library','li',13,31],['topology','to',7,29],['MOVE_INWARD','li',10,20],['SHIFT_RIGHT','li',8,16],['WIDEN_GAP','li',3,8],['MOVE_OUTWARD','li',4,14],['NARROW_GAP','li',2,12],['O05','to',1,5]];
function evScore(){
  $('#e-score').classList.add('on');const box=$('#scores');box.innerHTML='';
  SCORE1.forEach(([nm,arm,s,n],i)=>{
    const r=document.createElement('div');r.className='sc '+arm;
    r.innerHTML=`<span class="nm">${nm}</span><div class="bar"><i></i></div><span class="v">${s} / ${n}</span>`;box.appendChild(r);
    after(100+i*90,()=>{r.querySelector('i').style.width=(s/n*100)+'%';});
  });
}
function evReport(){
  $('#e-report').classList.add('on');
  $('#rpFront').textContent=G1.front_size;$('#rpSucc').textContent=G1.succ;
  animNum($('#rpHV'),G1.hv_base,G1.hv,1200,v=>v.toFixed(2));
  $('#rpBest').textContent=`${G1.best.c} ${fp(pctOf(G1.best.iron,BASE.iron))}`;
  after(600,()=>$('#evReady').classList.add('show'));
}

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
  $('#hvStat').textContent=`HV ${g.hv.toFixed(2)} · ×${(g.hv/g.hv_base).toFixed(2)}`;
  // gallery
  const gal=$('#gallery');gal.innerHTML='';
  f.slice(0,8).forEach((p,i)=>{const d=document.createElement('div');d.className='gi';d.innerHTML=`<img class="thumb" src="${TH(p.t)}" alt=""><b>${p.c}</b><span>${fp(pctOf(p.iron,BASE.iron))} / ${fp(pctOf(p.tq,BASE.tq))}</span>`;gal.appendChild(d);after(80+i*90,()=>d.classList.add('show'));});
  $('#galInfo').textContent=`${f.length} designs · iron ↓`;
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
/* tooltip for FEA points */
const tip=$('#tip');
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
    {who:'agent',key:'ev.s2',after:evChain},
    {who:'agent',key:'ev.s3',after:evFEA,dur:4200},
    {who:'agent',key:'ev.s4',after:evSurrogate},
    {who:'agent',key:'ev.s5',after:evEps,dur:4200},
    {who:'agent',key:'ev.s6',after:evDirections},
    {who:'agent',key:'ev.s7',after:evScore},
    {who:'agent',key:'ev.s8',after:evReport},
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
  if(view==='overview'){$('#view-overview').classList.add('active');applyTopbar('overview');player.token++;player.agent=null;}
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
