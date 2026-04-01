/* =============================================
   ROYAL 21 — PREMIUM BLACKJACK GAME LOGIC
   ============================================= */

'use strict';

// ── CONSTANTS ──────────────────────────────────────────────────────
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

// ── STATE ──────────────────────────────────────────────────────────
let state = {
  deck: [],
  dealerHand: [],
  playerHands: [[]],
  handBets: [0],
  currentHandIdx: 0,
  balance: 100_000,
  startBalance: 100_000,
  currentBet: 0,
  phase: 'bet',   // 'bet' | 'play' | 'done'
  insuranceBet: 0,
  stats: { hands: 0, wins: 0, losses: 0, pushes: 0, best: 0 }
};

// ── DECK ───────────────────────────────────────────────────────────
function newDeck() {
  const d = [];
  for (const s of SUITS)
    for (const r of RANKS)
      d.push({ r, s });
  shuffle(d);
  return d;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function draw() {
  if (state.deck.length < 20) state.deck = newDeck();
  return { ...state.deck.pop(), hidden: false };
}

// ── SCORING ────────────────────────────────────────────────────────
function cardValue(c) {
  if (['J','Q','K'].includes(c.r)) return 10;
  if (c.r === 'A') return 11;
  return parseInt(c.r);
}
function score(hand) {
  let sum = 0, aces = 0;
  for (const c of hand) {
    if (c.hidden) continue;
    if (c.r === 'A') aces++;
    sum += cardValue(c);
  }
  while (sum > 21 && aces > 0) { sum -= 10; aces--; }
  return sum;
}
function scoreStr(hand) {
  let sum = 0, aces = 0;
  for (const c of hand) {
    if (c.hidden) continue;
    if (c.r === 'A') aces++;
    sum += cardValue(c);
  }
  let soft = aces > 0;
  while (sum > 21 && aces > 0) { sum -= 10; aces--; soft = false; }
  if (soft && aces > 0 && sum < 21) return `${sum - 10}/${sum}`;
  return `${sum}`;
}
function isBlackjack(hand) {
  return hand.length === 2 && score(hand) === 21;
}

// ── FORMAT ─────────────────────────────────────────────────────────
function fmt(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n < 0 ? '-' : '') + '$' + (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 2) + 'M';
  if (abs >= 1_000)     return (n < 0 ? '-' : '') + '$' + (abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1) + 'K';
  return (n < 0 ? '-' : '') + '$' + abs.toLocaleString();
}

// ── DOM REFS ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
  balance:   $('balance-display'),
  bet:       $('bet-display'),
  pl:        $('pl-display'),
  sHands:    $('s-hands'),
  sRate:     $('s-rate'),
  sBest:     $('s-best'),
  sLast:     $('s-last'),
  dealerCards:   $('dealer-cards'),
  dealerScore:   $('dealer-score-badge'),
  playerWrap:    $('player-hands-wrap'),
  result:        $('result-display'),
  btnDeal:       $('btn-deal'),
  btnHit:        $('btn-hit'),
  btnStand:      $('btn-stand'),
  btnDouble:     $('btn-double'),
  btnSplit:      $('btn-split'),
  btnInsurance:  $('btn-insurance'),
  btnNext:       $('btn-next'),
  btnClear:      $('btn-clear-bet'),
  btnRebuy:      $('btn-rebuy'),
  btnManualAdd:  $('btn-manual-add'),
  betManual:     $('bet-manual'),
};

// ── CARD RENDERING ─────────────────────────────────────────────────
function isRed(c) { return c.s === '♥' || c.s === '♦'; }

function cardHTML(c) {
  if (c.hidden) {
    return `<div class="card"><div class="card-back"></div></div>`;
  }
  const colorCls = isRed(c) ? 'red' : 'black';
  return `
    <div class="card">
      <div class="card-face ${colorCls}">
        <div class="card-corner top">
          <div class="card-rank">${c.r}</div>
          <div class="card-suit-sm">${c.s}</div>
        </div>
        <div class="card-suit-lg">${c.s}</div>
        <div class="card-corner bot">
          <div class="card-rank">${c.r}</div>
          <div class="card-suit-sm">${c.s}</div>
        </div>
      </div>
    </div>`;
}

