import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DUITku — Uang terarah, kuliah lebih tenang",
  description:
    "Kelola pemasukan, pengeluaran, dan keuangan pribadimu dalam satu ruang sederhana.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
