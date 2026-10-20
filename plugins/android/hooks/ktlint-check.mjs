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
// Hinner Gradle inte (kall daemon) får Claude en påminnelse om spotlessCheck i stället.
// Varje besked (regelbrott eller påminnelse) ger en rad i beskedloggen (log.mjs).

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logBesked } from './log.mjs';

const TIMEOUT_MS = Number(process.env.KTLINT_HOOK_TIMEOUT_MS) || 25000;

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
  if (r.error?.code === 'ETIMEDOUT' || r.signal) {
    logBesked('ktlint-check', 'timeout', root);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `ktlint hann inte köras på ${path.basename(file)} (Gradle startar). Kör ./gradlew spotlessCheck före push.`,
      },
    }));
    return 0;
  }
  if (r.status === 0) return 0;
  const found = violations(r.stderr ?? '');
  if (found.length === 0) return 0;
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
