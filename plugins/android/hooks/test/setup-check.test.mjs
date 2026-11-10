import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { failedPlugins, duplicateAgents } from '../setup-check.mjs';

const LIST = `Installed plugins:

  > android-ui@repon
    Version: 0.0.0
    Status: √ enabled

  > husjakt@repon
    Version: 0.0.0
    Status: × failed to load
    Error: Path escapes plugin directory: /home/user/.repo-plugins/husjakt/agents (agents)
    Error: Path escapes plugin directory: /home/user/.repo-plugins/husjakt/skills (skills)

  > android@claude-android
    Status: √ enabled
`;

test('pluginer som inte laddades plockas ur listan, en gång var', () => {
  assert.deepEqual(failedPlugins(LIST), ['husjakt@repon']);
  assert.deepEqual(failedPlugins('Installed plugins:\n\n  > a@b\n    Status: √ enabled\n'), []);
  assert.deepEqual(failedPlugins(''), []);
});

function agent(base, repo, file, name) {
  const dir = path.join(base, repo, '.claude/agents');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, file), name ? `---\nname: ${name}\ndescription: x\n---\n` : 'utan frontmatter\n');
}

test('samma agentnamn i två repon rapporteras, unika namn inte', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'agenter-'));
  agent(base, 'Husjakt', 'granskare.md', 'granskare');
  agent(base, 'VeckansMat', 'granskare.md', 'granskare');
  agent(base, 'Husjakt', 'kallgranskare.md', 'kallgranskare');
  agent(base, 'fonder', 'bygg.md', 'byggare');
  agent(base, 'Dagboken', 'byggare.md'); // namnet ur filnamnet
  agent(base, '.repo-plugins', 'granskare.md', 'granskare'); // dolda kataloger räknas inte
  assert.deepEqual(duplicateAgents(base), {
    granskare: ['Husjakt', 'VeckansMat'],
    byggare: ['Dagboken', 'fonder'],
  });
});

test('en rot utan repon eller som saknas ger inga dubbletter', () => {
  assert.deepEqual(duplicateAgents(mkdtempSync(path.join(tmpdir(), 'tom-'))), {});
  assert.deepEqual(duplicateAgents('/finns/inte'), {});
});
