import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { violations } from '../ktlint-check.mjs';

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
// felformaterad (Spotless skriver rättad kod på stdout och lyckas).
function repo({ spotless = true } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'ktlint-'));
  mkdirSync(path.join(root, 'app/src'), { recursive: true });
  writeFileSync(path.join(root, 'build.gradle.kts'), spotless ? 'plugins { id("com.diffplug.spotless") }\n' : 'plugins {}\n');
  writeFileSync(path.join(root, 'stderr.txt'), SPOTLESS_STDERR);
  writeFileSync(path.join(root, 'gradlew'), `#!/bin/sh
printf '%s\\n' "$@" > "$(dirname "$0")/args.txt"
case "$*" in
  *Bad.kt*) cat "$(dirname "$0")/stderr.txt" >&2; exit 1 ;;
  *Slow.kt*) sleep 5 ;;
  *Fmt.kt*) echo 'fun f() = 1' ;;
esac
exit 0
`);
  chmodSync(path.join(root, 'gradlew'), 0o755);
  for (const name of ['Bad.kt', 'Slow.kt', 'Fmt.kt', 'Ok.kt', 'Notes.md']) writeFileSync(path.join(root, 'app/src', name), '');
  return root;
}

function run(root, file) {
  return spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_input: { file_path: path.join(root, 'app/src', file) } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: path.dirname(root), KTLINT_HOOK_TIMEOUT_MS: '1500' },
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
