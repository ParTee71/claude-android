#!/usr/bin/env node
// Förnyar vid sessionsstart det setup-skriptet skriver utanför pluginen (#67).
//
// Molnmiljön kör inte setup-skriptet i varje tråd: en ny tråd kan starta från en sparad bild där
// `~/.claude/settings.json` skrevs dagar tidigare. Pluginen läses ur den färska klonen och följer
// med varje merge, men repons `deny` och `ask` (#40), som `scripts/repo-plugins.mjs` lägger i
// användarinställningarna, gör det inte. Den här hooken lägger in dem igen ur de färska klonerna.
// Claude Code läser om spärrarna i filen direkt (prövat 2026-11-12), så de gäller i samma session.
//
// `env` läses däremot bara när sessionen startar (prövat samma dag: en agent startad efter att
// `CLAUDE_CODE_SUBAGENT_MODEL` skrivits i filen körde ändå trådens modell). Standardmodellen för
// agenter måste därför ligga som variabel i molnmiljöns inställningar; hooken säger till när den
// saknas.
//
// Pluginen ska komma från claude.ai-kontot (`android@synced`, #69): den synkas från GitHub och når
// varje ny tråd, medan en kopia som setup-skriptet installerat ligger i miljöbilden och blir gammal.
// En installerad kopia har dessutom företräde framför kontots. Hooken säger därför till när
// pluginen läses från något annat ställe än kontots synkade kopia.
//
// Bara i molnet (CLAUDE_CODE_REMOTE). Tyst när inget ändrats. Stoppar aldrig sessionen.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logBesked } from './log.mjs';

// Spärrarna läses med funktionerna i claude-androids `scripts/repo-plugins.mjs`. Kontots kopia av
// pluginen har bara pluginmappen, så skriptet söks också i setup-skriptets klon. Finns ingen klon
// (utanför molnet) gör hooken ingenting med spärrarna.
const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCRIPT_CANDIDATES = [
  path.resolve(PLUGIN_ROOT, '../../scripts/repo-plugins.mjs'),
  '/home/user/claude-android/scripts/repo-plugins.mjs',
  '/opt/claude-android/scripts/repo-plugins.mjs',
];

let lib = null;
for (const file of SCRIPT_CANDIDATES) {
  if (!existsSync(file)) continue;
  try {
    lib = await import(pathToFileURL(file).href);
    break;
  } catch {
    // nästa kandidat
  }
}

/** Kommer pluginen från claude.ai-kontot (`~/.claude/plugins/synced/…`)? */
export const isSynced = (root) => root.split(path.sep).join('/').includes('/.claude/plugins/synced/');

function rules(file) {
  try {
    const p = JSON.parse(readFileSync(file, 'utf8')).permissions ?? {};
    return new Set([...(p.deny ?? []), ...(p.ask ?? [])]);
  } catch {
    return new Set();
  }
}

/** Lägger repons spärrar i inställningsfilen och returnerar beskeden (tom lista = inget att säga). */
export function run({
  root,
  env = process.env,
  settingsFile = path.join(homedir(), '.claude/settings.json'),
  pluginRoot = PLUGIN_ROOT,
}) {
  if (!lib) return [];
  const { collectPermissions, DEFAULT_ENV, mergeSettings } = lib;
  const lines = [];
  if (!isSynced(pluginRoot)) {
    lines.push(
      `Pluginen läses ur ${pluginRoot}, inte från claude.ai-kontot – en kopia som setup-skriptet installerat har företräde och blir gammal. ` +
        'Byt setup-skriptet i Claude-miljön mot blocket i claude-android README → Installation, och lägg till pluginen android på kontot (Customize → Plugins).',
    );
  }
  const perms = collectPermissions(root);
  const before = rules(settingsFile);
  const added = [...perms.deny, ...perms.ask].filter((r) => !before.has(r));
  if (added.length > 0) {
    try {
      // `env` skrivs inte här: den verkar först i nästa session och ska komma från miljön.
      mergeSettings(settingsFile, perms, {});
      lines.push(`Repons spärrar: ${added.length} nya regler lagda i ${settingsFile} (fanns inte i miljöbilden)`);
    } catch (e) {
      lines.push(`Repons spärrar: kunde inte skrivas (${e.message})`);
    }
  }
  for (const name of Object.keys(DEFAULT_ENV)) {
    if (!env[name]) {
      lines.push(
        `${name} saknas i miljön – agenter utan egen modell kör trådens modell. ` +
          `Lägg ${name}=${DEFAULT_ENV[name]} under Environment variables i Claude-miljöns inställningar (claude-android README → Installation).`,
      );
    }
  }
  return lines;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.CLAUDE_CODE_REMOTE === 'true') {
    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    try {
      const lines = run({ root });
      if (lines.length) {
        console.log(lines.join('\n'));
        logBesked('repo-sync', 'miljöbild', root);
      }
    } catch {
      // Sessionen ska starta även om kontrollen inte gick att göra.
    }
  }
}
