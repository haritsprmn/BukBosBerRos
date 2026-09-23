import { z } from "zod";

export const categories = {
  income: ["Uang saku", "Gaji & freelance", "Beasiswa", "Hadiah", "Lainnya"],
  expense: [
    "Makan & minum",
    "Transportasi",
    "Belanja",
    "Pendidikan",
    "Hiburan",
    "Tagihan",
    "Kesehatan",
    "Lainnya",
  ],
};
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Alamat email tidak valid.")
    .max(254),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128),
});
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const transactionSchema = z
  .object({
    title: z.string().trim().min(1, "Nama transaksi wajib diisi.").max(100),
    type: z.enum(["income", "expense"]),
    amount: z
      .number()
      .int("Nominal harus berupa rupiah bulat.")
      .positive("Nominal harus lebih dari nol.")
      .max(10000000000, "Nominal maksimal Rp10 miliar."),
    category: z.string(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.")
      .refine((value) => {
        const parsed = new Date(value + "T00:00:00Z");
        return (
          !isNaN(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value &&
          value >= "1900-01-01" &&
          value <= "2100-12-31"
        );
      }, "Tanggal tidak valid (1900–2100)."),
    note: z.string().trim().max(500).default(""),
  })
  .refine((value) => categories[value.type].includes(value.category), {
    message: "Kategori tidak sesuai jenis transaksi.",
    path: ["category"],
  });
export type Transaction = z.infer<typeof transactionSchema> & { id: string };
export type User = { id: string; name: string; email: string };
export const rupiah = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
