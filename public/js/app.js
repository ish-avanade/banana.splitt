/* ============================================================
   banana/splitt — frontend application
   ============================================================ */
'use strict';

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Unknown error');
  return json;
}

const get  = (path)        => api('GET',    path);
const post = (path, body)  => api('POST',   path, body);
const put  = (path, body)  => api('PUT',    path, body);
const del  = (path)        => api('DELETE', path);

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------

function toast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast${type !== 'default' ? ' ' + type : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const overlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');

function openModal(html) {
  modalContent.innerHTML = html;
  overlay.classList.remove('hidden');
  const first = modalContent.querySelector('input, select, textarea');
  if (first) first.focus();
}

function closeModal() {
  overlay.classList.add('hidden');
  modalContent.innerHTML = '';
}

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ---------------------------------------------------------------------------
// Router (hash-based)
// ---------------------------------------------------------------------------

let currentTripId = null;

function navigate(hash) {
  location.hash = hash;
}

window.addEventListener('hashchange', render);
window.addEventListener('load', render);

function render() {
  const hash = location.hash.replace('#', '');
  if (hash.startsWith('trip/')) {
    const id = hash.replace('trip/', '');
    currentTripId = id;
    renderTripDetail(id);
  } else {
    currentTripId = null;
    renderHome();
  }
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

function setBreadcrumb(items) {
  const el = document.getElementById('breadcrumb');
  el.innerHTML = items
    .map((item, i) =>
      i < items.length - 1
        ? `<a href="${item.href}">${item.label}</a><span>/</span>`
        : `<span>${item.label}</span>`
    )
    .join('');
}

// Logo click → home
document.getElementById('logo-home').addEventListener('click', () => navigate(''));

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function cloneTemplate(id) {
  return document.importNode(document.getElementById(id).content, true);
}

function fmt(amount, currency) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Avatar colour palette (deterministic from name)
const PALETTE = [
  ['#FEF3C7','#78350f'], ['#D1FAE5','#065f46'], ['#DBEAFE','#1e3a8a'],
  ['#FCE7F3','#831843'], ['#EDE9FE','#4c1d95'], ['#FEE2E2','#7f1d1d'],
];
function avatarStyle(name) {
  const idx = (name.charCodeAt(0) || 0) % PALETTE.length;
  const [bg, color] = PALETTE[idx];
  return `background:${bg};color:${color}`;
}

// ---------------------------------------------------------------------------
// Expense categorizer
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: 'Food & Drink',  icon: '🍽️', color: '#F97316', keywords: ['dinner','lunch','breakfast','restaurant','cafe','coffee','bar','beer','wine','groceries','food','pizza','sushi','burger','snack','drink','brunch','bakery','meal','drinks','takeaway','takeout'] },
  { name: 'Transport',     icon: '🚗', color: '#3B82F6', keywords: ['taxi','uber','lyft','bus','train','metro','flight','gas','parking','car','fuel','subway','tram','ferry','bike','scooter','transport','transit','toll','rental','airport'] },
  { name: 'Accommodation', icon: '🏨', color: '#8B5CF6', keywords: ['hotel','hostel','airbnb','accommodation','motel','resort','apartment','lodge','inn','stay','room','villa'] },
  { name: 'Activities',    icon: '🎯', color: '#10B981', keywords: ['tour','ticket','museum','concert','show','activity','sport','game','park','attraction','event','festival','class','lesson','excursion','entrance','adventure','theatre','theater','cinema','movie'] },
  { name: 'Shopping',      icon: '🛍️', color: '#EC4899', keywords: ['shopping','shop','store','market','mall','souvenir','clothes','clothing','gift','buy','purchase','supermarket'] },
  { name: 'Other',         icon: '📦', color: '#9CA3AF', keywords: [] },
];

function categorize(description) {
  const lower = (description || '').toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) return cat.name;
  }
  return 'Other';
}

function categoryIcon(name) {
  return CATEGORIES.find((c) => c.name === name)?.icon || '📦';
}

function categoryColor(name) {
  return CATEGORIES.find((c) => c.name === name)?.color || '#9CA3AF';
}

// ---------------------------------------------------------------------------
// HOME PAGE
// ---------------------------------------------------------------------------

