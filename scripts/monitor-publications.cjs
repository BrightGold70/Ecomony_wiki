'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {noSymlinks}=require('./safe-fs.cjs');
const { checkPublication } = require('./check-publication-status.cjs');
const validDoi = value => typeof value === 'string' && /^10\.\d{4,9}\/[^\s\x00-\x1f\x7f]+$/.test(value);
const USAGE = 'Usage: node scripts/monitor-publications.cjs --vault ROOT --output NEW_JSON [--limit N] [--doi EXACT_BARE_DOI ...]';
function parseArgs(args) {
  const options = { dois: [] };
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--vault', '--output', '--limit', '--doi'].includes(key) || !args[i + 1] || args[i + 1].startsWith('--')) throw Error(USAGE);
    const value = args[++i];
    if (key === '--doi') {
      if (!validDoi(value)) throw Error('Invalid bare DOI; tokens are never repaired');
      options.dois.push(value);
    } else {
      const name = key.slice(2);
      if (Object.hasOwn(options, name)) throw Error(USAGE);
      options[name] = value;
    }
  }
  if (!options.vault || !options.output) throw Error(USAGE);
  if (options.limit !== undefined && (!/^[1-9]\d*$/.test(options.limit) || !Number.isSafeInteger(Number(options.limit)))) throw Error('Invalid --limit');
  options.limit = options.limit === undefined ? undefined : Number(options.limit);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(options.output)) throw Error('--output must be a local path');
  return options;
}
function scalar(raw) {
  // YAML scalar delimiters are syntax, not DOI normalization. Never trim inside quotes.
  if (/^".*"$/.test(raw)) { try { return JSON.parse(raw); } catch { return raw; } }
  if (/^'.*'$/.test(raw)) return raw.slice(1, -1).replace(/''/g, "'");
  return raw;
}
function collectLiterature(vault) {
  noSymlinks(vault);const root = fs.realpathSync(vault);
  const literature = path.join(root, 'economy_wiki/Literature');
  for (const dir of [path.join(root, 'economy_wiki'), literature]) {
    if (fs.lstatSync(dir).isSymbolicLink() || !fs.statSync(dir).isDirectory()) throw Error('Literature scope must be a real directory, not a symlink');
  }
  const result = { literature, notesScanned: 0, entries: [], missingDoiNotes: [], skippedSymlinks: [] };
  const byDoi = new Map();
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if(item.name.startsWith('.')||/^(private|personal|secrets)$/i.test(item.name))continue;
      const file = path.join(dir, item.name);
      const relative = path.relative(root, file).split(path.sep).join('/');
      if (item.isSymbolicLink()) { result.skippedSymlinks.push(relative); continue; }
      if (item.isDirectory()) { walk(file); continue; }
      if (!item.isFile() || !item.name.endsWith('.md')) continue;
      // Read only a bounded metadata prefix; never follow file symlinks.
      const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      let text;
      try { const bytes = Buffer.alloc(65536); const n = fs.readSync(fd, bytes, 0, bytes.length, 0); text = bytes.subarray(0, n).toString('utf8'); }
      finally { fs.closeSync(fd); }
      result.notesScanned++;
      const lines = text.replace(/\r\n/g, '\n').split('\n');
      let metadata = lines;
      if (lines[0] === '---') {
        const end = lines.indexOf('---', 1);
        if (end < 0) throw Error(`Unterminated or oversized frontmatter: ${relative}`);
        metadata = lines.slice(1, end);
      } else {
        // Legacy template: only its leading metadata section, not article prose.
        const end = lines.findIndex(line => /^##\s/.test(line));
        if (end >= 0) metadata = lines.slice(0, end);
      }
      const values = metadata.filter(line => /^doi:/i.test(line)).map(line => scalar(line.replace(/^doi:[ \t]*/i, '')));
      if (!values.length) result.missingDoiNotes.push(relative);
      for (const doi of values) {
        const key = validDoi(doi) ? doi.toLowerCase() : JSON.stringify(doi);
        if (!byDoi.has(key)) { const entry = { doi, notes: [] }; byDoi.set(key, entry); result.entries.push(entry); }
        const entry = byDoi.get(key);
        if (!entry.notes.includes(relative)) entry.notes.push(relative);
      }
    }
  }
  walk(literature);
  return result;
}
const STATES = ['not-checked', 'check-failed', 'notice-found', 'no-notice-found'];
async function runBatch({ vault, output, dois = [], limit }, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  noSymlinks(vault);const root = fs.realpathSync(vault);
  const outputPath = path.join(fs.realpathSync(path.dirname(path.resolve(output))), path.basename(output));
  if (outputPath === root || outputPath.startsWith(root + path.sep)) throw Error('Receipt must be outside the vault');
  const inventory = collectLiterature(root);
  for (const doi of dois) {
    if (!validDoi(doi)) throw Error('Invalid bare DOI selector');
    if (!inventory.entries.some(entry => validDoi(entry.doi) && entry.doi.toLowerCase() === doi.toLowerCase())) throw Error(`Requested DOI not found in Literature metadata: ${doi}`);
  }
  const requested = new Set(dois.map(doi => doi.toLowerCase()));
  let selected = inventory.entries.filter(entry => !requested.size || requested.has(entry.doi.toLowerCase()));
  const matchedBeforeLimit = selected.length;
  if (limit !== undefined) selected = selected.slice(0, limit);
  // Reserve exclusively before network traffic. An existing receipt is never overwritten.
  const fd = fs.openSync(outputPath, 'wx', 0o600);
  try {
    const startedAt = new Date().toISOString();
    const results = [];
    const safeCrossrefFetch = async (url, options) => {
      const target = new URL(url);
      if (target.origin !== 'https://api.crossref.org' || target.href.length > 4096) throw Error('Unsafe or oversized Crossref URL');
      const response = await fetchImpl(target.href, { ...options, redirect: 'error' });
      return { ok: response.ok, status: response.status, json: async () => JSON.parse(await response.text()) };
    };
    for (const entry of selected) {
      const checkedAt = new Date().toISOString();
      const crossref = await checkPublication(entry.doi, { fetchImpl: safeCrossrefFetch, timeoutMs, checkedAt });
      crossref.coverage = crossref.complete ? 'crossref-work-and-editorial-updates' : crossref.state === 'not-checked' ? 'not-attempted' : 'partial-or-failed';
      // The reused checker's original limitations are source-specific, not a statement about this batch.
      results.push({ ...entry, crossref });
    }
    const selectedSet = new Set(selected);
    const unselected = inventory.entries.filter(entry => !selectedSet.has(entry)).map(entry => ({ ...entry, crossref: { state: 'not-checked', complete: false }, reason: 'outside-explicit-selection-or-limit' }));
    const sources = {};
    for (const name of ['crossref']) sources[name] = Object.fromEntries(STATES.map(state => [state, results.filter(result => result[name].state === state).length]));
    const receipt = {
      schemaVersion: 1, startedAt, finishedAt: new Date().toISOString(), vault: root,
      selection: { requestedDois: dois, limit: limit ?? null, matchedBeforeLimit, order: 'sorted Literature paths; first DOI token preserved; valid DOI dedupe case-insensitive' },
      coverage: { notesScanned: inventory.notesScanned, uniqueDoiTokens: inventory.entries.length, missingDoiNotes: inventory.missingDoiNotes, skippedSymlinks: inventory.skippedSymlinks, selected: results.length, unselected: unselected.length, sources, sourceCountsScope: 'selected DOI tokens only; unselected tokens remain not-checked in unselected array' },
      limitations: [
        'Crossref only: optional explicit network metadata checks, no exhaustive notice coverage.',
        'No-notice-found is not proof of validity or absence of notices elsewhere.',
        'No scheduler, model calls, note edits, review decisions or automatic approval.'
      ], results, unselected
    };
    fs.writeFileSync(fd, JSON.stringify(receipt, null, 2) + '\n');
    return receipt;
  } finally { fs.closeSync(fd); }
}
module.exports = { parseArgs, collectLiterature, runBatch };
if (require.main === module) {
  (async () => {
    const receipt = await runBatch(parseArgs(process.argv.slice(2)));
    process.stdout.write(JSON.stringify({ output: process.argv[process.argv.indexOf('--output') + 1], coverage: receipt.coverage }, null, 2) + '\n');
    process.exitCode = receipt.results.some(row => row.crossref.state === 'check-failed') ? 1 : receipt.results.some(row => row.crossref.state === 'not-checked') ? 2 : 0;
  })().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
}
