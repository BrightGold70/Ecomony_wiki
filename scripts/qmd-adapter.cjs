#!/usr/bin/env node
'use strict';
const {noSymlinks}=require('./safe-fs.cjs');
// A local-only allowlist boundary. Never point QMD at the original vault.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const ALLOWED = Object.freeze(['Literature', 'Topics', 'Datasets', 'Policies', 'Methods', 'Theories', 'Analyses', 'Comparisons', 'Queries']);
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const inside = (root, file) => file.startsWith(root + path.sep);
function checkedFile(vault, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Outside research scope');
  const parts = relative.split('/');
  if (!ALLOWED.includes(parts[0]) || parts.length < 2 || parts.some(p => !p || p.startsWith('.') || /^(private|personal|secrets)$/i.test(p) || /[\\%\x00-\x1f]/.test(p)) || !relative.toLowerCase().endsWith('.md')) throw new Error('Outside research scope');
  let current = vault;
  for (const part of parts) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink denied');
  }
  if (!fs.statSync(current).isFile() || !inside(vault, fs.realpathSync(current))) throw new Error('Outside research scope');
  return current;
}
function stage({ vault, state }) {
  vault = path.resolve(vault); state = path.resolve(state);
  if (fs.lstatSync(vault).isSymbolicLink() || fs.realpathSync(vault) !== vault) throw new Error('Vault must be a canonical non-symlink directory');
  if (state === vault || inside(vault, state) || inside(state, vault)) throw new Error('State and vault must be separate');
  noSymlinks(state,true);
  fs.mkdirSync(state, { recursive: true, mode: 0o700 });
  const mirror = path.join(state, 'mirror');
  const pending = path.join(state, `mirror-pending-${process.pid}`);
  fs.mkdirSync(pending, { mode: 0o700 });
  const manifest = { version: 1, vault, allowed: [...ALLOWED], files: {} };
  function visit(relative) {
    const full = path.join(vault, relative);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) if(!name.startsWith('.')&&!/^(private|personal|secrets)$/i.test(name)) visit(`${relative}/${name}`);
    } else if (stat.isFile() && relative.toLowerCase().endsWith('.md')) {
      const source = checkedFile(vault, relative);
      const fd = fs.openSync(source, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      let content;
      try { content = fs.readFileSync(fd); } finally { fs.closeSync(fd); }
      const key = digest(relative) + '.md';
      fs.writeFileSync(path.join(pending, key), content, { mode: 0o600 });
      manifest.files[key] = { path: source, relative, sha256: digest(content) };
    }
  }
  try {
    // Do not enumerate the vault root or any non-allowlisted directory.
    for (const name of ALLOWED) if (fs.existsSync(path.join(vault, name))) visit(name);
    fs.rmSync(mirror, { recursive: true, force: true });
    fs.renameSync(pending, mirror);
    fs.writeFileSync(path.join(state, 'manifest.json.new'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    fs.renameSync(path.join(state, 'manifest.json.new'), path.join(state, 'manifest.json'));
    return manifest;
  } finally { fs.rmSync(pending, { recursive: true, force: true }); }
}
const COLLECTION = 'economy-research';
function typedQuery(lex, vec) {
  for (const value of [lex, vec]) {
    if (typeof value !== 'string' || !value.trim() || value.length > 4000 || /[\x00-\x1f\x7f\u2028\u2029]/u.test(value) || (value.match(/"/g) || []).length % 2) throw new Error('Query must be nonempty single-line text with balanced quotes (max 4000 characters)');
  }
  return `lex: ${lex.trim()}\nvec: ${vec.trim()}`;
}
function mapResults(rows, { vault, state }) {
  vault = path.resolve(vault);
  const manifest = JSON.parse(fs.readFileSync(path.join(state, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || manifest.vault !== vault || fs.realpathSync(vault) !== vault) throw new Error('Manifest scope mismatch');
  if (!Array.isArray(rows)) throw new Error('Invalid QMD result JSON');
  return rows.map(row => {
    const match = /^qmd:\/\/economy-research\/([a-f0-9]{64}\.md)(?:\?index=economy-research)?$/.exec(row.file);
    if (!match || !Object.hasOwn(manifest.files, match[1])) throw new Error('Unmapped or out-of-scope QMD result');
    const item = manifest.files[match[1]];
    const full = checkedFile(vault, item.relative);
    if (item.path !== full || match[1] !== digest(item.relative) + '.md') throw new Error('Invalid result mapping');
    const fd = fs.openSync(full, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    let hash;
    try { hash = digest(fs.readFileSync(fd)); } finally { fs.closeSync(fd); }
    if (hash !== item.sha256) throw new Error('Stale result: source changed; rebuild the index');
    return { ...row, path: full, relativePath: item.relative };
  });
}
function runBounded(executable, args, { timeoutMs = 120000, maxBytes = 8 * 1024 * 1024, env = process.env, cwd } = {}) {
  const { spawn } = require('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, env, cwd, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', bytes = 0, failure;
    const kill = () => { try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {} };
    const cancel = () => { failure = new Error('operation cancelled'); kill(); };
    const cleanup = () => { clearTimeout(timer); process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel); };
    process.on('SIGTERM', cancel); process.on('SIGINT', cancel);
    const timer = setTimeout(() => { failure = new Error('QMD timed out'); kill(); }, timeoutMs);
    for (const [stream, isOut] of [[child.stdout, true], [child.stderr, false]]) stream.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) { failure = new Error('QMD output limit exceeded'); kill(); return; }
      if (isOut) stdout += chunk.toString(); else stderr += chunk.toString();
    });
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', (code, signal) => {
      cleanup();
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`QMD exited ${code ?? signal}: ${stderr.slice(-4000)}`));
      else resolve({ stdout, stderr, code });
    });
  });
}
function options(input = {}) {
  if(!input.vault)throw Error('Optional QMD requires explicit vault; install/configure QMD separately');
  const configuredRoot = input.toolRoot || process.env.ECONOMY_QMD_ROOT;
  if(!configuredRoot)throw Error('Optional QMD requires toolRoot or ECONOMY_QMD_ROOT; install/configure QMD separately');
  const toolRoot = path.resolve(configuredRoot);noSymlinks(toolRoot,true);
  const state = path.join(toolRoot, 'research');
  return { ...input, toolRoot, state, vault: path.resolve(input.vault), node: input.node || process.execPath };
}
function commandPlan(input, args) {
  const o = options(input);
  // Whitelist the child environment: do not inherit QMD model/index overrides,
  // NODE_OPTIONS, project hooks, or the caller's private HOME/XDG directories.
  const env = {
    PATH: `${path.dirname(o.node)}:/usr/bin:/bin`,
    HOME: path.join(o.toolRoot, 'home'), XDG_CONFIG_HOME: path.join(o.toolRoot, 'config'),
    XDG_CACHE_HOME: path.join(o.toolRoot, 'cache'), XDG_DATA_HOME: path.join(o.toolRoot, 'data'),
    TMPDIR: path.join(o.toolRoot, 'tmp'), npm_config_cache: path.join(o.toolRoot, 'cache/npm'),
    LANG: 'en_US.UTF-8', QMD_SOURCE_MODE: '0', GGML_METAL_NO_RESIDENCY: '1'
  };
  return { executable: o.node, args: [path.join(o.toolRoot, 'node_modules/@tobilu/qmd/bin/qmd'), '--index', COLLECTION, ...args], env, cwd: o.toolRoot };
}
function validateInstall(o) {
  const pkg = JSON.parse(fs.readFileSync(path.join(o.toolRoot, 'node_modules/@tobilu/qmd/package.json'), 'utf8'));
  if (pkg.version !== '2.8.3') throw new Error('This adapter requires @tobilu/qmd exactly 2.8.3');
  for (const dir of ['home', 'config/qmd', 'cache', 'data', 'tmp', 'logs', 'research']) fs.mkdirSync(path.join(o.toolRoot, dir), { recursive: true, mode: 0o700 });
}
function expectedConfig(o) {
  return JSON.stringify({ collections: { [COLLECTION]: { path: path.join(o.state, 'mirror'), pattern: '**/*.md' } }, models: { embed: 'hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf' } }, null, 2) + '\n';
}
async function withLock(o, action) {
  fs.mkdirSync(o.state, { recursive: true, mode: 0o700 });
  const lock = path.join(o.state, 'adapter.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); } catch (e) {
    if (e.code === 'EEXIST') throw new Error('Adapter busy (or stale adapter.lock after forced termination); do not remove while a build/query is running');
    throw e;
  }
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
  try { return await action(); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
async function invoke(o, args, label, timeoutMs) {
  const plan = commandPlan(o, args);
  const result = await runBounded(plan.executable, plan.args, { ...plan, timeoutMs });
  fs.writeFileSync(path.join(o.toolRoot, 'logs', label + '.stdout'), result.stdout, { mode: 0o600 });
  fs.writeFileSync(path.join(o.toolRoot, 'logs', label + '.stderr'), result.stderr, { mode: 0o600 });
  return result;
}
function verifyStatus(text, documents) {
  const total = /Total:\s+(\d+) files indexed/.exec(text);
  const vectors = /Vectors:\s+(\d+) embedded/.exec(text);
  const pending = /Pending:\s+(\d+) need embedding/.exec(text);
  if (!total || Number(total[1]) !== documents || !vectors || Number(vectors[1]) < 1 || (pending && Number(pending[1]) > 0)) throw new Error('Incomplete scoped index/embeddings; build did not complete');
}
async function build(input = {}) {
  const o = options(input); validateInstall(o);
  return withLock(o, async () => {
    const started = Date.now();
    const readyPath = path.join(o.state, 'ready.json');
    fs.rmSync(readyPath, { force: true });
    const manifest = stage(o);
    if (!Object.keys(manifest.files).length) throw new Error('No authorized markdown found');
    // JSON is valid YAML. Replace, never merge: no unrelated collection or hook.
    fs.writeFileSync(path.join(o.toolRoot, 'config/qmd', COLLECTION + '.yml'), expectedConfig(o), { mode: 0o600 });
    const version = await invoke(o, ['--version'], 'version', 30000);
    await invoke(o, ['update'], 'update', 120000);
    await invoke(o, ['embed', '-c', COLLECTION, '--timeout', '10', '--max-docs-per-batch', '16', '--max-batch-mb', '8'], 'embed', o.timeoutMs || 660000);
    const status = await invoke(o, ['status'], 'status', 30000);
    verifyStatus(status.stdout, Object.keys(manifest.files).length);
    const receipt = { version: version.stdout.trim(), collection: COLLECTION, vault: o.vault, allowlist: ALLOWED, stagedDocuments: Object.keys(manifest.files).length, configSha256: digest(fs.readFileSync(path.join(o.toolRoot, 'config/qmd', COLLECTION + '.yml'))), manifestSha256: digest(fs.readFileSync(path.join(o.state, 'manifest.json'))), builtAt: new Date().toISOString(), elapsedMs: Date.now() - started, status: status.stdout, rerankingValidated: false };
    fs.writeFileSync(readyPath, JSON.stringify(receipt, null, 2), { mode: 0o600 });
    fs.writeFileSync(path.join(o.toolRoot, 'logs/build-receipt.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
    return receipt;
  });
}
function validateReady(o, ready) {
  if (ready.vault !== o.vault || ready.manifestSha256 !== digest(fs.readFileSync(path.join(o.state, 'manifest.json'))) || ready.configSha256 !== digest(fs.readFileSync(path.join(o.toolRoot, 'config/qmd', COLLECTION + '.yml')))) throw new Error('Index scope/configuration changed; rebuild required');
}
async function query(input = {}) {
  const o = options(input); validateInstall(o);
  const typed = typedQuery(o.lex, o.vec || o.lex);
  if(o.mode!==undefined&&!['fast','rerank','expanded'].includes(o.mode))throw Error('mode must be fast, rerank or expanded');
  const text=o.mode==='expanded'?o.lex:typed;
  const rerank=o.mode==='rerank'||o.mode==='expanded';
  const limit = o.limit === undefined ? 5 : Number(o.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('limit must be an integer in 1..50');
  return withLock(o, async () => {
    const ready = JSON.parse(fs.readFileSync(path.join(o.state, 'ready.json'), 'utf8'));
    validateReady(o, ready);
    const started = Date.now();
    const raw = await invoke(o, ['query', text, '-c', COLLECTION, '-n', String(limit), ...(rerank?['-C','8']:['--no-rerank']), '--format', 'json', '--explain'], 'query', o.timeoutMs || 120000);
    const results = mapResults(JSON.parse(raw.stdout), o);
    const receipt = { mode: o.mode==='expanded'?'expanded-hybrid-reranked':rerank?'typed-hybrid-reranked':'typed-lex-vec-rrf-no-rerank', collection: COLLECTION, query: text, elapsedMs: Date.now() - started, rerankingValidated: rerank&&results.length>0&&results.every(r=>Number.isFinite(r.explain?.rerankScore)&&r.explain.rerankScore>0), results };
    fs.writeFileSync(path.join(o.toolRoot, 'logs/query-receipt.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
    return receipt;
  });
}
function parseCli(argv) {
  const command = argv.shift();
  if (!['build', 'query'].includes(command)) throw new Error('Usage: qmd-adapter.cjs build|query [--vault PATH] [--tool-root PATH] [--node PATH] [--lex TEXT] [--vec TEXT] [--limit N] [--timeout-ms N]');
  const names = { '--mode':'mode', '--vault': 'vault', '--tool-root': 'toolRoot', '--node': 'node', '--lex': 'lex', '--vec': 'vec', '--limit': 'limit', '--timeout-ms': 'timeoutMs' };
  const o = {};
  while (argv.length) {
    const flag = argv.shift();
    if (!names[flag] || !argv.length || Object.hasOwn(o, names[flag])) throw new Error(`Invalid or duplicate option: ${flag}`);
    o[names[flag]] = argv.shift();
  }
  if (o.timeoutMs !== undefined) {
    o.timeoutMs = Number(o.timeoutMs);
    if (!Number.isInteger(o.timeoutMs) || o.timeoutMs < 1 || o.timeoutMs > 900000) throw new Error('timeout-ms must be in 1..900000');
  }
  return { command, options: o };
}
module.exports = { ALLOWED, COLLECTION, stage, typedQuery, mapResults, runBounded, commandPlan, parseCli, validateReady, verifyStatus, build, query };
if (require.main === module) {
  Promise.resolve().then(() => { const parsed = parseCli(process.argv.slice(2)); return parsed.command === 'build' ? build(parsed.options) : query(parsed.options); })
    .then(result => process.stdout.write(JSON.stringify(result, null, 2) + '\n'))
    .catch(error => { process.stderr.write(JSON.stringify({ error: error.message }) + '\n'); process.exitCode = 1; });
}
