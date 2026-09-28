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
  for (const method of ["GET", "PUT"]) {
    const denied = await anonymous.call("/api/budgets?month=2026-09", method, method === "PUT" ? { month: "2026-09", amount: 50000 } : undefined);
    check(`Anonymous budget ${method} denied`, () => assert.equal(denied.status, 401));
  }
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
  const budgetPath = "/api/budgets?month=2026-09";
  const noBudget = await a.call(budgetPath);
  check("Unset budget still reports own expenses, excluding income", () => {
    assert.equal(noBudget.status, 200);
    assert.deepEqual(noBudget.data.summary, { month: "2026-09", amount: null, expense: 30000, remaining: null, percentage: null, exceeded: false });
    assert.match(noBudget.headers.get("cache-control"), /no-store/);
  });
  for (const month of ["", "2026-13", "2026-00", "2026-9", "1899-12", "2101-01", "2026-09-01", "' OR 1=1--"]) {
    const invalid = await a.call(`/api/budgets?month=${encodeURIComponent(month)}`);
    check(`Invalid budget month ${JSON.stringify(month)} rejected`, () => assert.equal(invalid.status, 400));
  }
  for (const amount of [0, -1, 1.5, 10000000001, "50000", null]) {
    const invalid = await a.call("/api/budgets", "PUT", { month: "2026-09", amount });
    check(`Invalid budget amount ${JSON.stringify(amount)} rejected`, () => assert.equal(invalid.status, 400));
  }
  const forgedOwner = await b.call("/api/budgets", "PUT", { month: "2026-09", amount: 1, user_id: "forged-owner" });
  check("Budget owner cannot be supplied by client", () => assert.equal(forgedOwner.status, 400));
  const crossBudget = await a.call("/api/budgets", "PUT", { month: "2026-09", amount: 50000 }, "https://untrusted.invalid");
  check("Cross-origin budget mutation denied", () => assert.equal(crossBudget.status, 403));
  const budgetSave = await a.call("/api/budgets", "PUT", { month: "2026-09", amount: 50000 });
  check("Set monthly budget", () => assert.equal(budgetSave.status, 200));
  const budget = await a.call(budgetPath);
  check("Budget remaining and usage calculated", () => assert.deepEqual(budget.data.summary, { month: "2026-09", amount: 50000, expense: 30000, remaining: 20000, percentage: 60, exceeded: false }));
  const privateBudget = await b.call(budgetPath);
  check("Other user cannot read budget or expense totals", () => {
    assert.equal(privateBudget.data.summary.amount, null);
    assert.equal(privateBudget.data.summary.expense, 0);
  });
  await b.call("/api/budgets", "PUT", { month: "2026-09", amount: 1 });
  const untouched = await a.call(budgetPath);
  check("Other user cannot overwrite budget", () => assert.equal(untouched.data.summary.amount, 50000));
  await a.call("/api/budgets", "PUT", { month: "2026-09", amount: 30000 });
  const exact = await a.call(budgetPath);
  check("Exactly exhausted budget is not exceeded", () => {
    assert.equal(exact.data.summary.remaining, 0);
    assert.equal(exact.data.summary.percentage, 100);
    assert.equal(exact.data.summary.exceeded, false);
  });
  await a.call("/api/budgets", "PUT", { month: "2026-09", amount: 20000 });
  const exceeded = await a.call(budgetPath);
  check("Over-budget warning and negative remainder", () => {
    assert.equal(exceeded.data.summary.remaining, -10000);
    assert.equal(exceeded.data.summary.percentage, 150);
    assert.equal(exceeded.data.summary.exceeded, true);
  });
  const persisted = await db.query("SELECT b.amount::float8 AS amount FROM duitku.budgets b JOIN duitku.users u ON u.id=b.user_id WHERE u.email=$1 AND b.month='2026-09-01'", [emails[0]]);
  check("Budget updates persist as a single PostgreSQL row", () => {
    assert.equal(persisted.rows.length, 1);
    assert.equal(persisted.rows[0].amount, 20000);
  });
  await a.call("/api/budgets", "PUT", { month: "2026-10", amount: 80000 });
  const nextMonth = await a.call("/api/budgets?month=2026-10");
  check("Independent budget for another month", () => {
    assert.equal(nextMonth.data.summary.amount, 80000);
    assert.equal(nextMonth.data.summary.expense, 0);
    assert.equal(nextMonth.data.summary.remaining, 80000);
  });
  await a.call(`/api/transactions/${id}`, "PATCH", { ...expense, date: "2026-10-01", amount: 30000 });
  const movedOld = await a.call(budgetPath);
  const movedNew = await a.call("/api/budgets?month=2026-10");
  check("Moving expense across month boundary refreshes both summaries", () => {
    assert.equal(movedOld.data.summary.expense, 0);
    assert.equal(movedOld.data.summary.exceeded, false);
    assert.equal(movedNew.data.summary.expense, 30000);
  });
  await a.call(`/api/transactions/${id}`, "PATCH", { ...expense, date: "2026-09-30", amount: 30000 });
  const lastDay = await a.call(budgetPath);
  check("Last day of selected month is included", () => assert.equal(lastDay.data.summary.expense, 30000));
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
  const afterDeleteBudget = await a.call(budgetPath);
  check("Deleting expense clears budget warning", () => {
    assert.equal(afterDeleteBudget.data.summary.expense, 0);
    assert.equal(afterDeleteBudget.data.summary.remaining, 20000);
    assert.equal(afterDeleteBudget.data.summary.exceeded, false);
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
  const expiredBudget = await a.call(budgetPath);
  check("Expired session cannot access budget", () => assert.equal(expiredBudget.status, 401));
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
