// Logika Blackjack
const dealerHandEl = document.getElementById('dealerHand');
const playerHandEl = document.getElementById('playerHand');
const dealerScoreEl = document.getElementById('dealerScore');
const playerScoreEl = document.getElementById('playerScore');
const messageEl = document.getElementById('message');
// Doradca — elementy UI
const advisorEl = document.getElementById('advisor');
const advMoveEl = document.getElementById('advMove');
const advReasonEl = document.getElementById('advReason');

// Nowe: elementy doradcy stawek
const bankrollEl = document.getElementById('bankrollAdvisor');
const bkSafeEl = document.getElementById('bkSafe');
const bkStdEl = document.getElementById('bkStd');
const bkAggEl = document.getElementById('bkAgg');
const bkMaxFlexEl = document.getElementById('bkMaxFlex');
const bkHintEl = document.getElementById('bkHint');

const dealBtn = document.getElementById('dealBtn');
const hitBtn = document.getElementById('hitBtn');
const standBtn = document.getElementById('standBtn');
const doubleBtn = document.getElementById('doubleBtn');
const newBtn = document.getElementById('newBtn');
const splitBtn = document.getElementById('splitBtn');

const balanceEl = document.getElementById('balance');
const betEl = document.getElementById('bet');

const chips = Array.from(document.querySelectorAll('.chip'));

// Nowe: selektor trudności
const difficultySel = document.getElementById('difficulty');

