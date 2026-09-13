/**
 * Behaviour tests for scripts/codex/install-local-plugin.sh.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');
const LAUNCHER_PATH = path.join(REPO_ROOT, 'scripts', 'codex', 'install-local-plugin.sh');
const CACHE_CHECK_PATH = path.join(REPO_ROOT, 'scripts', 'codex', 'check-plugin-cache.js');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    return false;
  }
}

function findExecutable(command) {
  const result = spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Required test executable was not found: ${command}`);
  }
  return result.stdout.trim();
}

function writeExecutable(filePath, source) {
  fs.writeFileSync(filePath, source, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function createFixture({
  codex = true,
  node = true,
  failPluginRemove = false,
  failMarketplaceRemove = false,
  failMarketplaceAdd = false,
  failPluginAdd = false,
  failCacheCheck = false,
} = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-local-codex-plugin-'));
  const binDir = path.join(tempDir, 'bin');
  const workingDir = path.join(tempDir, 'working-directory');
  const callsPath = path.join(tempDir, 'calls.log');

  fs.mkdirSync(binDir);
  fs.mkdirSync(workingDir);
  fs.writeFileSync(callsPath, '', 'utf8');

  for (const command of ['dirname', 'basename']) {
    fs.symlinkSync(findExecutable(command), path.join(binDir, command));
  }

  if (codex) {
    writeExecutable(
      path.join(binDir, 'codex'),
      `#!/bin/sh
printf 'codex %s\\n' "$*" >> "$ECC_TEST_CALLS"
if [ "$1" = 'plugin' ] && [ "$2" = 'remove' ] && [ "$3" = 'ecc@ecc' ] && [ "${failPluginRemove}" = 'true' ]; then
  exit 40
fi
if [ "$1" = 'plugin' ] && [ "$2" = 'marketplace' ] && [ "$3" = 'remove' ] && [ "$4" = 'ecc' ] && [ "${failMarketplaceRemove}" = 'true' ]; then
  exit 41
fi
if [ "$1" = 'plugin' ] && [ "$2" = 'marketplace' ] && [ "$3" = 'add' ] && [ "${failMarketplaceAdd}" = 'true' ]; then
  exit 42
fi
if [ "$1" = 'plugin' ] && [ "$2" = 'add' ] && [ "$3" = 'ecc@ecc' ] && [ "${failPluginAdd}" = 'true' ]; then
  exit 43
fi
`
    );
  }

  if (node) {
    writeExecutable(
      path.join(binDir, 'node'),
      `#!/bin/sh
printf 'node %s\\n' "$*" >> "$ECC_TEST_CALLS"
if [ "$1" = ${JSON.stringify(CACHE_CHECK_PATH)} ] && [ "${failCacheCheck}" = 'true' ]; then
  exit 44
fi
`
    );
  }

  return { binDir, callsPath, tempDir, workingDir };
}

function readCalls(callsPath) {
  const contents = fs.readFileSync(callsPath, 'utf8').trim();
  return contents === '' ? [] : contents.split('\n');
}

function runLauncher(fixture, args = []) {
  return spawnSync(findExecutable('bash'), [LAUNCHER_PATH, ...args], {
    cwd: fixture.workingDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      ECC_TEST_CALLS: fixture.callsPath,
      PATH: fixture.binDir,
    },
  });
}

function runTests() {
  console.log('\n=== Testing install-local-plugin.sh ===\n');

  let passed = 0;
  let failed = 0;

  const successFixture = createFixture();
  try {
    if (test('refreshes the local marketplace install and cache verification in order', () => {
      const result = runLauncher(successFixture);

      assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
      assert.deepStrictEqual(readCalls(successFixture.callsPath), [
        'codex plugin remove ecc@ecc',
        'codex plugin marketplace remove ecc',
        `codex plugin marketplace add ${REPO_ROOT}`,
        'codex plugin add ecc@ecc',
        `node ${CACHE_CHECK_PATH}`,
      ]);
    })) passed += 1; else failed += 1;
  } finally {
    fs.rmSync(successFixture.tempDir, { recursive: true, force: true });
  }

  const firstRunFixture = createFixture({
    failPluginRemove: true,
    failMarketplaceRemove: true,
  });
  try {
    if (test('continues installation when no existing plugin or marketplace can be removed', () => {
      const result = runLauncher(firstRunFixture);

      assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
      assert.deepStrictEqual(readCalls(firstRunFixture.callsPath), [
        'codex plugin remove ecc@ecc',
        'codex plugin marketplace remove ecc',
        `codex plugin marketplace add ${REPO_ROOT}`,
        'codex plugin add ecc@ecc',
        `node ${CACHE_CHECK_PATH}`,
      ]);
    })) passed += 1; else failed += 1;
  } finally {
    fs.rmSync(firstRunFixture.tempDir, { recursive: true, force: true });
  }

  const failureFixture = createFixture({ failMarketplaceAdd: true });
  try {
    if (test('stops when marketplace installation fails', () => {
      const result = runLauncher(failureFixture);

      assert.strictEqual(result.status, 42, `stderr: ${result.stderr}`);
      assert.deepStrictEqual(readCalls(failureFixture.callsPath), [
        'codex plugin remove ecc@ecc',
        'codex plugin marketplace remove ecc',
        `codex plugin marketplace add ${REPO_ROOT}`,
      ]);
    })) passed += 1; else failed += 1;
  } finally {
    fs.rmSync(failureFixture.tempDir, { recursive: true, force: true });
  }

  const pluginFailureFixture = createFixture({ failPluginAdd: true });
  try {
    if (test('stops when installing ecc@ecc fails', () => {
      const result = runLauncher(pluginFailureFixture);

      assert.strictEqual(result.status, 43, `stderr: ${result.stderr}`);
      assert.deepStrictEqual(readCalls(pluginFailureFixture.callsPath), [
        'codex plugin remove ecc@ecc',
        'codex plugin marketplace remove ecc',
        `codex plugin marketplace add ${REPO_ROOT}`,
        'codex plugin add ecc@ecc',
      ]);
    })) passed += 1; else failed += 1;
  } finally {
    fs.rmSync(pluginFailureFixture.tempDir, { recursive: true, force: true });
  }

  const cacheFailureFixture = createFixture({ failCacheCheck: true });
  try {
    if (test('returns the cache verification failure after both Codex calls', () => {
      const result = runLauncher(cacheFailureFixture);

      assert.strictEqual(result.status, 44, `stderr: ${result.stderr}`);
      assert.deepStrictEqual(readCalls(cacheFailureFixture.callsPath), [
        'codex plugin remove ecc@ecc',
        'codex plugin marketplace remove ecc',
        `codex plugin marketplace add ${REPO_ROOT}`,
        'codex plugin add ecc@ecc',
        `node ${CACHE_CHECK_PATH}`,
      ]);
    })) passed += 1; else failed += 1;
  } finally {
    fs.rmSync(cacheFailureFixture.tempDir, { recursive: true, force: true });
  }

  const argumentsFixture = createFixture();
  try {
    if (test('rejects command-line arguments before invoking Codex', () => {
      const result = runLauncher(argumentsFixture, ['unexpected']);

      assert.strictEqual(result.status, 64, `stderr: ${result.stderr}`);
      assert.deepStrictEqual(readCalls(argumentsFixture.callsPath), []);
    })) passed += 1; else failed += 1;
  } finally {
    fs.rmSync(argumentsFixture.tempDir, { recursive: true, force: true });
  }

  const missingCodexFixture = createFixture({ codex: false });
  try {
    if (test('reports a missing codex prerequisite before invoking commands', () => {
      const result = runLauncher(missingCodexFixture);

      assert.strictEqual(result.status, 127, `stderr: ${result.stderr}`);
      assert.match(result.stderr, /codex is required but was not found on PATH/);
      assert.deepStrictEqual(readCalls(missingCodexFixture.callsPath), []);
    })) passed += 1; else failed += 1;
  } finally {
    fs.rmSync(missingCodexFixture.tempDir, { recursive: true, force: true });
  }

  const missingNodeFixture = createFixture({ node: false });
  try {
    if (test('reports a missing node prerequisite before invoking commands', () => {
      const result = runLauncher(missingNodeFixture);

      assert.strictEqual(result.status, 127, `stderr: ${result.stderr}`);
      assert.match(result.stderr, /node is required but was not found on PATH/);
      assert.deepStrictEqual(readCalls(missingNodeFixture.callsPath), []);
    })) passed += 1; else failed += 1;
  } finally {
    fs.rmSync(missingNodeFixture.tempDir, { recursive: true, force: true });
  }

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
