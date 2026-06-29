/* ===========================================================
   Rendering — builds the board DOM and paints state each frame.
   Reads global state from engine.js; calls applyHighlights() from game.js.
   =========================================================== */

const POINT_LAYOUT = {
  // which point number sits in each quadrant cell (left->right within quad)
  'q-top-left':  [13,14,15,16,17,18],
  'q-top-right': [19,20,21,22,23,24],
  'q-bot-left':  [12,11,10,9,8,7],
  'q-bot-right': [6,5,4,3,2,1],
};

function buildBoard(){
  for(const [qid, pts] of Object.entries(POINT_LAYOUT)){
    const quad = document.getElementById(qid);
    quad.innerHTML='';
    pts.forEach(pn=>{
      const div = document.createElement('div');
      div.className='point';
      div.dataset.point = pn;
      div.innerHTML = `<div class="tri"></div><div class="stack"></div><span class="point-num">${pn}</span>`;
      div.addEventListener('click',()=>onPointClick(pn));
      quad.appendChild(div);
    });
  }
  document.getElementById('bar-white').addEventListener('click',()=>onBarClick(WHITE));
  document.getElementById('bar-black').addEventListener('click',()=>onBarClick(BLACK));
  document.getElementById('off-white').addEventListener('click',()=>onOffClick(WHITE));
  document.getElementById('off-black').addEventListener('click',()=>onOffClick(BLACK));
}

function render(){
  // points
  document.querySelectorAll('.point').forEach(div=>{
    const pn = +div.dataset.point;
    const stack = div.querySelector('.stack');
    stack.innerHTML='';
    const v = board[pn];
    const count = Math.abs(v);
    const color = v>0 ? 'white' : 'black';
    const maxShow = 5;
    const show = Math.min(count, maxShow);
    for(let i=0;i<show;i++){
      const c = document.createElement('div');
      c.className=`checker ${color}`;
      if(i===show-1 && count>maxShow){ c.classList.add('count'); c.textContent = count; }
      stack.appendChild(c);
    }
    div.classList.remove('src-hl','target','playable');
  });

  // bar
  renderBarZone('bar-white', WHITE);
  renderBarZone('bar-black', BLACK);

  // off
  renderOff('off-white', WHITE);
  renderOff('off-black', BLACK);
  document.getElementById('off-white-count').textContent = off.white;
  document.getElementById('off-black-count').textContent = off.black;

  // dice
  renderDice();

  // highlights
  applyHighlights();

  // pip counts
  document.getElementById('pipWhite').textContent = pipCount(WHITE);
  document.getElementById('pipBlack').textContent = pipCount(BLACK);

  // turn indicator
  const dot = document.getElementById('turnDot');
  dot.className = 'turn-dot ' + current;
}

function renderBarZone(id, player){
  const zone = document.getElementById(id);
  zone.innerHTML='';
  zone.classList.remove('src-hl','playable');
  const n = bar[player];
  for(let i=0;i<Math.min(n,4);i++){
    const c=document.createElement('div');
    c.className=`checker ${player}`;
    if(i===3 && n>4){c.textContent=n;c.classList.add('count');}
    zone.appendChild(c);
  }
}

function renderOff(id, player){
  const zone=document.getElementById(id);
  // keep the count/cap spans, manage bear bars
  zone.querySelectorAll('.bear').forEach(e=>e.remove());
  zone.classList.remove('target');
  const n=off[player];
  const frag=document.createDocumentFragment();
  for(let i=0;i<n;i++){
    const b=document.createElement('div');
    b.className=`bear ${player}`;
    frag.appendChild(b);
  }
  zone.insertBefore(frag, zone.firstChild);
}

function renderDice(){
  const wrap=document.getElementById('dice');
  wrap.innerHTML='';
  if(!dice.length){
    wrap.innerHTML='<span style="color:var(--muted);font-size:.85rem">—</span>';
    return;
  }
  const PIPS={
    1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]
  };
  dice.forEach(d=>{
    const die=document.createElement('div');
    die.className='die'+(d.used?' used':'')+(current===BLACK?' black-die':'');
    for(let i=0;i<9;i++){
      const cell=document.createElement('div');
      if(PIPS[d.value].includes(i)){const p=document.createElement('div');p.className='pip';cell.appendChild(p);}
      die.appendChild(cell);
    }
    wrap.appendChild(die);
  });
}
