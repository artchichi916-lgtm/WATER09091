
(() => {
'use strict';
const BANK = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
const TEST_SIZE = 40;
const CATEGORY_TARGET = 5;
const STORAGE_KEY = 'bioTreatmentQuiz_v1';
const SESSION_KEY = 'bioTreatmentQuiz_current_v1';
const letters = ['A','B','C','D'];
const advice = {
  '微生物與生物處理基礎':'加強微生物營養型態、生長曲線、代謝、好氧／厭氧基本原理，以及環境因子對微生物的影響。',
  '活性污泥與操作控制':'加強 F/M、MLSS／MLVSS、SVI、SRT、迴流污泥、曝氣與溶氧，以及二沉池與操作異常判讀。',
  'SBR／氧化渠與改良活性污泥法':'加強 SBR 各操作階段、氧化渠／氧化深渠，以及延長曝氣、階梯曝氣、接觸穩定等改良程序的特性比較。',
  '附著生長與生物膜':'加強接觸曝氣、生物膜與附著生長、濾床／流體化床、接觸材料與反沖洗等程序特性。',
  'MBR 薄膜生物反應器':'加強 MBR 與傳統活性污泥法差異、膜配置、通量、積垢、能耗與操作特性。',
  '厭氧生物處理':'加強厭氧分解階段、甲烷菌、SRT／HRT、UASB／厭氧濾床／流體化床、負荷與環境條件。',
  '脫氮除磷與營養鹽':'加強硝化／脫硝的環境條件與菌種、生物除磷機制，以及氮磷轉化與操作條件。',
  '污泥處理與處置':'加強污泥濃縮、消化、調理、脫水與乾燥的目的、順序、操作指標與基本計算。'
};

function baseState(){ return {mastered:[], wrong:[], attempts:{}, history:[]}; }
function loadState(){
  try{ const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); return x && Array.isArray(x.mastered) && Array.isArray(x.wrong) ? {...baseState(),...x} : baseState(); }
  catch(e){ return baseState(); }
}
let state = loadState();
let current = null;

const $ = id => document.getElementById(id);
const uniq = arr => [...new Set(arr.map(Number))];
const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const byId = new Map(BANK.map(q=>[q.id,q]));
const categories = [...new Set(BANK.map(q=>q.category))];
function saveState(){ state.mastered=uniq(state.mastered); state.wrong=uniq(state.wrong).filter(id=>!state.mastered.includes(id)); localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); updateDashboard(); }
function saveSession(){ if(current) localStorage.setItem(SESSION_KEY,JSON.stringify(current)); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }
function loadSession(){ try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch(e){return null} }

function updateDashboard(){
  const mastered=state.mastered.length, wrong=state.wrong.length, remaining=BANK.length-mastered, pct=BANK.length?Math.round(mastered/BANK.length*100):0;
  $('statTotal').textContent=BANK.length; $('statMastered').textContent=mastered; $('statWrong').textContent=wrong; $('statRemaining').textContent=remaining;
  $('masteryText').textContent=pct+'%'; $('masteryBar').style.width=pct+'%';
  $('startBtn').textContent = remaining===0 ? '全部題目已掌握' : `開始 ${Math.min(TEST_SIZE,remaining)} 題測驗`;
  $('startBtn').disabled = remaining===0;
}
function show(view){ ['dashboard','quizView','resultView'].forEach(id=>$(id).classList.toggle('hidden',id!==view)); window.scrollTo({top:0,behavior:'smooth'}); }

