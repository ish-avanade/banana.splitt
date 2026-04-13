/* ============================================================
   banana.splitt — frontend application
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

    renderExpensesTab(trip, tripId);
    renderMembersTab(trip, tripId);
    await renderBalancesTab(tripId, trip.currency);
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

    const item = document.createElement('div');
    item.className = 'expense-item';
    item.innerHTML = `
      <div class="expense-icon">💸</div>
      <div class="expense-body">
        <div class="expense-desc">${escHtml(expense.description)}</div>
        <div class="expense-meta">
          Paid by <strong>${escHtml(payer?.name || '?')}</strong>
          · Split: ${escHtml(splitNames)}
          · <time>${expense.date}</time>
        </div>
      </div>
      <div class="expense-amount">${fmt(expense.amount, trip.currency)}</div>
      <div class="expense-actions">
        <button class="btn btn-ghost btn-sm edit-expense-btn" aria-label="Edit expense" title="Edit">✏️</button>
        <button class="btn btn-ghost btn-sm delete-expense-btn" aria-label="Delete expense" title="Delete">🗑️</button>
      </div>
    `;
    item.querySelector('.edit-expense-btn').addEventListener('click', () =>
      showEditExpenseModal(trip, expense, () => renderTripDetail(tripId))
    );
    item.querySelector('.delete-expense-btn').addEventListener('click', () =>
      confirmDeleteExpense(trip, expense, () => renderTripDetail(tripId))
    );
    list.appendChild(item);
  }
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

function expenseModalHTML(trip, expense) {
  const participants = trip.participants;
  const today = new Date().toISOString().split('T')[0];

  const splitIds = expense?.splitBetween || participants.map((p) => p.id);

  return `
    <h2 class="modal-title">${expense ? 'Edit Expense' : 'Add Expense'}</h2>
    <form id="expense-form">
      <div class="form-group">
        <label for="exp-desc">Description *</label>
        <input id="exp-desc" type="text" placeholder="e.g. Hotel, Dinner, Taxi…"
          value="${escAttr(expense?.description || '')}" required maxlength="120" />
      </div>
      <div class="form-group">
        <label for="exp-amount">Amount (${escHtml(trip.currency)}) *</label>
        <input id="exp-amount" type="number" step="0.01" min="0.01"
          value="${expense ? expense.amount : ''}" required placeholder="0.00" />
      </div>
      <div class="form-group">
        <label for="exp-date">Date</label>
        <input id="exp-date" type="date" value="${expense?.date || today}" />
      </div>
      <div class="form-group">
        <label for="exp-paidby">Paid by *</label>
        <select id="exp-paidby">
          ${participants.map((p) =>
            `<option value="${p.id}" ${expense?.paidBy === p.id ? 'selected' : ''}>${escHtml(p.name)}</option>`
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

function showAddExpenseModal(trip, onSuccess) {
  if (trip.participants.length === 0) {
    toast('Add members to the trip before adding expenses.', 'error');
    return;
  }
  openModal(expenseModalHTML(trip));
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
  document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = document.getElementById('exp-desc').value.trim();
    const amount      = parseFloat(document.getElementById('exp-amount').value);
    const date        = document.getElementById('exp-date').value;
    const paidBy      = document.getElementById('exp-paidby').value;
    const splitBetween = [...document.querySelectorAll('#split-checkboxes input:checked')]
      .map((cb) => cb.value);

    if (splitBetween.length === 0) {
      toast('Select at least one person to split with.', 'error');
      return;
    }

    try {
      if (expense) {
        await put(`/trips/${trip.id}/expenses/${expense.id}`, {
          description, amount, date, paidBy, splitBetween,
        });
        toast('Expense updated', 'success');
      } else {
        await post(`/trips/${trip.id}/expenses`, {
          description, amount, date, paidBy, splitBetween,
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
