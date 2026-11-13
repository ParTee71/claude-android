// Körs av claude-androids CI (test.yml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_DESCRIPTION, check, listingText, total } from '../check-skill-descriptions.mjs';

const PLUGIN_SKILLS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills');

function repo(skills) {
  const dir = mkdtempSync(path.join(tmpdir(), 'skill-desc-'));
  for (const [name, frontmatter] of Object.entries(skills)) {
    mkdirSync(path.join(dir, '.claude/skills', name), { recursive: true });
    writeFileSync(path.join(dir, '.claude/skills', name, 'SKILL.md'), `---\nname: ${name}\n${frontmatter}\n---\n\nText.\n`);
  }
  return dir;
}

test('1 536 tecken släpps, 1 537 fälls', () => {
  const root = repo({ ok: `description: ${'a'.repeat(MAX_DESCRIPTION)}`, lang: `description: ${'a'.repeat(MAX_DESCRIPTION + 1)}` });
  const problems = check(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^\.claude\/skills\/lang\/SKILL\.md: beskrivningen är 1537 tecken, taket är 1536/);
});

test('when_to_use räknas in med avgränsaren, som i Claude Codes lista', () => {
  assert.equal(listingText('---\nname: x\ndescription: abc\nwhen_to_use: de\n---\n'), 'abc - de');
  const root = repo({ x: `description: ${'a'.repeat(1530)}\nwhen_to_use: bcdefg` });
  assert.equal(check(root).length, 1);
});

test('citerade värden och blockskalärer läses som text', () => {
  assert.equal(listingText('---\ndescription: "Citerad: text"\n---\n'), 'Citerad: text');
  assert.equal(listingText('---\ndescription: >-\n  Första raden\n  andra raden.\nname: x\n---\n'), 'Första raden andra raden.');
});

test('summan per repo', () => {
  const root = repo({ a: 'description: abc', b: 'description: de' });
  assert.deepEqual(total(path.join(root, '.claude/skills')), { count: 2, chars: 5 });
});

test('pluginens egna skills håller taket', () => {
  assert.deepEqual(check(path.join(PLUGIN_SKILLS, '..'), PLUGIN_SKILLS), []);
});
