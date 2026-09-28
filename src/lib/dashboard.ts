import { z } from "zod";
import { categories, type Transaction } from "./validation";

const allCategories = [...new Set([...categories.income, ...categories.expense])];

export const dashboardFilterSchema = z.object({
  month: z.string().refine(
    (value) => value === "" || /^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value),
    "Bulan tidak valid (1900–2100).",
  ).default(""),
  type: z.enum(["all", "income", "expense"]).default("all"),
  category: z.string().refine(
    (value) => value === "all" || allCategories.includes(value),
    "Kategori tidak valid.",
  ).default("all"),
  query: z.string().trim().max(100, "Kata kunci maksimal 100 karakter.").default(""),
});

export type DashboardFilters = z.infer<typeof dashboardFilterSchema>;

export function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit",
  }).format(new Date());
}

/** The balance covers all dates; other totals follow the active filters. */
export function buildDashboard(transactions: Transaction[], filters: DashboardFilters) {
  const keyword = filters.query.toLocaleLowerCase("id-ID");
  const matching = transactions.filter((transaction) =>
    (filters.type === "all" || transaction.type === filters.type) &&
    (filters.category === "all" || transaction.category === filters.category) &&
    `${transaction.title} ${transaction.category} ${transaction.note}`
      .toLocaleLowerCase("id-ID").includes(keyword),
  );
  const selected = matching.filter((transaction) =>
    !filters.month || transaction.date.startsWith(filters.month),
  );
  const sum = (rows: Transaction[], type: Transaction["type"]) =>
    rows.reduce((total, transaction) => total + (transaction.type === type ? transaction.amount : 0), 0);
  const income = sum(selected, "income");
  const expense = sum(selected, "expense");
  const chartEnd = filters.month || currentMonth();
  const chartMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${chartEnd}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 5 + index);
    const key = date.toISOString().slice(0, 7);
    const rows = matching.filter((transaction) => transaction.date.startsWith(key));
    return {
      key,
      label: date.toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" }),
      income: sum(rows, "income"),
      expense: sum(rows, "expense"),
    };
  });
  return {
    filters,
    transactions: selected,
    summary: {
      balance: sum(transactions, "income") - sum(transactions, "expense"),
      income,
      expense,
      incomeCount: selected.filter((transaction) => transaction.type === "income").length,
      expenseCount: selected.filter((transaction) => transaction.type === "expense").length,
    },
    grouped: categories.expense.map((category) => ({
      category,
      total: sum(selected.filter((transaction) => transaction.category === category), "expense"),
    })).filter((group) => group.total > 0).sort((a, b) => b.total - a.total),
    chartEnd,
    chartMonths,
  };
}

export type DashboardData = ReturnType<typeof buildDashboard>;