function pickBalancedTest(){
  const mastered=new Set(state.mastered), wrongSet=new Set(state.wrong);
  const eligible=BANK.filter(q=>!mastered.has(q.id));
  if(!eligible.length) return [];
  const selected=[]; const selectedIds=new Set();
  // First pass: each category gets up to 5, with current wrong questions intentionally prioritized.
  for(const cat of categories){
    const pool=eligible.filter(q=>q.category===cat);
    const wrong=shuffle(pool.filter(q=>wrongSet.has(q.id)));
    const fresh=shuffle(pool.filter(q=>!wrongSet.has(q.id)));
    const want=Math.min(CATEGORY_TARGET,pool.length);
    const wrongQuota=Math.min(Math.ceil(want*0.4),wrong.length);
    [...wrong.slice(0,wrongQuota),...fresh.slice(0,want-wrongQuota),...wrong.slice(wrongQuota)].slice(0,want).forEach(q=>{if(!selectedIds.has(q.id)){selected.push(q);selectedIds.add(q.id)}});
  }
  // Fill shortage to 40 from all non-mastered questions, weighting wrong questions first.
  if(selected.length<Math.min(TEST_SIZE,eligible.length)){
    const rest=eligible.filter(q=>!selectedIds.has(q.id));
    const wrongRest=shuffle(rest.filter(q=>wrongSet.has(q.id)));
    const freshRest=shuffle(rest.filter(q=>!wrongSet.has(q.id)));
    for(const q of [...wrongRest,...freshRest]){ if(selected.length>=Math.min(TEST_SIZE,eligible.length)) break; selected.push(q); selectedIds.add(q.id); }
  }
  // If first pass exceeds 40 due future category changes, trim while preserving variety.
  return shuffle(selected).slice(0,Math.min(TEST_SIZE,eligible.length));
}

function startNewTest(){
  const qs=pickBalancedTest();
  if(!qs.length){ current=null; clearSession(); updateDashboard(); show('dashboard'); alert('恭喜！目前 430 題都已答對並列入已掌握。若要重新練習，可使用「重設進度」。'); return; }
  current={questionIds:qs.map(q=>q.id),answers:{},submitted:false,createdAt:new Date().toISOString()};
  saveSession(); renderQuiz(); show('quizView');
}
function resumeSessionIfAny(){
  const s=loadSession();
  if(s && !s.submitted && Array.isArray(s.questionIds) && s.questionIds.length && s.questionIds.every(id=>byId.has(id))){
    current=s; renderQuiz(); show('quizView'); return true;
  }
  return false;
}

function renderQuiz(){
  const qs=current.questionIds.map(id=>byId.get(id)).filter(Boolean);
  $('quizCount').textContent=`（${qs.length} 題）`;
  const nav=$('navigator'); nav.innerHTML='';
  const box=$('questionsContainer'); box.innerHTML='';
  qs.forEach((q,idx)=>{
    const n=document.createElement('button'); n.type='button'; n.className='nav-q'+(current.answers[q.id]?' answered':''); n.textContent=idx+1; n.addEventListener('click',()=>document.getElementById('q-'+q.id).scrollIntoView({behavior:'smooth',block:'start'})); nav.appendChild(n);
    const card=document.createElement('article'); card.className='question-card'; card.id='q-'+q.id;
    const meta=document.createElement('div'); meta.className='q-meta'; meta.innerHTML=`<span>第 ${idx+1} 題／原題號 ${q.id}</span><span class="category-pill"></span>`; meta.querySelector('.category-pill').textContent=q.category; card.appendChild(meta);
    const h=document.createElement('h3'); h.textContent=q.question; card.appendChild(h);
    const list=document.createElement('div'); list.className='option-list';
    q.options.forEach((opt,oi)=>{
      const label=document.createElement('label'); label.className='option';
      const input=document.createElement('input'); input.type='radio'; input.name='q'+q.id; input.value=oi+1; input.checked=Number(current.answers[q.id])===oi+1;
      input.addEventListener('change',()=>{current.answers[q.id]=oi+1; saveSession(); updateAnsweredUI();});
      const badge=document.createElement('span'); badge.className='letter'; badge.textContent=letters[oi]; const txt=document.createElement('span'); txt.textContent=opt;
      label.append(input,badge,txt); list.appendChild(label);
    });
    card.appendChild(list); box.appendChild(card);
  });
  updateAnsweredUI();
}
function updateAnsweredUI(){
  const total=current.questionIds.length; const count=current.questionIds.filter(id=>current.answers[id]).length; $('answeredCount').textContent=`已答 ${count} / ${total}`;
  [...$('navigator').children].forEach((el,i)=>el.classList.toggle('answered',!!current.answers[current.questionIds[i]]));
}

