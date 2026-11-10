#!/usr/bin/env node
// Dokumentkontrollerna för Android-repona (claude-android #59), körs i repots CI efter att
// claude-android checkats ut bredvid:
//   - länkar och nämnda skills/agenter i dokumentationen finns, och .claude/README.md listar
//     exakt repots skills och agenter (check-links.mjs; pluginens namn läses ur pluginen);
//   - CI-tabellen i skill ci-budget har samma filter som android.yml (check-ci-table.mjs), när
//     tabellen har markeringarna ci-table:start/end.
//
//   node <claude-android>/plugins/android/checks/doc-checks.mjs [repo]   # exit 1 vid fel

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check as checkLinks } from './check-links.mjs';
import { SKILL, check as checkCiTable } from './check-ci-table.mjs';

/** Alla fel i repot, som läsbara rader. Tom lista = ok. */
export function docChecks(root) {
  const problems = checkLinks(root);
  const skill = path.join(root, SKILL);
  if (existsSync(skill) && readFileSync(skill, 'utf8').includes('ci-table:start')) {
    problems.push(...checkCiTable(root).map((p) => `${SKILL}: ${p}`));
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? '.');
  const problems = docChecks(root);
  if (problems.length) {
    console.error(`Dokumentkontrollen i ${path.basename(root)}:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Dokumentkontrollen i ${path.basename(root)}: ok`);
}
