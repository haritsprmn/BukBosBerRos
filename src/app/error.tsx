"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <div className="eyebrow">DUITku</div>
      <h1>Belum bisa terhubung.</h1>
      <p>Periksa koneksi jaringan dan database, lalu coba sekali lagi.</p>
      <button className="button primary" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}