function submitTest(){
  if(!current || current.submitted) return;
  const blanks=current.questionIds.filter(id=>!current.answers[id]).length;
  if(blanks && !confirm(`還有 ${blanks} 題未作答。確定要交卷嗎？未作答題不會列為已掌握，之後仍可能再次出題。`)) return;
  const results=[]; let correct=0, wrong=0, blank=0;
  const mastered=new Set(state.mastered), wrongSet=new Set(state.wrong);
  current.questionIds.forEach(id=>{
    const q=byId.get(id), user=Number(current.answers[id]||0); const status=!user?'blank':(user===q.answer?'correct':'wrong');
    if(status==='correct'){correct++; mastered.add(id); wrongSet.delete(id);} else if(status==='wrong'){wrong++; wrongSet.add(id); mastered.delete(id);} else blank++;
    state.attempts[id]=(state.attempts[id]||0)+1; results.push({id,user,status});
  });
  state.mastered=[...mastered]; state.wrong=[...wrongSet];
  const total=current.questionIds.length; const score=Math.round(correct/total*100);
  state.history.push({date:new Date().toISOString(),score,correct,wrong,blank,total}); if(state.history.length>100) state.history=state.history.slice(-100);
  current.submitted=true; current.results=results; current.score=score; clearSession(); saveState(); renderResults(); show('resultView');
}

