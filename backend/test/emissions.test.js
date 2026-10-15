const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const app = require("../src/server");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("health endpoint reports the API is healthy", async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    message: "CarbonIQ API is healthy",
  });
});

test("emissions endpoint calculates category and monthly totals", async () => {
  const response = await fetch(`${baseUrl}/api/emissions/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ electricity: 260, gas: 18, car: 520, flights: 1 }),
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.ok(Math.abs(result.data.electricity - 109.2) < 0.001);
  assert.ok(Math.abs(result.data.gas - 95.4) < 0.001);
  assert.ok(Math.abs(result.data.car - 109.2) < 0.001);
  assert.equal(result.data.flights, 7.5);
  assert.ok(Math.abs(result.data.monthly - 321.3) < 0.001);
});

test("emissions endpoint rejects missing, negative, and non-numeric activity", async (t) => {
  const invalidCases = [
    { electricity: 1, gas: 1, car: 1 },
    { electricity: -1, gas: 1, car: 1, flights: 1 },
    { electricity: "260", gas: 1, car: 1, flights: 1 },
    { electricity: 1, gas: 1, car: 1, flights: Number.POSITIVE_INFINITY },
  ];

  for (const [index, usage] of invalidCases.entries()) {
    await t.test(`invalid case ${index + 1}`, async () => {
      const response = await fetch(`${baseUrl}/api/emissions/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(usage),
      });
      const result = await response.json();

      assert.equal(response.status, 400);
      assert.equal(result.success, false);
      assert.match(result.message, /must be a finite, non-negative number/);
    });
  }
});

test("emissions endpoint rejects finite inputs that overflow during calculation", async () => {
  const response = await fetch(`${baseUrl}/api/emissions/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      electricity: 1,
      gas: 1,
      car: 1,
      flights: Number.MAX_VALUE,
    }),
  });
  const result = await response.json();

  assert.equal(response.status, 400);
  assert.equal(result.success, false);
  assert.equal(result.message, "flights is too large to calculate safely");
});
