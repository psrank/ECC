'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL = 'autonomous-orch-pipeline';
const CANONICAL = path.join(REPO_ROOT, 'skills', SKILL);
const MIRROR = path.join(REPO_ROOT, '.agents', 'skills', SKILL);
const REQUIRED_SKILL_PHRASES = [
  'plan -> test -> implement -> review -> verify -> remember -> improve',
  'Do not alter production code until the user approves.',
  'Commit only when the user explicitly approves; never push automatically.',
  '.ecc/autonomous-runs/<run-id>.md',
  'Resume Discovery and Checkpointing',
  'before accepting a new plan or plain-language request',
  'exactly one compatible non-terminal ledger',
  'Resume that ledger from its recorded next action',
  'Do not infer in-progress work from plan files',
  'multiple compatible non-terminal ledgers',
  'last completed checkpoint',
  'needs_user_approval is a paused, resumable state',
  'Only `completed` and `completed-with-memory-pending` are final',
  'repository identity, canonical worktree path, branch, plan path and item ID, plan fingerprint, and baseline commit',
  'If any required compatibility field is absent or mismatched, do not resume',
  'Stage Resolution',
  'Current stage:',
  'implement (review remediation)',
  'blocking review finding with no subsequent GREEN evidence',
  'A blocking review finding takes precedence over generic review resolution',
  'implement (review remediation) | review',
  'A `blocked` ledger must present its recorded blocker and stop',
  'missing or contradictory durable evidence',
  'raw transcripts, secrets, credentials',
  'three failed review/remediation rounds',
  'needs_user_approval',
  'exactly one additional round',
  'two repair checkpoints',
  'completed-with-memory-pending',
  'Do not edit workflow artifacts without separate approval.',
  'manual `$ecc:plan` through `$ecc:improve` skills remain explicit-only',
  'never invoked automatically by this skill',
];

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    return true;
  } catch (error) {
    console.log(`  FAIL ${name}`);
    console.log(`    ${error.stack || error.message}`);
    return false;
  }
}

function assertSkillFrontmatter(content, root) {
  assert.match(content, new RegExp(`^name: ${SKILL}$`, 'm'), `${root} skill name is incorrect`);
  assert.match(content, /^description: .+$/m, `${root} skill description is missing`);
}

function assertMetadata(content, root) {
  assert.match(content, /default_prompt: "Use \$ecc:autonomous-orch-pipeline\b[^\n]*"/);
  assert.match(content, /^\s+allow_implicit_invocation: false$/m, `${root} must be explicit-only`);
}

console.log('\n=== Testing autonomous orchestrator pipeline ===\n');

let passed = 0;
let failed = 0;

if (test('ships canonical and Codex-mirror skill surfaces', () => {
  for (const root of [CANONICAL, MIRROR]) {
    assert.ok(fs.existsSync(path.join(root, 'SKILL.md')), `Missing ${path.relative(REPO_ROOT, root)}/SKILL.md`);
    assert.ok(
      fs.existsSync(path.join(root, 'agents', 'openai.yaml')),
      `Missing ${path.relative(REPO_ROOT, root)}/agents/openai.yaml`
    );
  }
})) passed += 1; else failed += 1;

if (test('keeps canonical and Codex-mirror files identical', () => {
  assert.strictEqual(
    readUtf8(path.join(CANONICAL, 'SKILL.md')),
    readUtf8(path.join(MIRROR, 'SKILL.md')),
    'SKILL.md surfaces must match exactly'
  );
  assert.strictEqual(
    readUtf8(path.join(CANONICAL, 'agents', 'openai.yaml')),
    readUtf8(path.join(MIRROR, 'agents', 'openai.yaml')),
    'openai.yaml surfaces must match exactly'
  );
})) passed += 1; else failed += 1;

if (test('uses valid explicit-only Codex metadata', () => {
  for (const root of [CANONICAL, MIRROR]) {
    assertSkillFrontmatter(readUtf8(path.join(root, 'SKILL.md')), path.relative(REPO_ROOT, root));
    assertMetadata(readUtf8(path.join(root, 'agents', 'openai.yaml')), path.relative(REPO_ROOT, root));
  }
})) passed += 1; else failed += 1;

if (test('defines the approved autonomous lifecycle and bounded recovery contract', () => {
  const content = readUtf8(path.join(CANONICAL, 'SKILL.md')).replace(/\s+/g, ' ');
  for (const phrase of REQUIRED_SKILL_PHRASES) {
    assert.ok(content.includes(phrase), `Missing autonomous workflow contract: ${phrase}`);
  }
})) passed += 1; else failed += 1;

if (test('packages the skill and ignores local run ledgers', () => {
  const packageJson = JSON.parse(readUtf8(path.join(REPO_ROOT, 'package.json')));
  assert.ok(packageJson.files.includes(`skills/${SKILL}/`), 'package.json must ship the canonical skill');
  const modules = JSON.parse(readUtf8(path.join(REPO_ROOT, 'manifests', 'install-modules.json'))).modules;
  const agenticPatterns = modules.find(module => module.id === 'agentic-patterns');
  assert.ok(agenticPatterns, 'agentic-patterns install module is missing');
  assert.ok(
    agenticPatterns.paths.includes(`skills/${SKILL}`),
    'agentic-patterns must install the canonical skill'
  );
  assert.ok(
    readUtf8(path.join(REPO_ROOT, '.gitignore')).includes('/.ecc/autonomous-runs/'),
    '.gitignore must protect local autonomous run ledgers'
  );
})) passed += 1; else failed += 1;

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
