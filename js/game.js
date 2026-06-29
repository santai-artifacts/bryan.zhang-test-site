/* ===========================================================
   Game flow — input handling, dice/turns, CPU opponent, win
   detection, and boot. Depends on engine.js and render.js.
   =========================================================== */

/* ---------------------------  INTERACTION  --------------------------- */

function applyHighlights(){
  if(gameOver || current!==WHITE || !rolledThisTurn) return;
  const moves = legalMoves(WHITE);
  // mark sources playable
  const srcSet = new Set(moves.map(m=>m.from));
  srcSet.forEach(src=>{
    if(src==='bar') document.getElementById('bar-white').classList.add('playable');
    else { const el=document.querySelector(`.point[data-point="${src}"]`); if(el) el.classList.add('playable'); }
  });

  if(selected!==null){
    // highlight selected source
    if(selected==='bar') document.getElementById('bar-white').classList.add('src-hl');
    else { const el=document.querySelector(`.point[data-point="${selected}"]`); if(el) el.classList.add('src-hl'); }
    // highlight targets
    moves.filter(m=>m.from===selected).forEach(m=>{
      if(m.to==='off') document.getElementById('off-white').classList.add('target');
      else { const el=document.querySelector(`.point[data-point="${m.to}"]`); if(el) el.classList.add('target'); }
    });
  }
}

function onPointClick(pn){
  if(gameOver || current!==WHITE || !rolledThisTurn) return;
  if(bar[WHITE]>0){ // must enter from bar
    if(selected==='bar'){ tryMoveTo(pn); }
    return;
  }
  if(selected===null){
    if(owns(pn,WHITE) && legalMoves(WHITE).some(m=>m.from===pn)){
      selected=pn; render();
    }
    return;
  }
  // selected is set
  if(selected===pn){ selected=null; render(); return; }   // deselect
  // try to move to pn
  if(!tryMoveTo(pn)){
    // maybe reselect another source
    if(owns(pn,WHITE) && legalMoves(WHITE).some(m=>m.from===pn)){
      selected=pn; render();
    }
  }
}

function onBarClick(player){
  if(player!==WHITE || gameOver || current!==WHITE || !rolledThisTurn) return;
  if(bar[WHITE]>0 && legalMoves(WHITE).some(m=>m.from==='bar')){
    selected = (selected==='bar') ? null : 'bar';
    render();
  }
}

function onOffClick(player){
  if(player!==WHITE) return;
  if(selected!==null) tryMoveTo('off');
}

function tryMoveTo(dest){
  const moves = legalMoves(WHITE).filter(m=>m.from===selected && m.to===dest);
  if(!moves.length) return false;
  // choose the die: prefer the smaller die that works (keeps options open)
  moves.sort((a,b)=>a.die-b.die);
  const mv = moves[0];
  const snap = applyMove(WHITE, mv);
  if(snap.hit) flashHit();
  selected=null;
  afterHumanMove();
  return true;
}

function afterHumanMove(){
  if(checkWin()) return;
  selected=null;
  const remaining = legalMoves(WHITE);
  const anyDieLeft = dice.some(d=>!d.used);
  // Turn no longer auto-ends — the player confirms with the Done button.
  if(!anyDieLeft || remaining.length===0){
    setStatus(remaining.length===0 && anyDieLeft
      ? 'No more legal moves — click Done to end your turn'
      : 'All dice played — click Done to end your turn');
  } else {
    setStatus('Your move — '+dice.filter(d=>!d.used).length+' die left');
  }
  updateButtons();
  render();
}

function endHumanTurn(){
  if(gameOver) return;
  current = BLACK;
  rolledThisTurn=false; selected=null; history=[];
  updateButtons(); render();
  setStatus('Black (CPU) is thinking…');
  setTimeout(cpuTurn, 700);
}

/* ---------------------------  DICE / TURNS  --------------------------- */

function rollDice(){
  const a=1+Math.floor(Math.random()*6);
  const b=1+Math.floor(Math.random()*6);
  if(a===b){
    dice=[{value:a,used:false},{value:a,used:false},{value:a,used:false},{value:a,used:false}];
  } else {
    dice=[{value:a,used:false},{value:b,used:false}];
  }
}

function onRoll(){
  if(gameOver || current!==WHITE || rolledThisTurn) return;
  rollDice();
  rolledThisTurn=true;
  history=[]; selected=null;
  animateDice();
  updateButtons();
  render();
  const moves=legalMoves(WHITE);
  if(moves.length===0){
    setStatus('No legal moves with '+dice.map(d=>d.value).join(' & ')+' — turn passes');
    setTimeout(endHumanTurn, 1100);
  } else {
    setStatus('Your move — pick a checker');
  }
}

function animateDice(){
  document.querySelectorAll('.die').forEach(d=>{d.classList.add('rolling');setTimeout(()=>d.classList.remove('rolling'),400);});
}

function onUndo(){
  if(!history.length) return;
  const snap=history.pop();
  restore(snap);
  selected=null;
  updateButtons(); render();
  setStatus('Your move — pick a checker');
}

function onDone(){
  // Only allowed when no legal moves remain (enforced); otherwise force play.
  const remaining=legalMoves(WHITE);
  if(remaining.length>0){
    showToast('You must use all playable dice');
    return;
  }
  endHumanTurn();
}

