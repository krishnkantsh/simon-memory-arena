(() => {
  const $ = id => document.getElementById(id);
  const authScreen=$('authScreen'), gameScreen=$('gameScreen'), resultScreen=$('resultScreen');
  const pads=[...document.querySelectorAll('.pad')];
  let mode='create', current=null, sequence=[], step=0, score=0, playing=false, accepting=false, roundToken=0, soundOn=true, audioCtx=null;

  async function api(url, data) {
    const opts = data ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)} : {};
    const response = await fetch(url, opts);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result;
  }
  function showScreen(s){[authScreen,gameScreen,resultScreen].forEach(x=>x.classList.remove('active'));s.classList.add('active')}
  function setMode(m){mode=m;$('newTab').classList.toggle('active',m==='create');$('existingTab').classList.toggle('active',m==='login');$('nameField').style.display=m==='create'?'block':'none';$('authSubmit').textContent=m==='create'?'CREATE MY GAME ID':'SIGN IN';$('authError').textContent=''}
  $('newTab').onclick=()=>setMode('create'); $('existingTab').onclick=()=>setMode('login');
  function cleanId(v){return v.trim().toUpperCase()}
  function enterGame(player){current=player;$('currentName').textContent=current.name;$('currentId').textContent='@'+current.id;showScreen(gameScreen);resetGameUI()}
  $('authForm').addEventListener('submit', async e=>{
    e.preventDefault(); const id=cleanId($('playerId').value), name=$('displayName').value.trim(); $('authError').textContent=''; $('authSubmit').disabled=true;
    try {
      const result = mode==='create' ? await api('/api/register',{id,name}) : await api('/api/login',{id});
      enterGame(result.player);
    } catch(err) { $('authError').textContent=err.message; }
    finally { $('authSubmit').disabled=false; }
  });
  async function switchUser(){roundToken++;playing=false;accepting=false;current=null;$('playerId').value='';$('displayName').value='';setMode('login');showScreen(authScreen)}
  $('switchUser').onclick=$('resultSwitch').onclick=switchUser;
  const tones=[261.63,329.63,392,523.25];
  function tone(i,d=.22){if(!soundOn)return;try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=tones[i];g.gain.setValueAtTime(.0001,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.16,audioCtx.currentTime+.015);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d+.03)}catch{}}
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function flash(i,ms=380){pads[i].classList.add('lit');tone(i,ms/1000);await sleep(ms);pads[i].classList.remove('lit');await sleep(120)}
  function updateStats(){ $('score').textContent=score;$('level').textContent=Math.max(1,sequence.length);$('best').textContent=current?current.best:0}
  function resetGameUI(){sequence=[];step=0;score=0;playing=false;accepting=false;updateStats();$('status').textContent='Press START GAME to begin';$('start').disabled=false;$('start').textContent='▶  START GAME';pads.forEach(p=>p.classList.remove('lit'))}
  async function begin(){roundToken++;const token=roundToken;sequence=[];step=0;score=0;playing=true;accepting=false;updateStats();$('start').disabled=true;$('start').textContent='▶  GAME IN PROGRESS';$('status').textContent='Get ready…';await sleep(500);if(token===roundToken)nextRound(token)}
  async function nextRound(token){if(token!==roundToken)return;sequence.push(Math.floor(Math.random()*4));score=sequence.length-1;updateStats();accepting=false;$('status').textContent='Watch the sequence carefully…';await sleep(420);for(const i of sequence){if(token!==roundToken)return;await flash(i,400)}if(token!==roundToken)return;step=0;accepting=true;$('status').textContent='Your turn! Repeat the sequence'}
  async function saveScore(value){const result=await api('/api/score',{score:value});current=result.player;updateStats();return result.leaderboard}
  async function choose(i){if(!accepting||!playing)return;accepting=false;await flash(i,210);if(sequence[step]!==i){finish();return}step++;if(step===sequence.length){score=sequence.length;try{await saveScore(score)}catch(err){$('status').textContent='Score could not be saved: '+err.message;playing=false;finish(true);return}updateStats();$('status').textContent='Perfect! Get ready for the next level…';const token=roundToken;await sleep(620);if(token===roundToken)nextRound(token)}else{accepting=true;$('status').textContent=`Correct! ${sequence.length-step} more ${sequence.length-step===1?'step':'steps'} to go`}}
  async function renderTop(){const target=$('topThree');target.innerHTML='';try{const data=await api('/api/leaderboard');const users=data.players;const icons=['🥇','🥈','🥉'];if(!users.length){target.innerHTML='<div class="empty">No scores yet. Be the first to set a high score!</div>';return}users.forEach((u,i)=>{const row=document.createElement('div');row.className='rankrow';const medal=document.createElement('div');medal.className='medal';medal.textContent=icons[i];const player=document.createElement('div');const nm=document.createElement('div');nm.className='player-name';nm.textContent=u.name;const id=document.createElement('div');id.className='player-id';id.textContent='@'+u.id;player.append(nm,id);const points=document.createElement('div');points.className='points';points.textContent=u.best+' pts';row.append(medal,player,points);target.append(row)})}catch(err){target.textContent='Could not load leaderboard: '+err.message}}
  async function finish(save=true){playing=false;accepting=false;roundToken++;if(save){try{await saveScore(score)}catch(err){$('status').textContent='Score save failed: '+err.message}}$('resultName').textContent=current.name;$('finalScore').textContent=score;$('resultMessage').textContent=score>=10?'Incredible memory!':score>=5?'Great focus — keep going!':'Good try! Play again to beat your score.';await renderTop();$('start').disabled=false;$('start').textContent='↻  PLAY AGAIN';showScreen(resultScreen)}
  pads.forEach((p,i)=>p.addEventListener('click',()=>choose(i)));$('start').onclick=begin;$('playAgain').onclick=()=>{showScreen(gameScreen);begin()};$('backGame').onclick=()=>showScreen(gameScreen);
  api('/api/me').then(r=>{if(r.player)enterGame(r.player)}).catch(()=>{});
})();