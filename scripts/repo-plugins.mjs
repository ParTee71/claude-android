#!/usr/bin/env node
// Gör hookarna i varje repos `.claude/settings.json` under en gemensam rot till en lokal plugin,
// så att de körs även när sessionen startar ovanför repona (projekttrådar i claude.ai startar i
// `/home/user`, och då läses inget repos `settings.json`). Körs av miljöns setup-skript; repona
// ändras inte.
//
// Varje repo med hookar blir pluginen `<repo i gemener>` i marknadsplatsen `repon` under
// `<rot>/.repo-plugins`. Hookarna går via `repo-hook.mjs`, som bara kör dem när händelsen rör
// repot (se där). Regel 4-hooken (PostToolUse och Stop) hoppas över: pluginens `regel4-dispatch`
// kör den.
//
// Pluginen bär bara hookar (#37). Skills och agenter hittar Claude Code själv i repots
// `.claude/` under roten; en plugin som länkar dit avvisas ("Path escapes plugin directory"),
// och en kopia blir gammal eftersom setup-skriptet körs innan repona hämtas på nytt.
//
//   node repo-plugins.mjs [rot] [--no-install]

import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARKETPLACE = 'repon';
export const GUARD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'repo-hook.mjs');

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

/**
 * Är det repots regel 4-hook? Den körs av pluginens `regel4-dispatch` (efter en ändring och vid
 * Stop). En SessionStart som bara letar upp sin katalog via samma filnamn är det inte (#39).
 */
const runsRegel4 = (event, command) => (event === 'PostToolUse' || event === 'Stop') && command.includes('regel4-check');

/** Repots hookar omskrivna till pluginens format, via vakten. Tomt objekt om inga finns. */
export function convertHooks(repo, settings) {
  const out = {};
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    for (const group of groups ?? []) {
      const hooks = (group.hooks ?? [])
        .filter((h) => h.type === 'command' && h.command && !runsRegel4(event, h.command))
        .map((h) => ({ ...h, command: `node ${shQuote(GUARD)} ${shQuote(repo)} ${shQuote(h.command)}` }));
      if (hooks.length > 0) (out[event] ??= []).push({ ...group, hooks });
    }
  }
  return out;
}

/** Repona direkt under roten som har hookar att ladda. */
export function reposUnder(base) {
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => path.join(base, d.name))
    .filter((repo) => Object.keys(convertHooks(repo, readSettings(repo))).length > 0);
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
      name, version: '0.0.0', description: `${path.basename(repo)}: repots egna hookar`,
    }, null, 2));
    mkdirSync(path.join(dir, 'hooks'));
    writeFileSync(path.join(dir, 'hooks/hooks.json'),
      JSON.stringify({ hooks: convertHooks(repo, readSettings(repo)) }, null, 2));
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
