// Körs av claude-androids CI (test.yml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { docChecks } from '../doc-checks.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'doc-checks.mjs');

function repo(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'doc-checks-'));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

const readme = '## Agenter\n\n## Skills\n| Skill | När |\n|---|---|\n| `ci-budget` | x |\n';
const workflow = "        with:\n          filters: |\n            app:\n              - 'app/**'\n";

test('CI-tabellen kontrolleras när skill ci-budget har markeringarna, annars inte', () => {
  const table = (paths) => `<!-- ci-table:start -->\n| Filter | Sökvägar | Körs |\n|---|---|---|\n| \`app\` | ${paths} | x |\n<!-- ci-table:end -->\n`;
  const ok = repo({ '.claude/README.md': readme, '.claude/skills/ci-budget/SKILL.md': table('`app/**`'), '.github/workflows/android.yml': workflow });
  assert.deepEqual(docChecks(ok), []);
  const bad = repo({ '.claude/README.md': readme, '.claude/skills/ci-budget/SKILL.md': table('`app/**`, `x/**`'), '.github/workflows/android.yml': workflow });
  assert.match(docChecks(bad).join(), /ci-budget\/SKILL\.md: `app`: tabellen har \[app\/\*\*, x\/\*\*\]/);
  const none = repo({ '.claude/README.md': readme, '.claude/skills/ci-budget/SKILL.md': 'Ingen tabell.' });
  assert.deepEqual(docChecks(none), []);
});

test('kommandot ger exit 1 med felen och exit 0 när repot är rent', () => {
  const ok = repo({ '.claude/README.md': readme, '.claude/skills/ci-budget/SKILL.md': 'x' });
  assert.equal(spawnSync('node', [CLI, ok], { encoding: 'utf8' }).status, 0);
  const bad = repo({ '.claude/README.md': readme, '.claude/skills/ci-budget/SKILL.md': 'Se [x](saknas.md).' });
  const r = spawnSync('node', [CLI, bad], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /länken saknas\.md pekar på något som inte finns/);
});
