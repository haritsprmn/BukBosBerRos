import { WalletCards } from "lucide-react";
import Link from "next/link";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      className={`brand ${light ? "brand-light" : ""}`}
      href="/"
      aria-label="BukBosBerRos beranda"
    >
      <span className="brand-icon">
        <WalletCards size={23} />
      </span>
      <span>
        BukBos<br></br>BerRos
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
