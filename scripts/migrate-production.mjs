import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const database = "clinica-teste-agendamentos-db";
const wranglerBin = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);

function runWrangler(args, capture = false) {
  const result = spawnSync(
    process.execPath,
    [wranglerBin, ...args],
    {
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    },
  );

  if (capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Wrangler encerrou com código ${result.status ?? "desconhecido"}.`);
  }

  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function query(sql) {
  return runWrangler(
    ["d1", "execute", database, "--remote", "--command", sql, "--yes"],
    true,
  );
}

function apply(file) {
  console.log(`\nAplicando ${file}...`);
  runWrangler([
    "d1",
    "execute",
    database,
    "--remote",
    "--file",
    file,
    "--yes",
  ]);
}

function hasTable(name) {
  const output = query("SELECT name FROM sqlite_master WHERE type='table';");
  return new RegExp(`\\b${name}\\b`, "i").test(output);
}

function hasColumn(table, column) {
  const output = query(`PRAGMA table_info('${table}');`);
  return new RegExp(`\\b${column}\\b`, "i").test(output);
}

console.log("Verificando schema remoto antes do deploy...");

if (!hasTable("appointments")) {
  apply("drizzle/0000_quick_leopardon.sql");
}

if (!hasColumn("appointments", "patient_phone")) {
  apply("drizzle/0001_add_patient_phone.sql");
}

if (!hasColumn("appointments", "provider_id")) {
  apply("drizzle/0002_add_provider_schedule.sql");
}

if (!hasColumn("appointments", "status")) {
  apply("drizzle/0003_add_appointment_status.sql");
}

console.log("\nSchema remoto atualizado com segurança.");
