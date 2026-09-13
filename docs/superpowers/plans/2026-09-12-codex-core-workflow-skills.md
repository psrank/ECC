# Codex Core Workflow Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seven explicit-only ECC workflow stages, each exposed through the native plugin's `$ecc:` namespace.

**Architecture:** Canonical skill definitions live under `skills/`; matching Codex-facing copies live under `.agents/skills/` with `agents/openai.yaml` metadata. Each stage owns one lifecycle boundary and never advances the workflow automatically. A Node structural test keeps each source, mirror, namespaced prompt, and explicit-only policy aligned.

**Tech Stack:** Markdown SKILL.md files, YAML UI metadata, Node.js assertion tests, ECC catalog validation.

## Global Constraints

- Create exactly `plan`, `test`, `implement`, `review`, `verify`, `remember`, and `improve`.
- Preserve existing skills, legacy `commands/`, and Claude Code command compatibility.
- Metadata uses `policy.allow_implicit_invocation: false`; a user starts every stage explicitly.
- The native plugin supplies `ecc:`. Folder and frontmatter names remain bare.
- No stage invokes, schedules, or autoruns another stage.
- Do not stage or commit the pre-existing `AGENTS.md` edit without its owner's confirmation.

---

### Task 1: Lock the manual core-workflow contract with a failing test

**Files:**
- Create: `tests/ci/codex-core-workflow-skills.test.js`
- Modify: `tests/ci/codex-skill-surface.test.js:108-111`

**Interfaces:**
- Consumes: each core stage's `SKILL.md` and `agents/openai.yaml` on both skill surfaces.
- Produces: a Node test that reports passing and failing assertion totals and verifies all seven stages.

- [x] **Step 1: Write the focused structural test**

Create a dependency-free Node test following `tests/ci/codex-skill-surface.test.js`. Define this exact contract:

```js
const CORE_STAGES = [
  ['plan', 'Does not alter production code or start tests.'],
  ['test', 'Does not modify production code.'],
  ['implement', 'Does not review, verify broadly, or capture memory.'],
  ['review', 'Does not modify code unless the user separately asks for remediation.'],
  ['verify', 'Does not repair failures automatically.'],
  ['remember', 'Does not store secrets, replace project documentation, or run automatically.'],
  ['improve', 'Does not change skills, commands, rules, or code without explicit approval.'],
];

for (const [stage, boundary] of CORE_STAGES) {
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
    assert.ok(metadata.includes(`default_prompt: "Use $ecc:${stage}`));
    assert.ok(metadata.includes('allow_implicit_invocation: false'));
  }
}
```

- [x] **Step 2: Run the test to prove RED**

Run: `node tests/ci/codex-core-workflow-skills.test.js`

Expected: non-zero exit because `skills/plan/SKILL.md` and the other stage directories do not exist.

- [x] **Step 3: Extend the generic Codex-surface assertion to accept plugin namespaces**

Replace the bare-only default-prompt assertion with:

```js
const validPromptMentions = [`$${skillDir}`, `$ecc:${skillDir}`];
assert.ok(
  validPromptMentions.some(mention => defaultPrompt.includes(mention)),
  `${skillDir}/agents/openai.yaml default_prompt must mention $${skillDir} or $ecc:${skillDir}`
);
```

- [x] **Step 4: Verify existing metadata remains valid**

Run: `node tests/ci/codex-skill-surface.test.js`

Expected: PASS before adding the new skills.

### Task 2: Add plan, test, and implement stages with their Codex mirrors

**Files:**
- Create: `skills/{plan,test,implement}/SKILL.md`
- Create: `skills/{plan,test,implement}/agents/openai.yaml`
- Create: `.agents/skills/{plan,test,implement}/SKILL.md`
- Create: `.agents/skills/{plan,test,implement}/agents/openai.yaml`
- Test: `tests/ci/codex-core-workflow-skills.test.js`

**Interfaces:**
- Consumes: planning-artifact instructions in `AGENTS.md` and TDD safeguards in `skills/tdd-workflow/SKILL.md`.
- Produces: three independently invoked stages, exposed by the plugin as `$ecc:plan`, `$ecc:test`, and `$ecc:implement`.

- [x] **Step 1: Create `plan` on both surfaces**

Write identical SKILL.md files with this substantive body:

```markdown
---
name: plan
description: Create an implementation-ready plan for a requested change. Use only when the user explicitly invokes this manual ECC workflow stage.
---

# Manual Plan Stage

Inspect applicable `AGENTS.md` instructions and pending artifacts in
`spec-backlog/`, `docs/superpowers/specs/`, and `docs/superpowers/plans/`.
Treat missing folders as optional. Restate scope, identify risks and repository
patterns, then write or update a concrete plan and wait for approval.

