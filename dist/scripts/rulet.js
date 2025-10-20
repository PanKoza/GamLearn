// Ruletka – europejska 0–36
const wheelInner = document.getElementById('wheelInner');
const resultNumEl = document.getElementById('resultNum');
const resultColorEl = document.getElementById('resultColor');
const balanceEl = document.getElementById('balance');
const messageEl = document.getElementById('message');
const insideBoard = document.getElementById('insideBoard');
const spinBtn = document.getElementById('spinBtn');
const clearBtn = document.getElementById('clearBtn');
const chipsBtns = Array.from(document.querySelectorAll('.chip'));
const activeChipEl = document.getElementById('activeChip');
const outsideBtns = Array.from(document.querySelectorAll('.ob'));
const betsSumEl = document.getElementById('betsSum');

const EURO_SEQ = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

let balance = Number(localStorage.getItem('roulette_balance') || 1000);
let selectedChip = 10;
let spinning = false;

// Zakłady: key -> amount; keys: n:17, red, black, even, odd, low, high, d1, d2, d3 oraz grupowe g:1,4 / g:3,6,2,5
const bets = Object.create(null);

// Mapy dla overlay (split/corner)
const cellByNumber = new Map();        // num -> element komórki
const spotByKey = Object.create(null); // 'g:1,4' -> element spotu

function saveBalance(){ localStorage.setItem('roulette_balance', String(balance)); }
function updateBalance(){ if (balanceEl) balanceEl.textContent = balance; }
function updateBetsSum(){
  if (!betsSumEl) return;
  const sum = Object.values(bets).reduce((a,b)=>a+b,0);
  betsSumEl.textContent = `Suma zakładów: ${sum}`;
}
function numColor(n){
  if (n === 0) return 'green';
  return REDS.has(n) ? 'red' : 'black';
}
function colorBadgeEl(color){
  if (!resultColorEl) return;
  resultColorEl.className = 'color-badge ' + (color || '');
  resultColorEl.textContent = ' ';
}

function buildWheel(){
  if (!wheelInner) return;
  const step = 360 / EURO_SEQ.length;
  wheelInner.innerHTML = '';
  EURO_SEQ.forEach((num, i)=>{
    const el = document.createElement('div');
    el.className = 'wn';
    const angle = i * step;
    el.style.transform = `rotate(${angle}deg) translate(0, 0)`;
    const badge = document.createElement('span');
    const c = numColor(num);
    badge.textContent = String(num);
    badge.className = `color-${c}`;
    el.appendChild(badge);
    wheelInner.appendChild(el);
  });
}

function buildBoard(){
  if (!insideBoard) return;
  insideBoard.innerHTML = '';
  insideBoard.style.gridTemplateRows = 'repeat(3, 1fr)';

  // 0
  const cell0 = makeCell('0', 'n:0', 'zero');
  cell0.style.gridRow = '1 / span 3';
  cell0.style.gridColumn = '1';
  insideBoard.appendChild(cell0);

  // wyczyść mapę
  cellByNumber.clear();

  // 3 rzędy
  const top = Array.from({length:12}, (_,i)=> (i+1)*3);
  const mid = Array.from({length:12}, (_,i)=> (i+1)*3 - 1);
  const bot = Array.from({length:12}, (_,i)=> (i+1)*3 - 2);

  const rows = [top, mid, bot];
  rows.forEach((arr, rIdx)=>{
    arr.forEach((num, cIdx)=>{
      const key = `n:${num}`;
      const c = numColor(num);
      const cell = makeCell(String(num), key, c);
      cell.style.gridRow = (rIdx+1).toString();
      cell.style.gridColumn = (cIdx+2).toString(); // +1 bo 0 zajmuje kolumnę 1
      insideBoard.appendChild(cell);
      cellByNumber.set(num, cell);
    });
  });

  // Overlay na spready/cornery
  ensureBoardOverlay();
  requestAnimationFrame(buildOverlays);
}

function makeCell(label, key, colorClass){
  const el = document.createElement('div');
  el.className = `cell ${colorClass || ''}`;
  el.dataset.key = key;
  el.textContent = label;
  el.addEventListener('click', ()=> addBet(key, selectedChip));
  el.addEventListener('contextmenu', (e)=>{
    e.preventDefault();
    removeBet(key, selectedChip);
  });
  return el;
}

