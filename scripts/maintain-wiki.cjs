#!/usr/bin/env node
'use strict';
// Local mechanical audit only. No note writes, subprocesses, network or model calls.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const lifecycle = require('../dashboard/evidence-lifecycle.cjs');
const FOLDERS = Object.freeze(['Sources', 'Literature', 'Topics', 'Datasets', 'Policies', 'Methods', 'Theories', 'Analyses', 'Comparisons', 'Queries', 'Claims', 'Review', 'Setup']);
const NAV = Object.freeze(['Home.md', 'index.md', 'log.md', 'SCHEMA.md']);
const COMPILED = ['Literature', 'Topics', 'Datasets', 'Policies', 'Methods', 'Theories', 'Analyses', 'Comparisons', 'Queries'];
const STATE = 'maintenance-state.json';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
const sorted = values => [...new Set(values)].sort();
function noSymlinks(file, missing = false) {
  file = path.resolve(file);
  let current = path.parse(file).root;
  for (const part of file.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw Error('Symlink denied: ' + current); }
    catch (e) { if (missing && e.code === 'ENOENT') return false; throw e; }
  }
  return true;
}
function readSafe(file) {
  noSymlinks(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { if (!fs.fstatSync(fd).isFile()) throw Error('Not a regular file: ' + file); return fs.readFileSync(fd); }
  finally { fs.closeSync(fd); }
}
function scope(options) {
  if (!options || !options.vault || !options.stateDir) throw Error('vault (parent of economy_wiki) and stateDir are required');
  const vault = path.resolve(options.vault), root = path.join(vault, 'economy_wiki'), stateDir = path.resolve(options.stateDir);
  noSymlinks(root);
  if (!fs.statSync(root).isDirectory()) throw Error('Research root must be a directory');
  noSymlinks(stateDir, true);
  if (inside(vault, stateDir) || inside(stateDir, vault)) throw Error('State directory must be separate from vault');
  return { vault, root, stateDir };
}
function metadata(text) {
  const front = (text.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || '';
  return Object.fromEntries([...front.matchAll(/^([a-z_][a-z0-9_]*):[ \t]*([^\n]*)$/gm)].map(m => [m[1], m[2].trim().replace(/^(["'])(.*)\1$/, '$2')]));
}
function targetPath(value, raw = false) {
  if (typeof value !== 'string' || /[\\\x00-\x1f]/.test(value)) return null;
  let rel = value.trim();
  if (!rel.startsWith('economy_wiki/')) return null;
  const parts = rel.split('/');
  if (parts.some(p => !p || p === '.' || p === '..')) return null;
  const inner = parts.slice(1).join('/');
  if (raw && parts[1] === 'raw' && parts.length > 2 && !parts.slice(2).some(p => p.startsWith('.') || /^(private|personal|secrets)$/i.test(p))) return rel;
  if (NAV.includes(inner)) return rel;
  if (NAV.includes(inner + '.md')) return rel + '.md';
  if (!FOLDERS.includes(parts[1]) || parts.length < 3 || parts.some(p => p.startsWith('.') || /^(private|personal|secrets)$/i.test(p))) return null;
  if (!/\.[a-z0-9]+$/i.test(rel)) rel += '.md';
  return /\.(md|json)$/i.test(rel) ? rel : null;
}
function previousState(s) {
  const file = path.join(s.stateDir, STATE);
  if (!noSymlinks(file, true)) return null;
  const old = JSON.parse(readSafe(file));
  if (old.version !== 1 || old.vault !== s.vault || !old.files || typeof old.files !== 'object' || Array.isArray(old.files) || typeof old.lastSuccessfulRun !== 'string') throw Error('Invalid maintenance state or vault scope mismatch');
  for (const [key, value] of Object.entries(old.files)) {
    if (targetPath(key, true) !== key || !value || !/^[a-f0-9]{64}$/.test(value.sha256) || !Array.isArray(value.dependencies) || value.dependencies.some(d => targetPath(d, true) !== d)) throw Error('Invalid maintenance manifest entry');
  }
  return old;
}
function auditWiki(options) {
  const s = scope(options), old = previousState(s), generatedAt = new Date().toISOString();
  const docs = new Map(), files = {}, issues = [];
  const add = (file, rule, details = {}) => issues.push({ file, rule, ...details });
  function collect(rel) {
    const full = path.join(s.vault, rel);
    let stat;
    try { stat = fs.lstatSync(full); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    if (stat.isSymbolicLink()) { add(rel, 'symlink-denied'); return; }
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) if (!name.startsWith('.') && !/^(private|personal|secrets)$/i.test(name)) collect(rel + '/' + name);
    } else if (stat.isFile() && /\.md$/i.test(rel) || stat.isFile() && /economy_wiki\/(Claims|Review)\/.+\.json$/i.test(rel)) {
      const data = readSafe(full), text = data.toString('utf8');
      docs.set(rel, { text, meta: metadata(text) });
      files[rel] = { sha256: sha(data), bytes: data.length, dependencies: [] };
    }
  }
  // Never enumerate the parent vault, root, raw, Templates or hidden directories.
  for (const folder of FOLDERS) collect('economy_wiki/' + folder);
  for (const name of NAV) {
    const rel = 'economy_wiki/' + name;
    const full = path.join(s.vault, rel);
    if (fs.existsSync(full) && !fs.lstatSync(full).isDirectory()) collect(rel);
  }
  if (!docs.has('economy_wiki/SCHEMA.md')) add('economy_wiki/SCHEMA.md', 'missing-schema-governance');
  const fields = ['title', 'created', 'updated', 'type', 'tags', 'sources', 'review_status', 'evidence_kind', 'research_question'];
  const coverage = {}, duplicates = [], ids = { doi: new Map(), repec_id: new Map() };
  const inbound = new Map(), edges = [], claims = [], reviews = [];
  let eligible = 0, complete = 0, rawHashesChecked = 0;
  function dependency(from, target) {
    files[from].dependencies.push(target);
    edges.push({ source: from, target });
    if (from !== target) inbound.set(target, (inbound.get(target) || 0) + 1);
  }
  function hashRaw(from, value) {
    const target = targetPath(value, true);
    if (!target || !target.startsWith('economy_wiki/raw/')) { add(from, 'unsafe-raw-path', { target: String(value) }); return null; }
    dependency(from, target);
    try {
      const data = readSafe(path.join(s.vault, target));
      if (!files[target]) { files[target] = { sha256: sha(data), bytes: data.length, dependencies: [] }; rawHashesChecked++; }
      return files[target].sha256;
    } catch (e) { add(from, e.code === 'ENOENT' ? 'missing-raw-file' : 'unsafe-raw-file', { target }); return null; }
  }
  for (const [rel, doc] of docs) {
    const folder = rel.split('/')[1], m = doc.meta;
    if (rel.endsWith('.md') && (COMPILED.includes(folder) || folder === 'Sources')) {
      eligible++;
      const required = folder === 'Sources' ? ['title', 'type', 'source_mode'] : fields;
      const missing = required.filter(key => !m[key] || m[key] === '[]' && key === 'sources');
      if (!missing.length) complete++;
      for (const key of required) { coverage[key] ||= { applicable: 0, present: 0 }; coverage[key].applicable++; if (!missing.includes(key)) coverage[key].present++; }
      if (missing.length) add(rel, 'legacy-metadata-gaps', { fields: missing });
    }
    if (['Sources', 'Literature'].includes(folder)) {
      const doi = m.doi ? [m.doi.toLowerCase()] : [];
      const repec_id = m.repec_id && /^[A-Za-z0-9:._/-]+$/.test(m.repec_id) ? [m.repec_id] : [];
      for (const [kind, values] of [['doi', doi], ['repec_id', repec_id]]) for (const value of sorted(values)) { if (!ids[kind].has(value)) ids[kind].set(value, new Set()); ids[kind].get(value).add(rel); }
    }
    const refs = [...doc.text.matchAll(/\[\[(economy_wiki\/[^\]|#]+)(?:[^\]]*)\]\]/g)].map(m => m[1]);
    for (const match of doc.text.matchAll(/\]\(<?(economy_wiki\/[^\s)>#]+)(?:#[^\s)>]*)?>?\)/g)) refs.push(match[1]);
    for (const match of (m.sources || '').matchAll(/economy_wiki\/[^,\]"']+/g)) refs.push(match[0].trim());
    for (const value of sorted(refs)) {
      const target = targetPath(value);
      if (!target) add(rel, 'unsafe-or-out-of-scope-link', { target: value });
      else { dependency(rel, target); if (!docs.has(target)) add(rel, 'broken-full-path-link', { target }); }
    }
    if (folder === 'Sources' && m.raw_path) {
      const value = m.raw_path.startsWith('economy_wiki/') ? m.raw_path : 'economy_wiki/' + m.raw_path;
      const current = hashRaw(rel, value);
      if (!/^[a-f0-9]{64}$/i.test(m.raw_sha256 || '')) add(rel, 'missing-raw-integrity');
      else if (current && current !== m.raw_sha256.toLowerCase()) add(rel, 'raw-hash-mismatch', { target: value });
    }
    if (folder === 'Claims' || folder === 'Review') {
      const blocks = rel.endsWith('.json') ? [doc.text] : [...doc.text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map(m => m[1]);
      for (const block of blocks) {
        let data;
        try { data = JSON.parse(block); } catch { add(rel, 'invalid-json-record'); continue; }
        const records = Array.isArray(data) ? data : Array.isArray(data?.claims) ? data.claims : [data];
        for (const record of records) {
          if (folder === 'Review' && (record?.targetPath === undefined || record?.receipt === undefined)) continue;
          if (folder === 'Review') {
            const target = targetPath(record?.targetPath);
            const verified = lifecycle.verifyReview(target && docs.get(target)?.text, record?.receipt);
            reviews.push({ file: rel, target: record?.targetPath ?? null, ...verified });
            if (target) dependency(rel, target);
            if (verified.state !== 'reviewed') add(rel, 'review-receipt-' + verified.state, { target: record?.targetPath ?? null });
          } else {
            const errors = lifecycle.validateClaim(record);
            const source = targetPath(record?.sourcePath, true);
            let hash;
            if (source?.startsWith('economy_wiki/Sources/')) { hash = docs.has(source) ? files[source]?.sha256 : undefined; dependency(rel, source); }
            else if (source?.startsWith('economy_wiki/raw/')) hash = hashRaw(rel, source);
            else add(rel, 'claim-source-out-of-scope', { target: record?.sourcePath ?? null });
            const assessment = lifecycle.assessDependencies([record], new Map(hash ? [[record.sourcePath, hash]] : []))[0];
            claims.push({ file: rel, id: record?.id ?? null, sourcePath: record?.sourcePath ?? null, state: assessment.state, reason: assessment.reason, errors });
            if (errors.length) add(rel, 'invalid-claim', { id: record?.id ?? null, errors });
            if (assessment.state !== 'current') add(rel, 'claim-source-' + assessment.state, { id: record?.id ?? null, target: record?.sourcePath ?? null });
          }
        }
      }
    }
  }
  for (const kind of ['doi', 'repec_id']) for (const [value, paths] of ids[kind]) if (paths.size > 1 && ['Sources','Literature'].some(folder=>[...paths].filter(p=>p.startsWith('economy_wiki/'+folder+'/')).length>1)) duplicates.push({ kind, value, files: [...paths].sort(), candidateOnly: true });
  for (const d of duplicates) add(d.files[0], 'duplicate-' + d.kind + '-candidate', { value: d.value, files: d.files });
  const orphans = [...docs.keys()].filter(rel => ['Sources', ...COMPILED, 'Claims'].includes(rel.split('/')[1]) && !inbound.has(rel)).sort();
  for (const rel of orphans) add(rel, 'no-inbound-explicit-links');
  for (const entry of Object.values(files)) entry.dependencies = sorted(entry.dependencies);
  const manifestFiles = Object.fromEntries(Object.keys(files).sort().map(key => [key, files[key]]));
  const added = Object.keys(files).filter(key => !old || !Object.hasOwn(old.files, key)).sort();
  const changed = old ? Object.keys(files).filter(key => old.files[key] && old.files[key].sha256 !== files[key].sha256).sort() : [];
  const deleted = old ? Object.keys(old.files).filter(key => !Object.hasOwn(files, key)).sort() : [];
  const probableRenames = [];
  for (const from of deleted) { const to = added.filter(key => files[key].sha256 === old.files[from].sha256); if (to.length) probableRenames.push({ from, candidates: to, sha256: old.files[from].sha256, probableOnly: true }); }
  const affected = new Set(old ? [...added, ...changed, ...deleted] : []), impacted = [];
  // Explicit direct dependencies only; first baseline is never all-pages invalidation.
  for (const source of Object.keys(files).sort()) {
    const targets = sorted([...files[source].dependencies, ...(old?.files[source]?.dependencies || [])]).filter(t => affected.has(t));
    if (targets.length) impacted.push({ file: source, targets });
  }
  const index = qmdFreshness(options.qmdStateDir, s, files);
  const navPath = 'economy_wiki/index.md';
  const indexed = new Set(files[navPath]?.dependencies || []);
  const unlisted = [...docs.keys()].filter(rel => COMPILED.includes(rel.split('/')[1]) && !indexed.has(rel)).sort();
  const navigationIndex = { status: !docs.has(navPath) ? 'missing' : unlisted.length ? 'incomplete' : 'covered', unlisted, automaticallySynchronized: false };
  if (!docs.has(navPath)) add(navPath, 'missing-navigation-index');
  for (const rel of unlisted) add(rel, 'not-in-navigation-index');
  const compare = (a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); return x < y ? -1 : x > y ? 1 : 0; };
  const orderedIssues = [...new Map(issues.map(i => [JSON.stringify(i), i])).values()].sort(compare);
  return {
    version: 1,
    run: { generatedAt, lastSuccessfulRun: old?.lastSuccessfulRun || null, firstRun: !old, persisted: false, mode: 'read-only-audit' },
    scope: { vault: s.vault, root: s.root, folders: [...FOLDERS], navigation: [...NAV], raw: 'Only explicitly referenced safe paths; never enumerated', privateContentRead: false },
    counts: { notes: docs.size, registeredFiles: Object.keys(files).length, rawHashesChecked, issues: orderedIssues.length, duplicates: duplicates.length, orphans: orphans.length, claims: claims.length, reviews: reviews.length },
    changes: { new: added, changed, deleted, probableRenames, impacted, deletionPolicy: 'Report only; never enact deletions or link rewrites' },
    metadata: { mode: 'legacy-tolerant-coverage', strictPass: null, eligible, complete, fields: coverage, limitations: 'Restricted scalar/inline-list metadata coverage, not strict schema validation or economic review' },
    duplicates: duplicates.sort(compare), orphans, dependencies: [...new Map(edges.map(e => [JSON.stringify(e), e])).values()].sort(compare),
    claims: claims.sort(compare), reviews: reviews.sort(compare), index, navigationIndex,
    manifest: { version: 1, vault: s.vault, files: manifestFiles }, issues: orderedIssues,
    limitations: ['Explicit references only; no semantic dependency inference.', 'Hashes do not authenticate reviewers or validate economic claims.', 'No network, model, note edits, automatic deletion or index synchronization.']
  };
}
function qmdFreshness(stateDir, s, files) {
  const result = { status: 'not-configured', automaticallySynchronized: false, indexVerified: false, stalePaths: [] };
  if (!stateDir) return result;
  stateDir = path.resolve(stateDir);
  if (inside(s.vault, stateDir) || inside(stateDir, s.vault)) throw Error('QMD state must be external to vault');
  try {
    const bytes = readSafe(path.join(stateDir, 'manifest.json')), manifest = JSON.parse(bytes);
    const ready = JSON.parse(readSafe(path.join(stateDir, 'ready.json')));
    const root = s.root;
    if (manifest.vault !== root || ready.vault !== root || manifest.version !== 1 || ready.collection !== 'economy-research' || ready.manifestSha256 !== sha(bytes)) throw Error('QMD scope/receipt/manifest mismatch');
    // Verify the adapter configuration hash too, using its fixed local layout.
    const config = readSafe(path.join(stateDir, '../config/qmd/economy-research.yml'));
    if (ready.configSha256 !== sha(config)) throw Error('QMD config hash mismatch');
    const seen = new Set();
    for (const [key, entry] of Object.entries(manifest.files)) {
      const rel = targetPath('economy_wiki/' + entry.relative);
      if (!rel || !COMPILED.includes(rel.split('/')[1]) || key !== sha(entry.relative) + '.md' || entry.path !== path.join(root, entry.relative)) throw Error('Invalid QMD manifest mapping');
      seen.add(rel);
      if (files[rel]?.sha256 !== entry.sha256) result.stalePaths.push(rel);
    }
    for (const rel of Object.keys(files)) if (COMPILED.includes(rel.split('/')[1]) && !seen.has(rel)) result.stalePaths.push(rel);
    result.stalePaths = sorted(result.stalePaths);
    result.status = result.stalePaths.length ? 'stale' : 'manifest-hashes-current';
    result.builtAt = ready.builtAt || null;
    result.limitations = 'Receipt/config/source hashes checked only; live index contents and embeddings are not independently verified.';
  } catch (e) { result.status = e.code === 'ENOENT' ? 'not-ready' : 'invalid'; result.reason = e.code === 'ENOENT' ? 'Missing QMD manifest, ready receipt or config' : e.message; }
  return result;
}
function persistWiki(options) {
  const s = scope(options);
  fs.mkdirSync(s.stateDir, { recursive: true, mode: 0o700 });
  noSymlinks(s.stateDir);
  const lock = path.join(s.stateDir, 'maintenance.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); } catch (e) { if (e.code === 'EEXIST') throw Error('Maintenance busy; lock exists (do not remove an active lock)'); throw e; }
  let tmp;
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    const report = auditWiki(options);
    const state = { ...report.manifest, lastSuccessfulRun: report.run.generatedAt };
    tmp = path.join(s.stateDir, '.maintenance-' + crypto.randomBytes(12).toString('hex') + '.tmp');
    const out = fs.openSync(tmp, 'wx', 0o600);
    try { fs.writeFileSync(out, JSON.stringify(state, null, 2) + '\n'); fs.fsyncSync(out); } finally { fs.closeSync(out); }
    noSymlinks(path.join(s.stateDir, STATE), true);
    fs.renameSync(tmp, path.join(s.stateDir, STATE));
    report.run.persisted = true;
    report.run.mode = 'external-state-only';
    report.run.successfulRun = report.run.generatedAt;
    return report;
  } finally { if (tmp && fs.existsSync(tmp)) fs.unlinkSync(tmp); fs.closeSync(fd); fs.unlinkSync(lock); }
}
function cli(argv) {
  const options = {}, names = { '--vault': 'vault', '--state-dir': 'stateDir', '--output': 'output', '--qmd-state-dir': 'qmdStateDir' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--persist' && !options.persist) options.persist = true;
    else if (names[flag] && argv[i + 1] && !argv[i + 1].startsWith('--') && !Object.hasOwn(options, names[flag])) options[names[flag]] = argv[++i];
    else throw Error('Invalid or duplicate option: ' + flag);
  }
  const s = scope(options);
  if (!options.output) throw Error('--output must be a fresh external report path');
  const output = path.resolve(options.output);
  if (inside(s.vault, output) || inside(output, s.vault) || output === path.join(s.stateDir, STATE) || output === path.join(s.stateDir, 'maintenance.lock')) throw Error('Output must not overwrite vault or maintenance state');
  noSymlinks(path.dirname(output));
  // Reserve output before persisting; an existing path must not advance state.
  const fd = fs.openSync(output, 'wx', 0o600);
  try { const report = options.persist ? persistWiki(options) : auditWiki(options); fs.writeFileSync(fd, JSON.stringify(report, null, 2) + '\n'); return report; }
  catch (e) { fs.closeSync(fd); fs.unlinkSync(output); throw e; }
  finally { try { fs.closeSync(fd); } catch {} }
}
module.exports = { auditWiki, persistWiki, cli, FOLDERS, NAV };
if (require.main === module) {
  try { const report = cli(process.argv.slice(2)); process.stdout.write(JSON.stringify({ output: path.resolve(process.argv[process.argv.indexOf('--output') + 1]), counts: report.counts, run: report.run }) + '\n'); }
  catch (e) { process.stderr.write(JSON.stringify({ error: e.message }) + '\n'); process.exitCode = 1; }
}
