import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run } from '../repo-sync.mjs';

const ENV_OK = { CLAUDE_CODE_SUBAGENT_MODEL: 'opus' };

function setup({ settings } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'rs-'));
  const root = path.join(base, 'root');
  const repo = path.join(root, 'fonder');
  mkdirSync(path.join(repo, '.claude'), { recursive: true });
  writeFileSync(
    path.join(repo, '.claude/settings.json'),
    JSON.stringify({ permissions: { deny: ['Read(./.env)'], ask: ['Bash(git push:*)'] } }),
  );
  const settingsFile = path.join(base, 'settings.json');
  if (settings) writeFileSync(settingsFile, JSON.stringify(settings));
  return { root, settingsFile };
}

test('en spärr som saknas i miljöbilden läggs in och sägs en gång', () => {
  const { root, settingsFile } = setup({ settings: { model: 'opus', permissions: { deny: ['Bash(rm:*)'] } } });
  const lines = run({ root, env: ENV_OK, settingsFile });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /2 nya regler/);
  const s = JSON.parse(readFileSync(settingsFile, 'utf8'));
  assert.deepEqual(s.permissions.deny, ['Bash(rm:*)', `Read(/${path.join(root, 'fonder')}/.env)`]);
  assert.deepEqual(s.permissions.ask, ['Bash(git push:*)']);
  assert.equal(s.model, 'opus', 'befintliga nycklar står kvar');
  assert.equal(s.env, undefined, 'env skrivs inte av hooken');
  // andra gången är allt redan där: tyst och samma fil
  const text = readFileSync(settingsFile, 'utf8');
  assert.deepEqual(run({ root, env: ENV_OK, settingsFile }), []);
  assert.equal(readFileSync(settingsFile, 'utf8'), text);
});

test('saknad inställningsfil skapas', () => {
  const { root, settingsFile } = setup();
  assert.equal(run({ root, env: ENV_OK, settingsFile }).length, 1);
  assert.equal(JSON.parse(readFileSync(settingsFile, 'utf8')).permissions.ask.length, 1);
});

test('saknad standardmodell för agenter sägs, med var den ska läggas', () => {
  const { root, settingsFile } = setup();
  run({ root, env: ENV_OK, settingsFile });
  const lines = run({ root, env: {}, settingsFile });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /CLAUDE_CODE_SUBAGENT_MODEL=opus/);
  assert.match(lines[0], /Environment variables/);
});

test('en rot utan repon ger inga spärrar och rör inte filen', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'rs-'));
  const settingsFile = path.join(base, 'settings.json');
  assert.deepEqual(run({ root: path.join(base, 'saknas'), env: ENV_OK, settingsFile }), []);
  assert.throws(() => readFileSync(settingsFile));
});
