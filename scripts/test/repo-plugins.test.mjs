import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readlinkSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build, convertHooks, pluginName } from '../repo-plugins.mjs';
import { shouldRun } from '../repo-hook.mjs';

const HOOKS = {
  hooks: {
    PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/regel4-check.mjs' }] }],
    Stop: [{ hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/kontroll-stop.mjs', timeout: 120 }] }],
  },
};

function repo(base, name, { skills = true, agents = false, settings } = {}) {
  const dir = path.join(base, name);
  mkdirSync(path.join(dir, '.claude'), { recursive: true });
  if (skills) mkdirSync(path.join(dir, '.claude/skills/ui-style'), { recursive: true });
  if (agents) mkdirSync(path.join(dir, '.claude/agents'), { recursive: true });
  if (settings) writeFileSync(path.join(dir, '.claude/settings.json'), JSON.stringify(settings));
  return dir;
}

const STOP = { hook_event_name: 'Stop' };
const git = (dir, ...args) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });

test('pluginnamn blir gemener utan otillåtna tecken', () => {
  assert.equal(pluginName('/home/user/ReseApoteket'), 'reseapoteket');
  assert.equal(pluginName('/home/user/android-ui'), 'android-ui');
  assert.equal(pluginName('/x/Mitt Repo'), 'mitt-repo');
});

test('varje repo med .claude blir en plugin med symlänkar och en marknadsplats', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'repon-'));
  const rese = repo(base, 'ReseApoteket', { agents: true });
  repo(base, 'Husjakt', { skills: false, settings: HOOKS });
  mkdirSync(path.join(base, 'utan-claude'));
  const { out, plugins } = build(base);
  assert.equal(out, path.join(base, '.repo-plugins'));
  assert.deepEqual(plugins.sort(), ['husjakt', 'reseapoteket']);
  const market = JSON.parse(readFileSync(path.join(out, '.claude-plugin/marketplace.json'), 'utf8'));
  assert.equal(market.name, 'repon');
  assert.deepEqual(market.plugins.map((p) => p.source).sort(), ['./husjakt', './reseapoteket']);
  assert.equal(readlinkSync(path.join(out, 'reseapoteket/skills')), path.join(rese, '.claude/skills'));
  assert.equal(readlinkSync(path.join(out, 'reseapoteket/agents')), path.join(rese, '.claude/agents'));
  assert.ok(!existsSync(path.join(out, 'husjakt/skills')));
  assert.equal(JSON.parse(readFileSync(path.join(out, 'reseapoteket/.claude-plugin/plugin.json'), 'utf8')).name, 'reseapoteket');
});

test('en ny körning bygger om från början', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'repon-'));
  repo(base, 'a');
  build(base);
  assert.deepEqual(build(base).plugins, ['a']);
});

test('regel 4-hooken hoppas över och övriga går via vakten med timeout kvar', () => {
  const hooks = convertHooks('/home/user/Husjakt', HOOKS);
  assert.deepEqual(Object.keys(hooks), ['Stop']);
  const [h] = hooks.Stop[0].hooks;
  assert.equal(h.timeout, 120);
  assert.match(h.command, /repo-hook\.mjs' '\/home\/user\/Husjakt' 'node "\$CLAUDE_PROJECT_DIR"/);
});

test('vakten: fil i repot, fil utanför och sessionens egen rot', () => {
  const r = '/home/user/Husjakt';
  assert.equal(shouldRun(r, { tool_input: { file_path: `${r}/src/a.ts` } }, '/home/user'), true);
  assert.equal(shouldRun(r, { tool_input: { file_path: '/home/user/fonder/a.kt' } }, '/home/user'), false);
  assert.equal(shouldRun(r, { tool_input: { file_path: `${r}/src/a.ts` } }, r), false);
  assert.equal(shouldRun(r, { tool_name: 'NotebookEdit', tool_input: { notebook_path: '/home/user/fonder/a.ipynb' } }, '/home/user'), false);
});

test('vakten vid Stop: bara när repot har ändringar', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'repon-'));
  const origin = path.join(base, 'origin');
  mkdirSync(origin);
  git(origin, 'init', '-q', '-b', 'main');
  writeFileSync(path.join(origin, 'a'), '1');
  git(origin, 'add', '.');
  git(origin, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'a');
  const clone = path.join(base, 'clone');
  spawnSync('git', ['clone', '-q', origin, clone]);
  assert.equal(shouldRun(clone, STOP, base), false);
  writeFileSync(path.join(clone, 'b'), '2');
  assert.equal(shouldRun(clone, STOP, base), true);
  git(clone, 'add', '.');
  git(clone, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'b');
  assert.equal(shouldRun(clone, STOP, base), true);
  assert.equal(shouldRun(path.join(base, 'inget-repo'), STOP, base), true);
});

test('vakten kör alltid Bash-vakter och SessionStart, även utan ändringar i repot', () => {
  const r = mkdtempSync(path.join(tmpdir(), 'repon-'));
  assert.equal(shouldRun(r, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'npx wrangler secret put X' } }, '/home/user'), true);
  assert.equal(shouldRun(r, { hook_event_name: 'SessionStart' }, '/home/user'), true);
  assert.equal(shouldRun(r, { hook_event_name: 'SessionStart' }, r), false);
});

test('vakten kör hooken med repot som rot och för vidare utdata och exitkod', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'repon-'));
  const r = repo(base, 'r');
  const guard = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'repo-hook.mjs');
  const run = spawnSync('node', [guard, r, 'echo "$CLAUDE_PROJECT_DIR"; cat >&2; exit 2'], {
    input: JSON.stringify({ tool_input: { file_path: path.join(r, 'x') } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: base }, encoding: 'utf8',
  });
  assert.equal(run.status, 2);
  assert.equal(run.stdout.trim(), r);
  assert.match(run.stderr, /file_path/);
});

test('vakten gör en hook som avbryts till ett synligt fel, inte ett tyst ok', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'repon-'));
  const r = repo(base, 'r');
  const guard = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'repo-hook.mjs');
  const run = spawnSync('node', [guard, r, 'kill -9 $$'], {
    input: JSON.stringify({ tool_input: { file_path: path.join(r, 'x') } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: base }, encoding: 'utf8',
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /kördes inte klart: SIGKILL/);
});