// Utwórz/nadpisz kontener overlay
function ensureBoardOverlay(){
  let overlay = insideBoard.querySelector('.board-overlay');
  if (!overlay){
    overlay = document.createElement('div');
    overlay.className = 'board-overlay';
    insideBoard.appendChild(overlay);
  } else {
    overlay.innerHTML = '';
  }
  for (const k in spotByKey) delete spotByKey[k];
}

// Geometria – środek komórki względem board
function cellCenter(n){
  const cell = cellByNumber.get(n);
  const br = insideBoard.getBoundingClientRect();
  const cr = cell.getBoundingClientRect();
  return { x: cr.left - br.left + cr.width/2, y: cr.top - br.top + cr.height/2 };
}

// [CHANGE] createSpot – dodaj klasę typu (split h/v, corner) i reset poprzednich zakładów danego typu
function createSpot(key, cx, cy, label='', extraClass=''){
  const overlay = insideBoard.querySelector('.board-overlay');
  const spot = document.createElement('div');
  spot.className = 'spot' + (extraClass ? ' ' + extraClass : '');
  spot.style.left = `${cx}px`;
  spot.style.top  = `${cy}px`;
  if (label) spot.textContent = label;
  spot.dataset.key = key;
  spot.dataset.amt = String(bets[key] || 0);
  spot.addEventListener('click', ()=>{
    // pozwól stawiać wiele splitów/cornerów równocześnie
    addBet(key, selectedChip);
  });
  spot.addEventListener('contextmenu', (e)=>{ e.preventDefault(); removeBet(key, selectedChip); });
  overlay.appendChild(spot);
  spotByKey[key] = spot;
}

// [CHANGE] buildOverlays – przekazuj typ i orientację do createSpot
function buildOverlays(){
  const overlay = insideBoard.querySelector('.board-overlay');
  if (!overlay) return;
  overlay.innerHTML = '';
  for (const k in spotByKey) delete spotByKey[k];

  const top = Array.from({length:12}, (_,i)=> (i+1)*3);
  const mid = Array.from({length:12}, (_,i)=> (i+1)*3 - 1);
  const bot = Array.from({length:12}, (_,i)=> (i+1)*3 - 2);

  function addSplit(a,b){
    const nums = [a,b].sort((x,y)=>x-y);
    const key = 'g:' + nums.join(',');
    const ca = cellCenter(a), cb = cellCenter(b);
    const dir = Math.abs(a - b) === 3 ? 'h' : 'v'; // 3 = sąsiedztwo poziome, 1 = pionowe
    createSpot(key, (ca.x+cb.x)/2, (ca.y+cb.y)/2, '', `split ${dir}`);
  }

  function addCorner(a,b,c,d){
    const nums = [a,b,c,d].sort((x,y)=>x-y);
    const key = 'g:' + nums.join(',');
    const pts = [a,b,c,d].map(n=>cellCenter(n));
    const cx = pts.reduce((s,p)=>s+p.x,0)/4;
    const cy = pts.reduce((s,p)=>s+p.y,0)/4;
    createSpot(key, cx, cy, '', 'corner');
  }

  // Splity poziome
  [bot, mid, top].forEach(row=>{
    for (let i=0; i<row.length-1; i++){
      addSplit(row[i], row[i+1]);
    }
  });

  // Splity pionowe
  for (let col=0; col<12; col++){
    const a = bot[col], b = mid[col], c = top[col];
    addSplit(a, b);
    addSplit(b, c);
  }

  // Rogi
  for (let col=0; col<11; col++){
    const a = bot[col], b = mid[col], c = top[col];
    const a2 = bot[col+1], b2 = mid[col+1], c2 = top[col+1];
    addCorner(a, b, a2, b2);
    addCorner(b, c, b2, c2);
  }

  renderBetBadges();
}

// [ADD] Jeśli nie masz jeszcze tej funkcji – resetuje zakłady grupowe danego typu
function clearGroupBets(kind='all'){
  let refunded = 0;
  Object.keys(bets).forEach(key=>{
    if (!key.startsWith('g:')) return;
    const len = key.slice(2).split(',').length;
    const isSplit = len===2;
    const isCorner = len===4;
    if (kind==='split' && !isSplit) return;
    if (kind==='corner' && !isCorner) return;
    refunded += bets[key] || 0;
    delete bets[key];
  });
  if (refunded>0){
    balance += refunded;
    saveBalance(); updateBalance();
    updateBetsSum(); renderBetBadges();
  }
  return refunded;
}

