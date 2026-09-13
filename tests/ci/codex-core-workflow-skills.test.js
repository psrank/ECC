'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PACKAGE_JSON = require(path.join(REPO_ROOT, 'package.json'));
const CORE_STAGES = [
  ['plan', 'Does not alter production code or start tests.', ['$ecc:test']],
  ['test', 'Does not modify production code.', ['$ecc:implement']],
  ['implement', 'Does not review, verify broadly, or capture memory.', ['$ecc:review']],
  ['review', 'Does not modify code unless the user separately asks for remediation.', ['$ecc:implement', '$ecc:verify']],
  ['verify', 'Does not repair failures automatically.', ['$ecc:test', '$ecc:implement', '$ecc:review', '$ecc:remember']],
  ['remember', 'Does not store secrets, replace project documentation, or run automatically.', ['$ecc:improve']],
  ['improve', 'Does not change skills, commands, rules, or code without explicit approval.', ['$ecc:plan']],
];
const NO_AUTORUN_INVARIANT = /Do\s+not\s+invoke,\s+schedule,\s+or\s+autorun\s+another\s+stage\./;
const AUTOMATIC_CONTINUATION = /(?:^|[.!?]\s+)(?:automatically|auto(?:-|\s)?run)\s+(?:invoke|start|continue|advance|run|proceed\s+to)\s+(?:the\s+)?next\s+(?:manual\s+)?stage\b|(?:^|[.!?]\s+)(?:the\s+)?next\s+(?:manual\s+)?stage\s+(?:will|should)\s+(?:be\s+)?(?:automatically|auto(?:-|\s)?run)\b/im;
const IMPLEMENT_BRANCH_HANDOFF = [
  '## Branch handoff',
  'Before modifying production code, inspect the Git repository and current worktree.',
  'On an existing non-default feature branch that clearly belongs to the approved',
  'When on a clean default branch, create and switch to `feat/<plan-slug>` before modifying production code.',
  'When the default branch worktree is dirty, `HEAD` is detached, or the default branch cannot be determined, do not create or switch branches; explain the blocker and wait for user direction.',
  'Do not pull, push, commit, or modify Git configuration as part of this handoff.',
];

let passed = 0;
let failed = 0;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasExactSkillMention(prompt, skillName, namespace = '') {
  const escapedSkillName = escapeRegExp(skillName);
  return new RegExp(`\\$${namespace}${escapedSkillName}(?![A-Za-z0-9_-])`).test(prompt);
}

