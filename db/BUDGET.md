# Harits — Database, Access Control & Budget (SRS-10–12)

## Penyimpanan dan akses (SRS-10)

`db/schema.sql` menyimpan pengguna, session, transaksi, dan anggaran dalam schema PostgreSQL `duitku`. Jalankan `npm run db:migrate` setelah mengatur `DATABASE_URL` di `.env.local`. Migrasi dapat dijalankan kembali dan tidak menghapus data yang sudah ada.

Tabel `budgets` memakai primary key `(user_id, month)` sehingga setiap pengguna hanya memiliki satu anggaran untuk satu bulan. `month` selalu tanggal pertama bulan tersebut. Foreign key ke `users` memakai `ON DELETE CASCADE`; nominal harus berupa rupiah bulat positif, maksimal Rp10 miliar. Primary key sekaligus mengindeks pencarian anggaran per pengguna/bulan. Agregasi pengeluaran menggunakan indeks transaksi `(user_id, date, created_at)` yang sudah ada.

Semua API data memperoleh identitas dari session PostgreSQL yang belum kedaluwarsa melalui `getUser()`. Pembatasan akses berada di query server: pembacaan dan penulisan anggaran memakai `user.id`; daftar transaksi memakai `user_id`, sedangkan perubahan/penghapusan transaksi memeriksa `id` dan `user_id`. Input anggaran tidak menerima identitas pengguna dari klien. Query memakai parameter SQL. Mutasi memeriksa Origin dan Content-Type JSON.

## Anggaran dan ringkasan (SRS-11–12)

Pilih bulan di filter periode dashboard, lalu isi **Anggaran bulanan** dan klik **Simpan anggaran**. Menyimpan kembali pada bulan yang sama mengubah anggaran yang sudah ada. Anggaran bulan lain tetap terpisah. Pada mode semua periode, dashboard meminta pengguna memilih satu bulan.

- `GET /api/budgets?month=2026-09`: mengembalikan `{ summary: { month, amount, expense, remaining, percentage, exceeded } }`.
- `PUT /api/budgets` dengan JSON `{ "month": "2026-09", "amount": 2000000 }`: menyimpan anggaran milik pengguna yang login.
- Bulan wajib berbentuk `YYYY-MM`, dalam rentang 1900–2100. Respons 400 untuk input tidak valid, 401 untuk session tidak valid, dan 403 untuk Origin mutasi yang tidak sesuai.
- `expense` menjumlahkan seluruh transaksi `expense` milik pengguna dalam rentang tanggal awal bulan (inklusif) hingga awal bulan berikutnya (eksklusif). Pemasukan, pencarian, kategori, dan halaman daftar tidak memengaruhi total anggaran.
- `remaining = amount - expense`; `percentage = expense / amount × 100`; `exceeded` benar hanya saat pengeluaran lebih besar dari anggaran. Progress bar dibatasi 100%, sementara teks tetap menampilkan persentase sebenarnya.
- Bila belum ada anggaran, `amount`, `remaining`, dan `percentage` bernilai `null`; pengeluaran tetap ditampilkan. Saat tepat habis, tampil pesan anggaran habis; saat melampaui batas, tampil peringatan dan selisih kelebihan.

Komponen `src/components/budget-panel.tsx` memakai `fetch` tanpa reload halaman saat menyimpan, memilih bulan, atau setelah transaksi ditambah/diubah/dihapus. Permintaan pembacaan yang sudah tidak relevan dibatalkan agar respons bulan lama tidak menimpa bulan baru. Tersedia status memuat, pesan sukses/gagal, tombol coba ulang, dan dukungan penyembunyian nominal.

## Pengujian

Jalankan server aplikasi, kemudian `npm run test:integration`. Gunakan `TEST_BASE_URL` bila server tidak berada di `http://localhost:3000`. Tes membuat dua akun sementara dan membersihkan datanya otomatis, termasuk anggaran melalui foreign key cascade.

Pemeriksaan meliputi akses anonim/session kedaluwarsa, isolasi transaksi dan anggaran antar-akun, pemalsuan pemilik, validasi bulan/nominal, Origin mutasi, persistensi PostgreSQL, pembaruan anggaran tanpa duplikasi, anggaran belum diatur/tepat habis/terlampaui, dan agregasi setelah transaksi dipindah bulan atau dihapus.
