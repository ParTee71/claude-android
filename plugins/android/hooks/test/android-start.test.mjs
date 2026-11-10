import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { androidRepos, ensureSdkDir, needsGpr, run } from '../android-start.mjs';

function androidRepo(base, name, settings = '') {
  const d = name ? path.join(base, name) : base;
  mkdirSync(d, { recursive: true });
  writeFileSync(path.join(d, 'gradlew'), '');
  writeFileSync(path.join(d, 'settings.gradle.kts'), settings);
  return d;
}

test('Android-repona: roten själv eller barnen med gradlew och settings.gradle.kts', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'as-'));
  const b = androidRepo(base, 'b');
  const a = androidRepo(base, 'a');
  mkdirSync(path.join(base, 'webb'));
  writeFileSync(path.join(base, 'webb', 'package.json'), '{}');
  assert.deepEqual(androidRepos(base), [a, b]);
  assert.deepEqual(androidRepos(a), [a]);
  assert.deepEqual(androidRepos(path.join(base, 'saknas')), []);
});

test('sdk.dir läggs till en gång och rör inte en befintlig rad', () => {
  const r = androidRepo(mkdtempSync(path.join(tmpdir(), 'as-')), 'r');
  writeFileSync(path.join(r, 'local.properties'), 'gpr.user=x');
  assert.equal(ensureSdkDir(r, '/opt/sdk'), true);
  assert.equal(readFileSync(path.join(r, 'local.properties'), 'utf8'), 'gpr.user=x\nsdk.dir=/opt/sdk\n');
  assert.equal(ensureSdkDir(r, '/annan'), false);
  assert.equal(readFileSync(path.join(r, 'local.properties'), 'utf8'), 'gpr.user=x\nsdk.dir=/opt/sdk\n');
});

test('GPR_TOKEN behövs bara när settings.gradle.kts hämtar från GitHub Packages', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'as-'));
  assert.equal(needsGpr(androidRepo(base, 'app', 'url = uri("https://maven.pkg.github.com/partee71/android-ui")')), true);
  assert.equal(needsGpr(androidRepo(base, 'lib', 'rootProject.name = "x"')), false);
});

test('körningen lägger spegeln, sdk.dir och raderna; inget utan Android-repo', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'as-'));
  const home = mkdtempSync(path.join(tmpdir(), 'home-'));
  const sdk = path.join(base, 'sdk');
  mkdirSync(path.join(sdk, 'licenses'), { recursive: true });
  assert.deepEqual(run({ root: base, env: { ANDROID_HOME: sdk }, home }), []);
  const r = androidRepo(base, 'app', 'maven.pkg.github.com');
  const lines = run({ root: base, env: { ANDROID_HOME: sdk }, home });
  assert.match(lines[0], /Android SDK: .*sdk/);
  assert.match(lines[1], /GPR_TOKEN: saknas/);
  assert.match(lines[2], /Googles spegel/);
  assert.ok(existsSync(path.join(home, '.gradle', 'init.d', 'maven-central-mirror.init.gradle.kts')));
  assert.match(readFileSync(path.join(r, 'local.properties'), 'utf8'), /^sdk\.dir=/m);
  assert.match(run({ root: base, env: { GPR_TOKEN: 't', ANDROID_HOME: path.join(base, 'ingen') }, home })[0], /Android SDK: saknas/);
});
