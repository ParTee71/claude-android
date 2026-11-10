import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { violations, gradleError } from '../ktlint-check.mjs';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ktlint-check.mjs');

// Utdrag ur Spotless riktiga felutskrift (8.10, ktlint 1.8, compose-rules 0.6.8) för en effekt
// som anropar en lambdaparameter direkt.
const SPOTLESS_STDERR = `Picked up JAVA_TOOL_OPTIONS: -Dx=y
Step 'ktlint' found problem in 'Bad.kt':
L7: (compose:lambda-param-in-effect) Lambda parameters in a @Composable that are referenced directly inside of restarting effects can cause issues or unpredictable behavior.
If restarting the effect is ok, you can add the reference to this parameter as a key in that effect, so when the parameter changes, a new effect is created.
com.diffplug.spotless.Lint$ShortcutException: L7: (compose:lambda-param-in-effect) Lambda parameters in a @Composable that are referenced directly inside of restarting effects can cause issues or unpredictable behavior.
\tat com.diffplug.spotless.Lint.shortcut(Lint.java:114)
`;

// Ett falskt Gradle-repo: gradlew skriver argumenten till args.txt och svarar efter filnamnet.
// Bad.kt ger regelbrottet ovan, Slow.kt sover längre än hookens tidsgräns, Fmt.kt är bara
// felformaterad (Spotless skriver rättad kod på stdout och lyckas). Cold.kt faller med `--offline`
// som i en ny molnsession och lämnar warmed.txt när den körs med nät; Broken.kt faller alltid.
function repo({ spotless = true } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'ktlint-'));
  mkdirSync(path.join(root, 'app/src'), { recursive: true });
  writeFileSync(path.join(root, 'build.gradle.kts'), spotless ? 'plugins { id("com.diffplug.spotless") }\n' : 'plugins {}\n');
  writeFileSync(path.join(root, 'stderr.txt'), SPOTLESS_STDERR);
  writeFileSync(path.join(root, 'gradlew'), `#!/bin/sh
printf '%s\\n' "$@" > "$(dirname "$0")/args.txt"
case "$*" in
  *--offline*Cold.kt*) printf '%s\\n' 'FAILURE: Build failed with an exception.' '* What went wrong:' "Plugin [id: 'com.android.application'] was not found in any of the following sources:" >&2; exit 1 ;;
  *Cold.kt*) touch "$(dirname "$0")/warmed.txt" ;;
  *Broken.kt*) printf '%s\\n' 'Picked up JAVA_TOOL_OPTIONS: -Dx=y' 'FAILURE: Build failed with an exception.' '* What went wrong:' 'SDK location not found.' >&2; exit 1 ;;
  *Bad.kt*) cat "$(dirname "$0")/stderr.txt" >&2; exit 1 ;;
  *Slow.kt*) sleep 5 ;;
  *Fmt.kt*) echo 'fun f() = 1' ;;
esac
exit 0
`);
  chmodSync(path.join(root, 'gradlew'), 0o755);
  for (const name of ['Bad.kt', 'Slow.kt', 'Fmt.kt', 'Ok.kt', 'Cold.kt', 'Broken.kt', 'Notes.md']) writeFileSync(path.join(root, 'app/src', name), '');
  return root;
}

function run(root, file) {
  return spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_input: { file_path: path.join(root, 'app/src', file) } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: path.dirname(root), KTLINT_HOOK_TIMEOUT_MS: '1500', KTLINT_HOOK_STATE_DIR: root, CLAUDE_HOOKS_LOG: path.join(root, 'hooks.log') },
    encoding: 'utf8',
  });
}

test('ett regelbrott blockerar med regeln och raden, utan stackspår', () => {
  const r = run(repo(), 'Bad.kt');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /app\/src\/Bad\.kt/);
  assert.match(r.stderr, /L7: \(compose:lambda-param-in-effect\) Lambda parameters .* unpredictable behavior\./);
  assert.doesNotMatch(r.stderr, /ShortcutException|If restarting/);
});