// ── RENDER DEALER ──────────────────────────────────────────────────
function renderDealer() {
  el.dealerCards.innerHTML = state.dealerHand.map(c => cardHTML(c)).join('');
  if (!state.dealerHand.length) { el.dealerScore.className = 'score-badge hidden'; return; }
  el.dealerScore.className = 'score-badge';
  const hasHidden = state.dealerHand.some(c => c.hidden);
  if (hasHidden) {
    el.dealerScore.textContent = '?';
    return;
  }
  const s = score(state.dealerHand);
  el.dealerScore.textContent = s > 21 ? 'BUST' : scoreStr(state.dealerHand);
  if (s > 21) el.dealerScore.classList.add('bust');
  else if (isBlackjack(state.dealerHand)) el.dealerScore.classList.add('bj');
  else if (s >= 18) el.dealerScore.classList.add('good');
}

// ── RENDER PLAYER HANDS ────────────────────────────────────────────
function renderPlayerHands() {
  el.playerWrap.innerHTML = '';
  state.playerHands.forEach((hand, i) => {
    const isActive = i === state.currentHandIdx && state.phase === 'play';
    const container = document.createElement('div');
    container.className = 'player-hand-container';

    const label = document.createElement('div');
    label.className = 'hand-label';
    label.textContent = state.playerHands.length > 1
      ? (isActive ? '▶ HAND ' : 'HAND ') + (i + 1)
      : 'YOUR HAND';

    const ring = document.createElement('div');
    ring.className = 'hand-active-ring' + (isActive ? ' active' : '');

    const cardsArea = document.createElement('div');
    cardsArea.className = 'cards-area';
    cardsArea.innerHTML = hand.map(c => cardHTML(c)).join('');

    ring.appendChild(cardsArea);

    const scoreBadge = document.createElement('div');
    const s = score(hand);
    scoreBadge.className = 'score-badge' + (!hand.length ? ' hidden' : '');
    if (s > 21) { scoreBadge.textContent = 'BUST'; scoreBadge.classList.add('bust'); }
    else if (isBlackjack(hand)) { scoreBadge.textContent = 'BJ!'; scoreBadge.classList.add('bj'); }
    else { scoreBadge.textContent = scoreStr(hand); }
    if (s >= 18 && s <= 21) scoreBadge.classList.add('good');

    container.appendChild(label);
    container.appendChild(ring);
    container.appendChild(scoreBadge);
    el.playerWrap.appendChild(container);
  });
}

// ── RENDER HUD ─────────────────────────────────────────────────────
function renderHUD() {
  el.balance.textContent = fmt(state.balance);
  el.bet.textContent = fmt(state.currentBet);

  // PL
  const pl = state.balance - state.startBalance;
  el.pl.textContent = (pl >= 0 ? '+' : '') + fmt(pl);
  el.pl.className = 'balance-amount ' + (pl > 0 ? 'green' : pl < 0 ? 'red' : '');

  // Stats
  const { hands, wins, losses, best } = state.stats;
  el.sHands.textContent = hands;
  el.sRate.textContent = hands ? Math.round((wins / hands) * 100) + '%' : '—';
  el.sBest.textContent = best > 0 ? fmt(best) : '—';
}

// ── SHOW RESULT ────────────────────────────────────────────────────
function showResult(text, type, lastText, lastColor) {
  el.result.textContent = text;
  el.result.className = `result-display ${type}`;
  setTimeout(() => { el.result.className = 'result-display hidden'; }, 2200);

  el.sLast.textContent = lastText;
  el.sLast.className = 'stat-val ' + lastColor;
}

// ── PHASE MANAGEMENT ───────────────────────────────────────────────
function setPhase(p) {
  state.phase = p;
  const btns = [el.btnDeal, el.btnHit, el.btnStand, el.btnDouble, el.btnSplit, el.btnInsurance, el.btnNext];
  btns.forEach(b => b.style.display = 'none');

  const chips = document.querySelectorAll('.chip');

  if (p === 'bet') {
    el.btnDeal.style.display = '';
    el.btnClear.style.display = '';
    chips.forEach(c => c.classList.remove('disabled'));
  } else if (p === 'play') {
    el.btnClear.style.display = 'none';
    chips.forEach(c => c.classList.add('disabled'));
    el.btnHit.style.display = '';
    el.btnStand.style.display = '';

    const hand = state.playerHands[state.currentHandIdx];
    const bet = state.handBets[state.currentHandIdx];

    // Double: only on first two cards if enough balance
    if (hand.length === 2 && state.balance >= bet) {
      el.btnDouble.style.display = '';
    }
    // Split: two cards of same rank, max 4 hands, enough balance
    if (hand.length === 2 && hand[0].r === hand[1].r && state.playerHands.length < 4 && state.balance >= bet) {
      el.btnSplit.style.display = '';
    }
    // Insurance: dealer shows A, first hand, first two cards, not yet insured
    if (state.currentHandIdx === 0 && hand.length === 2 && state.dealerHand[0].r === 'A' && state.insuranceBet === 0 && state.balance >= Math.floor(bet / 2)) {
      el.btnInsurance.style.display = '';
    }
  } else if (p === 'done') {
    el.btnNext.style.display = '';
    el.btnClear.style.display = 'none';
    chips.forEach(c => c.classList.add('disabled'));
  }
}