async function renderHome() {
  setBreadcrumb([{ label: 'Trips', href: '#' }]);
  const tpl = cloneTemplate('tpl-home');
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  main.appendChild(tpl);

  document.getElementById('btn-new-trip').addEventListener('click', showNewTripModal);

  try {
    const trips = await get('/trips');
    const grid = document.getElementById('trips-grid');
    const empty = document.getElementById('trips-empty');

    if (trips.length === 0) {
      empty.classList.remove('hidden');
      document.getElementById('btn-new-trip-empty').addEventListener('click', showNewTripModal);
    } else {
      for (const trip of trips) {
        const card = renderTripCard(trip);
        grid.appendChild(card);
      }
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderTripCard(trip) {
  const frag = cloneTemplate('tpl-trip-card');
  const card = frag.querySelector('.trip-card');
  card.dataset.tripId = trip.id;
  card.querySelector('.trip-card-name').textContent = trip.name;
  card.querySelector('.trip-card-desc').textContent = trip.description || '\u00a0';
  card.querySelector('.members-count').textContent  = trip.participantCount;
  card.querySelector('.expenses-count').textContent = trip.expenseCount;
  card.querySelector('.total-amount').textContent   = fmt(trip.totalAmount || 0, trip.currency);
  card.querySelector('.total-label').textContent    = trip.currency || 'total';

  card.querySelector('.open-trip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    navigate(`trip/${trip.id}`);
  });
  card.addEventListener('click', () => navigate(`trip/${trip.id}`));

  card.querySelector('.delete-trip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    confirmDeleteTrip(trip);
  });

  return frag;
}

function showNewTripModal() {
  openModal(`
    <h2 class="modal-title">New Trip</h2>
    <form id="new-trip-form">
      <div class="form-group">
        <label for="trip-name">Trip Name *</label>
        <input id="trip-name" type="text" placeholder="e.g. Paris Summer 2024" required maxlength="80" />
      </div>
      <div class="form-group">
        <label for="trip-desc">Description</label>
        <input id="trip-desc" type="text" placeholder="Optional description" maxlength="160" />
      </div>
      <div class="form-group">
        <label for="trip-currency">Currency</label>
        <select id="trip-currency">
          ${CURRENCIES.map((c) => `<option value="${c.code}">${c.code} — ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Trip</button>
      </div>
    </form>
  `);

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('new-trip-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = document.getElementById('trip-name').value.trim();
    const desc     = document.getElementById('trip-desc').value.trim();
    const currency = document.getElementById('trip-currency').value;
    try {
      await post('/trips', { name, description: desc, currency });
      closeModal();
      toast('Trip created! 🎉', 'success');
      renderHome();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function confirmDeleteTrip(trip) {
  openModal(`
    <h2 class="modal-title">Delete Trip?</h2>
    <p>Are you sure you want to delete <strong>${escHtml(trip.name)}</strong>?
    This will permanently remove all expenses and data for this trip.</p>
    <div class="form-actions" style="margin-top:1rem">
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
    </div>
  `);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    try {
      await del(`/trips/${trip.id}`);
      closeModal();
      toast('Trip deleted', 'default');
      renderHome();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ---------------------------------------------------------------------------
// TRIP DETAIL PAGE
// ---------------------------------------------------------------------------

let tripCache = null; // cached trip data for the active trip detail view

async function renderTripDetail(tripId) {
  const tpl = cloneTemplate('tpl-trip-detail');
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  main.appendChild(tpl);

  try {
    const trip = await get(`/trips/${tripId}`);
    tripCache = trip;
    setBreadcrumb([
      { label: 'Trips', href: '#' },
      { label: trip.name, href: `#trip/${trip.id}` },
    ]);

    main.querySelector('.trip-title').textContent = trip.name;
    main.querySelector('.trip-subtitle').textContent =
      [trip.description, trip.currency].filter(Boolean).join(' · ');

    // Tabs
    main.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Add expense button
    main.querySelector('#btn-add-expense').addEventListener('click', () =>
      showAddExpenseModal(trip, () => renderTripDetail(tripId))
    );

    // Add member button
    main.querySelector('#btn-add-member').addEventListener('click', () =>
      showAddMemberModal(trip, () => renderTripDetail(tripId))
    );

    // Share balances button
    main.querySelector('#btn-share-balances').addEventListener('click', () =>
      shareBalancesSummary(tripId, trip)
    );

    renderExpensesTab(trip, tripId);
    renderMembersTab(trip, tripId);
    renderDashboard(trip);
    await renderBalancesTab(tripId, trip.currency);
    await initAiChat(trip, tripId);
  } catch (err) {
    toast(err.message, 'error');
    navigate('');
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach((t) => {
    const isActive = t.dataset.tab === tabName;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive);
  });
  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.classList.toggle('hidden', p.id !== `tab-${tabName}`);
  });
}

