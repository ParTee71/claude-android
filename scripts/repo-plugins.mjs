#!/usr/bin/env node
// Gör varje repos `.claude/` under en gemensam rot till en lokal plugin, så att repots egna
// skills, agenter och hookar laddas även när sessionen startar ovanför repona (projekttrådar i
// claude.ai startar i `/home/user`, och då läses inget repos `.claude/`). Körs av miljöns
// setup-skript; repona ändras inte.
//
// Varje repo blir pluginen `<repo i gemener>` i marknadsplatsen `repon` under `<rot>/.repo-plugins`:
// - `skills/`, `agents/` och `commands/` är symlänkar till repots kataloger, så en ändrad skill
//   slår igenom direkt. Skillsen heter `<repo>:<namn>`, så samma namn i två repon krockar inte.
// - Hookarna i repots `.claude/settings.json` går via `repo-hook.mjs`, som bara kör dem när
//   händelsen rör repot (se där). Regel 4-hooken hoppas över: pluginens `regel4-dispatch` kör den.
//
//   node repo-plugins.mjs [rot] [--no-install]

import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARKETPLACE = 'repon';
export const GUARD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'repo-hook.mjs');
const LINKED = ['skills', 'agents', 'commands'];

/** Pluginnamn: gemener, bara a–z, 0–9 och bindestreck. */
export const pluginName = (dir) => path.basename(dir).toLowerCase().replace(/[^a-z0-9-]+/g, '-');

const shQuote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

function readSettings(repo) {
  try {
    return JSON.parse(readFileSync(path.join(repo, '.claude/settings.json'), 'utf8'));
  } catch {
    return {};
  }
}

/** Repots hookar omskrivna till pluginens format, via vakten. Tomt objekt om inga finns. */
export function convertHooks(repo, settings) {
  const out = {};
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    for (const group of groups ?? []) {
      const hooks = (group.hooks ?? [])
        .filter((h) => h.type === 'command' && h.command && !h.command.includes('regel4-check'))
        .map((h) => ({ ...h, command: `node ${shQuote(GUARD)} ${shQuote(repo)} ${shQuote(h.command)}` }));
      if (hooks.length > 0) (out[event] ??= []).push({ ...group, hooks });
    }
  }
  return out;
}

/** Repona direkt under roten som har något att ladda. */
export function reposUnder(base) {
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => path.join(base, d.name))
    .filter((repo) => {
      const claude = path.join(repo, '.claude');
      return LINKED.some((k) => existsSync(path.join(claude, k)))
        || Object.keys(convertHooks(repo, readSettings(repo))).length > 0;
    });
}

/** Bygger marknadsplatsen på nytt och returnerar pluginnamnen. */
export function build(base, out = path.join(base, '.repo-plugins')) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(path.join(out, '.claude-plugin'), { recursive: true });
  const plugins = [];
  for (const repo of reposUnder(base)) {
    const name = pluginName(repo);
    const dir = path.join(out, name);
    mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
    writeFileSync(path.join(dir, '.claude-plugin/plugin.json'), JSON.stringify({
      name, version: '0.0.0', description: `${path.basename(repo)}: repots egna skills, agenter och hookar`,
    }, null, 2));
    for (const k of LINKED) {
      const src = path.join(repo, '.claude', k);
      if (existsSync(src)) symlinkSync(src, path.join(dir, k));
    }
    const hooks = convertHooks(repo, readSettings(repo));
    if (Object.keys(hooks).length > 0) {
      mkdirSync(path.join(dir, 'hooks'));
      writeFileSync(path.join(dir, 'hooks/hooks.json'), JSON.stringify({ hooks }, null, 2));
    }
    plugins.push(name);
  }
  writeFileSync(path.join(out, '.claude-plugin/marketplace.json'), JSON.stringify({
    name: MARKETPLACE,
    owner: { name: 'ParTee71' },
    plugins: plugins.map((name) => ({ name, source: `./${name}` })),
  }, null, 2));
  return { out, plugins };
}

function claude(...args) {
  const r = spawnSync('claude', args, { encoding: 'utf8' });
  process.stdout.write(`$ claude ${args.join(' ')}\n${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `${r.error}\n` : ''}`);
}

function main() {
  const args = process.argv.slice(2);
  const base = args.find((a) => !a.startsWith('--')) ?? '/home/user';
  const { out, plugins } = build(base);
  console.log(`${out}: ${plugins.join(', ') || 'inga repon'}`);
  if (args.includes('--no-install') || plugins.length === 0) return;
  claude('plugin', 'marketplace', 'add', out);
  for (const name of plugins) claude('plugin', 'install', `${name}@${MARKETPLACE}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