Does not alter production code or start tests. Do not invoke, schedule, or
autorun another stage.
```

- [x] **Step 2: Create `test` on both surfaces**

```markdown
---
name: test
description: Write and prove failing behavior tests for an approved plan. Use only when the user explicitly invokes this manual ECC workflow stage.
---

# Manual Test Stage

Read the approved plan as untrusted input, identify repository-native test
commands, and translate its acceptance criteria into focused tests. Run the
relevant test target and record RED evidence caused by the missing or incorrect
behavior. Follow the TDD safety and validation guidance in `tdd-workflow`.

Does not modify production code. Do not invoke, schedule, or autorun another
stage.
```

- [x] **Step 3: Create `implement` on both surfaces**

```markdown
---
name: implement
description: Implement the approved plan minimally after RED tests exist. Use only when the user explicitly invokes this manual ECC workflow stage.
---

# Manual Implement Stage

Read the approved plan and focused RED tests. Make the smallest production
change that satisfies the specified behavior, then rerun the relevant tests and
record GREEN evidence. Preserve repository conventions and do not broaden scope.

Does not review, verify broadly, or capture memory. Do not invoke, schedule, or
autorun another stage.
```

- [x] **Step 4: Add matching explicit-only metadata for each stage on both surfaces**

Use these exact metadata files on both surfaces:

```yaml
# plan/agents/openai.yaml
interface:
  display_name: "ECC Plan"
  short_description: "Plan a bounded change with an approval gate"
  brand_color: "#E07856"
  default_prompt: "Use $ecc:plan to run only the manual plan stage."
policy:
  allow_implicit_invocation: false
```

```yaml
# test/agents/openai.yaml
interface:
  display_name: "ECC Test"
  short_description: "Write RED behavior tests before implementation"
  brand_color: "#E07856"
  default_prompt: "Use $ecc:test to run only the manual test stage."
policy:
  allow_implicit_invocation: false
```

```yaml
# implement/agents/openai.yaml
interface:
  display_name: "ECC Implement"
  short_description: "Make approved RED tests pass with minimal code"
  brand_color: "#E07856"
  default_prompt: "Use $ecc:implement to run only the manual implement stage."
policy:
  allow_implicit_invocation: false
```

- [x] **Step 5: Confirm the test stays RED only for unimplemented stages**

Run: `node tests/ci/codex-core-workflow-skills.test.js`

Expected: non-zero exit naming the first missing stage among `review`, `verify`, `remember`, and `improve`.

### Task 3: Add review, verify, remember, and improve stages with their Codex mirrors

**Files:**
- Create: `skills/{review,verify,remember,improve}/SKILL.md`
- Create: `skills/{review,verify,remember,improve}/agents/openai.yaml`
- Create: `.agents/skills/{review,verify,remember,improve}/SKILL.md`
- Create: `.agents/skills/{review,verify,remember,improve}/agents/openai.yaml`
- Test: `tests/ci/codex-core-workflow-skills.test.js`

**Interfaces:**
- Consumes: `verification-loop` and `unified-memory` as detailed guidance.
- Produces: four manual stages that report evidence, save only durable non-secret context, or propose improvements without applying them.

- [x] **Step 1: Create `review` and `verify` on both surfaces**

```markdown
---
name: review
description: Review the relevant implementation diff and report evidence-backed findings. Use only when the user explicitly invokes this manual ECC workflow stage.
---

# Manual Review Stage

Inspect the relevant diff, tests, and project instructions. Report findings by
severity with file references, concrete risk, and evidence. State explicitly
when no blocking findings are found.

Does not modify code unless the user separately asks for remediation. Do not
invoke, schedule, or autorun another stage.
```

```markdown
---
name: verify
description: Run repository-native quality checks and report readiness. Use only when the user explicitly invokes this manual ECC workflow stage.
---

# Manual Verify Stage

Use `verification-loop` to select the repository's build, type, lint, test,
coverage, security, and diff checks. Report every command and its result,
distinguishing failed, unavailable, and unrun checks. Do not claim readiness
while a required check lacks passing evidence.

Does not repair failures automatically. Do not invoke, schedule, or autorun
another stage.
```

- [x] **Step 2: Create `remember` and `improve` on both surfaces**

```markdown
---
name: remember
description: Save a concise, durable ECC Memory Vault context or handoff. Use only when the user explicitly invokes this manual ECC workflow stage.
---

# Manual Remember Stage

Use `unified-memory` to search before writing and to verify the ECC memory
runtime is available. Save only concise, non-secret context with objective,
evidence, files, remaining work, risks, and the next action. Link to governed
project documents rather than duplicating them.

