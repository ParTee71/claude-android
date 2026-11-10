#!/usr/bin/env node
// Regel 4-kontrollen för Android-repona (enhetligt och utan dubbelkod), utan Gradle. Motorn
// finns bara här; varje repo har sina mönster, undantag, exempel och scope (#57):
//
//   app/src/test/resources/ui-forbidden.txt           mönstren per scope (läses också av UiConsistencyTest)
//   app/src/test/resources/ui-allowlist.txt           undantagen, med motivering
//   app/src/test/resources/ui-forbidden-examples.txt  delade exempel (läses också av UiConsistencyTest)
//   .claude/regel4.json                               scope, beskedets texter, exemplens filer, baslinjen
//
// Ett repo är en katalog med `.claude/regel4.json`.
//
//   (ingen flagga)             PostToolUse (Edit|Write|MultiEdit): kontrollerar filen som ändrades.
//                              Exit 0 = inget att anmärka, exit 2 = träff; beskedet på stderr.
//   --stop                     Stop: alla filer som ändrats mot origin/master (eller origin/main) i
//                              projektroten, eller i varje repo direkt under den. Vid träff
//                              `{"decision":"block"}` på stdout, högst en gång i följd.
//   --verify [repo]            Repots CI: konfigurationen, mönsterfilens sektioner mot scopen,
//                              alla delade exempel, undantagsfilen och baslinjen. Exit 1 vid fel.
//   --baseline [--check] [repo]  Skriver om baslinjen i ui-allowlist.txt (bara repon med `baseline`
//                              i konfigurationen); med --check exit 1 om den inte är aktuell.
//
// Varje besked (PostToolUse-träff, Stop-blockering per repo) ger en rad i beskedloggen (log.mjs).

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logBesked } from './log.mjs';

export const CONFIG_FILE = '.claude/regel4.json';
export const PATTERNS_FILE = 'app/src/test/resources/ui-forbidden.txt';
export const ALLOWLIST_FILE = 'app/src/test/resources/ui-allowlist.txt';
export const EXAMPLES_FILE = 'app/src/test/resources/ui-forbidden-examples.txt';
const MAIN = 'app/src/main/';
const SELF = fileURLToPath(import.meta.url);

const posix = (p) => p.split(path.sep).join('/');

/** Tolkar en sektionerad fil (`[namn]` följt av rader; tomma rader och `#`-rader hoppas över). */
export function parseSections(text) {
  const sections = {};
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const section = line.match(/^\[([\w-]+)\]\s*$/);
    if (section) sections[(current = section[1])] = [];
    else if (current) sections[current].push(line);
  }
  return sections;
}

/** Tolkar ui-forbidden.txt till { scope: [{ source, regex, replacement }] }. */
export function parsePatterns(text) {
  return Object.fromEntries(
    Object.entries(parseSections(text)).map(([scope, lines]) => [
      scope,
      lines.map((line) => {
        const [pattern, replacement = ''] = line.split('\t');
        return { source: pattern, regex: new RegExp(pattern), replacement };
      }),
    ]),
  );
}

/**
 * Tolkar ui-allowlist.txt till [{ file, symbol }]. Format per rad:
 * `<sökväg>:<symbol> – <motivering>`. En rad utan symbol eller motivering är ett fel.
 */
export function parseAllowlist(text) {
  const entries = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.startsWith('#')) return;
    const [location, ...reason] = line.split(/\s+[–-]\s+/);
    const idx = location.lastIndexOf(':');
    const file = idx > 0 ? location.slice(0, idx).trim() : '';
    const symbol = idx > 0 ? location.slice(idx + 1).trim() : '';
    if (!file || !symbol || !reason.join('').trim()) {
      throw new Error(`ui-allowlist.txt rad ${i + 1}: ogiltig rad, formatet är "<sökväg>:<symbol> – <motivering>"`);
    }
    entries.push({ file, symbol });
  });
  return entries;
}

/** Ett undantag gäller bara träffar vars matchade text och symbolen överlappar – inte hela raden. */
export function isAllowed(allowlist, file, match) {
  const m = match.trim();
  return allowlist.some((a) => a.file === file && (m.includes(a.symbol) || a.symbol.includes(m)));
}

/**
 * Läser och kontrollerar `.claude/regel4.json`. Varje scope har `text` och valfria `include` och
 * `exclude` (regex mot sökvägen relativt repots rot). Kastar med en begriplig text vid fel.
 */
