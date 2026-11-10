// Körs av claude-androids CI (test.yml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PLUGIN_ROOT, check, mentions, pluginNames, relativeLinks, tableNames } from '../check-links.mjs';

/** En liten plugin: skills mockup och release, agenten granskare. */
function makePlugin() {
  const dir = mkdtempSync(path.join(tmpdir(), 'plugin-'));
  for (const rel of ['skills/mockup/SKILL.md', 'skills/release/SKILL.md', 'skills/utan-fil/x.md', 'agents/granskare.md']) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), 'x');
  }
  return dir;
}

/** Minimalt repo med en skill, en agent och .claude/README.md som listar dem. */
function makeRepo(extra = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'links-'));
  const files = {
    'CLAUDE.md': 'Översikt: [.claude/README.md](.claude/README.md).',
    '.claude/README.md': '## Agenter\n| Agent | När |\n|---|---|\n| `granskare` | x |\n\n## Skills\n| Skill | När |\n|---|---|\n| `ci-budget` | x |\n',
    '.claude/skills/ci-budget/SKILL.md': 'Se [README](../../../README.md).',
    '.claude/agents/granskare.md': 'Agent.',
    'README.md': 'Läs [CLAUDE.md](CLAUDE.md) och skill `ci-budget`.',
    ...extra,
  };
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

test('ett korrekt minirepo ger inga fel', () => {
  assert.deepEqual(check(makeRepo()), []);
});

test('trasig relativ länk hittas, men inte webbadresser, ankare eller kodblock', () => {
  assert.deepEqual(relativeLinks('[a](x.md#rubrik) [b](https://x.se) [c](#ankare)\n```\n[d](kod.md)\n```'), ['x.md']);
  const problems = check(makeRepo({ 'ARKITEKTUR.md': 'Se [plan](PLAN.md).' }));
  assert.deepEqual(problems, ['ARKITEKTUR.md: länken PLAN.md pekar på något som inte finns']);
});

test('nämnd skill eller agent som inte finns hittas', () => {
  const problems = check(makeRepo({ 'ARKITEKTUR.md': 'Se skill `finns-inte` och agenten `spoke`.' }));
  assert.equal(problems.length, 2);
});

test('skill- och agentnamn känns igen i projektets skrivsätt', () => {
  const { skills, agents } = mentions('→ Skill: **data-safety-backup**. → Skills: **a-b**, **c-d**, **e-f**. (skill `ui-style`). Kör agenten **granskare**.');
  assert.deepEqual([...skills].sort(), ['a-b', 'c-d', 'data-safety-backup', 'e-f', 'ui-style']);
  assert.deepEqual([...agents], ['granskare']);
});

test('översiktstabellerna måste lista exakt de skills och agenter som finns', () => {
  const dir = makeRepo({ '.claude/skills/ny-skill/SKILL.md': 'x', '.claude/agents/ny.md': 'x' });
  assert.deepEqual(check(dir).sort(), [
    '.claude/README.md: agenten `ny` saknas i tabellen "Agenter"',
    '.claude/README.md: skill `ny-skill` saknas i tabellen "Skills"',
  ]);
  assert.deepEqual([...tableNames('## Skills\n| `a` · `b` | x |', 'Skills')], ['a', 'b']);
});

test('saknas översikten fälls varje skill och agent', () => {
  const dir = makeRepo();
  rmSync(path.join(dir, '.claude/README.md'));
  assert.deepEqual(check(dir).sort(), [
    '.claude/README.md: agenten `granskare` saknas i tabellen "Agenter"',
    '.claude/README.md: skill `ci-budget` saknas i tabellen "Skills"',
    'CLAUDE.md: länken .claude/README.md pekar på något som inte finns',
  ]);
});

test('framåtreferens i allowlistan godtas', () => {
  const dir = makeRepo({
    'ARKITEKTUR.md': 'Se [plan](PLAN.md).',
    '.github/scripts/link-allowlist.txt': '# x\nARKITEKTUR.md:PLAN.md – #99\n',
  });
  assert.deepEqual(check(dir), []);
});

test('pluginens skills och agenter läses ur pluginen själv', () => {
  const names = pluginNames(makePlugin());
  assert.deepEqual([...names.skills].sort(), ['mockup', 'release']);
  assert.deepEqual([...names.agents], ['granskare']);
  const real = pluginNames(PLUGIN_ROOT);
  assert.ok(real.skills.has('release') && real.skills.has('arbetsregler'));
  assert.ok(real.agents.has('granskare'));
});

test('pluginskills och pluginagenter med prefixet android: kontrolleras mot pluginen', () => {
  const { skills } = mentions('Skill **android:mockup** och skill `android:release`. → Skills: **android:refine-issue**, **ui-style**.');
  assert.deepEqual([...skills].sort(), ['android:mockup', 'android:refine-issue', 'android:release', 'ui-style'].sort());
  const dir = makeRepo({
    'ARKITEKTUR.md': 'Se skill **android:mockup**, skill `android:release` och skill `android:finns-inte`. Kör agenten `android:granskare` och agenten **android:spoke**.',
  });
  assert.deepEqual(check(dir, makePlugin()), [
    'ARKITEKTUR.md: skill `android:finns-inte` finns inte i pluginen',
    'ARKITEKTUR.md: agenten `android:spoke` finns inte i pluginen',
  ]);
});

test('en repo-skill räknas inte som pluginens', () => {
  const dir = makeRepo({ 'ARKITEKTUR.md': 'Skill `android:ci-budget`.' });
  assert.deepEqual(check(dir, makePlugin()), ['ARKITEKTUR.md: skill `android:ci-budget` finns inte i pluginen']);
});
