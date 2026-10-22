import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DISPATCH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'regel4-dispatch.mjs');

// En falsk repohook: PostToolUse-träff för filer som heter Bad.kt, Stop-blockering om
// repot har filen BLOCK. Skriver vilken projektrot den fick, så att testet ser vem som kördes.
const FAKE_HOOK = `
import { readFileSync, existsSync } from 'node:fs';
const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const root = process.env.CLAUDE_PROJECT_DIR;
if (process.argv.includes('--stop')) {
  if (existsSync(root + '/BLOCK')) process.stdout.write(JSON.stringify({ decision: 'block', reason: 'träff i ' + root.split('/').pop() }));
  process.exit(0);
}
if (input.tool_input.file_path.endsWith('Bad.kt')) { process.stderr.write('träff i ' + root.split('/').pop()); process.exit(2); }
process.exit(0);
`;

function workspace(...repos) {
  const base = mkdtempSync(path.join(tmpdir(), 'regel4-'));
  for (const name of repos) {
    mkdirSync(path.join(base, name, '.claude/hooks'), { recursive: true });
    mkdirSync(path.join(base, name, 'app/src'), { recursive: true });
    writeFileSync(path.join(base, name, '.claude/hooks/regel4-check.mjs'), FAKE_HOOK);
  }
  return base;
}

function dispatch(base, input, ...args) {
  return spawnSync('node', [DISPATCH, ...args], {
    input: JSON.stringify(input), env: { ...process.env, CLAUDE_PROJECT_DIR: base, CLAUDE_HOOKS_LOG: path.join(base, 'hooks.log') }, encoding: 'utf8',
  });
}

test('PostToolUse går till repot som äger filen', () => {
  const base = workspace('a', 'b');
  const r = dispatch(base, { tool_input: { file_path: path.join(base, 'b/app/src/Bad.kt') } });
  assert.equal(r.status, 2);
  assert.equal(r.stderr, 'träff i b');
});

test('PostToolUse är tyst för en fil utan träff och för filer utanför repona', () => {
  const base = workspace('a');
  assert.equal(dispatch(base, { tool_input: { file_path: path.join(base, 'a/app/src/Good.kt') } }).status, 0);
  const r = dispatch(base, { tool_input: { file_path: path.join(base, 'annat/Bad.kt') } });
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
});

test('Stop slår ihop blockeringarna från alla repon under roten', () => {
  const base = workspace('a', 'b', 'c');
  writeFileSync(path.join(base, 'a/BLOCK'), '');
  writeFileSync(path.join(base, 'c/BLOCK'), '');
  const out = JSON.parse(dispatch(base, {}, '--stop').stdout);
  assert.equal(out.decision, 'block');
  assert.deepEqual(out.reason.split('\n').sort(), ['träff i a', 'träff i c']);
});

test('Stop blockerar inte två gånger i följd', () => {
  const base = workspace('a');
  writeFileSync(path.join(base, 'a/BLOCK'), '');
  assert.equal(dispatch(base, { stop_hook_active: true }, '--stop').stdout, '');
});

test('gör ingenting när projektroten själv är ett repo med egen hook', () => {
  const base = workspace('a');
  const repo = path.join(base, 'a');
  writeFileSync(path.join(repo, 'BLOCK'), '');
  const edit = dispatch(repo, { tool_input: { file_path: path.join(repo, 'app/src/Bad.kt') } });
  assert.equal(edit.status, 0);
  assert.equal(edit.stderr, '');
  assert.equal(dispatch(repo, {}, '--stop').stdout, '');
});

test('med ett repo som projektrot kontrolleras ändå ändringar i ett syskonrepo', () => {
  const base = workspace('a', 'b');
  const r = dispatch(path.join(base, 'a'), { tool_input: { file_path: path.join(base, 'b/app/src/Bad.kt') } });
  assert.equal(r.status, 2);
  assert.equal(r.stderr, 'träff i b');
});

const logLines = (base) => (existsSync(path.join(base, 'hooks.log')) ? readFileSync(path.join(base, 'hooks.log'), 'utf8').trim().split('\n') : []);

test('varje besked ger exakt en loggrad med tid, hook, regel och repo men inget filinnehåll', () => {
  const base = workspace('a', 'b');
  writeFileSync(path.join(base, 'a/app/src/Bad.kt'), 'hemlig kod');
  dispatch(base, { tool_input: { file_path: path.join(base, 'a/app/src/Bad.kt'), content: 'hemlig kod' } });
  dispatch(base, { tool_input: { file_path: path.join(base, 'a/app/src/Good.kt') } });
  writeFileSync(path.join(base, 'b/BLOCK'), '');
  dispatch(base, {}, '--stop');
  const lines = logLines(base);
  assert.equal(lines.length, 2);
  const [edit, stop] = lines.map((l) => l.split('\t'));
  assert.ok(!Number.isNaN(Date.parse(edit[0])));
  assert.deepEqual(edit.slice(1), ['regel4-dispatch', 'regel4', 'a']);
  assert.deepEqual(stop.slice(1), ['regel4-dispatch', 'regel4-stop', 'b']);
  assert.doesNotMatch(lines.join('\n'), /hemlig|Bad\.kt/);
});

test('en logg som inte går att skriva stoppar aldrig hooken', () => {
  const base = workspace('a');
  const r = spawnSync('node', [DISPATCH], {
    input: JSON.stringify({ tool_input: { file_path: path.join(base, 'a/app/src/Bad.kt') } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: base, CLAUDE_HOOKS_LOG: path.join(base, 'saknas/hooks.log') },
    encoding: 'utf8',
  });
  assert.equal(r.status, 2);
  assert.equal(r.stderr, 'träff i a');
});
