'use strict';
const path = require('node:path');

// This is a best-effort credential guard, not a general secret detector.
const secretLike = value => /(?:\bBearer\s|-----BEGIN [^-]*KEY-----|\b(?:sk-|hf_|gh[pousr]_|github_pat_|AIza)[A-Za-z0-9_-]+|(?:api[_-]?key|access[_-]?token|token|password|secret)\s*[=:]|:\/\/[^/\s]*@)/i.test(value);
const unsafe = value => typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f]/.test(value) || secretLike(value);
function valid(key, raw) {
  if (unsafe(raw)) return false;
  const value = raw.trim();
  if (!value) return true;
  if (key === 'provider' || key === 'model') return /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,255}$/.test(value);
  return path.isAbsolute(value);
}
function record(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid settings record');
  return value;
}

// Configuration UI only: never loads backend code or inspects the host system.
async function renderServiceSettings(area, { plugin, onSaved, includeQmdRoot = false } = {}) {
  const root = area.createEl('details');
  root.createEl('summary', { text: 'Service settings' });
  root.createEl('p', { text: 'Configured values only — not runtime-verified. Saving does not check executables, indexes or provider access. Provider and model are names, not API keys or tokens. Paths must be absolute. Edited blank fields remove their stored keys; unedited fields are preserved.' });
  const inputs = {};
  const fields = [
    ['repositoryPath', 'Repository path'], ['pythonExecutable', 'Python executable'],
    ['nodeExecutable', 'Node.js executable'], ['provider', 'Provider name'], ['model', 'Model name']
  ];
  if (includeQmdRoot) fields.push(['economyQmdRoot', 'Private QMD tool root']);
  let cfg = {}, loadFailed = false;
  try { cfg = record(await plugin.loadData()); } catch { loadFailed = true; }
  const display = value => typeof value === 'string' && !unsafe(value) ? value : '';
  for (const [key, label] of fields) {
    const row = root.createEl('label', { text: label });
    const input = row.createEl('input', { type: 'text', value: display(cfg[key]) });
    input.setAttribute('aria-label', label + ' setting');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    inputs[key] = input;
  }
  let baseline = Object.fromEntries(fields.map(([key]) => [key, inputs[key].value]));
  const saveButton = root.createEl('button', { text: 'Save service settings' });
  const status = root.createEl('p', { text: loadFailed ? 'Could not load service settings. Reopen this panel to retry; details suppressed.' : 'Configured values are not runtime-verified.' });
  saveButton.disabled = loadFailed;
  saveButton.onclick = async () => {
    if (saveButton.disabled) return;
    const edits = fields.filter(([key]) => inputs[key].value !== baseline[key]);
    if (!edits.length) { status.setText('No changes. Configured values are not runtime-verified.'); return; }
    const patch = {};
    for (const [key, label] of edits) {
      if (!valid(key, inputs[key].value)) {
        status.setText('Invalid ' + label + ' setting. Use an absolute path or a provider/model name as applicable; credentials and control characters are rejected.');
        return;
      }
      patch[key] = inputs[key].value.trim();
    }
    saveButton.disabled = true;
    for (const [key] of fields) inputs[key].disabled = true;
    try {
      const merged = { ...record(await plugin.loadData()) };
      for (const [key] of edits) {
        if (patch[key]) merged[key] = patch[key]; else delete merged[key];
      }
      await plugin.saveData(merged);
      for (const [key] of fields) inputs[key].value = display(merged[key]);
      baseline = Object.fromEntries(fields.map(([key]) => [key, inputs[key].value]));
      status.setText('Service settings saved — not runtime-verified.');
      if (onSaved) {
        try { await onSaved(merged); }
        catch { status.setText('Settings saved, but panel refresh failed. Reopen services before use; not runtime-verified. Details suppressed.'); }
      }
    } catch { status.setText('Could not save service settings. Reload settings before retrying; details suppressed.'); }
    finally {
      saveButton.disabled = false;
      for (const [key] of fields) inputs[key].disabled = false;
    }
  };
  return { root, inputs, status, saveButton };
}

module.exports = { renderServiceSettings };