// ── DEAL ───────────────────────────────────────────────────────────
function startHand() {
  if (state.currentBet === 0) { flashMessage('Place a bet first!'); return; }
  if (state.currentBet > state.balance) { flashMessage('Insufficient balance!'); return; }

  state.balance -= state.currentBet;
  state.dealerHand = [draw(), { ...draw(), hidden: true }];
  state.playerHands = [[draw(), draw()]];
  state.handBets = [state.currentBet];
  state.currentHandIdx = 0;
  state.insuranceBet = 0;

  renderDealer();
  renderPlayerHands();
  renderHUD();
  setPhase('play');

  // Check player BJ immediately
  if (isBlackjack(state.playerHands[0])) {
    revealDealer();
  }
}

function flashMessage(msg) {
  el.result.textContent = msg;
  el.result.className = 'result-display push';
  setTimeout(() => el.result.className = 'result-display hidden', 1800);
}

// ── REVEAL DEALER ──────────────────────────────────────────────────
function revealDealer() {
  state.dealerHand.forEach(c => c.hidden = false);
  renderDealer();

  // If player has BJ, short-circuit
  if (isBlackjack(state.playerHands[0])) {
    const djBJ = isBlackjack(state.dealerHand);
    if (djBJ) {
      // Push on BJ vs BJ
      state.balance += state.handBets[0];
      state.stats.hands++; state.stats.pushes++;
      showResult('PUSH', 'push', 'Push', '');
    } else {
      const win = Math.floor(state.handBets[0] * 2.5);
      state.balance += win;
      const profit = win - state.handBets[0];
      state.stats.hands++; state.stats.wins++;
      if (profit > state.stats.best) state.stats.best = profit;
      showResult('BLACKJACK! ' + fmt(profit), 'bj', '+' + fmt(profit), 'green');
    }
    renderHUD();
    setPhase('done');
    return;
  }

  dealerPlay();
}

// ── DEALER PLAY ────────────────────────────────────────────────────
function dealerPlay() {
  while (score(state.dealerHand) < 17) {
    state.dealerHand.push(draw());
  }
  renderDealer();
  resolveAll();
}

// ── RESOLVE ────────────────────────────────────────────────────────
function resolveAll() {
  const ds = score(state.dealerHand);
  const dBust = ds > 21;
  const dBJ = isBlackjack(state.dealerHand);
  let totalNet = 0;
  let lastMsg = ''; let lastCls = '';

  for (let i = 0; i < state.playerHands.length; i++) {
    const hand = state.playerHands[i];
    const bet = state.handBets[i];
    const ps = score(hand);
    const pBust = ps > 21;
    const pBJ = isBlackjack(hand);
    let net = 0, msg = '';

    if (pBust)               { net = -bet; msg = 'BUST'; }
    else if (pBJ && !dBJ)    { net = Math.floor(bet * 1.5); msg = 'BLACKJACK!'; }
    else if (dBust)          { net = bet; msg = 'WIN!'; }
    else if (ps > ds)        { net = bet; msg = 'WIN!'; }
    else if (ps === ds)      { net = 0; msg = 'PUSH'; }
    else                     { net = -bet; msg = 'LOSE'; }

    state.balance += bet + net;
    totalNet += net;
    state.stats.hands++;

    if (net > 0) { state.stats.wins++; if (net > state.stats.best) state.stats.best = net; }
    else if (net < 0) state.stats.losses++;
    else state.stats.pushes++;

    if (i === 0) { lastMsg = msg; lastCls = net > 0 ? 'green' : net < 0 ? 'red' : ''; }
  }

  // Insurance payout
  if (state.insuranceBet > 0 && dBJ) {
    state.balance += state.insuranceBet * 3;
    totalNet += state.insuranceBet * 2;
  }

  // Pick result class
  let cls = totalNet > 0 ? 'win' : totalNet < 0 ? 'lose' : 'push';
  if (lastMsg === 'BLACKJACK!') cls = 'bj';
  const netStr = totalNet >= 0 ? '+' + fmt(totalNet) : '-' + fmt(-totalNet);
  showResult(lastMsg + (totalNet !== 0 ? ' ' + netStr : ''), cls, netStr, totalNet > 0 ? 'green' : totalNet < 0 ? 'red' : '');

  renderHUD();
  setPhase('done');
}

