#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { noSymlinks } = require('./safe-fs.cjs');

const root = path.resolve(__dirname, '..');
const QMD_VERSION = '2.8.3';
const QMD_DIRS = ['home', 'config/qmd', 'cache', 'data', 'tmp', 'logs', 'research'];

function detectPython() {
  const candidates = [process.env.PYTHON, '/opt/homebrew/bin/python3', '/usr/local/bin/python3', '/usr/bin/python3', 'python3'].filter(Boolean);
  for (const c of candidates) {
    try {
      const r = spawnSync(c, ['-B', '-c', 'import sys;sys.exit(0 if sys.version_info >= (3,10) else 1)'], { stdio: 'ignore', timeout: 5000 });
      if (r.status === 0) return c;
    } catch {}
  }
  return null;
}

function probePdfToText() {
  try {
    const r = spawnSync('pdftotext', ['-v'], { stdio: 'ignore', timeout: 5000 });
    return r.status === 0;
  } catch {
    return false;
  }
}

function checkQmdInstalled(toolRoot) {
  try {
    const pkgPath = path.join(toolRoot, 'node_modules/@tobilu/qmd/package.json');
    if (!fs.existsSync(pkgPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version === QMD_VERSION;
  } catch {
    return false;
  }
}

function setupQmdRuntime(toolRoot, { log = console.log } = {}) {
  toolRoot = path.resolve(toolRoot);
  noSymlinks(toolRoot, true);
  fs.mkdirSync(toolRoot, { recursive: true, mode: 0o700 });

  const isInstalled = checkQmdInstalled(toolRoot);
  if (!isInstalled) {
    log(`[QMD] Installing @tobilu/qmd@${QMD_VERSION} into isolated runtime: ${toolRoot}...`);
    const pkgJsonPath = path.join(toolRoot, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      fs.writeFileSync(pkgJsonPath, JSON.stringify({
        name: 'economy-qmd-runtime',
        version: '1.0.0',
        private: true,
        description: 'Isolated runtime environment for @tobilu/qmd'
      }, null, 2) + '\n', { mode: 0o600 });
    }

    const npmArgs = ['install', '--no-save', `@tobilu/qmd@${QMD_VERSION}`];
    const npmRes = spawnSync('npm', npmArgs, {
      cwd: toolRoot,
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin:${process.env.PATH || ''}` }
    });

    if (npmRes.status !== 0) {
      throw new Error(`Failed to install @tobilu/qmd@${QMD_VERSION}: ${npmRes.stderr || npmRes.stdout}`);
    }

    if (!checkQmdInstalled(toolRoot)) {
      throw new Error(`Installed @tobilu/qmd does not match required version ${QMD_VERSION}`);
    }
    log(`[QMD] Successfully installed @tobilu/qmd@${QMD_VERSION}`);
  } else {
    log(`[QMD] @tobilu/qmd@${QMD_VERSION} is already installed in ${toolRoot}`);
  }

  for (const dir of QMD_DIRS) {
    fs.mkdirSync(path.join(toolRoot, dir), { recursive: true, mode: 0o700 });
  }

  return { ok: true, toolRoot, version: QMD_VERSION };
}

function configureVaultPlugin(vault, toolRoot, { log = console.log, skipIndex = false } = {}) {
  vault = path.resolve(vault);
  noSymlinks(vault, true);
  if (!fs.existsSync(vault)) {
    throw new Error(`Vault path does not exist: ${vault}`);
  }

  // 1. Build and copy plugin
  const { buildDashboard } = require('./build.cjs');
  const buildResult = buildDashboard({ vault });
  log(`[Plugin] Dashboard built and deployed to ${buildResult.deployed}`);

  // 2. Configure data.json
  const pluginDir = path.join(vault, '.obsidian/plugins/economy-keyword-search');
  fs.mkdirSync(pluginDir, { recursive: true });
  const dataPath = path.join(pluginDir, 'data.json');
  let data = {};
  if (fs.existsSync(dataPath)) {
    try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch {}
  }

  data.repositoryPath = root;
  data.nodeExecutable = process.execPath;
  data.economyQmdRoot = toolRoot;
  const py = detectPython();
  if (py && !data.pythonExecutable) {
    data.pythonExecutable = py;
  }
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', { mode: 0o644 });
  log(`[Plugin] Configured ${dataPath} with repository, node, and QMD paths`);

  // 3. Ensure community-plugins.json has the plugin enabled
  const commPluginsPath = path.join(vault, '.obsidian/community-plugins.json');
  if (fs.existsSync(commPluginsPath)) {
    try {
      const list = JSON.parse(fs.readFileSync(commPluginsPath, 'utf8'));
      if (Array.isArray(list) && !list.includes('economy-keyword-search')) {
        list.push('economy-keyword-search');
        fs.writeFileSync(commPluginsPath, JSON.stringify(list, null, 2) + '\n');
        log(`[Plugin] Added economy-keyword-search to ${commPluginsPath}`);
      }
    } catch {}
  }

  // 4. Optionally build semantic index if economy_wiki notes exist
  let indexed = null;
  const wikiDir = path.join(vault, 'economy_wiki');
  if (!skipIndex && fs.existsSync(wikiDir)) {
    const hasNotes = ['Literature', 'Topics', 'Datasets', 'Policies', 'Methods', 'Theories', 'Analyses', 'Comparisons', 'Queries'].some(d => {
      const p = path.join(wikiDir, d);
      return fs.existsSync(p) && fs.readdirSync(p).some(f => f.endsWith('.md'));
    });

    if (hasNotes) {
      log(`[Semantic] Building initial QMD semantic vector index for ${wikiDir}...`);
      try {
        const res = spawnSync(process.execPath, [
          path.join(root, 'scripts/qmd-adapter.cjs'),
          'build',
          '--vault', wikiDir,
          '--tool-root', toolRoot
        ], { stdio: 'pipe', encoding: 'utf8', timeout: 720000 });

        if (res.status === 0) {
          const receipt = JSON.parse(res.stdout);
          indexed = receipt.stagedDocuments;
          log(`[Semantic] Initial index built: ${indexed} documents embedded.`);
        } else {
          log(`[Semantic] Note: QMD initial build skipped or deferred (${(res.stderr || '').trim().slice(-200)})`);
        }
      } catch (err) {
        log(`[Semantic] Note: QMD initial build deferred: ${err.message}`);
      }
    }
  }

  return { ok: true, pluginDir, dataPath, indexed };
}

function setupRuntime(options = {}) {
  const log = options.quiet ? () => {} : (options.log || console.log);
  const toolRoot = options.toolRoot || process.env.ECONOMY_QMD_ROOT || path.join(os.homedir(), '.economy-qmd');
  const nodeVersion = process.versions.node;
  const isNode22 = Number(nodeVersion.split('.')[0]) >= 22;

  log('====================================================');
  log(' Economics Wiki: Automated Runtime Library Setup');
  log('====================================================');
  log(`Node.js:  v${nodeVersion} (${process.execPath}) - ${isNode22 ? '✔ Ready' : '✘ Node 22+ recommended'}`);

  const qmdResult = setupQmdRuntime(toolRoot, { log });

  let vaultResult = null;
  if (options.vault) {
    vaultResult = configureVaultPlugin(options.vault, toolRoot, { log, skipIndex: options.skipIndex });
  }

  const pythonExec = detectPython();
  log(`Python:   ${pythonExec ? `✔ ${pythonExec} (3.10+ ready for synthesis)` : '○ Not detected (needed only for Hermes provider synthesis / full tests)'}`);

  const hasPdftotext = probePdfToText();
  log(`Poppler:  ${hasPdftotext ? '✔ pdftotext ready' : '○ Not detected (install poppler if text-layer PDF intake is needed)'}`);

  log('====================================================');
  log('✔ Runtime environment ready for Economics Wiki');
  log('====================================================');

  return {
    ok: true,
    node: { version: nodeVersion, execPath: process.execPath, ready: isNode22 },
    qmd: qmdResult,
    vault: vaultResult,
    python: { executable: pythonExec, ready: !!pythonExec },
    pdfExtraction: { ready: hasPdftotext }
  };
}

module.exports = {
  setupRuntime,
  setupQmdRuntime,
  configureVaultPlugin,
  checkQmdInstalled,
  detectPython,
  probePdfToText
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node scripts/setup-runtime.cjs [options]

Options:
  --vault <path>       Target Obsidian vault root directory to deploy plugin and configure
  --tool-root <path>   Directory for isolated QMD runtime (default: ~/.economy-qmd)
  --skip-index         Do not build initial vector index during setup
  --json               Output JSON result
  --quiet              Suppress verbose logging
  --help, -h           Show this help message
`);
    process.exit(0);
  }

  let vault = null;
  const vaultIdx = args.indexOf('--vault');
  if (vaultIdx !== -1 && args[vaultIdx + 1]) vault = args[vaultIdx + 1];

  let toolRoot = null;
  const toolRootIdx = args.indexOf('--tool-root');
  if (toolRootIdx !== -1 && args[toolRootIdx + 1]) toolRoot = args[toolRootIdx + 1];

  const skipIndex = args.includes('--skip-index');
  const quiet = args.includes('--quiet') || args.includes('--json');
  const isJson = args.includes('--json');

  try {
    const result = setupRuntime({ vault, toolRoot, skipIndex, quiet });
    if (isJson) console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    if (isJson) console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    else console.error('Setup failed:', err.message);
    process.exit(1);
  }
}