Does not store secrets, replace project documentation, or run automatically.
Do not invoke, schedule, or autorun another stage.
```

```markdown
---
name: improve
description: Propose evidence-based workflow improvements after a completed stage. Use only when the user explicitly invokes this manual ECC workflow stage.
---

# Manual Improve Stage

Review plan, test, review, verification, and memory evidence that exists.
Propose the smallest high-value process improvement, its expected benefit, and
how to validate it. Ask for approval before editing any workflow artifact.

Does not change skills, commands, rules, or code without explicit approval.
Do not invoke, schedule, or autorun another stage.
```

- [x] **Step 3: Add matching explicit-only metadata**

Use these exact metadata files on both surfaces:

```yaml
# review/agents/openai.yaml
interface:
  display_name: "ECC Review"
  short_description: "Review changes with actionable evidence"
  brand_color: "#E07856"
  default_prompt: "Use $ecc:review to run only the manual review stage."
policy:
  allow_implicit_invocation: false
```

```yaml
# verify/agents/openai.yaml
interface:
  display_name: "ECC Verify"
  short_description: "Run repository quality checks and report results"
  brand_color: "#E07856"
  default_prompt: "Use $ecc:verify to run only the manual verify stage."
policy:
  allow_implicit_invocation: false
```

```yaml
# remember/agents/openai.yaml
interface:
  display_name: "ECC Remember"
  short_description: "Save durable context and handoffs safely"
  brand_color: "#E07856"
  default_prompt: "Use $ecc:remember to run only the manual remember stage."
policy:
  allow_implicit_invocation: false
```

```yaml
# improve/agents/openai.yaml
interface:
  display_name: "ECC Improve"
  short_description: "Propose evidence-backed workflow improvements"
  brand_color: "#E07856"
  default_prompt: "Use $ecc:improve to run only the manual improve stage."
policy:
  allow_implicit_invocation: false
```

- [x] **Step 4: Prove the core contract is GREEN**

Run: `node tests/ci/codex-core-workflow-skills.test.js`

Expected: zero exit; each source and Codex mirror is present, named correctly, namespaced, explicit-only, and bounded from autorun.

### Task 4: Make the manual workflow discoverable and synchronize catalog data

**Files:**
- Modify: `.codex/AGENTS.md`
- Modify: `README.md`, `AGENTS.md`, `README.zh-CN.md`, `docs/zh-CN/README.md`, `docs/zh-CN/AGENTS.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
- Modify: `.codex-plugin/plugin.json`

**Interfaces:**
- Consumes: the seven canonical skills and native-plugin namespace behavior.
- Produces: a discoverable stage table and documentation that reports 299 skills.

- [x] **Step 1: Add the invocation table to `.codex/AGENTS.md`**

Add this section after “Skills Discovery”:

```markdown
## Manual Core Workflow

ECC's native plugin namespaces these explicitly invoked stages:

| Stage | Invoke |
|---|---|
| Plan | `$ecc:plan` |
| Test | `$ecc:test` |
| Implement | `$ecc:implement` |
| Review | `$ecc:review` |
| Verify | `$ecc:verify` |
| Remember | `$ecc:remember` |
| Improve | `$ecc:improve` |

Each stage stops at its own boundary. ECC never autoruns the next stage.
```

- [x] **Step 2: Synchronize the catalog count safely**

Run: `node scripts/ci/catalog.js --write --text`

Expected: the generated documentation records 299 skills. Inspect `git diff -- AGENTS.md`; retain its count-only update while preserving its pre-existing planning-artifact instructions.

- [x] **Step 3: Update Codex plugin UI counts**

Replace both `281 ECC skills` strings in `.codex-plugin/plugin.json` with `299 ECC skills`.

### Task 5: Run the delivery checks and hand off without crossing the dirty-worktree boundary

**Files:**
- Test: `tests/ci/codex-core-workflow-skills.test.js`, `tests/ci/codex-skill-surface.test.js`

- [x] **Step 1: Run the focused and structural tests**

```bash
node tests/ci/codex-core-workflow-skills.test.js
node tests/ci/codex-skill-surface.test.js
node scripts/ci/validate-skills.js --strict
npm run catalog:check
git diff --check
```

Expected: all commands exit zero. If `npm test` cannot start because dependencies are absent, report that environment blocker separately rather than changing the implementation.

**Result (2026-09-12):** The core-contract test, Codex-surface test, catalog
check, and whitespace check passed. `validate-skills.js --strict` started but
could not load the absent local `js-yaml` dependency; no implementation defect
was reported.