// ── PLAYER ACTIONS ─────────────────────────────────────────────────
function hit() {
  const hand = state.playerHands[state.currentHandIdx];
  hand.push(draw());
  renderPlayerHands();
  const s = score(hand);
  if (s >= 21) {
    advanceHand();
  } else {
    setPhase('play');
  }
}

function stand() {
  advanceHand();
}

function doubleDown() {
  const bet = state.handBets[state.currentHandIdx];
  if (state.balance < bet) return;
  state.balance -= bet;
  state.handBets[state.currentHandIdx] *= 2;
  state.currentBet += bet; // for display
  state.playerHands[state.currentHandIdx].push(draw());
  renderPlayerHands();
  renderHUD();
  advanceHand();
}

function split() {
  const idx = state.currentHandIdx;
  const hand = state.playerHands[idx];
  const bet = state.handBets[idx];
  if (state.balance < bet) return;
  state.balance -= bet;
  const newHand = [hand.splice(1, 1)[0]];
  hand.push(draw());
  newHand.push(draw());
  state.playerHands.splice(idx + 1, 0, newHand);
  state.handBets.splice(idx + 1, 0, bet);
  renderPlayerHands();
  renderHUD();
  setPhase('play');
}

function insurance() {
  const ins = Math.floor(state.handBets[0] / 2);
  if (state.balance < ins) return;
  state.balance -= ins;
  state.insuranceBet = ins;
  el.btnInsurance.style.display = 'none';
  renderHUD();
}

function advanceHand() {
  if (state.currentHandIdx < state.playerHands.length - 1) {
    state.currentHandIdx++;
    renderPlayerHands();
    setPhase('play');
  } else {
    revealDealer();
  }
}

function nextHand() {
  state.dealerHand = [];
  state.playerHands = [[]];
  state.handBets = [0];
  state.currentHandIdx = 0;
  state.insuranceBet = 0;
  renderDealer();
  renderPlayerHands();
  renderHUD();
  setPhase('bet');
  el.result.className = 'result-display hidden';
}

// ── BETTING ────────────────────────────────────────────────────────
function addBet(amount) {
  if (state.phase !== 'bet') return;
  const max = state.balance;
  state.currentBet = Math.min(state.currentBet + amount, max);
  animateBetDisplay();
  renderHUD();
}

function clearBet() {
  state.currentBet = 0;
  renderHUD();
}

function animateBetDisplay() {
  el.bet.classList.remove('pulsing');
  void el.bet.offsetWidth; // reflow
  el.bet.classList.add('pulsing');
  el.bet.className = 'balance-amount gold pulse-on-bet pulsing';
  setTimeout(() => { el.bet.className = 'balance-amount gold pulse-on-bet'; }, 400);
}

// ── EVENT LISTENERS ────────────────────────────────────────────────
document.querySelectorAll('.chip').forEach(c => {
  c.addEventListener('click', () => addBet(parseInt(c.dataset.val)));
});

el.btnClear.addEventListener('click', clearBet);
el.btnRebuy.addEventListener('click', () => { state.balance += 100_000; renderHUD(); });

el.btnManualAdd.addEventListener('click', () => {
  const v = parseInt(el.betManual.value);
  if (!v || v <= 0) return;
  addBet(v);
  el.betManual.value = '';
});
el.betManual.addEventListener('keydown', e => { if (e.key === 'Enter') el.btnManualAdd.click(); });

el.btnDeal.addEventListener('click', startHand);
el.btnHit.addEventListener('click', hit);
el.btnStand.addEventListener('click', stand);
el.btnDouble.addEventListener('click', doubleDown);
el.btnSplit.addEventListener('click', split);
el.btnInsurance.addEventListener('click', insurance);
el.btnNext.addEventListener('click', nextHand);

// ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (state.phase === 'play') {
    if (e.key === 'h' || e.key === 'H') hit();
    if (e.key === 's' || e.key === 'S') stand();
    if (e.key === 'd' || e.key === 'D') doubleDown();
  }
  if (state.phase === 'bet' && e.key === 'Enter') startHand();
  if (state.phase === 'done' && e.key === 'Enter') nextHand();
});

// ── INIT ───────────────────────────────────────────────────────────
state.deck = newDeck();
renderDealer();
renderPlayerHands();
renderHUD();
setPhase('bet');
