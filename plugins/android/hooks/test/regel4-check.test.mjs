// Test för regel 4-motorn (#57). Repot byggs i en tillfällig katalog med egna, små mönster-,
// undantags-, exempel- och konfigurationsfiler; repona prövar sina riktiga filer med --verify i CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConfig, scopesFor, findViolations, parseAllowlist, parsePatterns, renderAllowlist, verify, findRepoRoot } from '../regel4-check.mjs';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'regel4-check.mjs');
const pkg = 'app/src/main/kotlin/x';
const featureRel = `${pkg}/ui/trips/TripRow.kt`;
const featureCard = 'package x\n\n@Composable\nfun Row() {\n    Card(modifier = Modifier) { Text("Anna") }\n}\n';

const CONFIG = {
  scopes: {
    feature: { text: 'feature-kod (ui/<feature>/)', include: '/ui/', exclude: '/ui/(components|theme)/' },
    firestore: { text: 'kod utanför data/firestore/', exclude: '/data/firestore/' },
  },
  hint: 'Använd den delade komponenten.',
  examples: {
    ok: { file: featureRel, expect: 'ok' },
    stopp: { file: featureRel, expect: 'stopp' },
    'komponent-ok': { file: `${pkg}/ui/components/X.kt`, expect: 'ok' },
    allowlist: { file: featureRel },
  },
};
const PATTERNS = '# mönster\n[feature]\n\\b(Elevated|Outlined)?Card\\s*[({]\tAppCard\n\\bColor\\(\tAppColors\n\n[firestore]\n\\bFirebaseFirestore\\b\tFirestoreCollection\n';
const EXAMPLES = [
  '[ok]', 'AppCard { }', '[stopp]', 'Card(modifier) { }', 'val db: FirebaseFirestore', '[komponent-ok]', 'Card(modifier) { }',
  '[scope]', `${featureRel}\tfeature,firestore`, `${pkg}/ui/components/AppCard.kt\tfirestore`, `${pkg}/data/firestore/Db.kt\t`, 'docs/X.kt\t',
  '[allowlist]', `${featureRel}:Card( – test\tCard(modifier) { }\tok`, `${featureRel}:Card( – test\tColor(0xFF000000)\tstopp`,
  '[allowlist-fel]', `${featureRel} – saknar symbol`, `${featureRel}:Card(`,
].join('\n') + '\n';

function writeKt(dir, rel, content) {
  const abs = path.join(dir, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  return abs;
}

/** Tillfälligt repo i en egen föräldrakatalog. */
function makeRepo({ name = 'App', parent = mkdtempSync(path.join(tmpdir(), 'regel4-')), config = CONFIG, allowlist = '', patterns = PATTERNS, examples = EXAMPLES } = {}) {
  const dir = path.join(parent, name);
  writeKt(dir, '.claude/regel4.json', typeof config === 'string' ? config : JSON.stringify(config));
  writeKt(dir, 'app/src/test/resources/ui-forbidden.txt', patterns);
  writeKt(dir, 'app/src/test/resources/ui-allowlist.txt', allowlist);
  writeKt(dir, 'app/src/test/resources/ui-forbidden-examples.txt', examples);
  return { dir, parent };
}

function makeGitRepo(opts) {
  const repo = makeRepo(opts);
  const git = (...args) => spawnSync('git', args, { cwd: repo.dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'master');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'start');
  git('update-ref', 'refs/remotes/origin/master', 'HEAD');
  return { ...repo, git };
}

function run(projectDir, input, ...args) {
  return spawnSync('node', [HOOK, ...args], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, CLAUDE_HOOKS_LOG: process.env.TEST_HOOKS_LOG ?? path.join(tmpdir(), 'regel4-test-hooks.log') },
    encoding: 'utf8',
  });
}
const edit = (projectDir, file) => run(projectDir, { tool_name: 'Write', tool_input: { file_path: file } });
const stop = (projectDir, input = {}) => run(projectDir, input, '--stop');
const rules = (allowlist = []) => ({ config: parseConfig(JSON.stringify(CONFIG)), patterns: parsePatterns(PATTERNS), allowlist });

test('scope per sökväg: include, exclude och bara Kotlin under app/src/main', () => {
  const config = parseConfig(JSON.stringify(CONFIG));
  assert.deepEqual(scopesFor(featureRel, config), ['feature', 'firestore']);
  assert.deepEqual(scopesFor(`${pkg}/ui/Top.kt`, config), ['feature', 'firestore']);
  assert.deepEqual(scopesFor(`${pkg}/ui/components/deep/X.kt`, config), ['firestore']);
  assert.deepEqual(scopesFor(`${pkg}/data/firestore/Db.kt`, config), []);
  assert.deepEqual(scopesFor('app/src/test/kotlin/x/ui/a/T.kt', config), []);
  assert.deepEqual(scopesFor(`${pkg}/ui/a/notes.md`, config), []);
});