function policyAllowImplicitInvocationValues(metadata) {
  const values = [];
  let inPolicy = false;

  for (const line of metadata.split(/\r?\n/)) {
    if (/^policy:\s*(?:#.*)?$/.test(line)) {
      inPolicy = true;
      continue;
    }
    if (!inPolicy) continue;
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    if (!/^\s+/.test(line)) {
      inPolicy = false;
      continue;
    }

    const match = line.match(/^\s+allow_implicit_invocation:\s*(true|false)\s*(?:#.*)?$/);
    if (match) values.push(match[1]);
  }

  return values;
}

function assertExplicitOnlyPolicy(metadata, metadataPath) {
  const policyValues = policyAllowImplicitInvocationValues(metadata);
  assert.ok(
    policyValues.includes('false'),
    `${metadataPath} policy must set allow_implicit_invocation: false`
  );
  assert.ok(
    !policyValues.includes('true'),
    `${metadataPath} policy must not set allow_implicit_invocation: true`
  );
}

function assertNoAutorun(skill, skillPath) {
  assert.match(
    skill,
    NO_AUTORUN_INVARIANT,
    `${skillPath} must explicitly prohibit invoking, scheduling, or autorunning another stage`
  );
  assert.doesNotMatch(
    skill,
    AUTOMATIC_CONTINUATION,
    `${skillPath} must not recommend automatic continuation to the next stage`
  );
}

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  FAIL ${name}`);
    console.log(`    ${error.stack || error.message}`);
    failed += 1;
  }
}

console.log('\n=== Testing Codex core workflow skills ===\n');

test('matches complete bare and ECC-namespaced skill tokens', () => {
  assert.ok(hasExactSkillMention('Use $plan now.', 'plan'));
  assert.ok(hasExactSkillMention('Use $ecc:plan now.', 'plan', 'ecc:'));
  assert.ok(!hasExactSkillMention('Use $plan-canvas now.', 'plan'));
  assert.ok(!hasExactSkillMention('Use $ecc:plan-canvas now.', 'plan', 'ecc:'));
});

test('requires an active, unambiguous explicit-only policy', () => {
  assert.throws(
    () => assertExplicitOnlyPolicy('# policy:\n#   allow_implicit_invocation: false\n', 'commented.yaml'),
    /must set allow_implicit_invocation: false/
  );
  assert.throws(
    () => assertExplicitOnlyPolicy(
      'policy:\n  allow_implicit_invocation: false\n  allow_implicit_invocation: true\n',
      'conflicting.yaml'
    ),
    /must not set allow_implicit_invocation: true/
  );
});

test('rejects automatic next-stage continuation wording', () => {
  assert.throws(
    () => assertNoAutorun(
      'Do not invoke, schedule, or autorun another stage. Automatically invoke the next stage.',
      'automatic.md'
    ),
    /must not recommend automatic continuation to the next stage/
  );
  assert.doesNotThrow(() => assertNoAutorun(
    'Do not invoke, schedule, or autorun another stage. Do not automatically invoke the next stage.',
    'prohibition.md'
  ));
});

test('ships canonical workflow skills in the npm package surface', () => {
  assert.ok(PACKAGE_JSON.files.includes('.agents/'), 'package.json must ship the Codex skill mirror');
  for (const [stage] of CORE_STAGES) {
    assert.ok(
      PACKAGE_JSON.files.includes(`skills/${stage}/`),
      `package.json must include skills/${stage}/`
    );
  }
});

for (const [stage, boundary, nextStageTokens] of CORE_STAGES) {
  test(`${stage} exists on both skill surfaces and stays within its boundary`, () => {
    const canonicalSkillPath = path.join(REPO_ROOT, 'skills', stage, 'SKILL.md');
    const mirroredSkillPath = path.join(REPO_ROOT, '.agents', 'skills', stage, 'SKILL.md');
    assert.ok(fs.existsSync(canonicalSkillPath), `Missing skills/${stage}/SKILL.md`);
    assert.ok(fs.existsSync(mirroredSkillPath), `Missing .agents/skills/${stage}/SKILL.md`);
    assert.strictEqual(
      fs.readFileSync(canonicalSkillPath, 'utf8'),
      fs.readFileSync(mirroredSkillPath, 'utf8'),
      `skills/${stage}/SKILL.md must exactly match .agents/skills/${stage}/SKILL.md`
    );

    for (const root of ['skills', path.join('.agents', 'skills')]) {
      const skillPath = path.join(REPO_ROOT, root, stage, 'SKILL.md');
      const metadataPath = path.join(REPO_ROOT, root, stage, 'agents', 'openai.yaml');
      assert.ok(fs.existsSync(skillPath), `Missing ${root}/${stage}/SKILL.md`);
      assert.ok(fs.existsSync(metadataPath), `Missing ${root}/${stage}/agents/openai.yaml`);
      const skill = fs.readFileSync(skillPath, 'utf8');
      const metadata = fs.readFileSync(metadataPath, 'utf8');
      assert.match(skill, new RegExp(`^name: ${stage}$`, 'm'));
      assert.match(skill, /^description: .+$/m);
      assert.ok(skill.includes(boundary));
      assertNoAutorun(skill, skillPath);
      assert.ok(skill.includes('## Next manual stage'));
      assert.ok(skill.includes('The user chooses whether to invoke'));
      for (const token of nextStageTokens) {
        assert.ok(hasExactSkillMention(skill, token.slice(5), 'ecc:'));
      }
      if (stage === 'implement') {
        for (const requirement of IMPLEMENT_BRANCH_HANDOFF) {
          assert.ok(
            skill.includes(requirement),
            `${skillPath} must include the implementation branch handoff: ${requirement}`
          );
        }
      }
      const defaultPrompt = metadata.match(/^\s{2}default_prompt:\s*["'](.+)["']\s*$/m);
      assert.ok(defaultPrompt, `${root}/${stage}/agents/openai.yaml needs default_prompt`);
      assert.ok(
        hasExactSkillMention(defaultPrompt[1], stage, 'ecc:'),
        `${root}/${stage}/agents/openai.yaml default_prompt must mention $ecc:${stage}`
      );
      assertExplicitOnlyPolicy(metadata, `${root}/${stage}/agents/openai.yaml`);
    }
  });
}

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