// Nowe: stałe kart
const SUITS  = ['♠','♥','♦','♣'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

// Nowe: panel ubezpieczenia
const insurancePanel = document.getElementById('insurancePanel');
const insYes = document.getElementById('insYes');
const insNo  = document.getElementById('insNo');
let insuranceOffered = false;
let insuranceTaken = false;
let insuranceBet = 0;

// Konfiguracja poziomów
const DIFFICULTY = {
  easy:   { bankroll: 1000, showMove: true,  showBank: true  },
  medium: { bankroll:  500, showMove: false, showBank: true  },
  hard:   { bankroll:  250, showMove: false, showBank: false }
};

let deck = [];
let dealer = [];
let player = [];
let splitActive = false;
let playerHands = null;
let handBets = null;
let currentHand = 0;
let hiddenDealerCard = null;
let hideDealerHole = true;

// === Split helpers (para o tej samej wartości; 10/J/Q/K traktowane jako 10) ===
function currentPlayerHand(){
  return splitActive ? (playerHands && playerHands[currentHand] ? playerHands[currentHand] : []) : player;
}
function sameValue(a, b){
  if (!a || !b) return false;
  // porównaj wartości punktowe (10=J=Q=K)
  return cardValue(a.v) === cardValue(b.v);
}
const MAX_HANDS = 4;
function canSplit(){
  if (state !== 'player') return false;
  const hand = currentPlayerHand();
  if (hand.length !== 2) return false;
  if (!sameValue(hand[0], hand[1])) return false;
  const need = splitActive ? (handBets ? handBets[currentHand] : 0) : bet;
  if (balance < need) return false;
  if (splitActive && playerHands && playerHands.length >= MAX_HANDS) return false;
  return true;
}

let balance = Number(localStorage.getItem('bj_balance') || 1000);
let bet = 0;
let state = 'betting'; // betting -> player -> dealer -> round-over

function saveBalance(){ localStorage.setItem('bj_balance', String(balance)); }
function updateMoney(){ balanceEl.textContent = balance; betEl.textContent = bet; }

function createDeck(){
  deck = [];
  for (const s of SUITS){
    for (const v of VALUES){
      deck.push({s,v});
    }
  }
  // Shuffle - Fisher-Yates
  for (let i=deck.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function cardValue(v){
  if (v === 'A') return 11;
  if (['K','Q','J'].includes(v)) return 10;
  return Number(v);
}

function handTotals(hand){
  let total = 0, aces = 0;
  for (const c of hand){
    total += cardValue(c.v);
    if (c.v === 'A') aces++;
  }
  // Redukcja Asów z 11 do 1
  while (total > 21 && aces > 0){
    total -= 10; aces--;
  }
  return total;
}

// Czy ręka jest “soft” (As liczony jako 11 w optymalnej sumie)
function isSoft(hand){
  let sum = 0, aces = 0;
  for (const c of hand){
    if (c.v === 'A'){ aces++; sum += 1; } else { sum += cardValue(c.v); }
  }
  // jeśli da się dodać +10 do jednej A i <=21, to soft
  return aces > 0 && (sum + 10) <= 21;
}

function renderHand(el, hand, isDealer){
  el.innerHTML = '';
  hand.forEach((c, idx) => {
    const card = document.createElement('div');
    const red = (c.s === '♥' || c.s === '♦');
    card.className = 'card ' + (red ? 'red':'black');
    if (isDealer && idx === 1 && hideDealerHole){
      card.className = 'card back';
      card.innerHTML = '<span>GAM</span>';
    } else {
      card.innerHTML = `
        <div class="corner tl">${c.v}<br>${c.s}</div>
        <div class="corner br">${c.v}<br>${c.s}</div>
        <div class="pip">${c.s}</div>
      `;
    }
    el.appendChild(card);
  });
}

// Render rąk gracza (pojedyncza lub wiele)
function renderPlayer(){
  if (!splitActive){
    renderHand(playerHandEl, player, false);
    return;
  }
  playerHandEl.innerHTML = '';
  playerHands.forEach((hand, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'phand' + (i === currentHand ? ' active' : '');
    const title = document.createElement('div');
    title.className = 'phand-title';
    title.innerHTML = `Ręka ${i+1} <span class="score-badge">${handTotals(hand)}</span>`;
    const lane = document.createElement('div');
    lane.className = 'hand';
    renderHand(lane, hand, false);
    wrap.appendChild(title);
    wrap.appendChild(lane);
    playerHandEl.appendChild(wrap);
  });
}

// 1) Pokaż sumę tylko gdy karta krupiera odkryta
function updateScores(){
  const dTotal = handTotals(dealer);
  const pTotal = handTotals(currentPlayerHand());
  const dealerShown = hideDealerHole
    ? (dealer.length ? cardValue(dealer[0].v) : 0)
    : dTotal;

  dealerScoreEl.textContent = dealerShown;
  playerScoreEl.textContent = pTotal;
  return { d: dTotal, p: pTotal };
}

function setMsg(text, cls=''){
  messageEl.className = 'msg ' + cls;
  messageEl.textContent = text;
}

// Nowe: helper do pokazywania/ukrywania panelu ubezpieczenia
function showInsurance(show){
  if (insurancePanel) insurancePanel.hidden = !show;
}

// Nowe: zastosuj UI wg trudności
function applyDifficultyUI(diff){
  const cfg = DIFFICULTY[diff] || DIFFICULTY.easy;
  if (advisorEl) advisorEl.hidden = !cfg.showMove;
  if (bankrollEl) bankrollEl.hidden = !cfg.showBank;
  // odśwież panele jeśli widoczne
  updateAdvisor();
  updateBankrollAdvisor();
}

// Nowe: ustaw trudność; opcjonalnie resetuj saldo
function setDifficulty(diff, {resetBankroll=false} = {}){
  const key = DIFFICULTY[diff] ? diff : 'easy';
  localStorage.setItem('bj_diff', key);
  applyDifficultyUI(key);
  if (resetBankroll){
    balance = DIFFICULTY[key].bankroll;
    bet = 0;
    saveBalance(); updateMoney();
    // wyczyść stany rundy
    newRound();
  }
}

// ===== Doradca — podstawowa strategia (H17, DAS) =====
function dealerUpVal(){
  if (!dealer.length) return null;
  const v = dealer[0].v;
  return v === 'A' ? 11 : cardValue(v);
}

function canDoubleNow(){
  if (state !== 'player') return false;
  const cur = currentPlayerHand();
  if (cur.length !== 2) return false;
  const need = splitActive ? handBets[currentHand] : bet;
  return balance >= need;
}

function advisePair(v, up){
  // v: 2..11 (11=Ace), H17, DAS
  switch (v){
    case 11: return {move:'split', reason:'Zawsze splituj Asy.'};
    case 10: return {move:'stand', reason:'Nigdy nie splituj 10 — to 20.'};
    case 9:  return (up>=2 && up<=6) || up===8 || up===9
      ? {move:'split', reason:'9,9 split vs 2–6,8,9.'}
      : {move:'stand', reason:'9,9 stój vs 7,10,A.'};
    case 8:  return {move:'split', reason:'Zawsze splituj 8,8.'};
    case 7:  return (up>=2 && up<=7)
      ? {move:'split', reason:'7,7 split vs 2–7.'}
      : {move:'hit', reason:'7,7 dobierz vs 8+.'};
    case 6:  return (up>=2 && up<=6)
      ? {move:'split', reason:'6,6 split vs 2–6.'}
      : {move:'hit', reason:'6,6 dobierz vs 7+.'};
    case 5:  return {move:'double', alt:'hit', reason:'5,5 traktuj jako 10: podwajaj vs 2–9.'};
    case 4:  return (up>=5 && up<=6)
      ? {move:'split', reason:'4,4 split vs 5–6.'}
      : {move:'hit', reason:'4,4 dobierz w pozostałych.'};
    case 3:
    case 2:  return (up>=2 && up<=7)
      ? {move:'split', reason:`${v},${v} split vs 2–7.`}
      : {move:'hit', reason:`${v},${v} dobierz vs 8+.`};
    default: return {move:'hit', reason:'Dobierz.'};
  }
}

function adviseSoft(total, up){
  // total: 13..21 (A+X)
  if (total >= 20) return {move:'stand', reason:'Soft 20+ – stój.'};
  if (total === 19){
    // czasem double vs 6, zostawmy stój (prościej)
    return {move:'stand', reason:'Soft 19 – stój.'};
  }
  if (total === 18){
    if (up>=3 && up<=6) return {move:'double', alt:'stand', reason:'Soft 18: podwajaj vs 3–6.'};
    if (up===2 || up===7 || up===8) return {move:'stand', reason:'Soft 18: stój vs 2,7,8.'};
    return {move:'hit', reason:'Soft 18: dobierz vs 9,10,A.'};
  }
  if (total === 17) return (up>=3 && up<=6)
    ? {move:'double', alt:'hit', reason:'Soft 17: podwajaj vs 3–6.'}
    : {move:'hit', reason:'Soft 17: dobierz.'};
  if (total === 16 || total === 15) return (up>=4 && up<=6)
    ? {move:'double', alt:'hit', reason:`Soft ${total}: podwajaj vs 4–6.`}
    : {move:'hit', reason:`Soft ${total}: dobierz.`};
  if (total === 14 || total === 13) return (up>=5 && up<=6)
    ? {move:'double', alt:'hit', reason:`Soft ${total}: podwajaj vs 5–6.`}
    : {move:'hit', reason:`Soft ${total}: dobierz.`};
  return {move:'hit', reason:'Dobierz.'};
}

function adviseHard(total, up){
  if (total >= 17) return {move:'stand', reason:'17+ – stój.'};
  if (total >= 13 && total <= 16){
    return (up>=2 && up<=6)
      ? {move:'stand', reason:`${total}: stój vs 2–6.`}
      : {move:'hit', reason:`${total}: dobierz vs 7–A.`};
  }
  if (total === 12){
    return (up>=4 && up<=6)
      ? {move:'stand', reason:'12: stój vs 4–6.'}
      : {move:'hit', reason:'12: dobierz vs 2–3,7–A.'};
  }
  if (total === 11){
    return (up===11)
      ? {move:'hit', reason:'11 vs A: dobierz.'}
      : {move:'double', alt:'hit', reason:'11: podwajaj vs 2–10.'};
  }
  if (total === 10){
    return (up>=2 && up<=9)
      ? {move:'double', alt:'hit', reason:'10: podwajaj vs 2–9.'}
      : {move:'hit', reason:'10: dobierz vs 10–A.'};
  }
  if (total === 9){
    return (up>=3 && up<=6)
      ? {move:'double', alt:'hit', reason:'9: podwajaj vs 3–6.'}
      : {move:'hit', reason:'9: dobierz.'};
  }
  return {move:'hit', reason:'8 lub mniej: dobierz.'};
}

function computeAdvice(){
  // Ubezpieczenie
  if (state === 'insurance'){
    return { move:'ins-no', reason:'Ubezpieczenie jest statystycznie nieopłacalne.' };
  }
  if (state !== 'player'){
    return { move:'none', reason:'Czekaj na swoją turę.' };
  }
  const cur = currentPlayerHand();
  if (!cur || cur.length === 0 || dealer.length === 0){
    return { move:'none', reason:'Brak danych.' };
  }

  const pTotal = handTotals(cur);
  const up = dealerUpVal();

  if (pTotal >= 21){
    return pTotal === 21
      ? { move:'stand', reason:'Masz 21 – stój.' }
      : { move:'none', reason:'Przebicie.' };
  }

  // Para?
  const pair = (cur.length === 2 && sameValue(cur[0], cur[1]));
  if (pair && canSplit()){
    const pv = cur[0].v === 'A' ? 11 : cardValue(cur[0].v);
    return advisePair(pv, up);
  }

  // Soft/Hard
  if (isSoft(cur)){
    const adv = adviseSoft(pTotal, up);
    if (adv.move === 'double' && !canDoubleNow()){
      return { move: adv.alt || 'hit', reason: adv.reason + ' (brak warunków do podwojenia).' };
    }
    return adv;
  } else {
    const adv = adviseHard(pTotal, up);
    if (adv.move === 'double' && !canDoubleNow()){
      return { move: adv.alt || 'hit', reason: adv.reason + ' (brak warunków do podwojenia).' };
    }
    return adv;
  }
}

function updateAdvisor(){
  if (!advisorEl || !advMoveEl || !advReasonEl) return;

  const adv = computeAdvice();
  let label = '—', cls = '';
  switch (adv.move){
    case 'hit':      label = 'Dobierz'; cls='move-hit'; break;
    case 'stand':    label = 'Stój'; cls='move-stand'; break;
    case 'double':   label = 'Podwój'; cls='move-double'; break;
    case 'split':    label = 'Split'; cls='move-split'; break;
    case 'ins-no':   label = 'Bez ubezpieczenia'; cls='move-ins'; break;
    default:         label = '—'; cls=''; break;
  }
  advMoveEl.className = 'adv-move ' + cls;
  advMoveEl.textContent = label;
  advReasonEl.textContent = adv.reason || '';
}

// Nowe: doradca stawek
function roundToChip(n){
  return Math.max(0, Math.floor(n / 5) * 5); // zaokrąglenie do 5 żetonów
}
function fmtChips(n){ return String(n); }

function updateBankrollAdvisor(){
  if (!bankrollEl) return;
  const B = balance;

  if (B <= 0){
    bkSafeEl && (bkSafeEl.textContent = '0');
    bkStdEl  && (bkStdEl.textContent  = '0');
    bkAggEl  && (bkAggEl.textContent  = '0');
    bkMaxFlexEl && (bkMaxFlexEl.textContent = '0');
    bkHintEl && (bkHintEl.textContent = 'Brak środków. Doładuj saldo.');
    return;
  }

  const safe = roundToChip(B * 0.01);
  const std  = roundToChip(B * 0.02);
  const agg  = roundToChip(B * 0.05);

  // Maks stawka, aby po postawieniu zostało ≥ 2×bet na split+podwój: B - x ≥ 2x => x ≤ B/3
  const maxFlex = roundToChip(Math.floor(B / 3));

  bkSafeEl && (bkSafeEl.textContent = fmtChips(safe));
  bkStdEl  && (bkStdEl.textContent  = fmtChips(std));
  bkAggEl  && (bkAggEl.textContent  = fmtChips(agg));
  bkMaxFlexEl && (bkMaxFlexEl.textContent = fmtChips(maxFlex));

  // Podpowiedź pod aktualny zakład
  if (state === 'betting'){
    if (bet > maxFlex){
      bkHintEl && (bkHintEl.textContent = `Obecny zakład ${bet} może ograniczyć split lub podwojenie w rundzie.`);
    } else if (bet > std){
      bkHintEl && (bkHintEl.textContent = `Zakład ${bet} jest wyższy niż standardowe 2% salda.`);
    } else if (bet < safe){
      bkHintEl && (bkHintEl.textContent = `Możesz rozważyć podniesienie zakładu do ~${safe}–${std}.`);
    } else {
      bkHintEl && (bkHintEl.textContent = `Zakład w bezpiecznym zakresie.`);
    }
  } else {
    bkHintEl && (bkHintEl.textContent = `Ustaw zakład w panelu, najlepiej 1–2% salda.`);
  }
}

function setControls(){
  dealBtn.disabled   = !(state === 'betting' && bet > 0 && balance >= bet);
  const pTurn = (state === 'player');
  const cur = currentPlayerHand();
  const pTotal = handTotals(cur);

  hitBtn.disabled    = !pTurn || pTotal >= 21;
  standBtn.disabled  = !pTurn;

  if (!splitActive){
    doubleBtn.disabled = !(pTurn && player.length === 2 && balance >= bet) || pTotal >= 21;
  } else {
    doubleBtn.disabled = !(pTurn && cur.length === 2 && balance >= handBets[currentHand]) || pTotal >= 21;
  }

  splitBtn.disabled  = !canSplit();
  newBtn.disabled    = !(state === 'round-over');

  updateAdvisor();
  updateBankrollAdvisor(); // <— nowe
}

function resetHands(){
  dealer = [];
  player = [];
  // reset split
  splitActive = false;
  playerHands = null;
  handBets = null;
  currentHand = 0;
  hiddenDealerCard = null;
  hideDealerHole = true;
  renderHand(dealerHandEl, dealer, true);
  renderPlayer();
  updateScores();
  updateAdvisor();
  updateBankrollAdvisor(); // <— nowe
}

// Start rozdania – z ofertą ubezpieczenia przy Asie
function startRound(){
  if (bet <= 0 || balance < bet) return;
  state = 'dealt';
  balance -= bet; saveBalance(); updateMoney();
  createDeck();
  resetHands();

  // Rozdanie
  player.push(deck.pop());
  dealer.push(deck.pop());
  player.push(deck.pop());
  hiddenDealerCard = deck.pop();
  dealer.push(hiddenDealerCard);

  renderPlayer();
  renderHand(dealerHandEl, dealer, true);
  updateScores();
  updateAdvisor();

  // Oferta ubezpieczenia, gdy As na wierzchu
  const pTotal = handTotals(player);
  if (dealer[0].v === 'A'){
    state = 'insurance';
    insuranceOffered = true;
    showInsurance(true);
    setMsg('Dealer pokazuje Asa. Chcesz ubezpieczenie 50% stawki (wypłata 2:1)?');
    setControls();
    return; // poczekaj na decyzję
  }

  // Standardowy check naturalnych (gdy nie ma oferty ubezpieczenia)
  const dTotal = handTotals([dealer[0], hiddenDealerCard]);
  if (pTotal === 21 || dTotal === 21){
    hideDealerHole = false;
    renderHand(dealerHandEl, dealer, true);
    updateScores();
    resolveRound(false); // włącz rozliczenie 3:2 dla blackjacka gracza
    return;
  }

  state = 'player';
  setMsg('Twoja tura: dobierz (H), stój (S), split (P) lub podwój (D).');
  setControls();
}

function hit(){
  if (state !== 'player') return;
  const cur = currentPlayerHand();
  if (handTotals(cur) >= 21) { // nic nie dobieraj gdy 21+
    setControls();
    return;
  }
  cur.push(deck.pop());
  renderPlayer();
  const {p} = updateScores();
  updateAdvisor();

  if (p > 21){
    if (!splitActive){
      hideDealerHole = false;
      renderHand(dealerHandEl, dealer, true);
      updateScores();
      resolveRound();
    } else {
      nextSplitHandOrDealer();
    }
  } else if (p === 21) {
    setMsg('Masz 21. Wybierz Stój.');
  } else {
    setMsg(splitActive ? `Ręka ${currentHand+1}: dobierz lub stój.` : 'Dobierz lub stój.');
  }
  setControls();
}

// 2) Po odkryciu krupiera – zaktualizuj wynik
function stand(){
  if (state !== 'player') return;
  if (!splitActive){
    hideDealerHole = false;
    renderHand(dealerHandEl, dealer, true);
    updateScores();                 // <— dopisane
    updateAdvisor();
    dealerTurn();
  } else {
    nextSplitHandOrDealer();
  }
}

function doubleDown(){
  if (state !== 'player') return;
  if (handTotals(currentPlayerHand()) >= 21) return; // brak podwajania przy 21

  if (!splitActive){
    if (!(player.length === 2 && balance >= bet)) return;
    balance -= bet; bet *= 2; saveBalance(); updateMoney();
    player.push(deck.pop());
    renderPlayer();
    const {p} = updateScores();
    updateAdvisor();
    hideDealerHole = false;
    renderHand(dealerHandEl, dealer, true);
    if (p > 21){ resolveRound(); } else { dealerTurn(); }
  } else {
    const cur = currentPlayerHand();
    const curBet = handBets[currentHand];
    if (!(cur.length === 2 && balance >= curBet)) return;
    balance -= curBet; handBets[currentHand] = curBet * 2; saveBalance(); updateMoney();
    cur.push(deck.pop());
    renderPlayer();
    updateScores();
    updateAdvisor();
    nextSplitHandOrDealer();
  }
}

function nextSplitHandOrDealer(){
  if (!splitActive) return;
  if (currentHand + 1 < playerHands.length){
    currentHand++;
    renderPlayer();
    updateScores();
    updateAdvisor();
    setMsg(`Ręka ${currentHand+1}: dobierz (H), stój (S), split (P) lub podwój (D).`);
    setControls();
    return;
  }
  hideDealerHole = false;
  renderHand(dealerHandEl, dealer, true);
  updateScores();                   // <— dopisane
  updateAdvisor();
  dealerTurn();
}

// Split – podziel bieżącą rękę na dwie, pobierz dodatkowy zakład i dobierz po 1 karcie
function doSplit(){
  if (!canSplit()) return;

  // Pierwszy split: przenieś pojedynczą rękę do struktury wielu rąk
  if (!splitActive){
    splitActive = true;
    playerHands = [[player[0], player[1]]];
    handBets = [bet];
    player = []; // pojedyncza ręka nieużywana po splicie
    currentHand = 0;
  }

  const baseBet = handBets[currentHand];
  if (balance < baseBet){ setMsg('Za mało środków na split.'); return; }

  // Pobierz dodatkową stawkę na nową rękę
  balance -= baseBet; saveBalance(); updateMoney();

  // Rozdziel obecną rękę na dwie
  const hand = playerHands[currentHand];
  const first = [hand[0]];
  const second = [hand[1]];

  // Podmień w strukturze i duplikuj stawki
  playerHands.splice(currentHand, 1, first, second);
  handBets.splice(currentHand, 1, baseBet, baseBet);

  // Dobierz po jednej karcie do każdej nowej ręki
  first.push(deck.pop());
  second.push(deck.pop());

  // Odśwież UI
  renderPlayer();
  updateScores();
  setMsg(`Split wykonany. Ręka ${currentHand+1} w grze.`);
  setControls();
}

// 3) Aktualizuj wynik krupiera przy każdym dociągnięciu
function dealerTurn(){
  state = 'dealer';
  let d = handTotals(dealer);
  // Krupier dobiera do 17 (H17: dobiera przy miękkim 17)
  while (d < 17){
    dealer.push(deck.pop());
    renderHand(dealerHandEl, dealer, true);
    d = handTotals(dealer);
    updateScores();                 // <— dopisane
    updateAdvisor();
  }
  updateScores();                   // <— dopisane
  updateAdvisor();
  resolveRound();
}

function resolveSplitRound(){
  const d = handTotals(dealer);
  const results = [];
  for (let i=0; i<playerHands.length; i++){
    const p = handTotals(playerHands[i]);
    const wager = handBets[i];
    if (p > 21){
      results.push(`R${i+1}: Bust`);
    } else if (d > 21){
      balance += wager * 2; results.push(`R${i+1}: Wygrana`);
    } else if (p > d){
      balance += wager * 2; results.push(`R${i+1}: Wygrana`);
    } else if (p < d){
      results.push(`R${i+1}: Przegrana`);
    } else {
      balance += wager; results.push(`R${i+1}: Push`);
    }
  }
  saveBalance(); updateMoney();
  state = 'round-over';
  setMsg(results.join(' | '));
  setControls();
}

function resolveRound(skipNaturalCheck=false){
  if (splitActive){
    return resolveSplitRound();
  }
  const p = handTotals(player);
  const d = handTotals(dealer);
  state = 'round-over';

  const playerNatural = (player.length === 2 && p === 21);
  const dealerNatural = (dealer.length === 2 && d === 21);

  if (!skipNaturalCheck && playerNatural && dealerNatural){
    // push
    balance += bet; setMsg('Push – oboje macie blackjacka.', 'push');
  } else if (!skipNaturalCheck && playerNatural){
    const win = Math.floor(bet * 2.5);
    balance += win; setMsg(`Blackjack! Wygrana ${win - (bet*1)}.`, 'payout');
  } else if (!skipNaturalCheck && dealerNatural){
    setMsg('Krupier ma blackjacka. Przegrywasz.', 'lose');
  } else if (p > 21){
    setMsg('Przebicie – przegrywasz zakład.', 'lose');
  } else if (d > 21){
    balance += bet*2; setMsg('Krupier przebił – wygrywasz!', 'payout');
  } else if (p > d){
    balance += bet*2; setMsg('Wygrywasz!', 'payout');
  } else if (p < d){
    setMsg('Przegrywasz.', 'lose');
  } else {
    balance += bet; setMsg('Remis – zwrot stawki.', 'push');
  }

  saveBalance(); updateMoney();
  setControls();
}

// Decyzje ubezpieczenia
insYes && insYes.addEventListener('click', function(){
  if (state !== 'insurance') return;
  const half = Math.floor(bet / 2);
  if (half <= 0) return;
  if (balance < half){ setMsg('Za mało środków na ubezpieczenie.'); return; }

  insuranceTaken = true; insuranceBet = half;
  balance -= insuranceBet; saveBalance(); updateMoney();

  // Peek: czy krupier ma blackjacka?
  const dPeek = handTotals([dealer[0], hiddenDealerCard]);
  if (dPeek === 21){
    hideDealerHole = false;
    renderHand(dealerHandEl, dealer, true);
    updateScores();                 // <— dopisane
    updateAdvisor();
    balance += insuranceBet * 3; saveBalance(); updateMoney();
    setMsg('Blackjack krupiera. Ubezpieczenie wypłaca 2:1. Runda zakończona.', 'push');
    state = 'round-over';
    showInsurance(false);
    setControls();
  } else {
    showInsurance(false);
    if (handTotals(player) === 21){
      hideDealerHole = false;
      renderHand(dealerHandEl, dealer, true);
      updateScores();               // <— dopisane
      updateAdvisor();
      state = 'round-over';
      resolveRound(false);
    } else {
      state = 'player';
      setMsg('Ubezpieczenie przegrane. Twoja tura: dobierz (H) lub stój (S).');
      setControls();
    }
  }
});

insNo && insNo.addEventListener('click', function(){
  if (state !== 'insurance') return;
  const dPeek = handTotals([dealer[0], hiddenDealerCard]);
  if (dPeek === 21){
    hideDealerHole = false;
    renderHand(dealerHandEl, dealer, true);
    updateScores();                 // <— dopisane
    updateAdvisor();
    resolveRound(true);
  } else {
    showInsurance(false);
    if (handTotals(player) === 21){
      hideDealerHole = false;
      renderHand(dealerHandEl, dealer, true);
      updateScores();               // <— dopisane
      updateAdvisor();
      state = 'round-over';
      resolveRound(false);
    } else {
      state = 'player';
      setMsg('Twoja tura: dobierz (H) lub stój (S).');
      setControls();
    }
  }
});

// Reset ubezpieczenia przy nowej rundzie
function newRound(){
  bet = 0; updateMoney();
  state = 'betting';
  insuranceBet = 0; insuranceTaken = false; insuranceOffered = false;
  showInsurance(false);
  splitActive = false; playerHands = null; handBets = null; currentHand = 0;
  setMsg('Ustaw zakład i kliknij Rozdaj.');
  resetHands();
  setControls();
  updateAdvisor();
}

// Inicjalizacja
function init(){
  // Trudność – ustaw z pamięci lub domyślnie easy
  const storedDiff = localStorage.getItem('bj_diff') || 'easy';
  if (difficultySel) difficultySel.value = storedDiff;

  // Pierwsze uruchomienie: ustaw saldo dla wybranej trudności
  if (!localStorage.getItem('bj_seen')){
    const cfg = DIFFICULTY[storedDiff] || DIFFICULTY.easy;
    balance = cfg.bankroll;
    saveBalance();
    localStorage.setItem('bj_seen','1');
  }

  updateMoney();
  resetHands();
  setMsg('Ustaw zakład i kliknij Rozdaj.');
  applyDifficultyUI(storedDiff); // <— ustawia widoczność podpowiedzi
  updateAdvisor();
  updateBankrollAdvisor();

  // Zdarzenia UI gry
  dealBtn.addEventListener('click', startRound);
  hitBtn.addEventListener('click', hit);
  standBtn.addEventListener('click', stand);
  doubleBtn.addEventListener('click', doubleDown);
  newBtn.addEventListener('click', newRound);
  splitBtn.addEventListener('click', doSplit);

  // Zmiana poziomu trudności
  if (difficultySel){
    difficultySel.addEventListener('change', (e)=>{
      const next = e.target.value;
      const cfg = DIFFICULTY[next] || DIFFICULTY.easy;
      const ok = confirm(`Zmiana poziomu zresetuje saldo do ${cfg.bankroll} żetonów i wyczyści bieżącą rundę. Kontynuować?`);
      if (ok){
        setDifficulty(next, {resetBankroll:true});
      } else {
        // przywróć poprzednią wartość selektora
        difficultySel.value = localStorage.getItem('bj_diff') || 'easy';
      }
    });
  }

  window.addEventListener('keydown', (e)=>{
    if (state==='player'){
      if (e.key.toLowerCase() === 'h') hit();
      if (e.key.toLowerCase() === 's') stand();
      if (e.key.toLowerCase() === 'd') doubleDown();
      if (e.key.toLowerCase() === 'p') doSplit();
    }
  });

  chips.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if (state !== 'betting') return;
      if (btn.dataset.add){
        const add = Number(btn.dataset.add);
        if (balance >= bet + add){
          bet += add; updateMoney();
        }
      } else if (btn.dataset.clear){
        bet = 0; updateMoney();
      }
      setControls(); // wywoła też updateBankrollAdvisor
    });
  });

  const observer = new MutationObserver(()=>{
    if (state==='round-over'){
      newBtn.disabled = false;
      hitBtn.disabled = standBtn.disabled = doubleBtn.disabled = true;
    }
  });
  observer.observe(messageEl, {childList:true, subtree:true});

  setControls();
}

// Po załadowaniu
window.addEventListener('DOMContentLoaded', init);