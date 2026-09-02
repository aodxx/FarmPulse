import { readFile, writeFile } from "node:fs/promises";

const databaseId = process.argv[2];
if (!databaseId) throw new Error("Usage: node scripts/configure-d1.mjs <database-id>");

const configPath = new URL("../wrangler.toml", import.meta.url);
let config = await readFile(configPath, "utf8");
const binding = `[[d1_databases]]
binding = "DB"
database_name = "farmpulse-db"
database_id = "${databaseId}"
migrations_dir = "migrations"`;
const existing = /\n\[\[d1_databases\]\][\s\S]*?(?=\n\[|$)/;
config = existing.test(config) ? config.replace(existing, `\n${binding}\n`) : `${config.trimEnd()}\n\n${binding}\n`;
await writeFile(configPath, config);
console.log(`Configured D1 binding DB (${databaseId}).`);
