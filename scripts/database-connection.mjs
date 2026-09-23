import nextEnv from "@next/env";
import net from "node:net";

export function databaseConfig() {
  nextEnv.loadEnvConfig(process.cwd());
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("DATABASE_URL belum diatur di .env.local.");
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Format DATABASE_URL tidak valid. Periksa .env.local.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error(
      "DATABASE_URL harus memakai postgresql://USER:PASSWORD@HOST:PORT/DATABASE.",
    );
  }
  return {
    connectionString,
    host: url.hostname.replace(/^\[|\]$/g, ""),
    port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  };
}

export function checkTcp({ host, port, connectionTimeoutMillis }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      const error = new Error(
        `Koneksi TCP ke ${host}:${port} tidak mendapat respons dalam ${connectionTimeoutMillis / 1000} detik.`,
      );
      error.code = "ETIMEDOUT";
      socket.destroy(error);
    }, connectionTimeoutMillis);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export function explainFailure(error, stage, config) {
  console.error(`Gagal pada tahap ${stage}.`);
  if (stage === "TCP") {
    if (error.code === "ETIMEDOUT") {
      console.error(
        `Port ${config.host}:${config.port} tidak merespons dalam 10 detik. Autentikasi PostgreSQL dan SQL belum dijalankan.`,
      );
    } else if (error.code === "ECONNREFUSED") {
      console.error(
        `Koneksi ke ${config.host}:${config.port} ditolak. Periksa service PostgreSQL, alamat listener, atau pemetaan port container.`,
      );
    } else {
      console.error(
        `Koneksi jaringan gagal (${error.code || "UNKNOWN"}) ke ${config.host}:${config.port}.`,
      );
    }
    console.error(
      "Periksa Tailscale/VPN, listen_addresses PostgreSQL, firewall server, dan ACL Tailscale untuk port tujuan.",
    );
    console.error(
      "Ping Tailscale yang berhasil belum membuktikan port PostgreSQL dapat diakses.",
    );
  } else if (error.code === "28P01") {
    console.error(
      "Server dapat dijangkau, tetapi username/password ditolak. Periksa DATABASE_URL di .env.local.",
    );
  } else if (error.code === "28000") {
    console.error(
      "Server menolak aturan autentikasi koneksi ini. Periksa pg_hba.conf dan persyaratan SSL pada server.",
    );
  } else if (error.code === "3D000") {
    console.error(
      "Database tujuan tidak ditemukan pada server. Periksa nama database di DATABASE_URL.",
    );
  } else if (error.code === "42501") {
    console.error(
      "Role database tidak memiliki izin yang dibutuhkan. Periksa hak CREATE schema dan kepemilikan tabel duitku.",
    );
  } else if (
    stage === "PostgreSQL" &&
    /timeout|terminated unexpectedly/i.test(error.message)
  ) {
    console.error(
      "Port TCP terbuka, tetapi handshake/autentikasi PostgreSQL tidak selesai. Periksa service database dan konfigurasi SSL server.",
    );
  } else {
    // Do not print a raw connection URL or password in diagnostics.
    console.error(
      error.code
        ? `Kode PostgreSQL: ${error.code}.`
        : "Periksa konfigurasi dan log PostgreSQL di server.",
    );
  }
}
