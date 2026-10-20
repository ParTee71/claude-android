// Beskedloggen: varje besked från en hook ger en rad i en loggfil i sessionen, så att
// veckomätningen kan räkna hur ofta hookarna säger till. PostToolUse-hookarnas besked syns
// inte i sessionens händelseström, så utan loggen går de inte att räkna.
//
// En rad: tid, hook, regel och repo, tabbseparerade. Filinnehåll och kod skrivs aldrig.
// Går loggen inte att skriva tappas raden; hooken stoppas aldrig av loggen.

import { appendFileSync } from 'node:fs';
import path from 'node:path';

export const logFile = () => process.env.CLAUDE_HOOKS_LOG || '/tmp/claude-hooks.log';

const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ');

/** Skriver en beskedrad. `repo` är repots katalog; bara namnet loggas. */
export function logBesked(hook, regel, repo) {
  try {
    const line = [new Date().toISOString(), hook, regel, repo ? path.basename(repo) : ''].map(clean).join('\t');
    appendFileSync(logFile(), `${line}\n`);
  } catch {
    // Loggen är bara för mätningen.
  }
}