export function parseConfig(text) {
  const config = JSON.parse(text);
  if (!config || typeof config.scopes !== 'object' || Object.keys(config.scopes).length === 0) {
    throw new Error(`${CONFIG_FILE}: "scopes" saknas`);
  }
  const scopes = Object.fromEntries(
    Object.entries(config.scopes).map(([name, s]) => {
      if (!s?.text) throw new Error(`${CONFIG_FILE}: scope ${name} saknar "text"`);
      return [name, { text: s.text, include: s.include ? new RegExp(s.include) : null, exclude: s.exclude ? new RegExp(s.exclude) : null }];
    }),
  );
  return { scopes, hint: config.hint ?? '', examples: config.examples ?? {}, baseline: config.baseline ?? null };
}

/** Vilka scope en repo-relativ sökväg hör till: Kotlin under app/src/main som scopets regler släpper in. */
export function scopesFor(relPath, config) {
  const p = posix(relPath);
  if (!p.startsWith(MAIN) || !p.endsWith('.kt')) return [];
  return Object.entries(config.scopes)
    .filter(([, s]) => (!s.include || s.include.test(p)) && !(s.exclude && s.exclude.test(p)))
    .map(([name]) => name);
}

/** Hittar förbjudna mönster i en fils innehåll. */
export function findViolations(relPath, content, rules) {
  const { patterns, allowlist, config } = rules;
  const active = scopesFor(relPath, config).filter((s) => patterns[s]);
  if (active.length === 0) return [];
  const normalized = posix(relPath);
  const hits = [];
  content.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ')) return;
    for (const scope of active) {
      for (const rule of patterns[scope]) {
        const m = line.match(rule.regex);
        if (!m) continue;
        if (!isAllowed(allowlist, normalized, m[0])) hits.push({ line: i + 1, match: m[0], replacement: rule.replacement, scope });
      }
    }
  });
  return hits;
}

const read = (root, rel) => readFileSync(path.join(root, rel), 'utf8');

/** Konfiguration, mönster och undantag för ett repo. Kastar om någon fil är trasig. */
export function loadRules(root) {
  const config = parseConfig(read(root, CONFIG_FILE));
  const patterns = parsePatterns(read(root, PATTERNS_FILE));
  const allowlist = existsSync(path.join(root, ALLOWLIST_FILE)) ? parseAllowlist(read(root, ALLOWLIST_FILE)) : [];
  return { config, patterns, allowlist };
}

export const isRepo = (dir) => existsSync(path.join(dir, CONFIG_FILE));