test('Spotless körs på just den filen och skriver aldrig om den', () => {
  const root = repo();
  run(root, 'Ok.kt');
  const args = readFileSync(path.join(root, 'args.txt'), 'utf8').split('\n');
  assert.ok(args.includes(`-PspotlessIdeHook=${path.join(root, 'app/src/Ok.kt')}`));
  assert.ok(args.includes('-PspotlessIdeHookUseStdOut'));
  assert.ok(args.includes('--offline'));
});

test('ren formatering och felfria filer släpps igenom tyst', () => {
  const root = repo();
  for (const file of ['Fmt.kt', 'Ok.kt']) {
    const r = run(root, file);
    assert.equal(r.status, 0);
    assert.equal(r.stderr + r.stdout, '');
  }
});

test('hinner Gradle inte blir det en påminnelse, ingen blockering', () => {
  const r = run(repo(), 'Slow.kt');
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.match(out.hookSpecificOutput.additionalContext, /spotlessCheck före push/);
});

test('andra filer och repon utan Spotless rörs inte', () => {
  assert.equal(run(repo(), 'Notes.md').status, 0);
  const root = repo({ spotless: false });
  const r = run(root, 'Bad.kt');
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
});

test('violations läser varje brott en gång och bara före stackspåret', () => {
  assert.deepEqual(violations(SPOTLESS_STDERR), [
    'L7: (compose:lambda-param-in-effect) Lambda parameters in a @Composable that are referenced directly inside of restarting effects can cause issues or unpredictable behavior.',
  ]);
  assert.deepEqual(violations('BUILD FAILED\nsomething else'), []);
});

test('tom Gradle-cache ger en påminnelse och värmer cachen i bakgrunden, inget tyst ok', async () => {
  const root = repo();
  const r = run(root, 'Cold.kt');
  assert.equal(r.status, 0);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /Gradle-cachen är tom.*spotlessCheck före push/);
  for (let i = 0; i < 40 && !existsSync(path.join(root, 'warmed.txt')); i += 1) await new Promise((ok) => setTimeout(ok, 50));
  assert.ok(existsSync(path.join(root, 'warmed.txt')), 'uppvärmningen startade inte');
  assert.ok(!readFileSync(path.join(root, 'args.txt'), 'utf8').split('\n').includes('--offline'));
});

test('påminnelsen kommer en gång per repo, inte för varje fil', () => {
  const root = repo();
  assert.notEqual(run(root, 'Cold.kt').stdout, '');
  const again = run(root, 'Cold.kt');
  assert.equal(again.status, 0);
  assert.equal(again.stdout + again.stderr, '');
  // Ett regelbrott blockerar ändå.
  assert.equal(run(root, 'Bad.kt').status, 2);
});

test('faller Gradle av annat skäl står felets första rad i påminnelsen', () => {
  const r = run(repo(), 'Broken.kt');
  assert.equal(r.status, 0);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /Gradle föll: SDK location not found\./);
  assert.equal(gradleError('Picked up X\nnågot gick fel\n\tat a.b'), 'något gick fel');
  assert.equal(gradleError(''), 'okänt fel');
});

test('regelbrott och påminnelse ger en loggrad var, utan kod; tysta körningar ingen', () => {
  const root = repo();
  for (const file of ['Bad.kt', 'Slow.kt', 'Fmt.kt', 'Ok.kt', 'Notes.md']) run(root, file);
  const lines = readFileSync(path.join(root, 'hooks.log'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0].slice(1), ['ktlint-check', 'compose:lambda-param-in-effect', path.basename(root)]);
  assert.deepEqual(lines[1].slice(1), ['ktlint-check', 'timeout', path.basename(root)]);
  assert.ok(lines.every((l) => l.length === 4 && !Number.isNaN(Date.parse(l[0]))));
});