// Dodanie/zdjęcie zakładu
function addBet(key, amt){
  if (spinning) return;
  if (balance < amt) { setMsg('Za mało środków.'); return; }
  bets[key] = (bets[key] || 0) + amt;
  balance -= amt; saveBalance(); updateBalance();
  updateBetsSum(); renderBetBadges();
}

function removeBet(key, amt){
  if (spinning) return;
  if (!bets[key]) return;
  const take = Math.min(amt, bets[key]);
  bets[key] -= take;
  if (bets[key] <= 0) delete bets[key];
  balance += take; saveBalance(); updateBalance();
  updateBetsSum(); renderBetBadges();
}

// Reset zakładów grupowych (splity/cornery) i zwrot środków
function clearGroupBets(kind='all'){
  let refunded = 0;
  Object.keys(bets).forEach(key=>{
    if (!key.startsWith('g:')) return;
    const len = key.slice(2).split(',').length;
    const isSplit = len===2;
    const isCorner = len===4;
    if (kind==='split' && !isSplit) return;
    if (kind==='corner' && !isCorner) return;
    refunded += bets[key] || 0;
    delete bets[key];
  });
  if (refunded>0){
    balance += refunded;
    saveBalance(); updateBalance();
    updateBetsSum(); renderBetBadges();
  }
  return refunded;
}

// Odśwież znaczniki stawek
function renderBetBadges(){
  if (!insideBoard) return;

  // wyczyść kwoty wewnątrz komórek
  insideBoard.querySelectorAll('.cell .amt').forEach(e=>e.remove());

  // [FIX] Najpierw wyczyść wszystkie spoty grupowe (splity/cornery)
  Object.values(spotByKey).forEach(spot=>{
    spot.dataset.amt = '0';
    spot.classList.remove('active');
  });

  // inside – numery
  Object.entries(bets).forEach(([key, amount])=>{
    if (key.startsWith('n:')){
      const cell = insideBoard.querySelector(`.cell[data-key="${key}"]`);
      if (cell){
        const badge = document.createElement('div');
        badge.className = 'amt';
        badge.textContent = amount;
        cell.appendChild(badge);
      }
    }
  });

  // overlay – spoty grupowe
  Object.entries(bets).forEach(([key, amount])=>{
    if (key.startsWith('g:')){
      const spot = spotByKey[key];
      if (spot){
        spot.dataset.amt = String(amount);
        spot.classList.toggle('active', amount>0);
      }
    }
  });

  // outside – guziki
  outsideBtns.forEach(btn=>{
    const key = btn.dataset.bet;
    btn.dataset.amt = bets[key] || 0;
    btn.title = bets[key] ? `Zakład: ${bets[key]}` : '';
    btn.style.outline = bets[key] ? '2px solid var(--accent)' : '';
    btn.style.outlineOffset = bets[key] ? '2px' : '';
  });
}

function chooseChip(v){
  selectedChip = v;
  if (activeChipEl) activeChipEl.textContent = v;
  chipsBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.chip)===v));
}

function setMsg(text){
  if (messageEl) messageEl.textContent = text || '';
}

function totalBets(){
  return Object.values(bets).reduce((a,b)=>a+b,0);
}

// Podświetlenia wyników
function clearHighlights(){
  insideBoard?.querySelectorAll('.cell.win').forEach(el=> el.classList.remove('win'));
  outsideBtns.forEach(btn=> btn.classList.remove('win'));
}
function highlightResults(n){
  clearHighlights();
  const cell = insideBoard.querySelector(`.cell[data-key="n:${n}"]`);
  if (cell) cell.classList.add('win');

  if (n !== 0){
    const isRed = numColor(n)==='red';
    const isEven = n % 2 === 0;
    const inLow = n>=1 && n<=18;
    const inHigh = n>=19 && n<=36;
    const inD1 = n>=1 && n<=12;
    const inD2 = n>=13 && n<=24;
    const inD3 = n>=25 && n<=36;

    const byKey = k => outsideBtns.find(b=> b.dataset.bet===k);
    if (isRed) byKey('red')?.classList.add('win'); else byKey('black')?.classList.add('win');
    (isEven ? byKey('even') : byKey('odd'))?.classList.add('win');
    if (inLow) byKey('low')?.classList.add('win');
    if (inHigh) byKey('high')?.classList.add('win');
    if (inD1) byKey('d1')?.classList.add('win');
    if (inD2) byKey('d2')?.classList.add('win');
    if (inD3) byKey('d3')?.classList.add('win');
  }
  setTimeout(clearHighlights, 2200);
}