// ---- Expenses tab ----

function renderExpensesTab(trip, tripId) {
  const list  = document.getElementById('expenses-list');
  const empty = document.getElementById('expenses-empty');
  list.innerHTML = '';

  if (trip.expenses.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Sort by date desc
  const sorted = [...trip.expenses].sort((a, b) => b.date.localeCompare(a.date));
  for (const expense of sorted) {
    const payer = trip.participants.find((p) => p.id === expense.paidBy);
    const splitNames = expense.splitBetween
      .map((id) => trip.participants.find((p) => p.id === id)?.name || '?')
      .join(', ');

    const catName = expense.category || categorize(expense.description);
    const item = document.createElement('div');
    item.className = 'expense-item';

    // Determine whether to show dual-currency display safely via DOM (not innerHTML)
    const showConversion = expense.originalCurrency
      && expense.originalCurrency !== trip.currency
      && typeof expense.originalAmount === 'number';

    // Use a placeholder token that we'll replace via DOM after setting innerHTML
    item.innerHTML = `
      <div class="expense-icon">${categoryIcon(catName)}</div>
      <div class="expense-body">
        <div class="expense-desc">${escHtml(expense.description)}</div>
        <div class="expense-meta">
          Paid by <strong>${escHtml(payer?.name || '?')}</strong>
          · Split: ${escHtml(splitNames)}
          · <time>${expense.date}</time>
        </div>
      </div>
      <div class="expense-amount"></div>
      <div class="expense-actions">
        <button class="btn btn-ghost btn-sm edit-expense-btn" aria-label="Edit expense" title="Edit">✏️</button>
        <button class="btn btn-ghost btn-sm delete-expense-btn" aria-label="Delete expense" title="Delete">🗑️</button>
      </div>
    `;

    // Populate amount cell with safe DOM nodes to avoid Intl.NumberFormat throws and XSS
    const amountCell = item.querySelector('.expense-amount');
    if (showConversion) {
      let origText, convText;
      try { origText = fmt(expense.originalAmount, expense.originalCurrency); } catch { origText = String(expense.originalAmount); }
      try { convText = fmt(expense.amount, trip.currency); } catch { convText = String(expense.amount); }
      amountCell.appendChild(document.createTextNode(origText));
      const note = document.createElement('span');
      note.className = 'conversion-note';
      note.textContent = `(≈ ${convText})`;
      amountCell.appendChild(note);
    } else {
      let mainText;
      try { mainText = fmt(expense.amount, trip.currency); } catch { mainText = String(expense.amount); }
      amountCell.textContent = mainText;
    }
    item.querySelector('.edit-expense-btn').addEventListener('click', () =>
      showEditExpenseModal(trip, expense, () => renderTripDetail(tripId))
    );
    item.querySelector('.delete-expense-btn').addEventListener('click', () =>
      confirmDeleteExpense(trip, expense, () => renderTripDetail(tripId))
    );
    list.appendChild(item);
  }
}

// ---- Dashboard + Pie chart ----

const PIE_COLORS = [
  '#FBBF24', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6',
  '#F97316', '#EC4899', '#14B8A6', '#6366F1', '#F59E0B',
  '#06B6D4', '#84CC16', '#E11D48', '#A855F7', '#22D3EE',
];

function renderDashboard(trip) {
  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const memberCount = trip.participants.length;
  document.getElementById('dash-total').textContent = fmt(total, trip.currency);
  document.getElementById('dash-expense-count').textContent = trip.expenses.length;
  document.getElementById('dash-member-count').textContent = memberCount;
  document.getElementById('dash-avg').textContent =
    memberCount > 0 ? fmt(total / memberCount, trip.currency) : fmt(0, trip.currency);

  // Spending per member (who paid)
  const spentByPayer = {};
  for (const p of trip.participants) spentByPayer[p.id] = { name: p.name, amount: 0 };
  for (const e of trip.expenses) {
    if (spentByPayer[e.paidBy]) spentByPayer[e.paidBy].amount += e.amount;
  }

  const slices = Object.values(spentByPayer)
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const chartSection = document.getElementById('chart-section');
  if (slices.length === 0) {
    chartSection.classList.add('hidden');
    return;
  }
  chartSection.classList.remove('hidden');

  const canvas     = document.getElementById('pie-chart');
  const legendEl   = document.getElementById('chart-legend');
  const togglePayer = document.getElementById('chart-toggle-payer');
  const toggleCat   = document.getElementById('chart-toggle-category');

  function showPayerChart() {
    togglePayer.classList.add('active');
    toggleCat.classList.remove('active');
    drawPieChart(canvas, slices, trip.currency);
    renderChartLegend(legendEl, slices, total, trip.currency);
  }

  function showCategoryChart() {
    togglePayer.classList.remove('active');
    toggleCat.classList.add('active');
    renderCategoryChart(canvas, legendEl, trip);
  }

  togglePayer.addEventListener('click', showPayerChart);
  toggleCat.addEventListener('click', showCategoryChart);

  showPayerChart();
}

function renderCategoryChart(canvas, legendContainer, trip) {
  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = {};
  for (const e of trip.expenses) {
    const catName = e.category || categorize(e.description);
    byCategory[catName] = (byCategory[catName] || 0) + e.amount;
  }

  const slices = CATEGORIES
    .filter((cat) => byCategory[cat.name] > 0)
    .map((cat) => ({
      name: `${cat.icon} ${cat.name}`,
      amount: byCategory[cat.name],
      color: cat.color,
    }))
    .sort((a, b) => b.amount - a.amount);

  drawPieChart(canvas, slices, trip.currency);
  renderChartLegend(legendContainer, slices, total, trip.currency);
}

function drawPieChart(canvas, slices, currency) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = 260;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const radius = 110;
  const innerRadius = 60;
  const total = slices.reduce((s, sl) => s + sl.amount, 0);

  let startAngle = -Math.PI / 2;
  slices.forEach((slice, i) => {
    const sliceAngle = (slice.amount / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color || PIE_COLORS[i % PIE_COLORS.length];
    ctx.fill();

    // Subtle separator
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    startAngle = endAngle;
  });

  // Center label
  ctx.fillStyle = '#111827';
  ctx.font = '700 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Total', cx, cy - 10);
  ctx.font = '800 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(fmt(total, currency), cx, cy + 12);
}

