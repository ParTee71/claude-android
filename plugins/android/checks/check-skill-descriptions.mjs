// Skillbeskrivningarnas längd (claude-android #73). Claude Code kapar description + when_to_use
// vid 1 536 tecken per skill, och listan över alla skills har en budget i tecken (miljövariabeln
// SLASH_COMMAND_TOOL_CHAR_BUDGET, se DRIFT.md). Ryms listan inte stryks beskrivningar helt, så
// varje beskrivning ska hålla taket och summan per repo skrivas ut.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Claude Codes tak för description + when_to_use per skill. */
export const MAX_DESCRIPTION = 1536;

/** Ett skalärt fält ur frontmatter: enkel rad, citerad rad eller blockskalär (`>`, `|`). */
function field(frontmatter, key) {
  const lines = frontmatter.split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i < 0) return '';
  const first = lines[i].slice(key.length + 1).trim();
  const rest = [];
  for (const l of lines.slice(i + 1)) {
    if (l.trim() && !/^\s/.test(l)) break;
    rest.push(l.trim());
  }
  if (/^[>|][+-]?$/.test(first)) return rest.join(first.startsWith('>') ? ' ' : '\n').trim();
  const value = [first, ...rest].filter(Boolean).join(' ');
  const quoted = value.match(/^(["'])([\s\S]*)\1$/);
  return quoted ? quoted[2] : value;
}

/** Texten Claude Code visar i skill-listan: description, och " - when_to_use" om den finns. */
export function listingText(skillMd) {
  const m = skillMd.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return '';
  const description = field(m[1], 'description');
  const whenToUse = field(m[1], 'when_to_use');
  return whenToUse ? `${description} - ${whenToUse}` : description;
}

/** Varje skill i skillsDir med beskrivningens längd. */
export function measure(skillsDir) {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir)
    .map((name) => ({ name, file: path.join(skillsDir, name, 'SKILL.md') }))
    .filter(({ file }) => existsSync(file))
    .map(({ name, file }) => ({ name, length: listingText(readFileSync(file, 'utf8')).length }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Fel för beskrivningar över taket, relativt `root`. */
export function check(root, skillsDir = path.join(root, '.claude/skills')) {
  return measure(skillsDir)
    .filter((s) => s.length > MAX_DESCRIPTION)
    .map(
      (s) =>
        `${path.relative(root, path.join(skillsDir, s.name, 'SKILL.md'))}: beskrivningen är ${s.length} tecken, taket är ${MAX_DESCRIPTION} – Claude Code kapar resten`,
    );
}

/** Summan av beskrivningarnas längd, för utskriften. */
export function total(skillsDir) {
  const skills = measure(skillsDir);
  return { count: skills.length, chars: skills.reduce((sum, s) => sum + s.length, 0) };
}
