import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";
nextEnv.loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
const emails = [
  `test-${randomUUID()}@duitku.invalid`,
  `test-${randomUUID()}@duitku.invalid`,
];
let passed = 0;
const check = (label, fn) => {
  fn();
  passed++;
  console.log(`PASS ${label}`);
};
function client() {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    async call(path, method = "GET", body, origin = base) {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(method !== "GET"
            ? { "Content-Type": "application/json", Origin: origin }
            : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "manual",
      });
      for (const value of response.headers.getSetCookie()) {
        if (value.startsWith("duitku_session=")) cookie = value.split(";")[0];
      }
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: response.status, data, headers: response.headers };
    },
  };
}
const a = client(),
  b = client(),
  anonymous = client();
try {
  const anon = await anonymous.call("/api/transactions");
  check("Anonymous API access denied", () => assert.equal(anon.status, 401));
  const anonymousDashboard = await anonymous.call("/api/dashboard");
  check("Anonymous dashboard data denied", () => assert.equal(anonymousDashboard.status, 401));
  const protectedPage = await anonymous.call("/dashboard");
  check("Dashboard redirects anonymous visitors", () =>
    assert.ok(
      protectedPage.headers.get("location") === "/login" ||
        String(protectedPage.data).includes('content="1;url=/login"'),
    ),
  );
  for (const [index, c] of [a, b].entries()) {
    const result = await c.call("/api/auth/register", "POST", {
      name: `Integration ${index}`,
      email: emails[index],
      password: "Temporary-test-8!",
    });
    check(`Registration ${index + 1}`, () =>
      assert.equal(result.status, 201, JSON.stringify(result.data)),
    );
    check(`HttpOnly session ${index + 1}`, () =>
      assert.match(result.headers.get("set-cookie"), /HttpOnly/i),
    );
  }
  const dup = await anonymous.call("/api/auth/register", "POST", {
    name: "Duplicate",
    email: emails[0],
    password: "Temporary-test-8!",
  });
  check("Duplicate email rejected", () => assert.equal(dup.status, 409));
  const wrong = await anonymous.call("/api/auth/login", "POST", {
    email: emails[0],
    password: "Wrong-password",
  });
  check("Wrong password rejected", () => assert.equal(wrong.status, 401));
  const saved = await db.query(
    "SELECT password_hash FROM duitku.users WHERE email=$1",
    [emails[0]],
  );
  check("Password is hashed", () => {
    assert.notEqual(saved.rows[0].password_hash, "Temporary-test-8!");
    assert.match(saved.rows[0].password_hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  });
  const expense = {
    title: "Makan siang",
    type: "expense",
    amount: 25000,
    category: "Makan & minum",
    date: "2026-09-23",
    note: "Integration test",
  };
  const invalid = await a.call("/api/transactions", "POST", {
    ...expense,
    amount: -1,
  });
  check("Negative amount rejected", () => assert.equal(invalid.status, 400));
  const invalidDate = await a.call("/api/transactions", "POST", {
    ...expense,
    date: "2026-02-30",
  });
  check("Impossible date rejected", () =>
    assert.equal(invalidDate.status, 400),
  );
  const invalidCategory = await a.call("/api/transactions", "POST", {
    ...expense,
    category: "Beasiswa",
  });
  check("Invalid category rejected", () =>
    assert.equal(invalidCategory.status, 400),
  );
  const crossOrigin = await a.call(
    "/api/transactions",
    "POST",
    expense,
    "https://untrusted.invalid",
  );
  check("Cross-origin mutation rejected", () =>
    assert.equal(crossOrigin.status, 403),
  );
  const created = await a.call("/api/transactions", "POST", expense);
  check("Create expense", () => assert.equal(created.status, 201));
  const id = created.data.transaction.id;
  const income = await a.call("/api/transactions", "POST", {
    ...expense,
    title: "Uang saku",
    type: "income",
    category: "Uang saku",
    amount: 1000000,
  });
  check("Create income", () => assert.equal(income.status, 201));
  const list = await a.call("/api/transactions");
  check("Read own transactions and balance", () => {
    assert.equal(list.data.transactions.length, 2);
    assert.equal(
      list.data.transactions.reduce(
        (n, t) => n + (t.type === "income" ? t.amount : -t.amount),
        0,
      ),
      975000,
    );
  });
  const otherList = await b.call("/api/transactions");
  const dashboard = await a.call("/api/dashboard?month=2026-09");
  check("SRS-07 dashboard totals and history", () => {
    assert.equal(dashboard.status, 200);
    assert.deepEqual(dashboard.data.summary, {
      balance: 975000, income: 1000000, expense: 25000, incomeCount: 1, expenseCount: 1,
    });
    assert.equal(dashboard.data.transactions.length, 2);
    assert.match(dashboard.headers.get("cache-control"), /no-store/);
  });
  const combinedFilters = new URLSearchParams({
    month: "2026-09", type: "expense", category: "Makan & minum", query: "  MAKAN  ",
  });
  const filteredDashboard = await a.call(`/api/dashboard?${combinedFilters}`);
  check("SRS-08 combined month, type, category and case-insensitive search", () => {
    assert.equal(filteredDashboard.status, 200);
    assert.deepEqual(filteredDashboard.data.transactions.map((t) => t.id), [id]);
    assert.equal(filteredDashboard.data.summary.income, 0);
    assert.equal(filteredDashboard.data.summary.expense, 25000);
    assert.equal(filteredDashboard.data.summary.balance, 975000);
  });
  const incomeDashboard = await a.call("/api/dashboard?type=income");
  check("Income filter and all periods", () => {
    assert.equal(incomeDashboard.data.transactions.length, 1);
    assert.equal(incomeDashboard.data.summary.income, 1000000);
    assert.equal(incomeDashboard.data.summary.expense, 0);
    assert.deepEqual(incomeDashboard.data.grouped, []);
  });
  for (const query of ["INTEGRATION TEST", "minum"]) {
    const searched = await a.call(`/api/dashboard?query=${encodeURIComponent(query)}`);
    check(`Search includes notes and categories: ${query}`, () => {
      assert.equal(searched.status, 200);
      assert.ok(searched.data.transactions.some((t) => t.id === id));
    });
  }
  const emptyDashboard = await a.call("/api/dashboard?month=2025-01");
  check("Empty month has zero totals, six zero-filled chart months and overall balance", () => {
    assert.equal(emptyDashboard.data.transactions.length, 0);
    assert.equal(emptyDashboard.data.summary.income, 0);
    assert.equal(emptyDashboard.data.summary.expense, 0);
    assert.equal(emptyDashboard.data.summary.balance, 975000);
    assert.equal(emptyDashboard.data.chartMonths.length, 6);
    assert.equal(emptyDashboard.data.chartMonths[0].key, "2024-08");
    assert.ok(emptyDashboard.data.chartMonths.every((m) => m.income === 0 && m.expense === 0));
  });
  check("SRS-09 cashflow and category report match filtered transactions", () => {
    assert.deepEqual(dashboard.data.grouped, [{ category: "Makan & minum", total: 25000 }]);
    assert.deepEqual(dashboard.data.chartMonths.at(-1), {
      key: "2026-09", label: "Sep", income: 1000000, expense: 25000,
    });
    assert.equal(filteredDashboard.data.chartMonths.at(-1).income, 0);
  });
  const otherDashboard = await b.call("/api/dashboard?month=2026-09");
  check("Dashboard and reports exclude other users' data", () => {
    assert.equal(otherDashboard.data.transactions.length, 0);
    assert.equal(otherDashboard.data.summary.balance, 0);
    assert.deepEqual(otherDashboard.data.grouped, []);
  });
  for (const params of ["month=2026-13", "month=1899-01", "type=unknown", "category=unknown", `query=${"x".repeat(101)}`]) {
    const invalidFilter = await a.call(`/api/dashboard?${params}`);
    check(`Invalid dashboard filter rejected: ${params.slice(0, 30)}`, () => assert.equal(invalidFilter.status, 400));
  }
  const literalSearch = await a.call("/api/dashboard?query=%25");
  check("Search treats wildcard characters literally", () => assert.equal(literalSearch.data.transactions.length, 0));
  check("Other user cannot list transactions", () =>
    assert.equal(otherList.data.transactions.length, 0),
  );
  const otherUpdate = await b.call(`/api/transactions/${id}`, "PATCH", {
    ...expense,
    amount: 1,
  });
  check("Other user cannot update", () =>
    assert.equal(otherUpdate.status, 404),
  );
  const otherDelete = await b.call(`/api/transactions/${id}`, "DELETE", {});
  check("Other user cannot delete", () =>
    assert.equal(otherDelete.status, 404),
  );
  const updated = await a.call(`/api/transactions/${id}`, "PATCH", {
    ...expense,
    title: "Makan malam",
    amount: 30000,
  });
  check("Update own transaction", () => {
    assert.equal(updated.status, 200);
    assert.equal(updated.data.transaction.amount, 30000);
  });
  const updatedDashboard = await a.call("/api/dashboard?month=2026-09&query=malam");
  check("Dashboard refresh includes edited transaction, totals and chart", () => {
    assert.equal(updatedDashboard.data.transactions[0].title, "Makan malam");
    assert.equal(updatedDashboard.data.summary.expense, 30000);
    assert.equal(updatedDashboard.data.summary.balance, 970000);
    assert.equal(updatedDashboard.data.chartMonths.at(-1).expense, 30000);
  });
  const prefs = await a.call("/api/preferences", "POST", { hideBalance: true });
  check("Persistent preference cookie", () => {
    assert.equal(prefs.status, 200);
    assert.match(prefs.headers.get("set-cookie"), /duitku_hide_balance=true/);
    assert.match(prefs.headers.get("set-cookie"), /Max-Age=31536000/i);
  });
  const refreshed = await a.call("/dashboard");
  check("Session persists across page requests", () =>
    assert.equal(refreshed.status, 200),
  );
  const deleted = await a.call(`/api/transactions/${id}`, "DELETE", {});
  check("Delete own transaction", () => assert.equal(deleted.status, 200));
  const afterDelete = await a.call("/api/transactions");
  check("Deletion persisted", () =>
    assert.equal(afterDelete.data.transactions.length, 1),
  );
  const deletedDashboard = await a.call("/api/dashboard?month=2026-09");
  check("Dashboard refresh removes deleted transaction from totals and report", () => {
    assert.equal(deletedDashboard.data.transactions.length, 1);
    assert.equal(deletedDashboard.data.summary.balance, 1000000);
    assert.equal(deletedDashboard.data.summary.expense, 0);
    assert.deepEqual(deletedDashboard.data.grouped, []);
  });
  const oldCookie = a.cookie;
  await a.call("/api/auth/logout", "POST", {});
  const replay = await fetch(base + "/api/transactions", {
    headers: { Cookie: oldCookie },
  });
  check("Logout revokes database session", () =>
    assert.equal(replay.status, 401),
  );
  const login = await a.call("/api/auth/login", "POST", {
    email: emails[0].toUpperCase(),
    password: "Temporary-test-8!",
  });
  check("Login with normalized email", () => assert.equal(login.status, 200));
  const tokenHash = createHash("sha256")
    .update(a.cookie.split("=")[1])
    .digest("hex");
  await db.query(
    "UPDATE duitku.sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
    [tokenHash],
  );
  const expired = await a.call("/api/transactions");
  check("Expired session denied", () => assert.equal(expired.status, 401));
  console.log(`\n${passed} integration checks passed.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  // Remove only accounts created by this run, including their cascading test data.
  try {
    await db.query("DELETE FROM duitku.users WHERE email=ANY($1::text[])", [
      emails,
    ]);
    await db.query(
      "DELETE FROM duitku.auth_attempts WHERE key=ANY($1::text[])",
      [emails.map((email) => createHash("sha256").update(email).digest("hex"))],
    );
  } catch (error) {
    console.error("Test cleanup:", error.message);
    process.exitCode = 1;
  }
  await db.end();
}