/** Närmaste katalog uppåt från filen som har regel 4-konfigurationen, annars null. */
export function findRepoRoot(absFile) {
  let dir = path.dirname(absFile);
  for (;;) {
    if (isRepo(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Repona som Stop kontrollerar: projektroten om den är ett repo, annars varje repo direkt under den. */
export function stopRoots(base) {
  if (!base || !existsSync(base)) return [];
  if (isRepo(base)) return [base];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(base, d.name))
    .filter(isRepo);
}

/** Träffar i en fil (sökväg relativ repots rot); tom lista för filer utanför regelns räckvidd. */
function checkFile(root, rel, rules) {
  const abs = path.join(root, rel);
  if (!rel.endsWith('.kt') || !existsSync(abs) || scopesFor(rel, rules.config).length === 0) return [];
  return findViolations(rel, readFileSync(abs, 'utf8'), rules).map((h) => ({ ...h, rel }));
}

export function formatHits(hits, config) {
  const where = [...new Set(hits.map((h) => config.scopes[h.scope]?.text ?? h.scope))].join(' och ');
  const lines = hits.map((h) => `  ${h.rel}:${h.line}  \`${h.match.trim()}\`  → använd ${h.replacement}`);
  return (
    `Regel 4 (enhetligt och utan dubbelkod): förbjudna mönster i ${where}.\n` +
    lines.join('\n') +
    `\n${config.hint ? `${config.hint} ` : ''}` +
    `Undantag bara via ${ALLOWLIST_FILE} med motivering och användarens ok.\n`
  );
}

/** Filer som ändrats mot basgrenen på origin: committade, ändrade i arbetsträdet och nya. */
export function changedFiles(root) {
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : null;
  };
  const base = ['origin/master', 'origin/main'].find((b) => git('rev-parse', '--verify', '--quiet', b));
  return [
    ...new Set([
      ...(base ? git('diff', '--name-only', '--diff-filter=d', `${base}...HEAD`) ?? [] : []),
      ...(git('diff', '--name-only', '--diff-filter=d', 'HEAD') ?? []),
      ...(git('ls-files', '--others', '--exclude-standard') ?? []),
    ]),
  ];
}

function parseInput(raw) {
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** PostToolUse: kontrollerar filen som just ändrades. Repot räknas från filen, inte från projektroten. */
function afterEdit(base, input) {
  const filePath = input?.tool_input?.file_path;
  if (!filePath) return 0;
  const abs = path.isAbsolute(filePath) ? filePath : path.join(base, filePath);
  if (!abs.endsWith('.kt') || !existsSync(abs)) return 0;
  const root = findRepoRoot(abs);
  if (!root) return 0;
  const rel = path.relative(root, abs);
  let rules;
  try {
    rules = loadRules(root);
  } catch (e) {
    process.stderr.write(`Regel 4: ${e.message}\n`);
    logBesked('regel4-check', 'regel4', root);
    return 2;
  }
  const hits = checkFile(root, rel, rules);
  if (hits.length === 0) return 0;
  process.stderr.write(formatHits(hits, rules.config));
  logBesked('regel4-check', 'regel4', root);
  return 2;
}

/**
 * Stop: kontrollerar alla ändrade filer innan Claude avslutar turen, så att en träff som
 * PostToolUse-beskedet inte ledde till en rättning inte följer med till PR:en.
 */
function beforeStop(base, input) {
  if (input?.stop_hook_active) return 0;
  const roots = stopRoots(base);
  const reasons = [];
  for (const root of roots) {
    // Med flera repon visas reponamnet före sökvägen, så att träffarna går att skilja åt.
    const name = path.basename(root);
    let reason = null;
    try {
      const rules = loadRules(root);
      const hits = changedFiles(root).flatMap((rel) => checkFile(root, rel, rules));
      if (hits.length > 0) reason = formatHits(roots.length > 1 ? hits.map((h) => ({ ...h, rel: `${name}/${h.rel}` })) : hits, rules.config);
    } catch (e) {
      reason = `${roots.length > 1 ? `${name}: ` : ''}Regel 4: ${e.message}`;
    }
    if (reason) {
      reasons.push(reason);
      logBesked('regel4-check', 'regel4-stop', root);
    }
  }
  if (reasons.length > 0) process.stdout.write(JSON.stringify({ decision: 'block', reason: reasons.join('\n') }));
  return 0;
}

function kotlinFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return kotlinFiles(p);
    return e.name.endsWith('.kt') ? [p] : [];
  });
}

const baselineHeader = (reason) => `# Undantag från regel 4 (skill shared-ui-components).
# Format: <sökväg relativt repots rot>:<symbol> – <motivering>
# Varje ny handskriven rad kräver användarens uttryckliga ok i PR:en.
#
# Raderna med motiveringen "${reason}" är baslinjen: brotten som fanns när
# kontrollen infördes. De genereras av pluginens regel4-check.mjs --baseline och ska bara bli
# färre – kör den igen när en skärm rättats. Lägg aldrig till en baslinjerad för hand.`;

/** Hela undantagsfilen: huvudet, handskrivna rader (oförändrade) och baslinjen för repot i [root]. */
export function renderAllowlist(root) {
  const { config, patterns } = loadRules(root);
  const reason = config.baseline;
  if (!reason) throw new Error(`${CONFIG_FILE}: "baseline" saknas – repot har ingen baslinje`);
  const entries = new Set();
  for (const abs of kotlinFiles(path.join(root, MAIN))) {
    const rel = posix(path.relative(root, abs));
    for (const hit of findViolations(rel, readFileSync(abs, 'utf8'), { config, patterns, allowlist: [] })) {
      entries.add(`${rel}:${hit.match.trim()} – ${reason}`);
    }
  }
  const allowPath = path.join(root, ALLOWLIST_FILE);
  const current = existsSync(allowPath) ? readFileSync(allowPath, 'utf8') : '';
  const manual = current.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#') && !l.endsWith(reason));
  const parts = [baselineHeader(reason)];
  if (manual.length) parts.push('', '# Handskrivna undantag', ...manual);
  parts.push('', '# Baslinje', ...[...entries].sort());
  return parts.join('\n') + '\n';
}

