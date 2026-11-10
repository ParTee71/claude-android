#!/usr/bin/env node
// Dokumentkontroll: relativa länkar och nämnda skills/agenter i dokumentationen finns, och
// tabellerna i .claude/README.md listar exakt de skills och agenter som finns i .claude/.
// Framåtreferenser till sådant som byggs senare står i repots link-allowlist.txt (töms allteftersom).
// Pluginens skills och agenter (`android:<namn>`) läses ur pluginen själv (claude-android #59).
// Körs av doc-checks.mjs; testas av test/check-links.test.mjs.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWLIST = '.github/scripts/link-allowlist.txt';
/** Översikten över skills och agenter (CLAUDE.md länkar hit, så att den filen hålls kort). */
export const TABLES = '.claude/README.md';
export const PLUGIN_PREFIX = 'android:';
/** Pluginens rot (plugins/android): skills i skills/<namn>/SKILL.md, agenter i agents/<namn>.md. */
export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Pluginens skill- och agentnamn utan prefix. */
export function pluginNames(pluginRoot = PLUGIN_ROOT) {
  const list = (dir, keep) => (existsSync(dir) ? readdirSync(dir).filter(keep) : []);
  const skillsDir = path.join(pluginRoot, 'skills');
  const agentsDir = path.join(pluginRoot, 'agents');
  return {
    skills: new Set(list(skillsDir, (n) => existsSync(path.join(skillsDir, n, 'SKILL.md')))),
    agents: new Set(list(agentsDir, (f) => f.endsWith('.md')).map((f) => f.slice(0, -3))),
  };
}

/** Dokumenten som kontrolleras: rotens md-filer och allt i .claude/ (utom lokala inställningar). */
export function docFiles(root) {
  const files = ['CLAUDE.md', 'README.md', 'ARKITEKTUR.md', 'KRAVLISTA.md'].filter((f) => existsSync(path.join(root, f)));
  const walk = (dir) => {
    for (const entry of readdirSync(path.join(root, dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(path.join(root, rel)).isDirectory()) walk(rel);
      else if (rel.endsWith('.md')) files.push(rel);
    }
  };
  if (existsSync(path.join(root, '.claude'))) walk('.claude');
  return files;
}

/** Relativa länkmål i markdown (utan ankare), utom kodblock. */
export function relativeLinks(markdown) {
  const text = markdown.replace(/```[\s\S]*?```/g, '');
  return [...text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((m) => m[1])
    .filter((t) => !/^(https?:|mailto:|#)/.test(t))
    .map((t) => decodeURI(t.split('#')[0]))
    .filter(Boolean);
}

/**
 * Skill- och agentnamn som nämns i löptext: "skill `x`", "Skill: **x**", "Skills: **a**, **b**",
 * "agenten `x`". Pluginskills behåller prefixet ("skill **android:mockup**" → `android:mockup`).
 */
export function mentions(markdown) {
  const skills = new Set();
  const agents = new Set();
  const name = String.raw`(?:\*\*|\`)((?:android:)?(?:[a-z0-9]+(?:-[a-z0-9]+)+|[a-z]{3,}))(?:\*\*|\`)`;
  for (const m of markdown.matchAll(new RegExp(String.raw`\b[Ss]kill:?\s+${name}`, 'g'))) skills.add(m[1]);
  for (const m of markdown.matchAll(/\b[Ss]kills:\s+((?:\*\*(?:android:)?[a-z0-9-]+\*\*(?:,\s*|\s+och\s+)?)+)/g)) {
    for (const n of m[1].matchAll(/\*\*((?:android:)?[a-z0-9-]+)\*\*/g)) skills.add(n[1]);
  }
  for (const m of markdown.matchAll(new RegExp(String.raw`\b[Aa]genten\s+${name}`, 'g'))) agents.add(m[1]);
  return { skills, agents };
}

/** Förstakolumnens namn i översiktstabellen under rubriken (t.ex. "## Skills"). */
export function tableNames(markdown, heading) {
  const section = markdown.split(/\n(?=## )/).find((s) => s.startsWith(`## ${heading}`));
  if (!section) return new Set();
  const names = new Set();
  for (const row of section.split('\n').filter((l) => l.startsWith('|'))) {
    for (const m of (row.split('|')[1] ?? '').matchAll(/`([a-z0-9-]+)`/g)) names.add(m[1]);
  }
  return names;
}

function parseAllowlist(text) {
  return new Set(
    text.split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.split(/\s+[–-]\s+/)[0].trim()),
  );
}

export function check(root, pluginRoot = PLUGIN_ROOT) {
  const allow = existsSync(path.join(root, ALLOWLIST)) ? parseAllowlist(readFileSync(path.join(root, ALLOWLIST), 'utf8')) : new Set();
  const { skills: plugin, agents: pluginAgents } = pluginNames(pluginRoot);
  const skillExists = (n) => existsSync(path.join(root, '.claude/skills', n, 'SKILL.md'));
  const mentionedSkillExists = (n) => (n.startsWith(PLUGIN_PREFIX) ? plugin.has(n.slice(PLUGIN_PREFIX.length)) : skillExists(n));
  const agentExists = (n) => existsSync(path.join(root, '.claude/agents', `${n}.md`));
  const mentionedAgentExists = (n) => (n.startsWith(PLUGIN_PREFIX) ? pluginAgents.has(n.slice(PLUGIN_PREFIX.length)) : agentExists(n));
  const problems = [];
  const report = (file, target, what) => {
    if (!allow.has(`${file}:${target}`)) problems.push(`${file}: ${what}`);
  };

  for (const file of docFiles(root)) {
    const text = readFileSync(path.join(root, file), 'utf8');
    for (const target of relativeLinks(text)) {
      if (!existsSync(path.resolve(root, path.dirname(file), target))) report(file, target, `länken ${target} pekar på något som inte finns`);
    }
    const { skills, agents } = mentions(text);
    for (const s of skills) {
      if (mentionedSkillExists(s)) continue;
      report(file, s, s.startsWith(PLUGIN_PREFIX) ? `skill \`${s}\` finns inte i pluginen` : `skill \`${s}\` finns inte i .claude/skills/`);
    }
    for (const a of agents) {
      if (mentionedAgentExists(a)) continue;
      report(file, a, a.startsWith(PLUGIN_PREFIX) ? `agenten \`${a}\` finns inte i pluginen` : `agenten \`${a}\` finns inte i .claude/agents/`);
    }
  }

  const tables = existsSync(path.join(root, TABLES)) ? readFileSync(path.join(root, TABLES), 'utf8') : '';
  const listedSkills = tableNames(tables, 'Skills');
  const listedAgents = tableNames(tables, 'Agenter');
  const dirEntries = (rel) => (existsSync(path.join(root, rel)) ? readdirSync(path.join(root, rel)) : []);
  const actualSkills = dirEntries('.claude/skills').filter(skillExists);
  const actualAgents = dirEntries('.claude/agents').filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  for (const s of actualSkills) if (!listedSkills.has(s)) problems.push(`${TABLES}: skill \`${s}\` saknas i tabellen "Skills"`);
  for (const s of listedSkills) if (!actualSkills.includes(s)) problems.push(`${TABLES}: tabellen "Skills" nämner \`${s}\`, som inte finns`);
  for (const a of actualAgents) if (!listedAgents.has(a)) problems.push(`${TABLES}: agenten \`${a}\` saknas i tabellen "Agenter"`);
  for (const a of listedAgents) if (!actualAgents.includes(a)) problems.push(`${TABLES}: tabellen "Agenter" nämner \`${a}\`, som inte finns`);
  return problems;
}
