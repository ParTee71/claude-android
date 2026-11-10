#!/usr/bin/env node
// Självkontroll vid sessionsstart (#37): säger till när uppsättningen inte är den dokumenten
// beskriver, i stället för att felet ligger tyst i en logg.
//
// - En plugin som inte gick att ladda (`claude plugin list` säger "failed to load"). Setup-skriptet
//   loggar bara att installationen lyckades; laddningsfelet syns först här.
// - Samma agentnamn i två repon under en gemensam rot. Agenter får inget prefix, så bara en av
//   dem laddas – och det är inte säkert att det är den som repots skills menar.
//
// Beskeden skrivs till stdout och hamnar i sessionens sammanhang. Inget besked när allt stämmer.
// Kontrollen stoppar aldrig sessionen: går något inte att läsa hoppas den delen över.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logBesked } from './log.mjs';

/** Pluginerna som inte laddades, ur utskriften från `claude plugin list`. */
export function failedPlugins(text) {
  const failed = [];
  let current = null;
  for (const line of String(text ?? '').split('\n')) {
    const name = /^\s*[>❯]\s+(\S+@\S+)/.exec(line);
    if (name) current = name[1];
    else if (current && /failed to load/i.test(line)) failed.push(current);
  }
  return [...new Set(failed)];
}

/** Agentens namn: `name:` i frontmattern, annars filnamnet. */
function agentName(file) {
  try {
    const m = /^---\n[\s\S]*?^name:\s*(\S+)/m.exec(readFileSync(file, 'utf8'));
    if (m) return m[1];
  } catch {
    // Oläslig fil: filnamnet får gälla.
  }
  return path.basename(file, '.md');
}

/** Agentnamn som finns i mer än ett repo direkt under roten: `{ namn: [repo, …] }`. */
export function duplicateAgents(base) {
  const owners = {};
  if (!base || !existsSync(base)) return owners;
  for (const d of readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.')) continue;
    const dir = path.join(base, d.name, '.claude/agents');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
      (owners[agentName(path.join(dir, f))] ??= []).push(d.name);
    }
  }
  return Object.fromEntries(Object.entries(owners).filter(([, repos]) => repos.length > 1));
}

function main() {
  const base = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const lines = [];
  const r = spawnSync('claude', ['plugin', 'list'], { encoding: 'utf8', timeout: 10000 });
  const failed = r.status === 0 ? failedPlugins(r.stdout) : [];
  if (failed.length > 0) {
    lines.push(`Pluginer som inte laddades: ${failed.join(', ')}. Deras skills, agenter eller hookar saknas i sessionen – kör \`claude plugin list\` för felet och säg det till användaren.`);
    logBesked('setup-check', 'plugin-failed', base);
  }
  for (const [name, repos] of Object.entries(duplicateAgents(base))) {
    lines.push(`Agenten \`${name}\` finns i ${repos.join(' och ')}, men bara en laddas. Kontrollera agentens beskrivning innan du startar den, och döp om den i repona (claude-android#37).`);
    logBesked('setup-check', 'agent-dubblett', base);
  }
  if (lines.length > 0) process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
