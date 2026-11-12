#!/usr/bin/env node
// Gör hookarna i varje repos `.claude/settings.json` under en gemensam rot till en lokal plugin,
// så att de körs även när sessionen startar ovanför repona (projekttrådar i claude.ai startar i
// `/home/user`, och då läses inget repos `settings.json`). Körs av miljöns setup-skript; repona
// ändras inte.
//
// Varje repo med hookar blir pluginen `<repo i gemener>` i marknadsplatsen `repon` under
// `<rot>/.repo-plugins`. Hookarna går via `repo-hook.mjs`, som bara kör dem när händelsen rör
// repot (se där). Regel 4-hooken (PostToolUse och Stop) hoppas över: pluginens `regel4-check`
// kör den.
//
// Pluginen bär bara hookar (#37). Skills och agenter hittar Claude Code själv i repots
// `.claude/` under roten; en plugin som länkar dit avvisas ("Path escapes plugin directory"),
// och en kopia blir gammal eftersom setup-skriptet körs innan repona hämtas på nytt.
//
// Repons `permissions.deny` och `ask` läggs i användarinställningarna (`~/.claude/settings.json`),
// eftersom en plugin inte kan bära behörigheter (#40). Sökvägar skrivs om till repots absoluta
// sökväg, så att en spärr från ett repo bara gäller där. `allow` tas inte med: en tillåtelse från
// ett repo ska inte gälla i ett annat. Befintliga nycklar i filen lämnas orörda.
// `env` får en standardmodell för agenter utan egen modell (`DEFAULT_ENV`) om den inte redan är satt.
// Den verkar bara när setup-skriptet faktiskt körs; miljöbilden återanvänds annars (#67), så
// variabeln ska också ligga i molnmiljöns inställningar. Hooken `repo-sync` förnyar spärrarna.
//
//   node repo-plugins.mjs [rot] [--no-install] [--settings <fil>]

import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
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
 * Är det repots regel 4-hook? Den körs av pluginens `regel4-check` (efter en ändring och vid
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

/** Verktyg vars regel pekar ut en sökväg (gitignore-mönster). */
const PATH_TOOLS = new Set(['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/**
 * En behörighetsregel ur repots inställningar, med sökvägen gjord absolut mot repot
 * (`Read(./.env)` i VeckansMat blir `Read(//home/user/VeckansMat/.env)`). Andra regler, t.ex.
 * för Bash, gäller kommandon och lämnas som de är.
 */
export function anchorRule(repo, rule) {
  const m = /^(\w+)\((.*)\)$/.exec(rule);
  if (!m || !PATH_TOOLS.has(m[1])) return rule;
  const spec = m[2];
  if (spec.startsWith('//') || spec.startsWith('~')) return rule;
  const rest = spec.replace(/^\.?\//, '');
  return `${m[1]}(/${path.resolve(repo)}/${rest})`;
}

/** Repots `deny` och `ask`, förankrade i repot. */
export function repoPermissions(repo, settings) {
  const p = settings.permissions ?? {};
  return {
    deny: (p.deny ?? []).map((r) => anchorRule(repo, r)),
    ask: (p.ask ?? []).map((r) => anchorRule(repo, r)),
  };
}

/** Alla repons `deny` och `ask` under roten, utan dubbletter. */
export function collectPermissions(base) {
  const deny = new Set();
  const ask = new Set();
  if (!existsSync(base)) return { deny: [], ask: [] };
  for (const d of readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.')) continue;
    const dir = path.join(base, d.name);
    const perms = repoPermissions(dir, readSettings(dir));
    perms.deny.forEach((r) => deny.add(r));
    perms.ask.forEach((r) => ask.add(r));
  }
  return { deny: [...deny], ask: [...ask] };
}

/**
 * Agenter utan egen `model` (general-purpose, kopierade agentfiler) kör annars trådens modell –
 * på en Fable-tråd Fable. `Explore` och `Plan` är `inherit` och påverkas inte; för dem gäller
 * regeln i skill `ai-model-choice`.
 */
export const DEFAULT_ENV = { CLAUDE_CODE_SUBAGENT_MODEL: 'opus' };

/** Lägger reglerna och `env` i inställningsfilen; befintliga nycklar, regler och värden står kvar. */
export function mergeSettings(file, { deny, ask }, env = DEFAULT_ENV) {
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // ingen fil eller ogiltig: börja från tomt
  }
  const permissions = settings.permissions ?? {};
  const add = (list, rules) => [...new Set([...(list ?? []), ...rules])];
  if (deny.length > 0) permissions.deny = add(permissions.deny, deny);
  if (ask.length > 0) permissions.ask = add(permissions.ask, ask);
  if (deny.length > 0 || ask.length > 0) settings.permissions = permissions;
  // ett värde användaren redan satt vinner
  if (Object.keys(env).length > 0) settings.env = { ...env, ...settings.env };
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  return settings;
}

function claude(...args) {
  const r = spawnSync('claude', args, { encoding: 'utf8' });
  process.stdout.write(`$ claude ${args.join(' ')}\n${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `${r.error}\n` : ''}`);
}

function main() {
  const args = process.argv.slice(2);
  const base = args.find((a, j) => !a.startsWith('--') && args[j - 1] !== '--settings') ?? '/home/user';
  const i = args.indexOf('--settings');
  const settingsFile = i >= 0 ? args[i + 1] : path.join(homedir(), '.claude/settings.json');
  const perms = collectPermissions(base);
  mergeSettings(settingsFile, perms);
  console.log(`${settingsFile}: ${perms.deny.length} deny, ${perms.ask.length} ask, env ${Object.keys(DEFAULT_ENV).join(', ')}`);
  const { out, plugins } = build(base);
  console.log(`${out}: ${plugins.join(', ') || 'inga repon'}`);
  if (args.includes('--no-install') || plugins.length === 0) return;
  claude('plugin', 'marketplace', 'add', out);
  for (const name of plugins) claude('plugin', 'install', `${name}@${MARKETPLACE}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
