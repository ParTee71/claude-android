#!/usr/bin/env node
// Sessionsstart för Android-repona i molnet (#55, #42 punkt 1). Ersätter det gemensamma i repons
// egna session-start.sh: Maven-spegeln, sdk.dir i local.properties och raderna om SDK och
// GPR_TOKEN. Repots eget (t.ex. tools/db) står kvar i repots hook.
//
// Ett Android-repo är projektkatalogen eller ett barn till den med gradlew och settings.gradle.kts.
// Gör ingenting utanför molnet (CLAUDE_CODE_REMOTE), så Android Studio och CI påverkas inte.
// Stoppar aldrig sessionen: går något inte att göra skrivs det som en rad.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Android-repona: roten själv eller dess barn, de som har gradlew och settings.gradle.kts. */
export function androidRepos(root) {
  const isAndroid = (d) => existsSync(path.join(d, 'gradlew')) && existsSync(path.join(d, 'settings.gradle.kts'));
  if (isAndroid(root)) return [root];
  let names = [];
  try {
    names = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
  return names.map((n) => path.join(root, n)).filter(isAndroid);
}

/** Lägger sdk.dir i repots local.properties om raden saknas. Returnerar true om filen ändrades. */
export function ensureSdkDir(repo, sdk) {
  const f = path.join(repo, 'local.properties');
  const text = existsSync(f) ? readFileSync(f, 'utf8') : '';
  if (/^sdk\.dir=/m.test(text)) return false;
  appendFileSync(f, `${text && !text.endsWith('\n') ? '\n' : ''}sdk.dir=${sdk}\n`);
  return true;
}

/** Hämtar repot paket från GitHub Packages (android-ui)? Då behövs GPR_TOKEN. */
export function needsGpr(repo) {
  try {
    return readFileSync(path.join(repo, 'settings.gradle.kts'), 'utf8').includes('maven.pkg.github.com');
  } catch {
    return false;
  }
}

export function run({ root, env = process.env, home = homedir() }) {
  const repos = androidRepos(root);
  if (repos.length === 0) return [];
  const lines = [];
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || '/opt/android-sdk';
  if (existsSync(path.join(sdk, 'licenses'))) {
    for (const r of repos) ensureSdkDir(r, sdk);
    lines.push(`Android SDK: ${sdk} (Gradle kan köras i sessionen)`);
  } else {
    lines.push('Android SDK: saknas – miljöns setup-skript installerar den med claude-android scripts/android-sdk.sh');
  }
  if (repos.some(needsGpr)) {
    lines.push(env.GPR_TOKEN
      ? 'GPR_TOKEN: satt (android-ui kan hämtas)'
      : 'GPR_TOKEN: saknas – lägg GPR_USER och GPR_TOKEN (read:packages) i Claude-miljöns inställningar, annars går Gradle inte att köra');
  }
  try {
    const dir = path.join(home, '.gradle', 'init.d');
    mkdirSync(dir, { recursive: true });
    copyFileSync(path.join(here, 'maven-central-mirror.init.gradle.kts'), path.join(dir, 'maven-central-mirror.init.gradle.kts'));
    lines.push('Gradle: Maven Central via Googles spegel (~/.gradle/init.d/maven-central-mirror.init.gradle.kts)');
  } catch (e) {
    lines.push(`Gradle: spegeln kunde inte läggas ut (${e.message})`);
  }
  return lines;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.CLAUDE_CODE_REMOTE === 'true') {
    const lines = run({ root: process.env.CLAUDE_PROJECT_DIR || process.cwd() });
    if (lines.length) console.log(lines.join('\n'));
  }
}
