import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build, convertHooks, pluginName } from '../repo-plugins.mjs';
import { shouldRun, slug, otherGithubRepo, reposTouched } from '../repo-hook.mjs';

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

test('varje repo med hookar blir en plugin med bara hookar, och en marknadsplats', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'repon-'));
  repo(base, 'ReseApoteket', { agents: true });
  repo(base, 'Husjakt', { agents: true, settings: HOOKS });
  mkdirSync(path.join(base, 'utan-claude'));
  const { out, plugins } = build(base);
  assert.equal(out, path.join(base, '.repo-plugins'));
  // ReseApoteket har skills och agenter men inga hookar: ingen plugin (Claude Code hittar dem själv).
  assert.deepEqual(plugins, ['husjakt']);
  const market = JSON.parse(readFileSync(path.join(out, '.claude-plugin/marketplace.json'), 'utf8'));
  assert.equal(market.name, 'repon');
  assert.deepEqual(market.plugins.map((p) => p.source), ['./husjakt']);
  assert.deepEqual(readdirSync(path.join(out, 'husjakt')).sort(), ['.claude-plugin', 'hooks']);
  assert.equal(JSON.parse(readFileSync(path.join(out, 'husjakt/.claude-plugin/plugin.json'), 'utf8')).name, 'husjakt');
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(path.join(out, 'husjakt/hooks/hooks.json'), 'utf8')).hooks), ['Stop']);
});

test('ingen genererad plugin innehåller en symlänk (Claude Code avvisar länkar ut ur pluginen)', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'repon-'));
  repo(base, 'Husjakt', { agents: true, settings: HOOKS });
  repo(base, 'VeckansMat', { settings: HOOKS });
  const { out } = build(base);
  const links = readdirSync(out, { recursive: true }).filter((f) => lstatSync(path.join(out, f)).isSymbolicLink());
  assert.deepEqual(links, []);
});

test('en ny körning bygger om från början', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'repon-'));
  repo(base, 'a', { settings: HOOKS });
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

test('vakten kör SessionStart, och Bash-vakter när inget repo går att peka ut', () => {
  const r = mkdtempSync(path.join(tmpdir(), 'repon-'));
  assert.equal(shouldRun(r, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'npx wrangler secret put X' } }, '/home/user'), true);
  assert.equal(shouldRun(r, { hook_event_name: 'SessionStart' }, '/home/user'), true);
  assert.equal(shouldRun(r, { hook_event_name: 'SessionStart' }, r), false);
});

/** En rot med repona VeckansMat, Husjakt och claude-android (bara `.git`-kataloger). */
function root() {
  const base = mkdtempSync(path.join(tmpdir(), 'rot-'));
  for (const name of ['VeckansMat', 'Husjakt', 'claude-android']) mkdirSync(path.join(base, name, '.git'), { recursive: true });
  mkdirSync(path.join(base, 'ingen-klon'));
  return base;
}
const bash = (cwd, command) => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd, tool_input: { command } });

test('vakten vid Bash: en push i ett annat repo kör inte hooken', () => {
  const base = root();
  const vm = path.join(base, 'VeckansMat');
  const ca = path.join(base, 'claude-android');
  assert.equal(shouldRun(vm, bash(ca, 'git push -u origin gren'), base), false);
  assert.equal(shouldRun(vm, bash(path.join(ca, 'scripts'), 'git push'), base), false);
  assert.equal(shouldRun(vm, bash(base, `cd ${ca} && git push`), base), false);
  assert.equal(shouldRun(vm, bash(base, 'git -C claude-android push'), base), false);
});

test('vakten vid Bash: kommandot rör repot via katalogen eller namnet', () => {
  const base = root();
  const vm = path.join(base, 'VeckansMat');
  const hj = path.join(base, 'Husjakt');
  assert.equal(shouldRun(vm, bash(vm, 'git push'), base), true);
  assert.equal(shouldRun(vm, bash(path.join(vm, 'src'), 'git push'), base), true);
  assert.equal(shouldRun(vm, bash(base, 'cd VeckansMat && git push'), base), true);
  // Står i ett annat repo men nämner det här: båda repona rörs, hooken körs.
  assert.equal(shouldRun(vm, bash(hj, `git -C ${vm} push`), base), true);
  // En adress med repots namn i räknas, så att en vakt mot driften ser anropet var det än görs.
  assert.equal(shouldRun(hj, bash(path.join(base, 'claude-android'), 'curl -X POST https://husjakt.example.dev/x'), base), true);
});

test('vakten vid Bash: pekas inget repo ut körs hooken', () => {
  const base = root();
  const hj = path.join(base, 'Husjakt');
  assert.equal(shouldRun(hj, bash(base, 'npx wrangler secret put X'), base), true);
  assert.equal(shouldRun(hj, bash(path.join(base, 'ingen-klon'), 'ls'), base), true);
  assert.equal(shouldRun(hj, bash(undefined, 'ls'), base), true);
  assert.deepEqual(reposTouched(base, base, 'ls'), []);
});

test('vakten vid GitHub-verktyg: bara repots eget origin kör hooken', () => {
  assert.equal(slug('https://github.com/ParTee71/VeckansMat'), 'partee71/veckansmat');
  assert.equal(slug('git@github.com:ParTee71/VeckansMat.git'), 'partee71/veckansmat');
  assert.equal(slug('http://proxy@127.0.0.1:8080/git/ParTee71/VeckansMat/'), 'partee71/veckansmat');
  assert.equal(slug(''), null);
  const origin = 'https://github.com/ParTee71/VeckansMat';
  assert.equal(otherGithubRepo('/x', { owner: 'partee71', repo: 'claude-android', body: 'Closes #35' }, origin), true);
  assert.equal(otherGithubRepo('/x', { owner: 'partee71', repo: 'veckansmat' }, origin), false);
  assert.equal(otherGithubRepo('/x', { owner: 'ParTee71', repo: 'VeckansMat' }, null), false); // okänt origin: kör
  assert.equal(otherGithubRepo('/x', { command: 'ls' }, origin), false); // inget GitHub-verktyg
});

test('vakten vid GitHub-verktyg: en PR i ett annat repo når inte repots hook', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'repon-'));
  const vm = path.join(base, 'VeckansMat');
  mkdirSync(vm);
  git(vm, 'init', '-q');
  git(vm, 'remote', 'add', 'origin', 'https://github.com/ParTee71/VeckansMat');
  const pr = (owner, name) => ({ hook_event_name: 'PreToolUse', tool_name: 'mcp__github__create_pull_request', tool_input: { owner, repo: name, body: 'Closes #35' } });
  assert.equal(shouldRun(vm, pr('partee71', 'claude-android'), base), false);
  assert.equal(shouldRun(vm, pr('ParTee71', 'VeckansMat'), base), true);
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
