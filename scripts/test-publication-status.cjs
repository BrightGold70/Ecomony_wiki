'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const checkerPath = path.join(__dirname, 'check-publication-status.cjs');
const checkedAt = '2026-01-02T03:04:05.000Z';
const doi = '10.1234/EXAMPLE';
const ok = message => ({ ok: true, status: 200, json: async () => ({ status: 'ok', message }) });
function mockFetch(responses, calls = []) {
  return async (url, options) => {
    calls.push({ url: String(url), options });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, 'unexpected fetch');
    return response;
  };
}

test('valid DOI fetches exact work then documented updates filter, no notices is qualified', async () => {
  const calls = [];
  const result = await require(checkerPath).checkPublication(doi, { checkedAt, fetchImpl: mockFetch([
    ok({ DOI: doi.toLowerCase(), title: ['Example'] }), ok({ items: [], 'total-results': 0 })
  ], calls) });
  assert.equal(result.state, 'no-notice-found');
  assert.equal(result.doi, doi);
  assert.equal(result.checkedAt, checkedAt);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.crossref.org/works/10.1234%2FEXAMPLE');
  assert.equal(new URL(calls[1].url).searchParams.get('filter'), `updates:${doi}`);
  for (const call of calls) assert.ok(call.options.signal instanceof AbortSignal);
  assert.deepEqual(result.sources.map(s => s.name), ['Crossref REST work', 'Crossref REST editorial updates']);
  assert.ok(result.sources.every(s => s.status === 'ok'));
  assert.equal(result.complete, true);
  assert.match(result.limitations.join(' '), /corrections.*incomplete/i);
});

test('relevant update-to relations yield notices; unrelated and malformed DOI relations do not', async () => {
  const items = [
    { DOI: '10.1234/notice', title: ['Correction'], 'update-to': [{ DOI: doi.toLowerCase(), type: 'correction' }, { DOI: '10.1234/other', type: 'retraction' }] },
    { DOI: '10.1234/unrelated', 'update-to': [{ DOI: '10.1234/other', type: 'retraction' }] },
    { DOI: '10.1234/bad-relation', 'update-to': [{ DOI: ` https://doi.org/${doi}`, type: 'retraction' }] }
  ];
  const result = await require(checkerPath).checkPublication(doi, { fetchImpl: mockFetch([ok({ DOI: doi }), ok({ items, 'total-results': 3 })]) });
  assert.equal(result.state, 'notice-found');
  assert.equal(result.notices.length, 1);
  assert.equal(result.notices[0].doi, '10.1234/notice');
  assert.equal(result.notices[0].type, 'correction');
  assert.equal(result.notices[0].targetDoi, doi.toLowerCase());
});

test('unrelated updates never imply a notice', async () => {
  const result = await require(checkerPath).checkPublication(doi, { fetchImpl: mockFetch([ok({ DOI: doi }), ok({ items: [{ DOI: '10.1234/other', 'update-to': [{ DOI: '10.1234/unrelated', type: 'retraction' }] }], 'total-results': 1 })]) });
  assert.equal(result.state, 'no-notice-found');
});

test('HTTP, network, JSON, envelope, DOI mismatch and truncated results fail safely', async t => {
  const cases = [
    ['404', [{ ok: false, status: 404 }]],
    ['429', [{ ok: false, status: 429 }]],
    ['network', [Error('offline')]],
    ['JSON work', [{ ok: true, status: 200, json: async () => { throw SyntaxError('bad JSON'); } }]],
    ['envelope', [{ ok: true, status: 200, json: async () => null }]],
    ['DOI mismatch', [ok({ DOI: '10.1234/wrong' })]],
    ['updates HTTP', [ok({ DOI: doi }), { ok: false, status: 503 }]],
    ['updates JSON', [ok({ DOI: doi }), { ok: true, status: 200, json: async () => { throw SyntaxError('bad JSON'); } }]],
    ['updates malformed', [ok({ DOI: doi }), ok({ items: null, 'total-results': 0 })]],
    ['updates missing count', [ok({ DOI: doi }), ok({ items: [] })]],
    ['truncation', [ok({ DOI: doi }), ok({ items: [], 'total-results': 1001 })]]
  ];
  for (const [name, responses] of cases) await t.test(name, async () => {
    const result = await require(checkerPath).checkPublication(doi, { fetchImpl: mockFetch(responses) });
    assert.equal(result.state, 'check-failed');
    assert.equal(result.complete, false);
    assert.ok(result.error);
  });
});

test('timeout aborts both fetch and JSON body parsing', async t => {
  for (const body of [false, true]) await t.test(body ? 'body' : 'fetch', async () => {
    const fetchImpl = async (url, { signal }) => {
      const pending = () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), { once: true }));
      return body ? { ok: true, status: 200, json: pending } : pending();
    };
    const result = await require(checkerPath).checkPublication(doi, { fetchImpl, timeoutMs: 10 });
    assert.equal(result.state, 'check-failed');
    assert.match(result.error, /timed out/);
  });
});

test('default timestamp is ISO and malformed notice arrays fail safely', async () => {
  const result = await require(checkerPath).checkPublication(doi, { fetchImpl: mockFetch([ok({ DOI: doi }), ok({ items: [null], 'total-results': 1 })]) });
  assert.equal(new Date(result.checkedAt).toISOString(), result.checkedAt);
  assert.equal(result.state, 'check-failed');
});

test('CLI validates arguments, preserves exact invalid DOI and refuses existing output without network', () => {
  const run = args => spawnSync(process.execPath, [checkerPath, ...args], { encoding: 'utf8' });
  assert.notEqual(run([]).status, 0);
  assert.notEqual(run(['--doi', doi, '--unknown']).status, 0);
  assert.notEqual(run(['--doi', doi, '--doi', doi]).status, 0);
  const result = run(['--doi', ` ${doi}`]);
  assert.equal(JSON.parse(result.stdout).state, 'not-checked');
  assert.equal(JSON.parse(result.stdout).doi, ` ${doi}`);
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'publication-status-test-'));
  const output = path.join(dir, 'receipt.json');
  try {
    assert.equal(run(['--doi', 'invalid', '--output', output]).status, 2);
    const saved = fs.readFileSync(output, 'utf8');
    assert.equal(JSON.parse(saved).doi, 'invalid');
    assert.notEqual(run(['--doi', doi, '--output', output]).status, 0);
    assert.equal(fs.readFileSync(output, 'utf8'), saved);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

 test('invalid exact DOI tokens remain unchanged and never trigger a request', async () => {
  const { checkPublication } = require(checkerPath);
  for (const doi of ['', ' 10.1234/example', '10.1234/example ', 'https://doi.org/10.1234/example', 'doi:10.1234/example', '10.123/example', '10.1234/', '10.1234/a\nb', null, 123]) {
    let calls = 0;
    const result = await checkPublication(doi, { checkedAt, fetchImpl: async () => { calls++; throw Error('must not fetch'); } });
    assert.equal(result.state, 'not-checked');
    assert.equal(result.doi, doi);
    assert.equal(result.checkedAt, checkedAt);
    assert.equal(calls, 0);
  }
});
