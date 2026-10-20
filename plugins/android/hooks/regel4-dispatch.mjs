#!/usr/bin/env node
// Regel 4-hooken via pluginen: lämnar varje händelse till repots egen
// `.claude/hooks/regel4-check.mjs`, som har mönstren och testas i repots CI. Behövs när
// sessionens projektrot är en gemensam katalog med flera repon under sig – då laddas inget
// repos `.claude/settings.json`, och utan pluginen körs ingen kontroll alls.
//
// Är projektroten själv ett repo med egen hook gör pluginen ingenting: repots egna
// inställningar kör redan hooken, och två körningar skulle ge dubbla besked.
//
// PostToolUse: repot räknas från den ändrade filen; hookens exitkod och stderr förs vidare.
// Stop: varje repo direkt under roten kontrolleras med `--stop`; blockeringarna slås ihop.
// Varje besked (PostToolUse-träff, Stop-blockering per repo) ger en rad i beskedloggen (log.mjs).

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logBesked } from './log.mjs';

export const HOOK_REL = '.claude/hooks/regel4-check.mjs';

const hasHook = (dir) => existsSync(path.join(dir, HOOK_REL));

function readRaw() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parse(raw) {
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Närmaste katalog uppåt från filen som har en egen regel 4-hook, annars null. */
export function repoFor(file) {
  let dir = path.dirname(file);
  for (;;) {
    if (hasHook(dir)) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** Repona med egen hook direkt under roten. */
export function childRepos(base) {
  if (!base || !existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(base, d.name))
    .filter(hasHook);
}

function run(root, args, raw) {
  return spawnSync('node', [path.join(root, HOOK_REL), ...args], {
    input: raw, env: { ...process.env, CLAUDE_PROJECT_DIR: root }, encoding: 'utf8', timeout: 15000,
  });
}

function afterEdit(base, raw) {
  const filePath = parse(raw)?.tool_input?.file_path;
  if (!filePath) return 0;
  const root = repoFor(path.isAbsolute(filePath) ? filePath : path.join(base, filePath));
  if (!root) return 0;
  const r = run(root, [], raw);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 2) return 0;
  logBesked('regel4-dispatch', 'regel4', root);
  return 2;
}

function beforeStop(base, raw) {
  if (parse(raw)?.stop_hook_active) return 0;
  const reasons = [];
  for (const root of childRepos(base)) {
    const r = run(root, ['--stop'], raw);
    try {
      const out = JSON.parse(r.stdout);
      if (out.decision === 'block') {
        reasons.push(out.reason);
        logBesked('regel4-dispatch', 'regel4-stop', root);
      }
    } catch {
      // Inget eller oläsligt svar: repot har inget att anmärka.
    }
  }
  if (reasons.length > 0) process.stdout.write(JSON.stringify({ decision: 'block', reason: reasons.join('\n') }));
  return 0;
}

function main() {
  const raw = readRaw();
  const base = process.env.CLAUDE_PROJECT_DIR || parse(raw).cwd || process.cwd();
  if (hasHook(base)) return 0;
  return process.argv.includes('--stop') ? beforeStop(base, raw) : afterEdit(base, raw);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
