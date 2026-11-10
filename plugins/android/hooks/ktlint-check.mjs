#!/usr/bin/env node
// ktlint-kontrollen via pluginen: kör repots Spotless (ktlint + compose-rules) på den Kotlin-fil
// som just ändrats, så att regelbrott som spotlessApply inte kan rätta (t.ex.
// `lambda-param-in-effect`, `content-slot-reused`) syns direkt och inte först när någon kör
// `spotlessCheck` före push. Spotless körs inte i CI (CI-budgeten), så utan hooken fångas de
// bara av den som minns att köra kontrollen.
//
// PostToolUse efter Edit/Write på .kt/.kts: repot är närmaste katalog uppåt med `gradlew` och en
// root-`build.gradle.kts` som nämner spotless. Spotless IDE-hook skriver det formaterade
// resultatet till stdout, så filen ändras aldrig; bara rena formateringsavvikelser lämnas åt
// spotlessApply. Regelbrott ger exit 2 med raderna på stderr, så att Claude rättar dem.
// Kan kontrollen inte köras säger hooken det i stället för att se ut som ett godkännande (#39):
// - Hinner Gradle inte (kall daemon, Gradle laddas ned) eller är Gradle-cachen tom (hooken kör
//   `--offline`, och en ny molnsession har inga beroenden) blir det en påminnelse om
//   spotlessCheck, och cachen värms i bakgrunden med samma körning utan `--offline`. Efter en
//   till två minuter fungerar kontrollen.
// - Faller Gradle av annat skäl blir det en påminnelse med felets första rad.
// Påminnelsen kommer högst en gång per tio minuter och repo, inte för varje fil.
// Varje besked (regelbrott eller påminnelse) ger en rad i beskedloggen (log.mjs).

import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logBesked } from './log.mjs';

const TIMEOUT_MS = Number(process.env.KTLINT_HOOK_TIMEOUT_MS) || 25000;
const REMIND_MS = 10 * 60 * 1000;
const COLD_CACHE = /offline mode|No cached version|was not found in any of the following sources|Could not resolve/i;

/** Sant högst en gång per tio minuter och repo; markören ligger i tempkatalogen. */
function firstInAWhile(root) {
  const id = createHash('sha1').update(root).digest('hex').slice(0, 12);
  const marker = path.join(process.env.KTLINT_HOOK_STATE_DIR || tmpdir(), `claude-ktlint-blind-${id}`);
  try {
    if (Date.now() - statSync(marker).mtimeMs < REMIND_MS) return false;
  } catch {
    // Ingen markör än.
  }
  try {
    writeFileSync(marker, '');
  } catch {
    // Går markören inte att skriva kommer påminnelsen oftare, inget värre.
  }
  return true;
}

/** Värmer Gradle-cachen i bakgrunden: samma körning med nät. Filen skrivs aldrig om. */
function warm(root, file) {
  try {
    spawn(path.join(root, 'gradlew'), ['-q', 'spotlessApply', `-PspotlessIdeHook=${file}`, '-PspotlessIdeHookUseStdOut'], {
      cwd: root, env: { ...process.env, LC_ALL: 'C.UTF-8' }, detached: true, stdio: 'ignore',
    }).unref();
  } catch {
    // Gick den inte att starta gäller påminnelsen ändå.
  }
}

/** Felets första rad ur Gradles utskrift, utan stackspår. */
export function gradleError(stderr) {
  const lines = String(stderr ?? '').split('\n').map((l) => l.trim());
  const at = lines.findIndex((l) => l.startsWith('* What went wrong:'));
  const line = at >= 0 ? lines[at + 1] : lines.find((l) => l && !l.startsWith('Picked up '));
  return (line ?? 'okänt fel').slice(0, 200);
}

/** Kontrollen kunde inte köras: en påminnelse (inte för varje fil), aldrig ett tyst godkännande. */
function blind(root, file, regel, text) {
  if (!firstInAWhile(root)) return 0;
  logBesked('ktlint-check', regel, root);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `${text} Kör ./gradlew spotlessCheck före push.` },
  }));
  return 0;
}

function readInput() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const usesSpotless = (dir) => {
  const build = path.join(dir, 'build.gradle.kts');
  return existsSync(path.join(dir, 'gradlew')) && existsSync(build) && readFileSync(build, 'utf8').includes('spotless');
};

/** Närmaste katalog uppåt från filen som är ett Gradle-repo med Spotless, annars null. */
export function gradleRootFor(file) {
  let dir = path.dirname(file);
  for (;;) {
    if (usesSpotless(dir)) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** Regelbrotten i Spotless felutskrift, en rad per brott: `L7: (regel) första meningen.` */
export function violations(stderr) {
  const found = [];
  for (const line of stderr.split('\n')) {
    if (/^(com\.diffplug|\tat )/.test(line)) break;
    const m = /^(L\d+(?::\d+)?): \(([^)]+)\) (.*)$/.exec(line);
    if (m) found.push(`${m[1]}: (${m[2]}) ${m[3].replace(/(\.)\s.*$/, '$1')}`);
  }
  return [...new Set(found)];
}

function check(input) {
  const raw = input?.tool_input?.file_path;
  if (!raw || !/\.kts?$/.test(raw)) return 0;
  const base = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const file = path.isAbsolute(raw) ? raw : path.join(base, raw);
  if (!existsSync(file)) return 0;
  const root = gradleRootFor(file);
  if (!root) return 0;
  const r = spawnSync(
    path.join(root, 'gradlew'),
    ['-q', '--offline', 'spotlessApply', `-PspotlessIdeHook=${file}`, '-PspotlessIdeHookUseStdOut'],
    { cwd: root, env: { ...process.env, LC_ALL: 'C.UTF-8' }, encoding: 'utf8', timeout: TIMEOUT_MS },
  );
  const name = path.basename(file);
  if (r.error?.code === 'ETIMEDOUT' || r.signal) {
    warm(root, file);
    return blind(root, file, 'timeout', `ktlint hann inte köras på ${name} (Gradle startar; cachen värms i bakgrunden).`);
  }
  if (r.status === 0) return 0;
  const found = violations(r.stderr ?? '');
  if (found.length === 0) {
    if (COLD_CACHE.test(r.stderr ?? '')) {
      warm(root, file);
      return blind(root, file, 'kall-cache', `ktlint kunde inte köras på ${name}: Gradle-cachen är tom. Den värms i bakgrunden (en till två minuter); tills dess kontrolleras inga Kotlin-filer.`);
    }
    return blind(root, file, 'gradle-fel', `ktlint kunde inte köras på ${name}, Gradle föll: ${gradleError(r.stderr)}`);
  }
  logBesked('ktlint-check', [...new Set(found.map((v) => /\(([^)]+)\)/.exec(v)[1]))].join(','), root);
  process.stderr.write(
    `ktlint (compose-rules) i ${path.relative(root, file)}:\n${found.join('\n')}\n`
      + 'Rätta koden; stäng inte av regeln. Regeln förklaras på https://mrmans0n.github.io/compose-rules/rules/\n',
  );
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(check(readInput()));
}
