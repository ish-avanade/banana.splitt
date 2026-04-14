'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Use a temp data file so tests don't touch real data
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-splitt-'));
const tmpData = path.join(tmpDir, 'trips.json');
process.env.DATA_FILE_OVERRIDE = tmpData;

// We need to require server AFTER setting the env var.
// The server exports `app` so we can use supertest-like helpers.
const { app, calculateBalances } = require('../server.js');

// ---------------------------------------------------------------------------
// Minimal HTTP helper (no external dependencies)
// ---------------------------------------------------------------------------

let server;
let baseUrl;

before(() => {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  return new Promise((resolve) => {
    server.close(resolve);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
  });
});

async function req(method, path, body) {
  const url = new URL(baseUrl + path);
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const { default: fetch } = await import('node-fetch').catch(() => ({ default: null }));
  // Fall back to native fetch (Node 18+)
  const fetchFn = fetch || globalThis.fetch;
  const res = await fetchFn(url.toString(), {
    ...opts,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

// ---------------------------------------------------------------------------
// Unit tests — calculateBalances
// ---------------------------------------------------------------------------

describe('calculateBalances', () => {
  it('returns empty balances for a trip with no expenses', () => {
    const trip = {
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      expenses: [],
    };
    const { balances, settlements } = calculateBalances(trip);
    assert.equal(balances.length, 2);
    assert.equal(balances[0].balance, 0);
    assert.equal(balances[1].balance, 0);
    assert.equal(settlements.length, 0);
  });

  it('calculates correct balances for a simple two-person split', () => {
    const trip = {
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      expenses: [
        {
          id: 'e1',
          amount: 100,
          paidBy: 'a',
          splitBetween: ['a', 'b'],
        },
      ],
    };
    const { balances, settlements } = calculateBalances(trip);
    const alice = balances.find((b) => b.id === 'a');
    const bob   = balances.find((b) => b.id === 'b');
    // Alice paid 100, owes 50 → net +50
    assert.equal(alice.balance, 50);
    // Bob owes 50 → net -50
    assert.equal(bob.balance, -50);
    assert.equal(settlements.length, 1);
    assert.equal(settlements[0].from, 'b');
    assert.equal(settlements[0].to, 'a');
    assert.equal(settlements[0].amount, 50);
  });

  it('minimises number of transactions for three people', () => {
    // Alice paid 90 for all three → each owes 30
    // Bob paid 30 for all three → each owes 10
    // Charlie paid nothing
    const trip = {
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
        { id: 'c', name: 'Charlie' },
      ],
      expenses: [
        { id: 'e1', amount: 90, paidBy: 'a', splitBetween: ['a', 'b', 'c'] },
        { id: 'e2', amount: 30, paidBy: 'b', splitBetween: ['a', 'b', 'c'] },
      ],
    };
    const { balances, settlements } = calculateBalances(trip);
    const alice   = balances.find((b) => b.id === 'a');
    const bob     = balances.find((b) => b.id === 'b');
    const charlie = balances.find((b) => b.id === 'c');

    // Alice: paid 90, share = 40 → +50
    assert.equal(alice.balance, 50);
    // Bob: paid 30, share = 40 → -10
    assert.equal(bob.balance, -10);
    // Charlie: paid 0, share = 40 → -40
    assert.equal(charlie.balance, -40);

    assert.ok(settlements.length <= 3, 'Should not require more than 3 settlements');
  });
});

// ---------------------------------------------------------------------------
// Integration tests — HTTP API
// ---------------------------------------------------------------------------

describe('Trips API', () => {
  let tripId;

  it('GET /api/trips returns empty array initially', async () => {
    const { status, body } = await req('GET', '/api/trips');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 0);
  });

  it('POST /api/trips creates a trip', async () => {
    const { status, body } = await req('POST', '/api/trips', {
      name: 'Paris Trip',
      description: 'Summer 2024',
      currency: 'EUR',
    });
    assert.equal(status, 201);
    assert.equal(body.name, 'Paris Trip');
    assert.equal(body.currency, 'EUR');
    assert.ok(body.id);
    tripId = body.id;
  });

  it('POST /api/trips returns 400 for missing name', async () => {
    const { status, body } = await req('POST', '/api/trips', { currency: 'USD' });
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  it('GET /api/trips/:id returns the trip', async () => {
    const { status, body } = await req('GET', `/api/trips/${tripId}`);
    assert.equal(status, 200);
    assert.equal(body.id, tripId);
    assert.equal(body.name, 'Paris Trip');
  });

  it('GET /api/trips/:id returns 404 for unknown id', async () => {
    const { status } = await req('GET', '/api/trips/nonexistent');
    assert.equal(status, 404);
  });

  it('PUT /api/trips/:id updates the trip', async () => {
    const { status, body } = await req('PUT', `/api/trips/${tripId}`, {
      description: 'Updated desc',
    });
    assert.equal(status, 200);
    assert.equal(body.description, 'Updated desc');
  });

  describe('Participants', () => {
    let aliceId, bobId;

    it('POST /api/trips/:id/participants adds a participant', async () => {
      const { status, body } = await req('POST', `/api/trips/${tripId}/participants`, {
        name: 'Alice',
      });
      assert.equal(status, 201);
      assert.equal(body.name, 'Alice');
      aliceId = body.id;

      const { body: b2 } = await req('POST', `/api/trips/${tripId}/participants`, {
        name: 'Bob',
      });
      bobId = b2.id;
    });

    it('POST /api/trips/:id/participants returns 400 for missing name', async () => {
      const { status } = await req('POST', `/api/trips/${tripId}/participants`, {});
      assert.equal(status, 400);
    });

    describe('Expenses', () => {
      let expenseId;

      it('POST /api/trips/:id/expenses adds an expense with foreign currency', async () => {
        const { status, body } = await req('POST', `/api/trips/${tripId}/expenses`, {
          description: 'Foreign Dinner',
          amount: 49.12,
          paidBy: aliceId,
          splitBetween: [aliceId, bobId],
          date: '2024-07-15',
          originalCurrency: 'USD',
          originalAmount: 45.00,
          convertedAmount: 49.12,
        });
        assert.equal(status, 201);
        assert.equal(body.description, 'Foreign Dinner');
        assert.equal(body.amount, 49.12);
        assert.equal(body.originalCurrency, 'USD');
        assert.equal(body.originalAmount, 45.00);
        assert.equal(body.convertedAmount, 49.12);
        // Clean up so it doesn't affect balance tests
        await req('DELETE', `/api/trips/${tripId}/expenses/${body.id}`);
      });

      it('POST /api/trips/:id/expenses adds an expense with category', async () => {
        const { status, body } = await req('POST', `/api/trips/${tripId}/expenses`, {
          description: 'Hotel',
          amount: 200,
          paidBy: aliceId,
          splitBetween: [aliceId, bobId],
          date: '2024-07-01',
          category: 'Accommodation',
        });
        assert.equal(status, 201);
        assert.equal(body.description, 'Hotel');
        assert.equal(body.amount, 200);
        assert.equal(body.category, 'Accommodation');
        expenseId = body.id;
      });

      it('POST /api/trips/:id/expenses rejects invalid paidBy', async () => {
        const { status } = await req('POST', `/api/trips/${tripId}/expenses`, {
          description: 'Taxi',
          amount: 20,
          paidBy: 'nonexistent',
          splitBetween: [aliceId],
        });
        assert.equal(status, 400);
      });

      it('GET /api/trips/:id/balances returns correct balances', async () => {
        const { status, body } = await req('GET', `/api/trips/${tripId}/balances`);
        assert.equal(status, 200);
        assert.ok(Array.isArray(body.balances));
        assert.ok(Array.isArray(body.settlements));
        const alice = body.balances.find((b) => b.id === aliceId);
        const bob   = body.balances.find((b) => b.id === bobId);
        assert.equal(alice.balance, 100);  // paid 200, owed 100 → +100
        assert.equal(bob.balance, -100);   // paid 0, owed 100 → -100
        assert.equal(body.settlements.length, 1);
        assert.equal(body.settlements[0].amount, 100);
      });

      it('PUT /api/trips/:id/expenses/:eid preserves original currency info', async () => {
        // Create a foreign-currency expense first
        const { body: fe } = await req('POST', `/api/trips/${tripId}/expenses`, {
          description: 'Museum',
          amount: 22.00,
          paidBy: aliceId,
          splitBetween: [aliceId],
          date: '2024-07-16',
          originalCurrency: 'GBP',
          originalAmount: 18.00,
          convertedAmount: 22.00,
        });
        // Update only the description — conversion data should survive
        const { status, body } = await req(
          'PUT',
          `/api/trips/${tripId}/expenses/${fe.id}`,
          { description: 'Museum Visit' }
        );
        assert.equal(status, 200);
        assert.equal(body.description, 'Museum Visit');
        assert.equal(body.originalCurrency, 'GBP');
        assert.equal(body.originalAmount, 18.00);
        assert.equal(body.convertedAmount, 22.00);
        // Clean up
        await req('DELETE', `/api/trips/${tripId}/expenses/${fe.id}`);
      });

      it('PUT /api/trips/:id/expenses/:eid updates an expense including category', async () => {
        const { status, body } = await req(
          'PUT',
          `/api/trips/${tripId}/expenses/${expenseId}`,
          { description: 'Hotel & Breakfast', amount: 250, category: 'Food & Drink' }
        );
        assert.equal(status, 200);
        assert.equal(body.description, 'Hotel & Breakfast');
        assert.equal(body.amount, 250);
        assert.equal(body.category, 'Food & Drink');
      });

      it('DELETE /api/trips/:id/expenses/:eid deletes an expense', async () => {
        const { status } = await req('DELETE', `/api/trips/${tripId}/expenses/${expenseId}`);
        assert.equal(status, 204);
      });

      it('DELETE /api/trips/:id/participants/:pid fails if participant has expenses', async () => {
        // Re-add an expense
        const { body: e } = await req('POST', `/api/trips/${tripId}/expenses`, {
          description: 'Dinner',
          amount: 60,
          paidBy: aliceId,
          splitBetween: [aliceId, bobId],
          date: '2024-07-02',
        });
        const { status } = await req('DELETE', `/api/trips/${tripId}/participants/${aliceId}`);
        assert.equal(status, 400);
        // Clean up
        await req('DELETE', `/api/trips/${tripId}/expenses/${e.id}`);
      });

      it('DELETE /api/trips/:id/participants/:pid removes a participant with no expenses', async () => {
        // Add a third participant, then remove
        const { body: charlie } = await req('POST', `/api/trips/${tripId}/participants`, {
          name: 'Charlie',
        });
        const { status } = await req('DELETE', `/api/trips/${tripId}/participants/${charlie.id}`);
        assert.equal(status, 204);
      });
    });
  });

  it('DELETE /api/trips/:id deletes the trip', async () => {
    const { status } = await req('DELETE', `/api/trips/${tripId}`);
    assert.equal(status, 204);
    const { status: s2 } = await req('GET', `/api/trips/${tripId}`);
    assert.equal(s2, 404);
  });
});

// ---------------------------------------------------------------------------
// AI parse-expense endpoint
// ---------------------------------------------------------------------------

describe('AI parse-expense', () => {
  let tripId, aliceId, bobId;

  before(async () => {
    const { body: trip } = await req('POST', '/api/trips', {
      name: 'AI Test Trip', currency: 'EUR',
    });
    tripId = trip.id;
    const { body: a } = await req('POST', `/api/trips/${tripId}/participants`, { name: 'Alice' });
    aliceId = a.id;
    const { body: b } = await req('POST', `/api/trips/${tripId}/participants`, { name: 'Bob' });
    bobId = b.id;
  });

  after(async () => {
    await req('DELETE', `/api/trips/${tripId}`);
  });

  it('GET /api/ai-enabled returns false when OPENAI_API_KEY is not set', async () => {
    const { status, body } = await req('GET', '/api/ai-enabled');
    assert.equal(status, 200);
    assert.equal(body.enabled, false);
  });

  it('POST /api/trips/:id/parse-expense returns 503 when OPENAI_API_KEY is not set', async () => {
    const { status, body } = await req('POST', `/api/trips/${tripId}/parse-expense`, {
      message: 'Alice paid 45 for dinner',
    });
    assert.equal(status, 503);
    assert.ok(body.error);
  });

  it('POST /api/trips/:id/parse-expense returns 404 for unknown trip', async () => {
    const { status } = await req('POST', '/api/trips/nonexistent/parse-expense', {
      message: 'Alice paid 45 for dinner',
    });
    assert.equal(status, 404);
  });

  it('POST /api/trips/:id/parse-expense returns 400 for missing message', async () => {
    const { status, body } = await req('POST', `/api/trips/${tripId}/parse-expense`, {});
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  it('POST /api/trips/:id/parse-expense returns 400 for empty message', async () => {
    const { status, body } = await req('POST', `/api/trips/${tripId}/parse-expense`, {
      message: '   ',
    });
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  // --- New behavior tests using MOCK_AI_RESPONSE ---

  it('parse-expense passes through currency field from AI response', async () => {
    process.env.MOCK_AI_RESPONSE = JSON.stringify([{
      description: 'food', amount: 20, paidBy: 'Alice',
      splitBetween: ['Alice', 'Bob'], date: '2024-03-01', currency: 'EUR',
    }]);
    try {
      const { status, body } = await req('POST', `/api/trips/${tripId}/parse-expense`, {
        message: 'Alice paid 20 euros for food',
      });
      assert.equal(status, 200);
      assert.equal(body.expenses.length, 1);
      assert.equal(body.expenses[0].currency, 'EUR');
      assert.equal(body.expenses[0].amount, 20);
    } finally {
      delete process.env.MOCK_AI_RESPONSE;
    }
  });

  it('parse-expense passes through foreign currency code (USD on EUR trip)', async () => {
    process.env.MOCK_AI_RESPONSE = JSON.stringify([{
      description: 'dinner', amount: 50, paidBy: 'Alice',
      splitBetween: ['Alice', 'Bob'], date: '2024-03-01', currency: 'USD',
    }]);
    try {
      const { status, body } = await req('POST', `/api/trips/${tripId}/parse-expense`, {
        message: 'Alice paid 50 dollars for dinner',
      });
      assert.equal(status, 200);
      assert.equal(body.expenses.length, 1);
      assert.equal(body.expenses[0].currency, 'USD');
    } finally {
      delete process.env.MOCK_AI_RESPONSE;
    }
  });

  it('parse-expense uses last expense date when AI returns no date', async () => {
    // Add an expense with a known date
    const { body: expense } = await req('POST', `/api/trips/${tripId}/expenses`, {
      description: 'taxi', amount: 10, paidBy: aliceId,
      splitBetween: [aliceId, bobId], date: '2024-06-15',
    });

    process.env.MOCK_AI_RESPONSE = JSON.stringify([{
      description: 'coffee', amount: 5, paidBy: 'Alice',
      splitBetween: ['Alice', 'Bob'],
      // no date field — server should default to last expense date
    }]);
    try {
      const { status, body } = await req('POST', `/api/trips/${tripId}/parse-expense`, {
        message: 'Alice paid 5 for coffee',
      });
      assert.equal(status, 200);
      assert.equal(body.expenses.length, 1);
      assert.equal(body.expenses[0].date, '2024-06-15');
    } finally {
      delete process.env.MOCK_AI_RESPONSE;
      // Clean up the expense
      await req('DELETE', `/api/trips/${tripId}/expenses/${expense.id}`);
    }
  });

  it('parse-expense auto-creates unknown participant and persists them', async () => {
    process.env.MOCK_AI_RESPONSE = JSON.stringify([{
      description: 'food', amount: 20, paidBy: 'Ish',
      splitBetween: ['Alice', 'Bob', 'Ish'], date: '2024-03-01', currency: 'EUR',
    }]);
    try {
      const { status, body } = await req('POST', `/api/trips/${tripId}/parse-expense`, {
        message: 'Ish paid 20 for food',
      });
      assert.equal(status, 200);
      assert.equal(body.expenses.length, 1);
      // paidBy should be a valid ID (not null)
      assert.ok(body.expenses[0].paidBy, 'paidBy should be set');
      assert.equal(body.expenses[0].paidByName, 'Ish');
      // splitBetween should include all three
      assert.equal(body.expenses[0].splitBetween.length, 3);

      // Verify the new participant persists in the trip
      const { body: trip } = await req('GET', `/api/trips/${tripId}`);
      assert.ok(trip.participants.some((p) => p.name === 'Ish'), 'Ish should be persisted as a participant');
    } finally {
      delete process.env.MOCK_AI_RESPONSE;
      // Remove the auto-created participant to keep state clean for other tests
      const { body: trip } = await req('GET', `/api/trips/${tripId}`);
      const ish = trip.participants.find((p) => p.name === 'Ish');
      if (ish) await req('DELETE', `/api/trips/${tripId}/participants/${ish.id}`);
    }
  });

  it('parse-expense returns all participants in splitBetween when AI does so', async () => {
    process.env.MOCK_AI_RESPONSE = JSON.stringify([{
      description: 'taxi', amount: 15, paidBy: 'Bob',
      splitBetween: ['Alice', 'Bob'], date: '2024-03-01', currency: 'EUR',
    }]);
    try {
      const { status, body } = await req('POST', `/api/trips/${tripId}/parse-expense`, {
        message: 'Bob paid 15 for taxi',
      });
      assert.equal(status, 200);
      assert.equal(body.expenses.length, 1);
      // All known participants should be in the split
      assert.ok(body.expenses[0].splitBetween.includes(aliceId));
      assert.ok(body.expenses[0].splitBetween.includes(bobId));
    } finally {
      delete process.env.MOCK_AI_RESPONSE;
    }
  });

  it('parse-expense defaults splitBetween to all participants when AI omits it', async () => {
    process.env.MOCK_AI_RESPONSE = JSON.stringify([{
      description: 'hotel', amount: 100, paidBy: 'Alice',
      // splitBetween intentionally omitted — server should default to all participants
      date: '2024-03-01', currency: 'EUR',
    }]);
    try {
      const { status, body } = await req('POST', `/api/trips/${tripId}/parse-expense`, {
        message: 'Alice paid 100 for hotel',
      });
      assert.equal(status, 200);
      assert.equal(body.expenses.length, 1);
      // Should default to all trip participants
      assert.ok(body.expenses[0].splitBetween.includes(aliceId));
      assert.ok(body.expenses[0].splitBetween.includes(bobId));
      assert.ok(body.expenses[0].splitBetween.length >= 2);
    } finally {
      delete process.env.MOCK_AI_RESPONSE;
    }
  });

  it('parse-expense normalises invalid currency code to trip currency', async () => {
    process.env.MOCK_AI_RESPONSE = JSON.stringify([{
      description: 'snack', amount: 5, paidBy: 'Alice',
      splitBetween: ['Alice', 'Bob'], date: '2024-03-01', currency: 'euros',
    }]);
    try {
      const { status, body } = await req('POST', `/api/trips/${tripId}/parse-expense`, {
        message: 'Alice paid 5 euros for snack',
      });
      assert.equal(status, 200);
      assert.equal(body.expenses.length, 1);
      // 'euros' is not a valid ISO code — should fall back to trip currency 'EUR'
      assert.equal(body.expenses[0].currency, 'EUR');
    } finally {
      delete process.env.MOCK_AI_RESPONSE;
    }
  });
});
