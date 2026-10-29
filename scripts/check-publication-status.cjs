'use strict';

// Conservative bare-DOI syntax: do not trim, strip URL prefixes, or repair input.
function validDoi(doi) {
  return typeof doi === 'string' && /^10\.\d{4,9}\/[^\s\x00-\x1f\x7f]+$/.test(doi);
}

// Crossref documents updates:{doi} as records representing editorial updates:
// https://github.com/CrossRef/rest-api-doc#filter-names
// Current API entry point: https://api.crossref.org/ (links to filter docs).
const LIMITATIONS = [
  'Crossref publisher-deposited editorial-update metadata only; corrections coverage is incomplete, as are retractions and expressions of concern.',
  'No-notice-found means no matching update-to notice was found in this query, not proof of validity, safety, or absence of notices elsewhere.',
  'This does not search publisher websites, RePEc, Retraction Watch, or non-Crossref registration agencies.'
];

async function checkPublication(doi, { fetchImpl = globalThis.fetch, checkedAt = new Date().toISOString(), timeoutMs = 15000 } = {}) {
  const result = { doi, checkedAt, state: 'not-checked', complete: false, sources: [], notices: [], limitations: [...LIMITATIONS] };
  if (!validDoi(doi)) {
    result.error = 'Invalid bare DOI format; original token was not normalized.';
    return result;
  }
  const request = async (name, url) => {
    const source = { name, url, status: 'pending' };
    result.sources.push(source);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'EconomicsWikiPublicationStatus/1.0' } });
      source.httpStatus = response.status;
      if (!response.ok) throw new Error(`Crossref HTTP ${response.status}`);
      const body = await response.json();
      if (!body || body.status !== 'ok' || !body.message || typeof body.message !== 'object') throw new Error('Malformed Crossref response');
      source.status = 'ok';
      return body.message;
    } catch (error) {
      source.status = 'failed';
      source.error = controller.signal.aborted ? 'Request timed out' : String(error.message || error);
      throw new Error(source.error);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    const work = await request('Crossref REST work', `https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (!validDoi(work.DOI) || work.DOI.toLowerCase() !== doi.toLowerCase()) throw new Error('Work DOI does not match requested DOI');
    result.work = { doi: work.DOI, title: work.title || [] };
    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('filter', `updates:${doi}`);
    url.searchParams.set('rows', '1000');
    const updates = await request('Crossref REST editorial updates', url.href);
    if (!Array.isArray(updates.items) || !Number.isSafeInteger(updates['total-results']) || updates['total-results'] < updates.items.length) throw new Error('Malformed Crossref updates response');
    for (const item of updates.items) {
      if (!item || !validDoi(item.DOI) || (item['update-to'] !== undefined && !Array.isArray(item['update-to']))) throw new Error('Malformed Crossref notice');
      for (const relation of item['update-to'] || []) {
        if (!relation || !validDoi(relation.DOI) || relation.DOI.toLowerCase() !== doi.toLowerCase()) continue;
        result.notices.push({ doi: item.DOI, title: item.title || [], type: relation.type || 'unspecified-update', targetDoi: relation.DOI, updated: relation.updated || null, url: `https://doi.org/${encodeURIComponent(item.DOI)}` });
      }
    }
    if (updates['total-results'] > updates.items.length) throw new Error('Crossref updates results truncated (maximum 1000); manual follow-up required');
    result.complete = true;
    result.state = result.notices.length ? 'notice-found' : 'no-notice-found';
  } catch (error) {
    result.state = 'check-failed';
    result.error = String(error.message || error);
  }
  return result;
}

module.exports = { checkPublication };

// Only an explicitly supplied local path is written, exclusively (never overwrite).
// No notes, indexes, or corpus files are read or modified.
async function main(args) {
  const fs = require('node:fs');
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--doi', '--output'].includes(key) || Object.hasOwn(options, key) || i + 1 >= args.length || args[i + 1].startsWith('--')) {
      throw new Error('Usage: node scripts/check-publication-status.cjs --doi EXACT_BARE_DOI [--output LOCAL_JSON_PATH]');
    }
    options[key] = args[++i];
  }
  if (!Object.hasOwn(options, '--doi')) throw new Error('--doi is required');
  let fd;
  try {
    if (Object.hasOwn(options, '--output')) {
      const output = options['--output'];
      if (!output || /^[a-z][a-z0-9+.-]*:\/\//i.test(output)) throw new Error('--output must be an explicit local path');
      fd = fs.openSync(output, 'wx', 0o600);
    }
    const result = await checkPublication(options['--doi']);
    const json = `${JSON.stringify(result, null, 2)}\n`;
    if (fd !== undefined) fs.writeFileSync(fd, json);
    process.stdout.write(json);
    process.exitCode = result.state === 'not-checked' ? 2 : result.state === 'check-failed' ? 1 : 0;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