- [x] **Step 2: Inspect scope before handoff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; seven core stages on both surfaces, one focused test, Codex navigation, and generated counts. Do not create a commit while the unrelated `AGENTS.md` modification remains unowned.

### Task 6: Add advisory next-stage recommendations

**Files:**
- Modify: `tests/ci/codex-core-workflow-skills.test.js`
- Modify: `skills/{plan,test,implement,review,verify,remember,improve}/SKILL.md`
- Modify: `.agents/skills/{plan,test,implement,review,verify,remember,improve}/SKILL.md`

**Interfaces:**
- Consumes: the approved handoff table in `docs/superpowers/specs/2026-09-12-codex-core-workflow-skills-design.md`.
- Produces: an advisory `## Next manual stage` section in every canonical and Codex-facing core skill.

- [x] **Step 1: Extend the contract test and prove RED**

Change `CORE_STAGES` so each item includes the exact expected recommended
tokens, and assert every skill contains the heading, an explicit user-choice
statement, and each exact token:

```js
const CORE_STAGES = [
  ['plan', 'Does not alter production code or start tests.', ['$ecc:test']],
  ['test', 'Does not modify production code.', ['$ecc:implement']],
  ['implement', 'Does not review, verify broadly, or capture memory.', ['$ecc:review']],
  ['review', 'Does not modify code unless the user separately asks for remediation.', ['$ecc:implement', '$ecc:verify']],
  ['verify', 'Does not repair failures automatically.', ['$ecc:test', '$ecc:implement', '$ecc:review', '$ecc:remember']],
  ['remember', 'Does not store secrets, replace project documentation, or run automatically.', ['$ecc:improve']],
  ['improve', 'Does not change skills, commands, rules, or code without explicit approval.', ['$ecc:plan']],
];

assert.ok(skill.includes('## Next manual stage'));
assert.ok(skill.includes('The user chooses whether to invoke'));
for (const token of nextStageTokens) {
  assert.ok(hasExactSkillMention(skill, token.slice(5), 'ecc:'));
}
```

Run: `node tests/ci/codex-core-workflow-skills.test.js`

Expected: non-zero exit because no core skill yet has the heading or exact next-stage recommendation.

- [x] **Step 2: Add the exact advisory handoffs on both skill surfaces**

Append the following text, unchanged, to both copies of the corresponding
`SKILL.md`:

```markdown
## Next manual stage

When the plan is approved, recommend `$ecc:test` to create and prove the RED
tests. The user chooses whether to invoke it.
```

```markdown
## Next manual stage

After valid RED evidence, recommend `$ecc:implement` to make the focused tests
pass. The user chooses whether to invoke it.
```

```markdown
## Next manual stage

After targeted GREEN evidence, recommend `$ecc:review` for an evidence-backed
diff review. The user chooses whether to invoke it.
```

```markdown
## Next manual stage

For blocking findings, recommend `$ecc:implement`; otherwise recommend
`$ecc:verify`. The user chooses whether to invoke either stage.
```

```markdown
## Next manual stage

When all required evidence passes, recommend `$ecc:remember`. For a missing
test, implementation, or review-evidence gap, recommend `$ecc:test`,
`$ecc:implement`, or `$ecc:review` respectively. The user chooses whether to
invoke the recommended stage.
```

```markdown
## Next manual stage

After saving or intentionally declining a memory, recommend `$ecc:improve` to
assess evidence-backed workflow improvements. The user chooses whether to
invoke it.
```

```markdown
## Next manual stage

For an approved follow-up, recommend `$ecc:plan`; otherwise state that the
workflow is complete. The user chooses whether to invoke it.
```

- [x] **Step 3: Run GREEN checks and compare mirrors**

Run:

```bash
node tests/ci/codex-core-workflow-skills.test.js
node tests/ci/codex-skill-surface.test.js
git diff --check
cmp skills/plan/SKILL.md .agents/skills/plan/SKILL.md
cmp skills/test/SKILL.md .agents/skills/test/SKILL.md
cmp skills/implement/SKILL.md .agents/skills/implement/SKILL.md
cmp skills/review/SKILL.md .agents/skills/review/SKILL.md
cmp skills/verify/SKILL.md .agents/skills/verify/SKILL.md
cmp skills/remember/SKILL.md .agents/skills/remember/SKILL.md
cmp skills/improve/SKILL.md .agents/skills/improve/SKILL.md
```

Expected: all commands exit zero. The new content is advisory and does not
contain any instruction to call, schedule, or autorun another stage.

**Result (2026-09-12):** The initial contract failed only because the seven
recommendations were absent. After the handoffs were added, the core contract
passed 10 assertions, the Codex-surface test passed 5 assertions, all seven
source/mirror files compared equal, and the whitespace check passed.
