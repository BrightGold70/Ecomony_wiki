#!/usr/bin/env node
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  checkQmdInstalled,
  setupQmdRuntime,
  configureVaultPlugin,
  detectPython,
  probePdfToText,
  setupRuntime
} = require('./setup-runtime.cjs');

test('setup-runtime exports required helpers and probes environment safely', () => {
  assert.equal(typeof checkQmdInstalled, 'function');
  assert.equal(typeof setupQmdRuntime, 'function');
  assert.equal(typeof configureVaultPlugin, 'function');
  assert.equal(typeof detectPython, 'function');
  assert.equal(typeof probePdfToText, 'function');
  assert.equal(typeof setupRuntime, 'function');

  assert.equal(typeof probePdfToText(), 'boolean');
  const py = detectPython();
  assert.ok(py === null || typeof py === 'string');
});

test('checkQmdInstalled verifies exact pinned version 2.8.3', () => {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'qmd-test-'));
  try {
    assert.equal(checkQmdInstalled(tmp), false);
    const modDir = path.join(tmp, 'node_modules/@tobilu/qmd');
    fs.mkdirSync(modDir, { recursive: true });
    fs.writeFileSync(path.join(modDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    assert.equal(checkQmdInstalled(tmp), false);

    fs.writeFileSync(path.join(modDir, 'package.json'), JSON.stringify({ version: '2.8.3' }));
    assert.equal(checkQmdInstalled(tmp), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('setupQmdRuntime prepares subdirectories with required permissions', () => {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'qmd-dir-test-'));
  try {
    const modDir = path.join(tmp, 'node_modules/@tobilu/qmd');
    fs.mkdirSync(modDir, { recursive: true });
    fs.writeFileSync(path.join(modDir, 'package.json'), JSON.stringify({ version: '2.8.3' }));

    const res = setupQmdRuntime(tmp, { log: () => {} });
    assert.equal(res.ok, true);
    assert.equal(res.version, '2.8.3');

    for (const dir of ['home', 'config/qmd', 'cache', 'data', 'tmp', 'logs', 'research']) {
      assert.ok(fs.existsSync(path.join(tmp, dir)));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('configureVaultPlugin builds dashboard and writes data.json', () => {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'vault-plugin-test-'));
  try {
    fs.mkdirSync(path.join(tmp, '.obsidian'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.obsidian/community-plugins.json'), JSON.stringify(['existing-plugin']));

    const fakeToolRoot = path.join(tmp, 'toolRoot');
    fs.mkdirSync(fakeToolRoot, { recursive: true });

    const res = configureVaultPlugin(tmp, fakeToolRoot, { log: () => {}, skipIndex: true });
    assert.equal(res.ok, true);

    const pluginDir = path.join(tmp, '.obsidian/plugins/economy-keyword-search');
    assert.ok(fs.existsSync(path.join(pluginDir, 'main.js')));
    assert.ok(fs.existsSync(path.join(pluginDir, 'manifest.json')));
    assert.ok(fs.existsSync(path.join(pluginDir, 'data.json')));

    const data = JSON.parse(fs.readFileSync(path.join(pluginDir, 'data.json'), 'utf8'));
    assert.equal(data.economyQmdRoot, fakeToolRoot);
    assert.ok(typeof data.repositoryPath === 'string');
    assert.ok(typeof data.nodeExecutable === 'string');

    const commList = JSON.parse(fs.readFileSync(path.join(tmp, '.obsidian/community-plugins.json'), 'utf8'));
    assert.ok(commList.includes('economy-keyword-search'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