function renderChartLegend(container, slices, total, currency) {
  container.innerHTML = '';
  slices.forEach((slice, i) => {
    const pct = ((slice.amount / total) * 100).toFixed(1);
    const color = slice.color || PIE_COLORS[i % PIE_COLORS.length];
    const div = document.createElement('div');
    div.className = 'legend-item';
    div.innerHTML = `
      <span class="legend-dot" style="background:${color}"></span>
      <span class="legend-name">${escHtml(slice.name)}</span>
      <span class="legend-value">${fmt(slice.amount, currency)}</span>
      <span class="legend-pct">${pct}%</span>
    `;
    container.appendChild(div);
  });
}

// ---- Balances tab ----

async function renderBalancesTab(tripId, currency) {
  try {
    const { balances, settlements } = await get(`/trips/${tripId}/balances`);
    const balList = document.getElementById('balances-list');
    const setList = document.getElementById('settlements-list');
    const setEmpty = document.getElementById('settlements-empty');

    balList.innerHTML = '';
    setList.innerHTML = '';

    for (const b of balances) {
      const cls = b.balance > 0.005 ? 'positive' : b.balance < -0.005 ? 'negative' : 'neutral';
      const label = b.balance > 0.005 ? 'gets back' : b.balance < -0.005 ? 'owes' : 'settled';
      const div = document.createElement('div');
      div.className = `balance-item ${cls}`;
      div.innerHTML = `
        <div class="balance-avatar" style="${avatarStyle(b.name)}">${initials(b.name)}</div>
        <span class="balance-name">${escHtml(b.name)}</span>
        <span class="balance-amount">${fmt(Math.abs(b.balance), currency)}</span>
        <span class="balance-label">${label}</span>
      `;
      balList.appendChild(div);
    }

    if (settlements.length === 0) {
      setEmpty.classList.remove('hidden');
    } else {
      setEmpty.classList.add('hidden');
      for (const s of settlements) {
        const div = document.createElement('div');
        div.className = 'settlement-item';
        div.innerHTML = `
          <span class="settlement-from">${escHtml(s.fromName)}</span>
          <span class="settlement-arrow">→</span>
          pays
          <span class="settlement-amount">${fmt(s.amount, currency)}</span>
          <span class="settlement-arrow">→</span>
          to
          <span class="settlement-to">${escHtml(s.toName)}</span>
        `;
        setList.appendChild(div);
      }
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ---- Share balances ----

async function shareBalancesSummary(tripId, trip) {
  try {
    const { balances, settlements } = await get(`/trips/${tripId}/balances`);
    let text = `🍌 ${trip.name} — Balance Summary\n`;
    text += '━'.repeat(30) + '\n\n';

    text += '⚖️ Balances:\n';
    for (const b of balances) {
      const sign = b.balance > 0.005 ? '+' : '';
      text += `  ${b.name}: ${sign}${fmt(Math.abs(b.balance), trip.currency)}`;
      if (b.balance > 0.005) text += ' (gets back)';
      else if (b.balance < -0.005) text += ' (owes)';
      else text += ' (settled)';
      text += '\n';
    }

    if (settlements.length > 0) {
      text += '\n💸 Payments needed:\n';
      for (const s of settlements) {
        text += `  ${s.fromName} → pays ${fmt(s.amount, trip.currency)} → ${s.toName}\n`;
      }
    } else {
      text += '\n🎉 All settled up!\n';
    }

    if (navigator.share) {
      await navigator.share({ title: `${trip.name} — Balances`, text });
    } else {
      await navigator.clipboard.writeText(text);
      toast('Summary copied to clipboard!', 'success');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      toast(err.message, 'error');
    }
  }
}

// ---- Members tab ----

function renderMembersTab(trip, tripId) {
  const list  = document.getElementById('members-list');
  const empty = document.getElementById('members-empty');
  list.innerHTML = '';

  if (trip.participants.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  for (const p of trip.participants) {
    const item = document.createElement('div');
    item.className = 'member-item';
    item.innerHTML = `
      <div class="member-avatar" style="${avatarStyle(p.name)}">${initials(p.name)}</div>
      <span class="member-name">${escHtml(p.name)}</span>
      <div class="member-actions">
        <button class="btn btn-ghost btn-sm remove-member-btn" aria-label="Remove member" title="Remove">🗑️</button>
      </div>
    `;
    item.querySelector('.remove-member-btn').addEventListener('click', () =>
      confirmRemoveMember(trip, p, () => renderTripDetail(tripId))
    );
    list.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// MODALS — Add / Edit Expense
// ---------------------------------------------------------------------------

function expenseModalHTML(trip, expense, prefill = null) {
  const participants = trip.participants;
  const today = new Date().toISOString().split('T')[0];

  // `vals` provides default values: editing an existing expense takes priority,
  // then AI-prefilled data, then blank.
  const vals = expense || prefill;
  const splitIds = vals?.splitBetween || participants.map((p) => p.id);

  // When editing, show original amount if a foreign currency was used
  const displayAmount = expense?.originalAmount ?? (expense ? expense.amount : (vals?.amount || ''));
  const expCurrency = expense?.originalCurrency || trip.currency;
  const currentCat = expense?.category || categorize(vals?.description || '');

  return `
    <h2 class="modal-title">${expense ? 'Edit Expense' : 'Add Expense'}</h2>
    <form id="expense-form">
      <div class="form-group">
        <label for="exp-desc">Description *</label>
        <input id="exp-desc" type="text" placeholder="e.g. Hotel, Dinner, Taxi…"
          value="${escAttr(vals?.description || '')}" required maxlength="120" />
      </div>
      <div class="form-group">
        <label for="exp-amount">Amount *</label>
        <div style="display:flex;gap:.5rem;align-items:center">
          <input id="exp-amount" type="number" step="0.01" min="0.01"
            value="${escAttr(String(displayAmount))}" required placeholder="0.00" style="flex:1" />
          <select id="exp-currency" style="width:7rem">
            ${CURRENCIES.map((c) =>
              `<option value="${c.code}"${c.code === expCurrency ? ' selected' : ''}>${c.code}</option>`
            ).join('')}
          </select>
        </div>
        <div id="conversion-preview" style="font-size:.8rem;color:var(--text-muted);margin-top:.25rem;min-height:1.2em"></div>
      </div>
      <div class="form-group">
        <label for="exp-category">Category</label>
        <select id="exp-category">
          ${CATEGORIES.map((c) => `<option value="${escAttr(c.name)}"${currentCat === c.name ? ' selected' : ''}>${c.icon} ${escHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="exp-date">Date</label>
        <input id="exp-date" type="date" value="${vals?.date || today}" />
      </div>
      <div class="form-group">
        <label for="exp-paidby">Paid by *</label>
        <select id="exp-paidby">
          ${participants.map((p) =>
            `<option value="${p.id}" ${vals?.paidBy === p.id ? 'selected' : ''}>${escHtml(p.name)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Split between
          <button type="button" class="split-all-btn" id="split-all-btn">select all</button>
        </label>
        <div class="split-checkboxes" id="split-checkboxes">
          ${participants.map((p) => `
            <label class="split-checkbox-label">
              <input type="checkbox" name="split" value="${p.id}"
                ${splitIds.includes(p.id) ? 'checked' : ''} />
              ${escHtml(p.name)}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${expense ? 'Save Changes' : 'Add Expense'}</button>
      </div>
    </form>
  `;
}

function showAddExpenseModal(trip, onSuccess, prefill = null) {
  if (trip.participants.length === 0) {
    toast('Add members to the trip before adding expenses.', 'error');
    return;
  }
  openModal(expenseModalHTML(trip, null, prefill));
  attachExpenseFormHandlers(trip, null, onSuccess);
}

function showEditExpenseModal(trip, expense, onSuccess) {
  openModal(expenseModalHTML(trip, expense));
  attachExpenseFormHandlers(trip, expense, onSuccess);
}

function attachExpenseFormHandlers(trip, expense, onSuccess) {
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('split-all-btn').addEventListener('click', () => {
    document.querySelectorAll('#split-checkboxes input[type=checkbox]').forEach((cb) => {
      cb.checked = true;
    });
  });

  // Auto-categorize when description changes (only for new expenses)
  if (!expense) {
    document.getElementById('exp-desc').addEventListener('input', () => {
      const desc = document.getElementById('exp-desc').value.trim();
      document.getElementById('exp-category').value = categorize(desc);
    });
  }

  // Live conversion preview
  let conversionRate = null;
  let lastConvertedAmount = null;
  let conversionTimeout = null;

  async function updateConversionPreview() {
    const amountVal = parseFloat(document.getElementById('exp-amount').value);
    const expCurrency = document.getElementById('exp-currency').value;
    const dateVal = document.getElementById('exp-date').value;
    const preview = document.getElementById('conversion-preview');

    if (expCurrency === trip.currency || !amountVal || amountVal <= 0) {
      preview.textContent = '';
      conversionRate = null;
      lastConvertedAmount = null;
      return;
    }

    preview.textContent = 'Fetching rate…';
    try {
      const date = dateVal || new Date().toISOString().split('T')[0];
      const url = `https://api.frankfurter.dev/v1/${date}?from=${expCurrency}&to=${trip.currency}&amount=${amountVal}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Rate unavailable');
      const data = await res.json();
      const converted = data.rates[trip.currency];
      if (typeof converted !== 'number') throw new Error('Rate unavailable');
      conversionRate = converted / amountVal;
      lastConvertedAmount = Math.round(converted * 100) / 100;
      preview.textContent = `≈ ${fmt(lastConvertedAmount, trip.currency)} at ${conversionRate.toFixed(4)} rate`;
    } catch {
      conversionRate = null;
      lastConvertedAmount = null;
      preview.textContent = 'Could not fetch rate — will use 1:1';
    }
  }

  function schedulePreviewUpdate() {
    clearTimeout(conversionTimeout);
    conversionTimeout = setTimeout(updateConversionPreview, 500);
  }

  document.getElementById('exp-amount').addEventListener('input', schedulePreviewUpdate);
  document.getElementById('exp-currency').addEventListener('change', updateConversionPreview);
  document.getElementById('exp-date').addEventListener('change', updateConversionPreview);

  // Show initial preview if editing a foreign-currency expense
  if (expense?.originalCurrency && expense.originalCurrency !== trip.currency) {
    const preview = document.getElementById('conversion-preview');
    const rate = expense.originalAmount > 0
      ? (expense.convertedAmount / expense.originalAmount).toFixed(4)
      : '1.0000';
    preview.textContent = `≈ ${fmt(expense.convertedAmount, trip.currency)} at ${rate} rate`;
  }

  document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = document.getElementById('exp-desc').value.trim();
    const date        = document.getElementById('exp-date').value;
    const paidBy      = document.getElementById('exp-paidby').value;
    const expCurrency = document.getElementById('exp-currency').value;
    const rawAmount   = parseFloat(document.getElementById('exp-amount').value);
    const category    = document.getElementById('exp-category').value;
    const splitBetween = [...document.querySelectorAll('#split-checkboxes input:checked')]
      .map((cb) => cb.value);

    if (splitBetween.length === 0) {
      toast('Select at least one person to split with.', 'error');
      return;
    }

    // Determine final amount in trip currency and optional conversion fields
    let amount = rawAmount;
    let extraFields = {};

    if (expCurrency !== trip.currency) {
      if (conversionRate !== null) {
        // Use lastConvertedAmount when amount matches the preview, else reapply rate
        const previewAmount = parseFloat(document.getElementById('exp-amount').value);
        amount = lastConvertedAmount !== null && previewAmount === rawAmount
          ? lastConvertedAmount
          : Math.round(rawAmount * conversionRate * 100) / 100;
      } else {
        // Fallback: try one more fetch; if fails, use 1:1
        try {
          const date2 = date || new Date().toISOString().split('T')[0];
          const url = `https://api.frankfurter.dev/v1/${date2}?from=${expCurrency}&to=${trip.currency}&amount=${rawAmount}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('rate fetch failed');
          const data = await res.json();
          const converted = data.rates?.[trip.currency];
          if (typeof converted !== 'number') throw new Error('rate missing');
          amount = Math.round(converted * 100) / 100;
        } catch {
          toast('Exchange rate unavailable — using 1:1 conversion', 'error');
        }
      }
      extraFields = {
        originalCurrency: expCurrency,
        originalAmount: rawAmount,
        convertedAmount: amount,
      };
    } else {
      // Same currency — clear any previous conversion data when editing
      if (expense?.originalCurrency) {
        extraFields = { originalCurrency: trip.currency };
      }
    }

    try {
      if (expense) {
        await put(`/trips/${trip.id}/expenses/${expense.id}`, {
          description, amount, date, paidBy, splitBetween, category, ...extraFields,
        });
        toast('Expense updated', 'success');
      } else {
        await post(`/trips/${trip.id}/expenses`, {
          description, amount, date, paidBy, splitBetween, category, ...extraFields,
        });
        toast('Expense added 💸', 'success');
      }
      closeModal();
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function confirmDeleteExpense(trip, expense, onSuccess) {
  openModal(`
    <h2 class="modal-title">Delete Expense?</h2>
    <p>Delete <strong>${escHtml(expense.description)}</strong>
    (${fmt(expense.amount, trip.currency)})?</p>
    <div class="form-actions" style="margin-top:1rem">
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
    </div>
  `);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    try {
      await del(`/trips/${trip.id}/expenses/${expense.id}`);
      closeModal();
      toast('Expense deleted', 'default');
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ---------------------------------------------------------------------------
// MODALS — Members
// ---------------------------------------------------------------------------

function showAddMemberModal(trip, onSuccess) {
  openModal(`
    <h2 class="modal-title">Add Member</h2>
    <form id="add-member-form">
      <div class="form-group">
        <label for="member-name">Name *</label>
        <input id="member-name" type="text" placeholder="e.g. Alice" required maxlength="60" />
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Member</button>
      </div>
    </form>
  `);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('add-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('member-name').value.trim();
    try {
      await post(`/trips/${trip.id}/participants`, { name });
      closeModal();
      toast(`${name} added 👋`, 'success');
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function confirmRemoveMember(trip, participant, onSuccess) {
  openModal(`
    <h2 class="modal-title">Remove Member?</h2>
    <p>Remove <strong>${escHtml(participant.name)}</strong> from this trip?</p>
    <p style="margin-top:.5rem;color:var(--text-muted);font-size:.85rem">
      Members with associated expenses cannot be removed.</p>
    <div class="form-actions" style="margin-top:1rem">
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-danger" id="confirm-remove-btn">Remove</button>
    </div>
  `);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('confirm-remove-btn').addEventListener('click', async () => {
    try {
      await del(`/trips/${trip.id}/participants/${participant.id}`);
      closeModal();
      toast(`${participant.name} removed`, 'default');
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ---------------------------------------------------------------------------
// AI CHAT — Natural language expense entry
// ---------------------------------------------------------------------------

async function initAiChat(trip, tripId) {
  const chatBar = document.getElementById('ai-chat-bar');
  if (!chatBar) return;

  try {
    const { enabled } = await get('/ai-enabled');
    if (!enabled) return;
  } catch {
    return;
  }

  chatBar.classList.remove('hidden');

  const form    = document.getElementById('ai-chat-form');
  const input   = document.getElementById('ai-chat-input');
  const results = document.getElementById('ai-parsed-results');
  const sendBtn = form.querySelector('.ai-chat-send');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    sendBtn.disabled = true;
    sendBtn.textContent = '…';
    results.innerHTML = '';

    try {
      const { expenses } = await post(`/trips/${tripId}/parse-expense`, { message });

      if (!expenses || expenses.length === 0) {
        toast('Could not parse any expenses. Try being more specific or use the form.', 'error');
        return;
      }

      input.value = '';
      for (const expense of expenses) {
        results.appendChild(renderAiExpenseCard(trip, expense, tripId));
      }
    } catch {
      toast('Could not parse the message — try the form instead.', 'error');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    }
  });
}

function renderAiExpenseCard(trip, parsed, tripId) {
  const card = document.createElement('div');
  card.className = 'ai-expense-card';

  const payerName      = parsed.paidByName || '?';
  const splitNames     = parsed.splitBetweenNames?.join(', ') || '?';
  // Validate parsed currency (must be a 3-letter ISO code present in the known list); fall back to trip currency
  const parsedCurrency = (parsed.currency && /^[A-Z]{3}$/.test(parsed.currency)) ? parsed.currency : null;
  const displayCurrency = parsedCurrency || trip.currency;
  const currencyMismatch = parsedCurrency && parsedCurrency !== trip.currency;

  card.innerHTML = `
    <div class="ai-expense-card-body">
      <div class="ai-expense-card-desc">${escHtml(parsed.description || 'Untitled')}</div>
      <div class="ai-expense-card-meta">
        Paid by <strong>${escHtml(payerName)}</strong>
        · Split: ${escHtml(splitNames)}
        · <time>${escHtml(parsed.date || '')}</time>
        ${currencyMismatch ? `· <span class="ai-currency-warning">⚠ Currency: ${escHtml(parsed.currency)} (trip uses ${escHtml(trip.currency)})</span>` : ''}
      </div>
    </div>
    <div class="ai-expense-card-amount">${fmt(parsed.amount || 0, displayCurrency)}</div>
    <div class="ai-expense-card-actions">
      <button class="btn btn-primary btn-sm ai-add-btn">Add</button>
      <button class="btn btn-secondary btn-sm ai-edit-btn">Edit</button>
      <button class="btn btn-ghost btn-sm ai-dismiss-btn" aria-label="Dismiss">✕</button>
    </div>
  `;

  card.querySelector('.ai-add-btn').addEventListener('click', async () => {
    if (!parsed.paidBy || !parsed.splitBetween?.length) {
      toast('Could not match all participant names — use Edit to fill in manually.', 'error');
      return;
    }
    const btn = card.querySelector('.ai-add-btn');
    btn.disabled = true;
    btn.textContent = '…';
    try {
      let amount = parsed.amount;
      const extraFields = {};

      if (currencyMismatch) {
        const date = parsed.date || new Date().toISOString().split('T')[0];
        const convUrl = new URL(`https://api.frankfurter.dev/v1/${encodeURIComponent(date)}`);
        convUrl.searchParams.set('from', parsedCurrency);
        convUrl.searchParams.set('to', trip.currency);
        convUrl.searchParams.set('amount', String(parsed.amount));
        const convRes = await fetch(convUrl);
        if (!convRes.ok) throw new Error('Could not fetch currency conversion');
        const convData = await convRes.json();
        const converted = convData.rates?.[trip.currency];
        if (typeof converted !== 'number' || !Number.isFinite(converted)) {
          throw new Error(`Could not convert ${parsedCurrency} to ${trip.currency}`);
        }
        const convertedAmount = Math.round(converted * 100) / 100;
        amount = convertedAmount;
        extraFields.originalCurrency = parsedCurrency;
        extraFields.originalAmount   = parsed.amount;
        extraFields.convertedAmount  = convertedAmount;
      }

      await post(`/trips/${tripId}/expenses`, {
        description:   parsed.description,
        amount,
        paidBy:        parsed.paidBy,
        splitBetween:  parsed.splitBetween,
        date:          parsed.date,
        ...extraFields,
      });
      toast('Expense added 💸', 'success');
      card.remove();
      renderTripDetail(tripId);
    } catch (err) {
      toast(err.message || 'Could not add expense', 'error');
      btn.disabled = false;
      btn.textContent = 'Add';
    }
  });

  card.querySelector('.ai-edit-btn').addEventListener('click', async () => {
    // Re-fetch the trip so the edit modal sees any participants that were auto-created during parsing
    let latestTrip = trip;
    try { latestTrip = await get(`/trips/${tripId}`); } catch { /* fall back to current trip */ }
    showAddExpenseModal(latestTrip, () => {
      card.remove();
      renderTripDetail(tripId);
    }, parsed);
  });

  card.querySelector('.ai-dismiss-btn').addEventListener('click', () => card.remove());

  return card;
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Currency list
// ---------------------------------------------------------------------------

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'DKK', name: 'Danish Krone' },
];