function renderResults(){
  const rs=current.results, total=rs.length, correct=rs.filter(r=>r.status==='correct').length, wrong=rs.filter(r=>r.status==='wrong').length, blank=rs.filter(r=>r.status==='blank').length;
  $('scorePct').textContent=Math.round(correct/total*100); $('correctCount').textContent=correct; $('wrongCount').textContent=wrong; $('blankCount').textContent=blank;
  $('analysisSummary').textContent=`本回 ${total} 題，答對 ${correct} 題、答錯 ${wrong} 題、未作答 ${blank} 題。答對題目已移入「已掌握」且後續不再出題；答錯題目已加入錯題池，之後會優先安排複習。`;
  const stats={}; categories.forEach(c=>stats[c]={total:0,correct:0,wrong:0,blank:0});
  rs.forEach(r=>{const c=byId.get(r.id).category; stats[c].total++; stats[c][r.status]++;});
  const ca=$('categoryAnalysis'); ca.innerHTML='';
  Object.entries(stats).filter(([,s])=>s.total).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total)).forEach(([cat,s])=>{
    const pct=Math.round(s.correct/s.total*100); const row=document.createElement('div'); row.className='cat-row';
    const name=document.createElement('div'); name.textContent=`${cat}（${s.correct}/${s.total}）`; const bar=document.createElement('div'); bar.className='cat-bar'; const fill=document.createElement('span'); fill.style.width=pct+'%'; bar.appendChild(fill); const score=document.createElement('div'); score.className='cat-score'; score.textContent=pct+'%'; row.append(name,bar,score); ca.appendChild(row);
  });
  const ranked=Object.entries(stats).filter(([,s])=>s.total).map(([cat,s])=>({cat,...s,pct:s.correct/s.total})).sort((a,b)=>a.pct-b.pct || b.wrong-a.wrong);
  const weak=ranked.filter(x=>x.pct<0.75 || x.wrong>=2).slice(0,3); const wb=$('weaknessBox'); wb.innerHTML='';
  if(!weak.length){wb.classList.add('good'); wb.innerHTML='<h3>本回整體表現穩定</h3><p>各主題正確率均達到良好水準。下一回合可持續完成尚未掌握題目，並確認錯題是否已修正。</p>'}
  else{wb.classList.remove('good'); const h=document.createElement('h3'); h.textContent='建議優先加強'; wb.appendChild(h); const ul=document.createElement('ul'); weak.forEach(x=>{const li=document.createElement('li'); li.innerHTML=`<strong>${x.cat}</strong>：本回正確率 ${Math.round(x.pct*100)}%。`; li.append(document.createTextNode(' '+(advice[x.cat]||'建議回顧本主題錯題與相關概念。'))); ul.appendChild(li)}); wb.appendChild(ul)}
  const review=$('reviewContainer'); review.innerHTML='';
  rs.forEach((r,idx)=>{const q=byId.get(r.id), card=document.createElement('article'); card.className='review-card '+r.status;
    const meta=document.createElement('div'); meta.className='q-meta'; const st=document.createElement('span'); st.className='review-status'; st.textContent=r.status==='correct'?'✓ 答對':r.status==='wrong'?'✕ 答錯':'— 未作答'; const cp=document.createElement('span'); cp.className='category-pill'; cp.textContent=q.category; meta.append(st,cp); card.appendChild(meta);
    const h=document.createElement('h3'); h.textContent=`第 ${idx+1} 題（原題號 ${q.id}） ${q.question}`; card.appendChild(h);
    q.options.forEach((opt,oi)=>{const row=document.createElement('div'); row.className='option-review'; if(oi+1===q.answer)row.classList.add('correct-answer'); if(r.status==='wrong'&&oi+1===r.user)row.classList.add('user-wrong'); row.textContent=`(${oi+1}) ${opt}`; card.appendChild(row)});
    const lines=document.createElement('div'); lines.className='answer-lines'; const your=r.user?`(${r.user}) ${q.options[r.user-1]}`:'未作答'; const correctText=`(${q.answer}) ${q.options[q.answer-1]}`; lines.innerHTML='<div><strong>你的答案：</strong></div><div><strong>正確答案：</strong></div>'; lines.children[0].append(document.createTextNode(your)); lines.children[1].append(document.createTextNode(correctText)); card.appendChild(lines); review.appendChild(card);
  });
}

function resetProgress(){ if(!confirm('確定要清除所有已掌握、錯題與歷次成績紀錄嗎？此動作無法復原。'))return; state=baseState(); localStorage.removeItem(STORAGE_KEY); clearSession(); current=null; updateDashboard(); show('dashboard'); }
function exportProgress(){ const blob=new Blob([JSON.stringify({app:'bioTreatmentQuiz',version:1,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='生物處理測驗_學習紀錄.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function importProgress(file){ if(!file)return; const reader=new FileReader(); reader.onload=()=>{try{const x=JSON.parse(reader.result); const s=x.state||x; if(!Array.isArray(s.mastered)||!Array.isArray(s.wrong))throw new Error(); state={...baseState(),...s}; saveState(); alert('學習紀錄已匯入。');}catch(e){alert('匯入失敗：檔案格式不正確。')}}; reader.readAsText(file,'utf-8'); }

$('startBtn').addEventListener('click',()=>{ if(!resumeSessionIfAny()) startNewTest(); });
$('submitBtn').addEventListener('click',submitTest); $('submitTopBtn').addEventListener('click',submitTest);
$('nextRoundBtn').addEventListener('click',startNewTest); $('nextRoundBottomBtn').addEventListener('click',startNewTest);
$('homeBtn').addEventListener('click',()=>{current=null;show('dashboard')}); $('resetBtn').addEventListener('click',resetProgress);
$('exportBtn').addEventListener('click',exportProgress); $('importInput').addEventListener('change',e=>{importProgress(e.target.files[0]);e.target.value=''});
updateDashboard();
if(!BANK.length){ alert('題庫載入失敗，請確認 questions.js 與 index.html 位於同一資料夾。'); }
})();
