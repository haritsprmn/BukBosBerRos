"use client";

import { useState, useMemo, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Plus,
  LayoutDashboard,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Settings2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Search,
  Eye,
  EyeOff,
  Download,
  Pencil,
  Trash2,
  Wallet,
  Utensils,
  GraduationCap,
  ShoppingBag,
  Bus,
  Heart,
  CircleHelp,
  Sparkles,
  Check,
  LoaderCircle,
  X,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { Brand } from "./brand";
import { Dialog } from "./dialog";
import {
  categories,
  rupiah,
  type Transaction,
  type User,
} from "@/lib/validation";

type View = "dashboard" | "transactions" | "reports";
const colors = [
  "#275a43",
  "#82a98b",
  "#cfdfad",
  "#dda779",
  "#9e9abd",
  "#83b8bc",
  "#c5b795",
  "#b0b0a8",
];
const categoryIcons: Record<string, LucideIcon> = {
  "Makan & minum": Utensils,
  Transportasi: Bus,
  Belanja: ShoppingBag,
  Pendidikan: GraduationCap,
  Kesehatan: Heart,
  Beasiswa: GraduationCap,
};
function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function dateLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function monthLabel(month: string) {
  return new Date(month + "-01T12:00:00").toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

export function Dashboard({
  user,
  initialTransactions,
  initialHideBalance,
}: {
  user: User;
  initialTransactions: Transaction[];
  initialHideBalance: boolean;
}) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [view, setView] = useState<View>("dashboard");
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [hideBalance, setHideBalance] = useState(initialHideBalance);
  const [editor, setEditor] = useState<Transaction | "new" | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [settings, setSettings] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const selected = useMemo(
    () => transactions.filter((t) => !month || t.date.startsWith(month)),
    [transactions, month],
  );
  const income = selected
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = selected
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = transactions.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
    0,
  );
  const filtered = selected.filter(
    (t) =>
      (typeFilter === "all" || t.type === typeFilter) &&
      `${t.title} ${t.category} ${t.note}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const pageSize = view === "dashboard" ? 5 : 10;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(page, pages);
  const shown = filtered.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );
  const grouped = categories.expense
    .map((category) => ({
      category,
      total: selected
        .filter((t) => t.type === "expense" && t.category === category)
        .reduce((sum, t) => sum + t.amount, 0),
    }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
  const amount = (value: number) =>
    hideBalance ? "Rp •••••••" : rupiah(value);
  const periodLabel = month ? monthLabel(month) : "Semua periode";
  async function request(path: string, method: string, body: unknown = {}) {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (response.status === 401) {
      router.replace("/login");
      router.refresh();
      throw new Error("Session berakhir. Silakan masuk kembali.");
    }
    if (!response.ok)
      throw new Error(data.error || "Permintaan gagal. Coba lagi.");
    return data;
  }
  async function toggleBalance() {
    setBusy(true);
    setError("");
    try {
      await request("/api/preferences", "POST", { hideBalance: !hideBalance });
      setHideBalance(!hideBalance);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan preferensi.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await request("/api/auth/logout", "POST");
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal keluar.");
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/transactions/${deleting.id}`, "DELETE");
      setTransactions((prev) => prev.filter((t) => t.id !== deleting.id));
      setDeleting(null);
      setToast("Transaksi berhasil dihapus.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus transaksi.");
    } finally {
      setBusy(false);
    }
  }
  function navigate(next: View) {
    setView(next);
    setPage(1);
    setQuery("");
    setTypeFilter("all");
    setMobileMenu(false);
  }
  function exportCsv() {
    const cell = (value: string | number) =>
      `"${String(value)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      [
        "Tanggal",
        "Nama transaksi",
        "Jenis",
        "Kategori",
        "Nominal (IDR)",
        "Catatan",
      ],
      ...filtered.map((t) => [
        t.date,
        t.title,
        t.type === "income" ? "Pemasukan" : "Pengeluaran",
        t.category,
        t.amount,
        t.note,
      ]),
    ];
    const blob = new Blob(
      ["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BukBosBerRos-${month || "semua-periode"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Riwayat transaksi berhasil diekspor.");
  }
  const chartEnd = month || localDate().slice(0, 7);
  const chartMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(chartEnd + "-01T12:00:00");
    d.setMonth(d.getMonth() - 5 + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const rows = transactions.filter((t) => t.date.startsWith(key));
    return {
      key,
      label: d.toLocaleDateString("id-ID", { month: "short" }),
      income: rows
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0),
      expense: rows
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0),
    };
  });
  const chartMax = Math.max(
    1,
    ...chartMonths.flatMap((m) => [m.income, m.expense]),
  );
  let cumulative = 0;
  const donut = grouped
    .map((g, i) => {
      const start = cumulative;
      cumulative += (g.total / expense) * 100;
      return `${colors[i % colors.length]} ${start}% ${cumulative}%`;
    })
    .join(",");
  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="Tutup navigasi"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenu ? "is-open" : ""}`}>
        <Brand />
        <div className="workspace-label">
          <span className="workspace-avatar">P</span>
          <div>
            Ruang pribadi<small>Akun mahasiswa</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <span className="nav-caption">MENU UTAMA</span>
        <nav aria-label="Navigasi utama">
          {(
            [
              { id: "dashboard", label: "Ringkasan", icon: LayoutDashboard },
              { id: "transactions", label: "Transaksi", icon: ArrowLeftRight },
              { id: "reports", label: "Laporan", icon: ChartNoAxesCombined },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              {item.label}
              {view === item.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-spark">✳</span>
          <h3>
            Catat hari ini.
            <br />
            Tenang esok hari.
          </h3>
          <p>Kebiasaan kecilmu adalah awal dari rencana besar.</p>
          <span className="note-line" />
        </div>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => {
              setSettings(true);
              setMobileMenu(false);
            }}
          >
            <Settings2 size={19} />
            Pengaturan
          </button>
          <button className="nav-item" onClick={logout} disabled={busy}>
            <LogOut size={19} />
            Keluar
          </button>
          <div className="sidebar-user">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>Akun pribadi</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu-button"
              aria-label="Buka navigasi"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Ruang pribadi</span>
            <ChevronRight size={14} />
            <strong>
              {view === "dashboard"
                ? "Ringkasan"
                : view === "transactions"
                  ? "Transaksi"
                  : "Laporan"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="private-badge">
              <span className="tiny-dot" /> Hanya untukmu
            </span>
            <span className="topbar-divider" />
            <button
              className="avatar small"
              aria-label="Buka pengaturan akun"
              onClick={() => setSettings(true)}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="dashboard-content">
          <section className="page-heading">
            <div>
              <span className="eyebrow">YOUR MONEY, YOUR STORY</span>
              <h1>
                {view === "dashboard" ? (
                  <>
                    Halo, {user.name.split(" ")[0]}{" "}
                    <span className="greeting-spark">✳</span>
                  </>
                ) : view === "transactions" ? (
                  "Setiap transaksi berarti."
                ) : (
                  "Kenali pola keuanganmu."
                )}
              </h1>
              <p>
                {view === "dashboard"
                  ? "Yuk, lihat kabar keuanganmu hari ini."
                  : view === "transactions"
                    ? "Semua pemasukan dan pengeluaran, tercatat dengan rapi."
                    : "Lihat ke mana uangmu pergi dan rencanakan langkah berikutnya."}
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setError("");
                setEditor("new");
              }}
            >
              <Plus size={18} />
              Tambah transaksi
            </button>
          </section>
          {error && !deleting && (
            <div className="form-error dashboard-error" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Tutup pesan"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="section-toolbar">
            <div className="section-title">
              <span className="tiny-dot" />{" "}
              {view === "dashboard"
                ? "Gambaran keuangan"
                : view === "transactions"
                  ? "Riwayat keuangan"
                  : "Analisis keuangan"}
              <span className="muted">/ {periodLabel}</span>
            </div>
            <div className="period-controls">
              <label className="month-picker">
                <CalendarDays size={15} />
                <input
                  type="month"
                  aria-label="Periode transaksi"
                  value={month}
                  min="1900-01"
                  max="2100-12"
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <button
                className={`button small-button ${!month ? "selected" : ""}`}
                onClick={() => {
                  setMonth(month ? "" : localDate().slice(0, 7));
                  setPage(1);
                }}
              >
                {month ? "Semua periode" : "Bulan ini"}
              </button>
            </div>
          </div>
          <section className="stats-grid" aria-label="Ringkasan keuangan">
            <article className="stat-card balance-card">
              <div className="stat-top">
                <span>
                  <Wallet size={18} />
                  Saldo saat ini
                </span>
                <button
                  className="icon-button"
                  aria-label={
                    hideBalance ? "Tampilkan nominal" : "Sembunyikan nominal"
                  }
                  onClick={toggleBalance}
                  disabled={busy}
                >
                  {hideBalance ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <strong>{amount(balance)}</strong>
              <div className="stat-bottom">
                <span className="balance-chip">Saldo keseluruhan</span>
                <span className="balance-decoration">↗</span>
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>Total pemasukan</span>
                <span className="stat-icon income">
                  <ArrowDownLeft size={20} />
                </span>
              </div>
              <strong>{amount(income)}</strong>
              <div className="stat-bottom">
                <span className="income-dot" />
                {selected.filter((t) => t.type === "income").length} transaksi
                pemasukan
                <span className="mini-bars income-bars" aria-hidden="true">
                  ▂▅▃▆▄▇
                </span>
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>Total pengeluaran</span>
                <span className="stat-icon expense">
                  <ArrowUpRight size={20} />
                </span>
              </div>
              <strong>{amount(expense)}</strong>
              <div className="stat-bottom">
                <span className="expense-dot" />
                {selected.filter((t) => t.type === "expense").length} transaksi
                pengeluaran
                <span className="mini-bars expense-bars" aria-hidden="true">
                  ▅▃▆▂▅▄
                </span>
              </div>
            </article>
          </section>
          {view !== "transactions" && (
            <section className="charts-grid">
              <article className="panel cashflow-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Arus kas</h2>
                    <p>Langkah finansialmu dalam 6 bulan terakhir</p>
                  </div>
                  <span className="subtle-icon">
                    <ChartNoAxesCombined size={19} />
                  </span>
                </div>
                <div className="chart-legend">
                  <span>
                    <i className="legend-dot green" />
                    Pemasukan
                  </span>
                  <span>
                    <i className="legend-dot sage" />
                    Pengeluaran
                  </span>
                  <span className="chart-unit">
                    {hideBalance ? "Nominal disembunyikan" : "Dalam rupiah"}
                  </span>
                </div>
                <div
                  className="bar-chart"
                  role="img"
                  aria-label="Grafik pemasukan dan pengeluaran selama enam bulan"
                >
                  <div className="chart-y-labels">
                    {[1, 0.75, 0.5, 0.25, 0].map((n) => (
                      <span key={n}>
                        {hideBalance
                          ? "•••"
                          : new Intl.NumberFormat("id-ID", {
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }).format(chartMax === 1 ? 0 : chartMax * n)}
                      </span>
                    ))}
                  </div>
                  <div className="chart-plot">
                    <div className="grid-lines">
                      {[0, 1, 2, 3, 4].map((n) => (
                        <i key={n} />
                      ))}
                    </div>
                    <div className="chart-columns">
                      {chartMonths.map((m) => (
                        <div className="chart-column" key={m.key}>
                          <div className="bar-pair">
                            <div
                              className="bar bar-income"
                              style={{
                                height: `${hideBalance ? 0 : (m.income / chartMax) * 100}%`,
                              }}
                              title={`${m.label} pemasukan: ${amount(m.income)}`}
                            />
                            <div
                              className="bar bar-expense"
                              style={{
                                height: `${hideBalance ? 0 : (m.expense / chartMax) * 100}%`,
                              }}
                              title={`${m.label} pengeluaran: ${amount(m.expense)}`}
                            />
                          </div>
                          <span
                            className={
                              m.key === chartEnd ? "current-month" : ""
                            }
                          >
                            {m.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    {(chartMax === 1 || hideBalance) && (
                      <div className="chart-empty">
                        {hideBalance
                          ? "Nominal sedang disembunyikan"
                          : "Arus kas akan muncul setelah kamu mencatat transaksi."}
                      </div>
                    )}
                  </div>
                </div>
                <div className="chart-footnote">
                  <span className="tiny-dot" />
                  {month ? "6 bulan hingga " + periodLabel : "6 bulan terakhir"}
                  <span>Pantau, pahami, rencanakan.</span>
                </div>
              </article>
              <article className="panel spending-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Ke mana uangmu?</h2>
                    <p>Pengeluaran berdasarkan kategori</p>
                  </div>
                  <ArrowUpRight size={19} className="muted" />
                </div>
                <div className="spending-body">
                  <div
                    className="donut"
                    style={{
                      background: expense
                        ? `conic-gradient(${donut})`
                        : "#edf0e9",
                    }}
                    role="img"
                    aria-label={
                      expense
                        ? "Proporsi pengeluaran per kategori"
                        : "Belum ada pengeluaran"
                    }
                  >
                    <div className="donut-hole">
                      <span>Total pengeluaran</span>
                      <strong>{amount(expense)}</strong>
                      <small>{grouped.length} kategori</small>
                    </div>
                  </div>
                  <div className="category-legend">
                    {grouped.length ? (
                      grouped.slice(0, 4).map((g, i) => (
                        <div key={g.category}>
                          <span>
                            <i
                              className="legend-dot"
                              style={{ background: colors[i] }}
                            />
                            {g.category}
                          </span>
                          <strong>
                            {hideBalance
                              ? "••"
                              : Math.round((g.total / expense) * 100) + "%"}
                          </strong>
                        </div>
                      ))
                    ) : (
                      <p className="empty-category">
                        Belum ada pengeluaran.
                        <br />
                        Mulai catat untuk mengenali kebiasaanmu.
                      </p>
                    )}
                    {grouped.length > 4 && (
                      <small className="muted">
                        + {grouped.length - 4} kategori lainnya
                      </small>
                    )}
                  </div>
                </div>
              </article>
            </section>
          )}
          {view === "reports" && (
            <section className="panel report-panel">
              <div className="panel-heading">
                <div>
                  <h2>Rincian pengeluaran</h2>
                  <p>
                    {periodLabel} · {grouped.length} kategori
                  </p>
                </div>
                <span className="report-net">
                  Selisih periode ini{" "}
                  <strong
                    className={
                      income - expense >= 0 ? "text-green" : "text-orange"
                    }
                  >
                    {amount(income - expense)}
                  </strong>
                </span>
              </div>
              {grouped.length ? (
                grouped.map((g, i) => (
                  <div className="report-row" key={g.category}>
                    <span>
                      <i
                        className="legend-dot"
                        style={{ background: colors[i % colors.length] }}
                      />
                      {g.category}
                    </span>
                    <div className="report-track">
                      <i
                        style={{
                          width: `${(g.total / expense) * 100}%`,
                          background: colors[i % colors.length],
                        }}
                      />
                    </div>
                    <strong>{amount(g.total)}</strong>
                    <small>{Math.round((g.total / expense) * 100)}%</small>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">
                  <ChartNoAxesCombined size={30} />
                  <h3>Ceritanya baru dimulai.</h3>
                  <p>Catat pengeluaran pertamamu untuk melihat laporan.</p>
                </div>
              )}
            </section>
          )}
          {view !== "reports" && (
            <section className="panel transactions-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {view === "dashboard"
                      ? "Transaksi terbaru"
                      : "Semua transaksi"}
                    <span className="count-badge">{selected.length}</span>
                  </h2>
                  <p>Catatan kecil untuk kendali yang lebih besar.</p>
                </div>
                {view === "dashboard" ? (
                  <button
                    className="text-button"
                    onClick={() => navigate("transactions")}
                  >
                    Lihat semua <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    className="button small-button"
                    disabled={!filtered.length}
                    onClick={exportCsv}
                  >
                    <Download size={15} />
                    Ekspor CSV
                  </button>
                )}
              </div>
              <div className="table-toolbar">
                <div className="filter-tabs" aria-label="Jenis transaksi">
                  {[
                    ["all", "Semua"],
                    ["income", "Pemasukan"],
                    ["expense", "Pengeluaran"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={typeFilter === id ? "active" : ""}
                      aria-pressed={typeFilter === id}
                      onClick={() => {
                        setTypeFilter(id);
                        setPage(1);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="search-input">
                  <Search size={16} />
                  <input
                    aria-label="Cari transaksi"
                    placeholder="Cari transaksi…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
              </div>
              {shown.length ? (
                <>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>TRANSAKSI</th>
                          <th>KATEGORI</th>
                          <th>TANGGAL</th>
                          <th className="amount-cell">NOMINAL</th>
                          <th className="action-cell">AKSI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((t) => {
                          const Icon =
                            categoryIcons[t.category] ||
                            (t.type === "income" ? ArrowDownLeft : Wallet);
                          return (
                            <tr key={t.id}>
                              <td>
                                <div className="transaction-name">
                                  <span
                                    className={`transaction-icon ${t.type}`}
                                  >
                                    <Icon size={18} />
                                  </span>
                                  <div>
                                    <strong>{t.title}</strong>
                                    <small>
                                      {t.note ||
                                        (t.type === "income"
                                          ? "Pemasukan"
                                          : "Pengeluaran")}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="category-pill">
                                  {t.category}
                                </span>
                              </td>
                              <td className="date-cell">{dateLabel(t.date)}</td>
                              <td
                                className={`amount-cell ${t.type === "income" ? "text-green" : ""}`}
                              >
                                {hideBalance
                                  ? "Rp •••••••"
                                  : (t.type === "income" ? "+" : "−") +
                                    rupiah(t.amount)}
                              </td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    className="icon-button"
                                    aria-label={`Ubah ${t.title}`}
                                    onClick={() => {
                                      setError("");
                                      setEditor(t);
                                    }}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    className="icon-button delete-button"
                                    aria-label={`Hapus ${t.title}`}
                                    onClick={() => {
                                      setError("");
                                      setDeleting(t);
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-footer">
                    <span>
                      Menampilkan {(activePage - 1) * pageSize + 1}–
                      {Math.min(activePage * pageSize, filtered.length)} dari{" "}
                      {filtered.length} transaksi
                    </span>
                    <div>
                      <button
                        className="icon-button"
                        aria-label="Halaman sebelumnya"
                        disabled={activePage === 1}
                        onClick={() => setPage(activePage - 1)}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <span className="page-number">{activePage}</span>
                      <button
                        className="icon-button"
                        aria-label="Halaman berikutnya"
                        disabled={activePage === pages}
                        onClick={() => setPage(activePage + 1)}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">
                    <ArrowLeftRight size={26} />
                  </span>
                  <h3>
                    {query || typeFilter !== "all"
                      ? "Transaksi tidak ditemukan."
                      : "Mulai cerita keuanganmu."}
                  </h3>
                  <p>
                    {query || typeFilter !== "all"
                      ? "Coba kata kunci atau filter yang lain."
                      : "Belum ada transaksi pada periode ini. Yuk, catat yang pertama."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (query || typeFilter !== "all") {
                        setQuery("");
                        setTypeFilter("all");
                      } else setEditor("new");
                    }}
                  >
                    {query || typeFilter !== "all"
                      ? "Reset filter"
                      : "Tambah transaksi"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          )}
          <aside className="daily-tip">
            <span className="tip-icon">
              <Sparkles size={19} />
            </span>
            <p>
              <strong>Sedikit dicatat, banyak manfaat.</strong> Luangkan satu
              menit setiap hari untuk mencatat pengeluaranmu.
            </p>
            <span className="tip-label">BukBosBerRos notes</span>
          </aside>
          <footer className="dashboard-footer">
            <span>© 2026 BukBosBerRos. Teman finansialmu.</span>
            <span>
              Dibuat untuk langkah mandirimu{" "}
              <span className="footer-spark">✳</span>
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            className="icon-button"
            aria-label="Tutup notifikasi"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {editor && (
        <TransactionEditor
          transaction={editor === "new" ? undefined : editor}
          request={request}
          onClose={() => setEditor(null)}
          onSave={(t) => {
            setTransactions((prev) =>
              [t, ...prev.filter((x) => x.id !== t.id)].sort((a, b) =>
                b.date.localeCompare(a.date),
              ),
            );
            setEditor(null);
            setPage(1);
            if (month && !t.date.startsWith(month))
              setMonth(t.date.slice(0, 7));
            setToast(
              editor === "new"
                ? "Transaksi berhasil ditambahkan."
                : "Transaksi berhasil diperbarui.",
            );
          }}
        />
      )}
      {deleting && (
        <Dialog
          title="Hapus transaksi?"
          description="Transaksi yang dihapus tidak dapat dikembalikan."
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <div className="delete-summary">
            <strong>{deleting.title}</strong>
            <span>{amount(deleting.amount)}</span>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
              disabled={busy}
            >
              Batal
            </button>
            <button className="button danger" onClick={remove} disabled={busy}>
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Trash2 size={17} />
              )}
              Hapus transaksi
            </button>
          </div>
        </Dialog>
      )}
      {settings && (
        <Dialog
          title="Pengaturan akun"
          description="Ruang pribadi, sesuai preferensimu."
          onClose={() => setSettings(false)}
          busy={busy}
        >
          <div className="account-details">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <p>{user.email}</p>
            </div>
          </div>
          <div className="preference-row">
            <div>
              <strong>Sembunyikan nominal</strong>
              <p>Preferensi diingat di browser ini selama 1 tahun.</p>
            </div>
            <button
              className={`toggle ${hideBalance ? "on" : ""}`}
              role="switch"
              aria-checked={hideBalance}
              aria-label="Sembunyikan nominal"
              onClick={toggleBalance}
              disabled={busy}
            >
              <span />
            </button>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="settings-info">
            <CircleHelp size={18} />
            <p>
              Session login berlaku 7 hari. Keluar dari akun akan mengakhiri
              session pada perangkat ini.
            </p>
          </div>
          <button
            className="button secondary full-width"
            onClick={logout}
            disabled={busy}
          >
            <LogOut size={17} />
            Keluar dari akun
          </button>
        </Dialog>
      )}
    </div>
  );
}

function TransactionEditor({
  transaction,
  request,
  onSave,
  onClose,
}: {
  transaction?: Transaction;
  request: (
    path: string,
    method: string,
    body: unknown,
  ) => Promise<{ transaction: Transaction }>;
  onSave: (t: Transaction) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<"income" | "expense">(
    transaction?.type ?? "expense",
  );
  const [category, setCategory] = useState(
    transaction?.category ?? categories.expense[0],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await request(
        transaction
          ? `/api/transactions/${transaction.id}`
          : "/api/transactions",
        transaction ? "PATCH" : "POST",
        {
          title: form.get("title"),
          amount: Number(form.get("amount")),
          type,
          category,
          date: form.get("date"),
          note: form.get("note"),
        },
      );
      onSave(result.transaction);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi gagal. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={transaction ? "Ubah transaksi" : "Catat transaksi baru"}
      description="Setiap catatan adalah langkah menuju keuangan yang lebih baik."
      onClose={onClose}
      busy={busy}
    >
      <form className="transaction-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="type-selector">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                className={type === t ? "active " + t : ""}
                onClick={() => {
                  setType(t);
                  setCategory(categories[t][0]);
                }}
              >
                {t === "income" ? (
                  <ArrowDownLeft size={18} />
                ) : (
                  <ArrowUpRight size={18} />
                )}{" "}
                {t === "income" ? "Pemasukan" : "Pengeluaran"}
              </button>
            ))}
          </div>
          <label>
            Nama transaksi
            <input
              name="title"
              placeholder={
                type === "income"
                  ? "Mis. Uang saku bulanan"
                  : "Mis. Makan siang di kantin"
              }
              defaultValue={transaction?.title}
              required
              maxLength={100}
            />
          </label>
          <label>
            Nominal
            <div className="currency-input">
              <span>Rp</span>
              <input
                name="amount"
                type="number"
                inputMode="numeric"
                placeholder="0"
                defaultValue={transaction?.amount}
                min={1}
                max={10000000000}
                step={1}
                required
              />
            </div>
          </label>
          <div className="form-grid">
            <label>
              Kategori
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories[type].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Tanggal
              <input
                name="date"
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                defaultValue={transaction?.date ?? localDate()}
                required
              />
            </label>
          </div>
          <label>
            Catatan <span className="optional">opsional</span>
            <textarea
              name="note"
              placeholder="Ada cerita di balik transaksi ini?"
              defaultValue={transaction?.note}
              rows={3}
              maxLength={500}
            />
          </label>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
            >
              Batal
            </button>
            <button className="button primary" type="submit">
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Check size={17} />
              )}{" "}
              {busy ? "Menyimpan…" : "Simpan transaksi"}
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
