#!/usr/bin/env node
// Vakten för en repohook som laddas via repo-plugins.mjs. Hooken körs med repot som
// projektrot (`CLAUDE_PROJECT_DIR`, arbetskatalog), men bara när händelsen rör repot:
// - Är sessionens projektrot repot självt gör vakten ingenting: repots egna inställningar kör
//   redan hooken, och två körningar skulle ge dubbla besked.
// - Har händelsen en fil (`tool_input.file_path`) körs hooken bara om filen ligger i repot.
// - Stop och SubagentStop körs bara om repot har ändringar: ocommittade filer eller commits som
//   inte finns på origin. Går det inte att avgöra körs den.
// - Övriga händelser körs alltid: en vakt på Bash (PreToolUse) ska se varje kommando, eftersom
//   ett kommando kan röra repot utan att nämna en fil, och SessionStart körs en gång.
// Hookens stdout, stderr och exitkod förs vidare oförändrade.
//
//   node repo-hook.mjs <repo> <kommando>

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STOP = new Set(['Stop', 'SubagentStop']);

function parse(raw) {
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const inside = (repo, file) => {
  const rel = path.relative(repo, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

function git(repo, ...args) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Har repot ocommittade filer eller commits utöver origin? null om det inte går att avgöra. */
export function changed(repo) {
  const status = git(repo, 'status', '--porcelain');
  if (status === null) return null;
  if (status !== '') return true;
  const ahead = git(repo, 'rev-list', '--count', '@{upstream}..HEAD') ?? git(repo, 'rev-list', '--count', 'origin/HEAD..HEAD');
  return ahead === null ? null : Number(ahead) > 0;
}

/** Ska hooken köras för den här händelsen? */
export function shouldRun(repo, input, projectDir) {
  if (projectDir && path.resolve(projectDir) === path.resolve(repo)) return false;
  const file = input?.tool_input?.file_path;
  if (file) return inside(repo, path.resolve(input.cwd ?? repo, file));
  if (STOP.has(input?.hook_event_name)) return changed(repo) !== false;
  return true;
}

function main() {
  const [repo, command] = process.argv.slice(2);
  if (!repo || !command) return 0;
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    // Ingen indata.
  }
  if (!shouldRun(repo, parse(raw), process.env.CLAUDE_PROJECT_DIR)) return 0;
  const r = spawnSync('sh', ['-c', command], {
    input: raw, cwd: repo, env: { ...process.env, CLAUDE_PROJECT_DIR: repo }, encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
