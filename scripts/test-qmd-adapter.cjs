#!/usr/bin/env node
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const scratch = fs.realpathSync(process.env.TMPDIR||os.tmpdir());
fs.mkdirSync(scratch, { recursive: true });
const adapterPath = path.join(__dirname, 'qmd-adapter.cjs');

test('typed queries reject grammar injection and preserve shell metacharacters as data', () => {
  const { typedQuery } = require(adapterPath);
  assert.equal(typeof typedQuery, 'function');
  assert.equal(typedQuery('DiD $(touch nope)', 'policy response'), 'lex: DiD $(touch nope)\nvec: policy response');
  for (const bad of ['', 'a\nexpand: private', 'a\rb', 'a\u0000b', '"unbalanced']) assert.throws(() => typedQuery(bad, 'valid'));
});

test('mapped results fail closed for forged scope, stale content, symlink replacement and unknown collection', () => {
  const { stage, mapResults } = require(adapterPath);
  assert.equal(typeof mapResults, 'function');
  const root = fs.mkdtempSync(path.join(scratch, 'qmd-map-test-'));
  try {
    const vault = path.join(root, 'vault'), state = path.join(root, 'state');
    fs.mkdirSync(path.join(vault, 'Topics'), { recursive: true });
    const source = path.join(vault, 'Topics', 'a.md');
    fs.writeFileSync(source, '# DiD');
    const manifest = stage({ vault, state });
    const key = Object.keys(manifest.files)[0];
    const row = { file: `qmd://economy-research/${key}?index=economy-research`, score: 1, snippet: 'DiD' };
    assert.equal(mapResults([row], { vault, state })[0].path, source);
    assert.throws(() => mapResults([{ ...row, file: `qmd://private/${key}` }], { vault, state }));
    assert.throws(() => mapResults([{ ...row, file: 'qmd://economy-research/../Private/a.md' }], { vault, state }));
    fs.writeFileSync(source, '# changed');
    assert.throws(() => mapResults([row], { vault, state }));
    fs.unlinkSync(source); fs.symlinkSync(path.join(root, 'outside.md'), source);
    assert.throws(() => mapResults([row], { vault, state }));
    manifest.files[key].relative = '../Private/a.md';
    fs.writeFileSync(path.join(state, 'manifest.json'), JSON.stringify(manifest));
    assert.throws(() => mapResults([row], { vault, state }));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('bounded runner kills a timed out process and limits output without a shell', async () => {
  const { runBounded } = require(adapterPath);
  assert.equal(typeof runBounded, 'function');
  await assert.rejects(runBounded(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 80 }), /timed out/);
  await assert.rejects(runBounded(process.execPath, ['-e', 'process.stdout.write("x".repeat(9999))'], { maxBytes: 100 }), /output limit/);
  const result = await runBounded(process.execPath, ['-e', 'console.log(process.argv[1])', '$(touch nope)'], {});
  assert.equal(result.stdout.trim(), '$(touch nope)');
});

test('cancelling adapter propagates to detached QMD children and removes signal handlers',async()=>{
 const {runBounded}=require(adapterPath),before=process.listenerCount('SIGTERM');
 const pending=runBounded(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:2000});
 assert.equal(process.listenerCount('SIGTERM'),before+1);process.emit('SIGTERM');await assert.rejects(pending,/cancelled/);assert.equal(process.listenerCount('SIGTERM'),before);
});

test('QMD root override is explicit, argument wins, and Node uses the current executable', () => {
  const { commandPlan } = require(adapterPath);
  const previous = process.env.ECONOMY_QMD_ROOT;
  try {
    process.env.ECONOMY_QMD_ROOT = '/owned/env-qmd';
    const plan = commandPlan({ vault: '/owned/vault' }, ['--version']);
    assert.equal(plan.cwd, '/owned/env-qmd');
    assert.equal(plan.executable, process.execPath);
    assert.equal(plan.env.HOME, '/owned/env-qmd/home');
    assert.equal(plan.env.ECONOMY_QMD_ROOT, undefined);
    assert.equal(commandPlan({vault:'/owned/vault',toolRoot:'/owned/argument'},[]).cwd,'/owned/argument');
    assert.throws(()=>commandPlan({},[]), /explicit vault/);
    delete process.env.ECONOMY_QMD_ROOT;
    assert.throws(()=>commandPlan({vault:'/owned/vault'},[]), /ECONOMY_QMD_ROOT/);
  } finally {
    if(previous === undefined) delete process.env.ECONOMY_QMD_ROOT;
    else process.env.ECONOMY_QMD_ROOT = previous;
  }
});

test('isolated command plan pins collection, index, environment and no-rerank', () => {
  const { commandPlan } = require(adapterPath);
  assert.equal(typeof commandPlan, 'function');
  const plan = commandPlan({ toolRoot: '/owned/qmd', vault: '/owned/vault' }, ['query', 'lex: DiD\nvec: response', '-c', 'economy-research', '--no-rerank']);
  assert.equal(plan.env.HOME, '/owned/qmd/home');
  assert.equal(plan.env.XDG_CONFIG_HOME, '/owned/qmd/config');
  assert.equal(plan.env.XDG_CACHE_HOME, '/owned/qmd/cache');
  assert.deepEqual(plan.args.slice(1, 3), ['--index', 'economy-research']);
  assert.equal(plan.cwd, '/owned/qmd');
});

test('build/query rejects changed configuration but accepts QMD-normalized YAML', () => {
  const { validateReady } = require(adapterPath);
  assert.equal(typeof validateReady, 'function');
  const root = fs.mkdtempSync(path.join(scratch, 'qmd-ready-test-'));
  try {
    const crypto = require('node:crypto');
    const hash = x => crypto.createHash('sha256').update(x).digest('hex');
    fs.mkdirSync(path.join(root, 'config/qmd'), { recursive: true });
    fs.mkdirSync(path.join(root, 'research'));
    fs.writeFileSync(path.join(root, 'research/manifest.json'), '{}');
    const config = path.join(root, 'config/qmd/economy-research.yml');
    fs.writeFileSync(config, 'collections:\n  economy-research: {}\n');
    const o = { toolRoot: root, state: path.join(root, 'research'), vault: '/authorized/vault' };
    const ready = { vault: o.vault, manifestSha256: hash('{}'), configSha256: hash(fs.readFileSync(config)) };
    assert.doesNotThrow(() => validateReady(o, ready));
    fs.appendFileSync(config, 'hooks: unsafe\n');
    assert.throws(() => validateReady(o, ready), /rebuild required/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('offline CLI fixture exercises build and scoped query end to end', async () => {
  const { build, query } = require(adapterPath);
  const root = fs.mkdtempSync(path.join(scratch, 'qmd-e2e-test-'));
  try {
    const toolRoot = path.join(root, 'tool'), vault = path.join(root, 'vault');
    fs.mkdirSync(path.join(toolRoot, 'node_modules/@tobilu/qmd/bin'), { recursive: true });
    fs.mkdirSync(path.join(vault, 'Literature'), { recursive: true });
    fs.writeFileSync(path.join(vault, 'Literature/paper.md'), '# DiD');
    fs.writeFileSync(path.join(toolRoot, 'node_modules/@tobilu/qmd/package.json'), '{"version":"2.8.3"}');
    fs.writeFileSync(path.join(toolRoot, 'node_modules/@tobilu/qmd/bin/qmd'), `
      const fs = require('fs');
      const assert = require('assert');
      const args = process.argv.slice(2);
      assert.deepEqual(args.slice(0,2), ['--index','economy-research']);
      assert.equal(process.env.HOME, process.cwd()+'/home');
      const command = args[2];
      if(command === '--version') console.log('qmd 2.8.3 fixture');
      else if(command === 'status') console.log('Total: 1 files indexed\\nVectors: 1 embedded');
      else if(command === 'query') {
        assert.ok(args.includes('--no-rerank'));
        assert.equal(args[args.indexOf('-c')+1], 'economy-research');
        assert.ok(args[3].startsWith('lex: '));
        const manifest=JSON.parse(fs.readFileSync('research/manifest.json'));
        console.log(JSON.stringify([{file:'qmd://economy-research/'+Object.keys(manifest.files)[0],score:1}]));
      }
    `);
    const o = { vault, toolRoot, node: process.execPath };
    const receipt = await build(o);
    assert.equal(receipt.stagedDocuments, 1);
    const found = await query({ ...o, lex: 'DiD', vec: 'tariff response' });
    assert.equal(found.results[0].relativePath, 'Literature/paper.md');
    fs.writeFileSync(path.join(toolRoot, 'research/adapter.lock'), 'busy');
    await assert.rejects(query({ ...o, lex: 'DiD' }), /busy/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('real research query (opt-in; requires existing scoped index and cached model)', { skip: !process.env.QMD_REAL_TEST }, async () => {
  const { query } = require(adapterPath);
  const receipt = await query({ vault:process.env.QMD_VAULT, toolRoot:process.env.QMD_TOOL_ROOT, lex: 'tariff trade', vec: 'difference-in-differences tariff policy and bilateral trade', limit: 5 });
  assert.ok(receipt.results.length > 0);
  const contributions = receipt.results.flatMap(row => row.explain.rrf.contributions);
  assert.ok(contributions.some(x => x.source === 'vec'));
  assert.ok(contributions.some(x => x.source === 'fts'));
  assert.equal(receipt.rerankingValidated, false);
});

test('status acceptance rejects partial embedding sessions', () => {
  const { verifyStatus } = require(adapterPath);
  assert.equal(typeof verifyStatus, 'function');
  assert.doesNotThrow(() => verifyStatus('Total: 124 files indexed\nVectors: 164 embedded', 124));
  assert.throws(() => verifyStatus('Total: 124 files indexed\nVectors: 2 embedded\nPending: 122 need embedding', 124));
  assert.throws(() => verifyStatus('Total: 2 files indexed\nVectors: 2 embedded', 124));
});

test('staging copies only allowlisted markdown, never symlinks, and maps full paths', () => {
  assert.ok(fs.existsSync(adapterPath), 'scoped adapter must exist');
  const { stage } = require(adapterPath);
  const root = fs.mkdtempSync(path.join(scratch, 'qmd-adapter-test-'));
  try {
    const vault = path.join(root, 'vault');
    const state = path.join(root, 'state');
    for (const name of ['Literature', 'Topics', 'Comparisons', 'Queries', 'Private']) fs.mkdirSync(path.join(vault, name), { recursive: true });
    fs.writeFileSync(path.join(vault, 'Literature', 'a.md'), '# DiD research');
    fs.writeFileSync(path.join(vault, 'Topics', '한글.md'), '# Topic');
    fs.writeFileSync(path.join(vault, 'Private', 'secret.md'), 'NEVER INDEX');
    fs.writeFileSync(path.join(vault, 'Literature', 'raw.pdf'), 'NEVER INDEX');
    fs.symlinkSync(path.join(vault, 'Private', 'secret.md'), path.join(vault, 'Queries', 'link.md'));
    fs.symlinkSync(path.join(vault, 'Private'), path.join(vault, 'Comparisons', 'link'));
    const manifest = stage({ vault, state });
    assert.equal(Object.keys(manifest.files).length, 2);
    assert.deepEqual(Object.values(manifest.files).map(x => x.relative).sort(), ['Literature/a.md', 'Topics/한글.md']);
    for (const [mirror, item] of Object.entries(manifest.files)) {
      assert.equal(item.path, path.join(vault, item.relative));
      assert.equal(fs.readFileSync(path.join(state, 'mirror', mirror), 'utf8'), fs.readFileSync(item.path, 'utf8'));
    }
    fs.unlinkSync(path.join(vault, 'Literature', 'a.md'));
    const next = stage({ vault, state });
    assert.equal(Object.keys(next.files).length, 1);
    assert.equal(fs.readdirSync(path.join(state, 'mirror')).length, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
