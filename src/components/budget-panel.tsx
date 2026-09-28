"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Wallet } from "lucide-react";
import { rupiah, type BudgetSummary, type Transaction } from "@/lib/validation";

export function BudgetPanel({ month, transactions, hideBalance }: {
  month: string;
  transactions: Transaction[];
  hideBalance: boolean;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/budgets?month=${encodeURIComponent(month)}`, {
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 401) router.replace("/login");
        if (!response.ok) throw new Error(data.error || "Gagal memuat anggaran.");
        setSummary(data.summary);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Gagal memuat anggaran.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [month, transactions, revision, router]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, amount: Number(draft) }),
      });
      const data = await response.json();
      if (response.status === 401) router.replace("/login");
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan anggaran.");
      setDraft("");
      setNotice("Anggaran berhasil disimpan.");
      setRevision((value) => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan anggaran.");
    } finally {
      setSaving(false);
    }
  }

  const amount = (value: number) => hideBalance ? "Rp •••••••" : rupiah(value);
  const label = new Date(`${month}-01T12:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return (
    <section className="panel budget-panel" aria-labelledby="budget-title" aria-busy={loading || saving}>
      <div className="panel-heading">
        <div><h2 id="budget-title">Anggaran bulanan</h2><p>{label} · Seluruh pengeluaran bulan ini</p></div>
        <Wallet size={22} aria-hidden="true" />
      </div>
      <div className="budget-body">
        {loading ? <p role="status"><LoaderCircle size={16} className="spin" /> Memuat anggaran…</p> : !error && summary && (
          <div aria-live="polite">
            <dl className="budget-summary">
              <div><dt>Anggaran</dt><dd>{summary.amount === null ? "Belum ditetapkan" : amount(summary.amount)}</dd></div>
              <div><dt>Pengeluaran</dt><dd>{amount(summary.expense)}</dd></div>
              <div><dt>Sisa anggaran</dt><dd>{summary.remaining === null ? "—" : amount(summary.remaining)}</dd></div>
            </dl>
            {summary.percentage !== null ? <>
              <progress className={summary.exceeded ? "budget-exceeded" : ""} max={100} value={Math.min(100, summary.percentage)} aria-label="Penggunaan anggaran" />
              <p className="budget-usage">{hideBalance ? "Persentase disembunyikan" : `${summary.percentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% anggaran terpakai`}</p>
              {summary.exceeded ? <p className="budget-warning" role="alert">Pengeluaran melebihi anggaran sebesar {amount(-summary.remaining!)}.</p> : summary.remaining === 0 ? <p className="budget-warning">Anggaran bulan ini telah habis.</p> : null}
            </> : <p className="budget-usage">Tetapkan anggaran untuk memantau batas pengeluaranmu.</p>}
          </div>
        )}
        <form className="budget-form" onSubmit={save}>
          <label htmlFor="budget-amount">{summary?.amount === null || !summary ? "Tetapkan" : "Ubah"} anggaran (Rp)
            <input id="budget-amount" type="number" min={1} max={10000000000} step={1} required inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Contoh: 2000000" disabled={saving || loading} />
          </label>
          <button className="button primary" type="submit" disabled={saving || loading}>{saving ? "Menyimpan…" : "Simpan anggaran"}</button>
        </form>
        {error && <div className="form-error" role="alert">{error} <button type="button" className="button secondary small-button" onClick={() => setRevision((value) => value + 1)}>Muat ulang</button></div>}
        {notice && <p className="budget-notice" role="status">{notice}</p>}
      </div>
    </section>
  );
}
