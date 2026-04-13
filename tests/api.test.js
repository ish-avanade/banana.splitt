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

      it('POST /api/trips/:id/expenses adds an expense', async () => {
        const { status, body } = await req('POST', `/api/trips/${tripId}/expenses`, {
          description: 'Hotel',
          amount: 200,
          paidBy: aliceId,
          splitBetween: [aliceId, bobId],
          date: '2024-07-01',
        });
        assert.equal(status, 201);
        assert.equal(body.description, 'Hotel');
        assert.equal(body.amount, 200);
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

      it('PUT /api/trips/:id/expenses/:eid updates an expense', async () => {
        const { status, body } = await req(
          'PUT',
          `/api/trips/${tripId}/expenses/${expenseId}`,
          { description: 'Hotel & Breakfast', amount: 250 }
        );
        assert.equal(status, 200);
        assert.equal(body.description, 'Hotel & Breakfast');
        assert.equal(body.amount, 250);
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
