"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  Check,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { Brand } from "./brand";

export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(
        `/api/auth/${register ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Koneksi gagal. Silakan coba lagi.",
      );
      setPending(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Brand light />
        <div className="auth-story-content">
          <span className="eyebrow light">
            <span className="tiny-dot" /> TEMAN FINANSIAL MAHASISWA
          </span>
          <h1>
            Uang terarah.
            <br />
            Kuliah lebih
            <br />
            <span>tenang.</span>
            <span className="heading-spark">✳</span>
          </h1>
          <p>
            Dari uang saku sampai mimpi besarmu.
            <br />
            Kenali keuanganmu, satu catatan setiap hari.
          </p>
          <div className="auth-preview" aria-hidden="true">
            <div className="preview-top">
              <span>
                <Wallet size={17} /> Saldo kamu
              </span>
              <span className="preview-badge">
                Terkendali <Check size={12} />
              </span>
            </div>
            <strong>
              Rp2.450.000<span>Contoh ringkasan keuangan</span>
            </strong>
            <div className="preview-bars">
              {[34, 52, 42, 70, 57, 84, 100].map((n, i) => (
                <div key={i} style={{ height: `${n}%` }} />
              ))}
            </div>
            <div className="preview-footer">
              <TrendingUp size={16} />
              <span>Langkah kecil, kebiasaan baik.</span>
              <ArrowUpRight size={18} />
            </div>
          </div>
        </div>
        <div className="auth-bottom">
          <span>Dibuat untuk langkah mandirimu.</span>
          <span>EST. 2026</span>
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-topline">
          {register ? "Sudah punya akun?" : "Baru di BukBosBerRos?"}{" "}
          <Link href={register ? "/login" : "/register"}>
            {register ? "Masuk" : "Buat akun"} <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="auth-form-wrap">
          <div className="welcome-icon">
            <Wallet size={25} />
          </div>
          <span className="eyebrow">MULAI DARI HAL SEDERHANA</span>
          <h2>{register ? "Halo, masa depan!" : "Selamat datang lagi."}</h2>
          <p>
            {register
              ? "Buat akun dan mulai perjalanan finansialmu."
              : "Masuk untuk melihat cerita di balik uangmu."}
          </p>
          <form onSubmit={submit} className="auth-form">
            {register && (
              <label>
                Nama lengkap
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="Nama panggilan juga boleh"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
            )}
            <label>
              Alamat email
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="kamu@email.com"
                required
                maxLength={254}
              />
            </label>
            <label>
              Kata sandi
              <div className="password-input">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={
                    register ? "Minimal 8 karakter" : "Masukkan kata sandimu"
                  }
                  required
                  minLength={8}
                  maxLength={128}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
                  }
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="button primary auth-submit" disabled={pending}>
              {pending ? <LoaderCircle className="spin" size={18} /> : null}
              {pending
                ? "Sebentar, ya…"
                : register
                  ? "Buat akun gratis"
                  : "Masuk ke BukBosBerRos"}
              {!pending && <ArrowRight size={18} />}
            </button>
          </form>
          <p className="auth-security">
            <ShieldCheck size={16} /> Catatan keuanganmu hanya bisa diakses
            olehmu.
          </p>
        </div>
        <footer className="auth-footer">
          © 2026 BukBosBerRos <span>Sedikit dicatat, banyak manfaat.</span>
        </footer>
      </section>
    </main>
  );
}