test('ett undantag gäller bara sin fil och sin symbol; kommentarer och import räknas inte', () => {
  const allow = parseAllowlist(`${featureRel}:Card( – ok från Mats`);
  assert.equal(findViolations(featureRel, 'Card(m) { }', rules(allow)).length, 0);
  assert.equal(findViolations(`${pkg}/ui/other/Y.kt`, 'Card(m) { }', rules(allow)).length, 1);
  assert.equal(findViolations(featureRel, 'Color(1)', rules(allow)).length, 1);
  assert.equal(findViolations(featureRel, '// Card(m)\n * Card(\nimport a.Card', rules()).length, 0);
});

test('konfigurationen kräver scope med text', () => {
  assert.throws(() => parseConfig('{}'), /"scopes" saknas/);
  assert.throws(() => parseConfig('{"scopes":{"a":{}}}'), /scope a saknar "text"/);
});

test('PostToolUse stoppar en träff med exit 2, scope-text, ersättning och repots tips', () => {
  const { dir } = makeRepo();
  const r = edit(dir, writeKt(dir, featureRel, featureCard));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /feature-kod \(ui\/<feature>\/\)/);
  assert.match(r.stderr, /TripRow\.kt:5 {2}`Card\(` {2}→ använd AppCard/);
  assert.match(r.stderr, /Använd den delade komponenten\. Undantag bara via app\/src\/test\/resources\/ui-allowlist\.txt/);
});

test('PostToolUse hittar repot från filen när projektroten är en föräldrakatalog, och släpper ui/components', () => {
  const { dir, parent } = makeRepo();
  assert.equal(edit(parent, writeKt(dir, featureRel, featureCard)).status, 2);
  const r = edit(parent, writeKt(dir, `${pkg}/ui/components/AppCard.kt`, featureCard));
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
});

test('PostToolUse: undantagsraden släpper filen, en trasig undantagsfil eller konfiguration stoppar med orsak', () => {
  const allowed = makeRepo({ allowlist: `${featureRel}:Card( – test\n` });
  assert.equal(edit(allowed.dir, writeKt(allowed.dir, featureRel, featureCard)).status, 0);
  const broken = makeRepo({ allowlist: `# x\n${featureRel} – saknar symbol\n` });
  const r = edit(broken.dir, writeKt(broken.dir, featureRel, featureCard));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /ui-allowlist\.txt rad 2/);
  const badConfig = makeRepo({ config: '{ inte json' });
  assert.equal(edit(badConfig.dir, writeKt(badConfig.dir, featureRel, featureCard)).status, 2);
});

test('filer utanför ett repo, av annan typ och trasig indata ger exit 0', () => {
  const { dir, parent } = makeRepo();
  assert.equal(edit(dir, writeKt(dir, 'docs/Card.kt', featureCard)).status, 0);
  const outside = writeKt(parent, `annat/${featureRel}`, featureCard);
  assert.equal(findRepoRoot(outside), null);
  assert.equal(edit(parent, outside).status, 0);
  assert.equal(run(dir, 'inte json').status, 0);
});

test('Stop blockerar för ändrade, nya och redan committade filer på grenen', () => {
  const { dir, git } = makeGitRepo();
  writeKt(dir, featureRel, featureCard);
  const out = JSON.parse(stop(dir).stdout);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /TripRow\.kt:5/);
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'rad');
  assert.equal(JSON.parse(stop(dir).stdout).decision, 'block');
});

test('Stop jämför mot origin/main när origin/master saknas', () => {
  const { dir, git } = makeGitRepo();
  git('update-ref', '-d', 'refs/remotes/origin/master');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  writeKt(dir, featureRel, featureCard);
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'rad');
  assert.equal(JSON.parse(stop(dir).stdout).decision, 'block');
});

test('Stop är tyst för gamla träffar på basgrenen och blockerar högst en gång i följd', () => {
  const { dir, git } = makeGitRepo();
  writeKt(dir, featureRel, featureCard);
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'på master');
  git('update-ref', 'refs/remotes/origin/master', 'HEAD');
  writeKt(dir, `${pkg}/ui/trips/Ok.kt`, 'package x\n\nfun ok() = Unit\n');
  assert.equal(stop(dir).stdout, '');
  writeKt(dir, `${pkg}/ui/trips/Ny.kt`, featureCard);
  assert.equal(stop(dir, { stop_hook_active: true }).stdout, '');
});