function spin(){
  if (spinning) return;
  if (totalBets() === 0){ setMsg('Postaw zakład.'); return; }

  spinning = true;
  setMsg('Kręcę...');
  if (spinBtn) spinBtn.disabled = true;
  if (clearBtn) clearBtn.disabled = true;
  clearHighlights();

  // los
  const idx = Math.floor(Math.random() * EURO_SEQ.length);
  const number = EURO_SEQ[idx];
  const color = numColor(number);

  // animacja koła
  if (wheelInner){
    const step = 360 / EURO_SEQ.length;
    const spins = 6 + Math.floor(Math.random()*4);
    const target = -(spins*360 + idx*step);
    wheelInner.classList.add('spinning');
    wheelInner.style.transform = `rotate(${target}deg)`;
  }

  const onEnd = ()=>{
    wheelInner?.classList.remove('spinning');
    wheelInner?.removeEventListener?.('transitionend', onEnd);

    if (resultNumEl) resultNumEl.textContent = String(number);
    colorBadgeEl(color);

    highlightResults(number);

    const win = settleBets(number);
    setMsg(win > 0 ? `Wygrana ${win}.` : 'Brak wygranej.');

    // reset zakładów
    for (const k in bets) delete bets[k];
    renderBetBadges();
    updateBetsSum();

    spinning = false;
    if (spinBtn) spinBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
  };
  wheelInner?.addEventListener('transitionend', onEnd);
  setTimeout(onEnd, 5200);
}

function settleBets(n){
  let payout = 0;

  // proste
  Object.entries(bets).forEach(([key, amount])=>{
    if (key.startsWith('n:')){
      const pick = Number(key.split(':')[1]);
      if (pick === n){
        payout += amount * 36; // 35:1 + stawka
      }
    }
  });

  // grupowe (split/corner) – wypłaty z doliczoną stawką (18x → 17:1, 9x → 8:1)
  Object.entries(bets).forEach(([key, amount])=>{
    if (!key.startsWith('g:')) return;
    const nums = key.slice(2).split(',').map(Number);
    if (nums.includes(n)){
      const size = nums.length;
      const mult = size===2 ? 18 : size===4 ? 9 : 0;
      if (mult>0) payout += amount * mult;
    }
  });

  // zewnętrzne
  if (bets.red && n!==0 && numColor(n)==='red') payout += bets.red * 2;
  if (bets.black && n!==0 && numColor(n)==='black') payout += bets.black * 2;
  if (bets.even && n!==0 && n%2===0) payout += bets.even * 2;
  if (bets.odd && n!==0 && n%2===1) payout += bets.odd * 2;
  if (bets.low && n>=1 && n<=18) payout += bets.low * 2;
  if (bets.high && n>=19 && n<=36) payout += bets.high * 2;
  if (bets.d1 && n>=1 && n<=12) payout += bets.d1 * 3;
  if (bets.d2 && n>=13 && n<=24) payout += bets.d2 * 3;
  if (bets.d3 && n>=25 && n<=36) payout += bets.d3 * 3;

  if (payout > 0){
    balance += payout; saveBalance(); updateBalance();
  }
  return payout;
}

function hookOutside(){
  outsideBtns.forEach(btn=>{
    const key = btn.dataset.bet;
    btn.addEventListener('click', ()=> addBet(key, selectedChip));
    btn.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      removeBet(key, selectedChip);
    });
  });
}

function init(){
  updateBalance(); chooseChip(selectedChip);

  chipsBtns.forEach(b => b.addEventListener('click', ()=> chooseChip(Number(b.dataset.chip))));

  buildWheel();
  buildBoard();
  renderBetBadges();
  hookOutside();
  updateBetsSum();

  spinBtn?.addEventListener('click', spin);
  clearBtn?.addEventListener('click', ()=>{
    const sum = totalBets();
    if (sum>0){ balance += sum; saveBalance(); updateBalance(); }
    for (const k in bets) delete bets[k];
    renderBetBadges(); updateBetsSum(); setMsg('');
  });

  window.addEventListener('keydown', (e)=>{
    if (e.code === 'Space'){ e.preventDefault(); spin(); }
  });

  // Reakcja na zmianę rozmiaru – przelicz pozycje spotów
  window.addEventListener('resize', ()=>{
    requestAnimationFrame(buildOverlays);
  });
}

document.addEventListener('DOMContentLoaded', init);