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
// Bara i molnet (CLAUDE_CODE_REMOTE). Tyst när inget ändrats. Stoppar aldrig sessionen.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logBesked } from './log.mjs';

// Skriptet ligger bredvid pluginen i claude-android-klonen. En plugin som installerats som kopia
// (utanför molnet) har det inte; då gör hooken ingenting.
let lib = null;
try {
  lib = await import('../../../scripts/repo-plugins.mjs');
} catch {
  // ingen klon bredvid pluginen
}

function rules(file) {
  try {
    const p = JSON.parse(readFileSync(file, 'utf8')).permissions ?? {};
    return new Set([...(p.deny ?? []), ...(p.ask ?? [])]);
  } catch {
    return new Set();
  }
}

/** Lägger repons spärrar i inställningsfilen och returnerar beskeden (tom lista = inget att säga). */
export function run({ root, env = process.env, settingsFile = path.join(homedir(), '.claude/settings.json') }) {
  if (!lib) return [];
  const { collectPermissions, DEFAULT_ENV, mergeSettings } = lib;
  const lines = [];
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