test('Stop kontrollerar varje repo under projektroten och märker träffarna med reponamnet', () => {
  const parent = mkdtempSync(path.join(tmpdir(), 'regel4-'));
  const a = makeGitRepo({ name: 'A', parent });
  const b = makeGitRepo({ name: 'B', parent });
  makeGitRepo({ name: 'C', parent });
  writeKt(a.dir, featureRel, featureCard);
  writeFileSync(path.join(b.dir, 'app/src/test/resources/ui-allowlist.txt'), 'trasig rad\n');
  const out = JSON.parse(stop(parent).stdout);
  assert.match(out.reason, new RegExp(`A/${featureRel}:5`));
  assert.match(out.reason, /B: Regel 4: ui-allowlist\.txt rad 1/);
  assert.doesNotMatch(out.reason, /\bC\b/);
});

test('varje besked ger en loggrad utan filinnehåll, och en oskrivbar logg stoppar aldrig hooken', () => {
  const parent = mkdtempSync(path.join(tmpdir(), 'regel4-'));
  const log = path.join(parent, 'hooks.log');
  process.env.TEST_HOOKS_LOG = log;
  const { dir } = makeGitRepo({ name: 'A', parent });
  edit(parent, writeKt(dir, featureRel, 'fun x() {\n    Card(hemlig) {}\n}\n'));
  edit(parent, writeKt(dir, `${pkg}/ui/trips/Ok.kt`, 'fun ok() = Unit\n'));
  stop(parent);
  delete process.env.TEST_HOOKS_LOG;
  const lines = readFileSync(log, 'utf8').trim().split('\n');
  assert.deepEqual(lines.map((l) => l.split('\t').slice(1)), [['regel4-check', 'regel4', 'A'], ['regel4-check', 'regel4-stop', 'A']]);
  assert.doesNotMatch(lines.join('\n'), /hemlig|TripRow/);
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_input: { file_path: path.join(dir, featureRel) } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: parent, CLAUDE_HOOKS_LOG: path.join(parent, 'saknas/hooks.log') },
    encoding: 'utf8',
  });
  assert.equal(r.status, 2);
});

test('--verify godkänner ett riktigt repo och nämner varje fel i ett trasigt', () => {
  const ok = makeRepo();
  const r = spawnSync('node', [HOOK, '--verify', ok.dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ok/);

  const brokenConfig = { ...CONFIG, scopes: { ...CONFIG.scopes, feature: { ...CONFIG.scopes.feature, exclude: '/ui/theme/' } }, examples: { ...CONFIG.examples, 'komponent-ok': undefined } };
  const bad = makeRepo({
    config: brokenConfig,
    patterns: `${PATTERNS}\n[extra]\nX\n`,
    examples: `${EXAMPLES}[stopp]\nAppCard { }\n[allowlist-fel]\n${featureRel}:Card( – har allt\n`,
  });
  const errors = verify(bad.dir).join('\n');
  assert.match(errors, /sektionerna \[extra, feature, firestore\] men .* scopen \[feature, firestore\]/);
  assert.match(errors, /\[extra\] X: ersättning saknas/);
  assert.match(errors, /examples\.komponent-ok\.file saknas/);
  assert.match(errors, /\[scope\] .*AppCard\.kt: väntade "firestore", fick "feature,firestore"/);
  assert.match(errors, /\[stopp\] .*väntade stopp, fick ok: AppCard/);
  assert.match(errors, /\[allowlist-fel\] godtogs/);
  assert.equal(spawnSync('node', [HOOK, '--verify', bad.dir], { encoding: 'utf8' }).status, 1);
});

test('baslinjen behåller handskrivna undantag, tar bort rättade brott och kontrolleras av --verify', () => {
  const reason = 'baslinje 2026-10 – rättas';
  const manual = `${featureRel}:Card( – användarens ok i #999`;
  const stale = `${pkg}/ui/trips/Rattad.kt:Card( – ${reason}`;
  const { dir } = makeRepo({ config: { ...CONFIG, baseline: reason }, allowlist: `# gammalt huvud\n${manual}\n${stale}\n` });
  writeKt(dir, `${pkg}/ui/trips/Ny.kt`, 'fun x() {\n    Color(1)\n}\n');
  const out = renderAllowlist(dir);
  assert.ok(out.includes(manual), out);
  assert.ok(!out.includes(stale));
  assert.ok(out.includes(`${pkg}/ui/trips/Ny.kt:Color( – ${reason}`), out);
  assert.match(verify(dir).join(), /baslinjen är inte aktuell/);
  assert.equal(spawnSync('node', [HOOK, '--baseline', '--check', dir], { encoding: 'utf8' }).status, 1);
  assert.equal(spawnSync('node', [HOOK, '--baseline', dir], { encoding: 'utf8' }).status, 0);
  assert.equal(readFileSync(path.join(dir, 'app/src/test/resources/ui-allowlist.txt'), 'utf8'), out);
  assert.deepEqual(verify(dir), []);
  assert.equal(spawnSync('node', [HOOK, '--baseline', '--check', dir], { encoding: 'utf8' }).status, 0);
  assert.ok(existsSync(dir));
});
