/* ===========================================================
   Backgammon engine — game model & rules (no DOM)
   Board model: points 1..24 from White's perspective.
   - White moves from high points (24) toward 1, bears off past 1. Home = 1..6.
   - Black moves from low points (1) toward 24, bears off past 24. Home = 19..24.
   board[p] = integer. Positive = White checkers, Negative = Black checkers.
   bar.white / bar.black = count on the bar.
   off.white / off.black = count borne off.

   Shared mutable state lives on the global scope so render.js and
   game.js can read/write it directly.
   =========================================================== */

const WHITE = 'white', BLACK = 'black';
let board, bar, off, dice, current, selected, history, gameOver, rolledThisTurn;

function startPosition(){
  board = new Array(25).fill(0); // index 0 unused
  // Standard setup (White perspective)
  board[24] = 2;   board[13] = 5;   board[8] = 3;   board[6] = 5;   // White (positive)
  board[1] = -2;   board[12] = -5;  board[17] = -3; board[19] = -5; // Black (negative)
  bar = {white:0, black:0};
  off = {white:0, black:0};
}

function sign(player){ return player === WHITE ? 1 : -1; }
function owns(p, player){ return sign(player) * board[p] > 0; }

/* Direction & home logic.
   White: moves point p -> p - die. Home board 1..6. Bears off when all in 1..6.
   Black: moves point p -> p + die. Home board 19..24. Bears off when all in 19..24.
   Entering from bar: White enters in opponent's home (points 19..24) -> entry point = 25 - die.
     Black enters in points 1..6 -> entry point = die. */

function entryPoint(player, die){ return player === WHITE ? 25 - die : die; }
function destPoint(player, from, die){ return player === WHITE ? from - die : from + die; }

function inHome(player, p){ return player === WHITE ? (p >=1 && p<=6) : (p>=19 && p<=24); }

function allHome(player){
  if(bar[player] > 0) return false;
  for(let p=1;p<=24;p++){
    if(owns(p,player) && !inHome(player,p)) return false;
  }
  return true;
}

function pipCount(player){
  let pips = bar[player] * 25;
  for(let p=1;p<=24;p++){
    if(owns(p,player)){
      const dist = player === WHITE ? p : (25 - p);
      pips += Math.abs(board[p]) * dist;
    }
  }
  return pips;
}

/* Can a checker land on point p for player? (empty, own, or single opponent = blot) */
function canLand(player, p){
  if(p<1 || p>24) return false;
  const v = board[p];
  if(sign(player) * v >= 0) return true;       // empty or own
  return Math.abs(v) === 1;                      // single opponent blot -> hit
}

/* Generate legal destinations for a single die from a given source.
   source is point number 1..24, or 'bar'. Returns dest point number, or 'off'. */
function destFor(player, source, die){
  if(bar[player] > 0 && source !== 'bar') return null; // must enter from bar first
  if(source === 'bar'){
    if(bar[player] === 0) return null;
    const e = entryPoint(player, die);
    return canLand(player, e) ? e : null;
  }
  if(!owns(source, player)) return null;
  const d = destPoint(player, source, die);
  // bearing off
  if(player === WHITE && d < 1){
    if(!allHome(player)) return null;
    if(d === 0) return 'off';
    // overshoot: only allowed if no checker on a higher home point
    for(let hp = 6; hp > source; hp--){ if(owns(hp,player)) return null; }
    return 'off';
  }
  if(player === BLACK && d > 24){
    if(!allHome(player)) return null;
    if(d === 25) return 'off';
    for(let hp = 19; hp < source; hp++){ if(owns(hp,player)) return null; }
    return 'off';
  }
  return canLand(player, d) ? d : null;
}

/* All legal single-die moves available given current dice (unused). */
function legalMoves(player){
  const moves = [];
  const usable = [...new Set(dice.filter(d=>!d.used).map(d=>d.value))];
  const sources = [];
  if(bar[player] > 0){ sources.push('bar'); }
  else { for(let p=1;p<=24;p++) if(owns(p,player)) sources.push(p); }
  for(const src of sources){
    for(const val of usable){
      const dest = destFor(player, src, val);
      if(dest !== null) moves.push({from:src, to:dest, die:val});
    }
  }
  return moves;
}

/* Apply a move, mutating state. Records hit for undo. Returns the snapshot used. */
function applyMove(player, mv){
  const snap = snapshot();
  const s = sign(player);
  // remove from source
  if(mv.from === 'bar') bar[player]--;
  else board[mv.from] -= s;
  // mark a die used (prefer exact)
  let die = dice.find(d=>!d.used && d.value===mv.die) || dice.find(d=>!d.used);
  if(die) die.used = true;
  // place at dest
  if(mv.to === 'off'){
    off[player]++;
  } else {
    if(sign(player) * board[mv.to] < 0){ // hit a blot
      board[mv.to] = 0;
      const opp = player === WHITE ? BLACK : WHITE;
      bar[opp]++;
      snap.hit = true;
    }
    board[mv.to] += s;
  }
  history.push(snap);
  return snap;
}

function snapshot(){
  return {
    board:[...board],
    bar:{...bar},
    off:{...off},
    dice:dice.map(d=>({...d})),
  };
}
function restore(snap){
  board=[...snap.board]; bar={...snap.bar}; off={...snap.off};
  dice=snap.dice.map(d=>({...d}));
}