function updateButtons(){
  const human = current===WHITE && !gameOver;
  document.getElementById('rollBtn').disabled = !human || rolledThisTurn;
  document.getElementById('undoBtn').disabled = !human || !rolledThisTurn || history.length===0;
  const remaining = human && rolledThisTurn ? legalMoves(WHITE).length : 1;
  document.getElementById('doneBtn').disabled = !human || !rolledThisTurn || remaining>0;
}

/* ---------------------------  CPU (Black)  --------------------------- */

function cpuTurn(){
  if(gameOver) return;
  rollDice();
  rolledThisTurn=true;
  render();
  setStatus('Black rolls '+dice.map(d=>d.value).join(' & '));
  setTimeout(()=>cpuPlaySequence(), 600);
}

/* Greedy CPU: repeatedly pick the best single move until dice exhausted. */
function cpuPlaySequence(){
  if(gameOver) return;
  const moves=legalMoves(BLACK);
  if(moves.length===0){
    setStatus('Black has no moves');
    setTimeout(()=>{ current=WHITE; rolledThisTurn=false; dice=[]; history=[]; updateButtons(); render(); setStatus('Your turn — roll the dice'); }, 800);
    return;
  }
  const mv = chooseCpuMove(moves);
  const snap=applyMove(BLACK, mv);
  if(snap.hit) flashHit();
  render();
  if(checkWin()) return;
  if(dice.some(d=>!d.used) && legalMoves(BLACK).length>0){
    setTimeout(cpuPlaySequence, 520);
  } else {
    setTimeout(()=>{
      current=WHITE; rolledThisTurn=false; dice=[]; history=[]; selected=null;
      updateButtons(); render();
      setStatus('Your turn — roll the dice');
    }, 700);
  }
}

/* Heuristic scoring for a candidate Black move. */
function chooseCpuMove(moves){
  let best=null, bestScore=-Infinity;
  for(const mv of moves){
    let s=0;
    // bearing off is great
    if(mv.to==='off'){ s+=100; }
    else {
      // hitting opponent blot
      if(typeof mv.to==='number' && board[mv.to]>0 && Math.abs(board[mv.to])===1){ s+=60; }
      // making a point (landing where we already have one) -> safety
      if(typeof mv.to==='number' && board[mv.to] < 0){ s+=18; }
      // avoid leaving from a made point into a blot (exposing)
      if(mv.from!=='bar' && board[mv.from]===-2){ s-=8; }
      // progress toward home (black wants higher points)
      if(typeof mv.to==='number'){ s += mv.to*0.3; }
      // building in home board
      if(typeof mv.to==='number' && mv.to>=19){ s+=10; }
      // escaping the back (entering from bar / advancing low checkers)
      if(mv.from==='bar'){ s+=8; }
      if(typeof mv.from==='number' && mv.from<=6){ s+=6; }
    }
    // small randomness to vary play
    s += Math.random()*1.5;
    if(s>bestScore){bestScore=s;best=mv;}
  }
  return best;
}

/* ---------------------------  WIN / UTIL  --------------------------- */

function checkWin(){
  if(off.white===15){ endGame(WHITE); return true; }
  if(off.black===15){ endGame(BLACK); return true; }
  return false;
}

function endGame(winner){
  gameOver=true;
  const loserOff = winner===WHITE ? off.black : off.white;
  let kind='single game';
  // gammon/backgammon detection
  const loser = winner===WHITE?BLACK:WHITE;
  if(loserOff===0){
    // backgammon if loser still has checker in winner's home or on bar
    let onBarOrHome=bar[loser]>0;
    if(winner===WHITE){ for(let p=1;p<=6;p++) if(owns(p,loser)) onBarOrHome=true; }
    else { for(let p=19;p<=24;p++) if(owns(p,loser)) onBarOrHome=true; }
    kind = onBarOrHome ? 'backgammon (triple!)' : 'gammon (double!)';
  }
  document.getElementById('turnDot').className='turn-dot '+winner;
  setStatus((winner===WHITE?'You win':'Black wins')+' — '+kind);
  const ov=document.getElementById('overlay');
  document.getElementById('winTitle').textContent = winner===WHITE ? '🏆 You Win!' : 'Black Wins';
  document.getElementById('winSub').textContent =
    (winner===WHITE?'Your checkers are all home and off. ':'The CPU bore off first. ') +
    'Result: '+kind+'.';
  ov.classList.add('show');
  updateButtons();
}

function setStatus(msg){ document.getElementById('statusMsg').textContent=msg; }

let toastTimer;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),1800);
}
function flashHit(){ showToast('Hit! Checker sent to the bar'); }

/* ---------------------------  BOOT  --------------------------- */

function newGame(){
  startPosition();
  dice=[]; current=WHITE; selected=null; history=[]; gameOver=false; rolledThisTurn=false;
  document.getElementById('overlay').classList.remove('show');
  updateButtons();
  render();
  setStatus('Your turn — press “Roll Dice” to begin');
}
window.newGame=newGame;

document.getElementById('rollBtn').addEventListener('click',onRoll);
document.getElementById('undoBtn').addEventListener('click',onUndo);
document.getElementById('doneBtn').addEventListener('click',onDone);
document.getElementById('newBtn').addEventListener('click',newGame);

buildBoard();
newGame();