/** Repots CI: alla fel i konfigurationen, mönstren, exemplen, undantagen och baslinjen. Tom lista = ok. */
export function verify(root) {
  let rules;
  try {
    rules = loadRules(root);
  } catch (e) {
    return [e.message];
  }
  const { config, patterns } = rules;
  const errors = [];
  const scopeNames = Object.keys(config.scopes).sort();
  const sections = Object.keys(patterns).sort();
  if (scopeNames.join() !== sections.join()) {
    errors.push(`${PATTERNS_FILE} har sektionerna [${sections.join(', ')}] men ${CONFIG_FILE} scopen [${scopeNames.join(', ')}]`);
  }
  for (const [scope, list] of Object.entries(patterns)) {
    for (const rule of list) if (!rule.replacement) errors.push(`${PATTERNS_FILE} [${scope}] ${rule.source}: ersättning saknas`);
  }
  if (!existsSync(path.join(root, EXAMPLES_FILE))) return [...errors, `${EXAMPLES_FILE} saknas`];
  const examples = parseSections(read(root, EXAMPLES_FILE));
  const noAllow = { config, patterns, allowlist: [] };
  for (const [section, lines] of Object.entries(examples)) {
    if (section === 'scope') {
      for (const line of lines) {
        const [file, expected = ''] = line.split('\t');
        const got = scopesFor(file, config).join(',');
        if (got !== expected) errors.push(`[scope] ${file}: väntade "${expected}", fick "${got}"`);
      }
    } else if (section === 'allowlist-fel') {
      for (const line of lines) {
        try {
          parseAllowlist(line);
          errors.push(`[allowlist-fel] godtogs: ${line}`);
        } catch {
          // Väntat.
        }
      }
    } else {
      const spec = config.examples[section];
      if (!spec?.file) {
        errors.push(`${CONFIG_FILE}: examples.${section}.file saknas`);
        continue;
      }
      for (const line of lines) {
        if (section === 'allowlist') {
          const [allowLine, code, expected] = line.split('\t');
          const got = findViolations(spec.file, code, { config, patterns, allowlist: parseAllowlist(allowLine) }).length === 0 ? 'ok' : 'stopp';
          if (got !== expected) errors.push(`[allowlist] ${line}: väntade ${expected}, fick ${got}`);
        } else {
          const got = findViolations(spec.file, line, noAllow).length === 0 ? 'ok' : 'stopp';
          if (got !== spec.expect) errors.push(`[${section}] i ${spec.file}: väntade ${spec.expect}, fick ${got}: ${line}`);
        }
      }
    }
  }
  if (config.baseline) {
    const current = existsSync(path.join(root, ALLOWLIST_FILE)) ? read(root, ALLOWLIST_FILE) : '';
    if (renderAllowlist(root) !== current) errors.push(`${ALLOWLIST_FILE}: baslinjen är inte aktuell – kör regel4-check.mjs --baseline`);
  }
  return errors;
}

function main(argv) {
  const repoArg = () => path.resolve(argv.find((a, i) => i > 0 && !a.startsWith('--')) ?? '.');
  if (argv.includes('--verify')) {
    const root = repoArg();
    const errors = verify(root);
    if (errors.length) {
      process.stderr.write(`Regel 4-kontrollen i ${path.basename(root)}:\n${errors.map((e) => `  ${e}`).join('\n')}\n`);
      return 1;
    }
    process.stdout.write(`Regel 4-kontrollen i ${path.basename(root)}: ok\n`);
    return 0;
  }
  if (argv.includes('--baseline')) {
    const root = repoArg();
    const next = renderAllowlist(root);
    const allowPath = path.join(root, ALLOWLIST_FILE);
    if (argv.includes('--check')) {
      const current = existsSync(allowPath) ? readFileSync(allowPath, 'utf8') : '';
      if (current === next) return 0;
      process.stderr.write(`${ALLOWLIST_FILE} är inte aktuell – kör regel4-check.mjs --baseline\n`);
      return 1;
    }
    writeFileSync(allowPath, next);
    const reason = parseConfig(read(root, CONFIG_FILE)).baseline;
    process.stdout.write(`${ALLOWLIST_FILE}: ${next.split('\n').filter((l) => l.endsWith(reason)).length} baslinjerader\n`);
    return 0;
  }
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    // Ingen indata.
  }
  const input = parseInput(raw);
  const base = path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  return argv.includes('--stop') ? beforeStop(base, input) : afterEdit(base, input);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  process.exit(main(process.argv.slice(1)));
}
