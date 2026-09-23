import pg from "pg";
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
    `Tujuan: ${config.host}:${config.port}, database=${config.database}, user=${config.user}`,
  );
  stage = "TCP";
  await checkTcp(config);
  console.log("OK: koneksi TCP berhasil.");
  stage = "PostgreSQL";
  client = new pg.Client(config);
  await client.connect();
  console.log("OK: autentikasi PostgreSQL berhasil.");
  stage = "query pemeriksaan";
  const result = await client.query(`SELECT
    EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='duitku') AS schema_ready,
    has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_schema`);
  console.log("OK: query database berhasil.");
  console.log(
    `Schema duitku: ${result.rows[0].schema_ready ? "tersedia" : "belum dibuat"}.`,
  );
  console.log(
    `Hak CREATE schema: ${result.rows[0].can_create_schema ? "tersedia" : "tidak tersedia"}.`,
  );
  console.log("Lanjutkan dengan npm run db:migrate.");
} catch (error) {
  if (stage === "konfigurasi") console.error(error.message);
  else explainFailure(error, stage, config);
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}
