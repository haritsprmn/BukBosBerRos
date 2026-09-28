# Hasil verifikasi DUITku

Tanggal: 23 September 2026.

- `npm run lint`: lulus, tanpa error atau warning.
- `npm run typecheck`: lulus.
- `npm run build`: lulus, build produksi Next.js berhasil.
- `npm run test:integration`: **27 pemeriksaan lulus** menggunakan build produksi dan PostgreSQL lokal khusus QA.
- Pengujian ulang pada database utama `100.120.162.69:5432/duitku` melalui server aplikasi development: **27 pemeriksaan integrasi lulus**. Akun dan transaksi pengujian dibersihkan otomatis.
- Pengujian browser: registrasi, tambah transaksi, perubahan nominal 25.000 → 30.000, konfirmasi hapus, penyembunyian nominal dan persistensi setelah reload, navigasi mobile, serta ekspor CSV.
- Lebar viewport mobile 390px: `document.documentElement.scrollWidth` = 390px. Tabel menggunakan scroll horizontal di dalam panel.
- Console browser pada build produksi: 0 error, 0 warning.

## Verifikasi database utama

Konfigurasi aplikasi mengarah ke host **100.120.162.69**, port **5432**, database **duitku**, pengguna **kel02**, sesuai koreksi pengguna. Password hanya disimpan pada `.env.local` yang tidak dilacak Git.

Pemeriksaan terbaru berhasil: koneksi TCP, autentikasi PostgreSQL, query database, dan hak CREATE schema tersedia. `npm run db:migrate` berhasil membuat schema/tabel aplikasi di database `duitku`. Aplikasi di-restart untuk memakai koneksi baru, kemudian seluruh 27 pemeriksaan integrasi terhadap database utama lulus.

Perintah untuk memeriksa kembali:

```powershell
npm run db:check
npm run db:migrate
npm run dev
# Di terminal terpisah:
npm run test:integration
```

## Artefak visual

Screenshot berada di `output/playwright/`:

- `login-desktop.png`
- `register-mobile.png`
- `form-mobile.png`
- `dashboard-desktop.png`
- `dashboard-mobile.png`

Nominal dan akun pada screenshot dashboard adalah data sementara di database QA lokal, bukan data pengguna pada database utama. Folder `output/` diabaikan Git dan tidak digunakan aplikasi produksi.

## SRS-10–12 — 28 September 2026

- Tabel `duitku.budgets` berhasil dimigrasikan ke PostgreSQL proyek dengan `npm run db:migrate`.
- `npm run lint`, `npm run typecheck`, dan `npm run build`: lulus.
- `TEST_BASE_URL=http://localhost:3100 npm run test:integration`: **58 pemeriksaan lulus** menggunakan build produksi dan PostgreSQL proyek. Data akun pengujian dibersihkan otomatis.
- Cakupan tambahan: API anggaran, isolasi antar-akun, session kedaluwarsa, validasi nominal/bulan, penolakan pemalsuan pemilik dan Origin lain, persistensi/upsert, ringkasan per bulan, batas akhir bulan, pemindahan tanggal transaksi, dan peringatan setelah penghapusan transaksi.
- Verifikasi visual panel baru belum dilakukan: tidak ada browser yang tersedia melalui alat browser pada sesi ini. Pengujian integrasi memverifikasi API dan respons halaman, bukan interaksi AJAX di browser.
- Dokumentasi penggunaan, kontrak API, dan batasan perhitungan: `db/BUDGET.md`.

### Verifikasi visual melalui browser terintegrasi VS Code

Pada sesi lanjutan 28 September 2026, dashboard `http://localhost:3000/dashboard` berhasil diakses melalui kontrol aplikasi desktop VS Code.

- Panel anggaran terlihat di bawah kartu ringkasan; judul, nominal, input, dan tombol simpan terbaca tanpa tumpang tindih pada tata letak yang diperiksa.
- Teramati tata letak ringkasan tiga kolom pada area lebar dan baris bertumpuk pada area lebih sempit.
- Pergantian September ke Oktober memperbarui judul panel dan pengeluaran dari Rp100.000 menjadi Rp0 tanpa navigasi halaman; kembali ke September mengembalikan Rp100.000.
- Mode semua periode menampilkan petunjuk memilih satu bulan, dan tombol Bulan ini mengembalikan panel anggaran.
- Periode dikembalikan ke September. Tidak ada anggaran atau transaksi pengguna yang diubah.
- Cakupan visual ini hanya keadaan anggaran belum ditetapkan dan pergantian periode. Penyimpanan anggaran, progress bar, dan peringatan terlampaui belum diuji secara visual; logikanya sudah tercakup tes integrasi di atas.
