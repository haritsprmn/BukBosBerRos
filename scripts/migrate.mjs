import pg from "pg";
import { readFile } from "node:fs/promises";
import {
  databaseConfig,
  checkTcp,
  explainFailure,
} from "./database-connection.mjs";
let client;
let config;
let stage = "konfigurasi";
try {
  config = databaseConfig();
  console.log(
    `Memeriksa PostgreSQL ${config.host}:${config.port} / ${config.database}...`,
  );
  stage = "TCP";
  await checkTcp(config);
  stage = "PostgreSQL";
  client = new pg.Client(config);
  await client.connect();
  stage = "migrasi SQL";
  await client.query(
    await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"),
  );
  console.log("Migrasi berhasil: schema duitku siap digunakan.");
} catch (error) {
  console.error("Migrasi gagal.");
  if (stage === "konfigurasi") console.error(error.message);
  else explainFailure(error, stage, config);
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}
