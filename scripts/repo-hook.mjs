#!/usr/bin/env node
// Vakten för en repohook som laddas via repo-plugins.mjs. Hooken körs med repot som
// projektrot (`CLAUDE_PROJECT_DIR`, arbetskatalog), men bara när händelsen rör repot:
// - Är sessionens projektrot repot självt gör vakten ingenting: repots egna inställningar kör
//   redan hooken, och två körningar skulle ge dubbla besked.
// - Har händelsen en fil (`tool_input.file_path`, eller `notebook_path` för NotebookEdit) körs
//   hooken bara om filen ligger i repot.
// - Stop och SubagentStop körs bara om repot har ändringar: ocommittade filer eller commits som
//   inte finns på origin. Går det inte att avgöra körs den.
// - Ett verktyg som pekar ut ett GitHub-repo (`tool_input.owner` och `repo`, t.ex.
//   `mcp__github__create_pull_request`) kör hooken bara när det är repots eget `origin`.
// - Bash: hooken körs när kommandot rör repot – arbetskatalogen ligger i repot, eller kommandot
//   nämner repots namn (`cd VeckansMat`, `git -C …/Husjakt`, en adress med namnet i). Pekar
//   arbetskatalogen eller kommandot bara ut andra repon under samma rot körs den inte: en
//   `git push` i ett repo ska inte prova ett annat repos tester (#38). Går inget repo att peka
//   ut körs hooken – hellre en körning för mycket än en missad vakt.
// - Övriga händelser körs alltid; SessionStart körs en gång.
// Hookens stdout, stderr och exitkod förs vidare oförändrade. Gick hooken inte att köra (eller
// avbröts den) blir det exitkod 1 med orsaken – ett icke-blockerande fel som syns, aldrig ett tyst ok.
//
//   node repo-hook.mjs <repo> <kommando>

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STOP = new Set(['Stop', 'SubagentStop']);

function parse(raw) {
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const inside = (repo, file) => {
  const rel = path.relative(repo, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

function git(repo, ...args) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Har repot ocommittade filer eller commits utöver origin? null om det inte går att avgöra. */
export function changed(repo) {
  const status = git(repo, 'status', '--porcelain');
  if (status === null) return null;
  if (status !== '') return true;
  const ahead = git(repo, 'rev-list', '--count', '@{upstream}..HEAD') ?? git(repo, 'rev-list', '--count', 'origin/HEAD..HEAD');
  return ahead === null ? null : Number(ahead) > 0;
}

/** `owner/namn` i gemener ur en GitHub-adress (https, ssh eller via proxy), annars null. */
export function slug(url) {
  const m = /([^/:\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(String(url ?? '').trim());
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : null;
}

/** Gäller verktygets `owner`/`repo` ett annat GitHub-repo än det här? Okänt räknas som nej. */
export function otherGithubRepo(repo, toolInput, origin = git(repo, 'remote', 'get-url', 'origin')) {
  const { owner, repo: name } = toolInput ?? {};
  if (typeof owner !== 'string' || typeof name !== 'string') return false;
  const own = slug(origin);
  return own !== null && own !== `${owner}/${name}`.toLowerCase();
}

/** Repona (kataloger med `.git`) direkt under roten. */
export function siblings(base) {
  if (!base || !existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && existsSync(path.join(base, d.name, '.git')))
    .map((d) => path.join(base, d.name));
}

/**
 * Repona under roten som ett Bash-kommando pekar ut: det arbetskatalogen ligger i, och de vars
 * namn står i kommandot (skiftlägesokänsligt, så att även en adress med namnet i räknas).
 */
export function reposTouched(base, cwd, command) {
  const text = String(command ?? '').toLowerCase();
  const at = cwd ? path.resolve(cwd) : null;
  return siblings(base).filter((dir) => (at && (at === dir || inside(dir, at)))
    || text.includes(path.basename(dir).toLowerCase()));
}

/** Ska hooken köras för den här händelsen? */
export function shouldRun(repo, input, projectDir) {
  if (projectDir && path.resolve(projectDir) === path.resolve(repo)) return false;
  const file = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  if (file) return inside(repo, path.resolve(input.cwd ?? repo, file));
  if (STOP.has(input?.hook_event_name)) return changed(repo) !== false;
  if (otherGithubRepo(repo, input?.tool_input)) return false;
  if (input?.tool_name === 'Bash' && projectDir) {
    const touched = reposTouched(path.resolve(projectDir), input.cwd, input.tool_input?.command);
    if (touched.length > 0) return touched.includes(path.resolve(repo));
  }
  return true;
}

function main() {
  const [repo, command] = process.argv.slice(2);
  if (!repo || !command) return 0;
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    // Ingen indata.
  }
  if (!shouldRun(repo, parse(raw), process.env.CLAUDE_PROJECT_DIR)) return 0;
  const r = spawnSync('sh', ['-c', command], {
    input: raw, cwd: repo, env: { ...process.env, CLAUDE_PROJECT_DIR: repo }, encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== null) return r.status;
  process.stderr.write(`repohooken i ${path.basename(repo)} kördes inte klart: ${r.error?.message ?? r.signal}\n`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
