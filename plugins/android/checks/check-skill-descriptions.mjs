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
  if (!quoted) return value;
  return quoted[1] === '"' ? quoted[2].replace(/\\(["\\])/g, '$1') : quoted[2].replaceAll("''", "'");
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

/**
 * Ett ociterat värde med ` #` eller `: ` läses fel: i giltig YAML är ` #` en kommentar och resten
 * av beskrivningen försvinner, och `: ` gör frontmattern ogiltig, så att den bara råkar läsas rätt.
 */
export function unquotedProblem(skillMd) {
  const m = skillMd.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  for (const key of ['description', 'when_to_use']) {
    const line = m[1].split('\n').find((l) => l.startsWith(`${key}:`));
    const value = line?.slice(key.length + 1).trim() ?? '';
    if (/^["'>|]/.test(value)) continue;
    if (value.includes(' #')) return `${key} är ociterad och innehåller " #" – resten läses som en YAML-kommentar; sätt värdet inom "…"`;
    if (value.includes(': ')) return `${key} är ociterad och innehåller ": " – frontmattern blir ogiltig YAML; sätt värdet inom "…"`;
  }
  return null;
}

/** Fel för beskrivningar över taket eller ociterade värden som läses fel, relativt `root`. */
export function check(root, skillsDir = path.join(root, '.claude/skills')) {
  const rel = (name) => path.relative(root, path.join(skillsDir, name, 'SKILL.md'));
  const tooLong = measure(skillsDir)
    .filter((s) => s.length > MAX_DESCRIPTION)
    .map((s) => `${rel(s.name)}: beskrivningen är ${s.length} tecken, taket är ${MAX_DESCRIPTION} – Claude Code kapar resten`);
  const unquoted = measure(skillsDir)
    .map((s) => ({ ...s, problem: unquotedProblem(readFileSync(path.join(skillsDir, s.name, 'SKILL.md'), 'utf8')) }))
    .filter((s) => s.problem)
    .map((s) => `${rel(s.name)}: ${s.problem}`);
  return [...tooLong, ...unquoted];
}

/** Summan av beskrivningarnas längd, för utskriften. */
export function total(skillsDir) {
  const skills = measure(skillsDir);
  return { count: skills.length, chars: skills.reduce((sum, s) => sum + s.length, 0) };
}
