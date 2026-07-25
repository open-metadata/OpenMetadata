# Hook Enforcement — Advisory → Deterministic

Applied the decision framework to all 12 hooks in `.claude/settings.json` using the enforcement-gap
table (`00-findings.md §5`) and the authoritative generated-path list (`08d-hazards.md §3`, derived
from codegen config — **not** the provisional directory-name list).

**Result: `.claude/settings.json` = 3 `PreToolUse` blockers, 0 advisory `PostToolUse`.** Every deleted
hook only printed text; its guidance already lives in a `.claude/rules/*.md` file from the CLAUDE.md
split and/or is enforced by CI. The three shipped blockers: `--no-verify` (kept), **generated-output
protection** (new), and **`.github/workflows/**` edit protection** (new, added on request). The four
format/license invariants requested (spotless, python, UI format, license) were made **repo-wide
pre-commit** blockers instead of agent hooks (see final sections).

```
before: PreToolUse Bash ×2 (--no-verify, antd) ; PostToolUse Edit ×6 ; PostToolUse Write ×4
after:  PreToolUse Bash ×1 (--no-verify) ; PreToolUse Edit|Write ×2 (generated-output, workflow-edit)
        + .pre-commit-config.yaml: ui-prettier, ui-license-header (Java+Python format already present)
```

## Decision framework recap
- **Hard invariant AND cheap (<1s) AND false-positive-safe → `PreToolUse` blocker** (exit 2, message = what/why/fix).
- **CI-enforced AND cheaply checkable for real → keep, but run the real check** (not a `new_string` pattern-match, which misses other write paths).
- **Preference, or a pure-print reminder a rule already carries → delete**, guidance lives in `.claude/rules/`.

## Per-hook disposition (all 12)

| # | Hook (before) | CI-enforced? | Disposition | Why |
|---|---|---|---|---|
| P1 | `PreToolUse Bash` — block `--no-verify` | n/a (client-side) | **KEEP (blocker)** | Hard invariant, cheap, zero false positives. |
| P2 | `PreToolUse Bash` — block `antd` import | No (no eslint rule) | **DELETE** | Preference (migration; audit F1 = DOCUMENT). Matcher was `Bash`, so it caught ~nothing on the real edit path; can't move to `Edit`/`Write` (would false-positive on **864** legacy antd files). → `component-library.md`. |
| E1 | `PostToolUse Edit .java` — spotless reminder | **Yes** (`java-checkstyle.yml`) | **DELETE** | Hard invariant, but the real check (`mvn spotless`) is >1s and a formatter can't be a *pre*-edit block (you format *after* editing). Pure-print reminder → `java.md` + `java-checkstyle` skill; CI still gates. |
| E2 | `PostToolUse Edit schema .json` — `make generate` reminder | Partial (UI drift) | **DELETE** | Editing the schema is *correct*; the reminder is redundant with `schema-first.md` (which loads when you edit a schema), and the new generated-output blocker enforces the inverse. |
| E3 | `PostToolUse Edit connection-schema .json` — `parse-schema` reminder | **No** (gitignored artifact) | **DELETE** | Not enforced anywhere; pure convenience. → `schema-first.md`. |
| E4 | `PostToolUse Edit .ts/.tsx` — `any` warning | **No** (`no-explicit-any` = `warn`) | **DELETE** | Preference. Blocking is unsafe (461 files, many under `generated/`). → `frontend-react.md`. |
| E5 | `PostToolUse Edit .ts/.tsx` — `console.*` warning | **Yes** (`no-console` = `error`) | **DELETE** | Hard invariant, but **can't safely block**: 32/34 real `console` usages are `eslint-disable`d (legit); a grep "real check" fires on those (noisy) and the accurate check (eslint) is >1s. → `frontend-react.md` + CI. |
| E6 | `PostToolUse Edit en-us.json` — `yarn i18n` reminder | Partial (sync only) | **DELETE** | Pure-print reminder redundant with `i18n.md`; sync is CI-enforced. (Its text also carried the wrong "17 locale files" figure — now corrected to 19/20 in `i18n.md`.) |
| W1 | `PostToolUse Write .java` — spotless reminder | **Yes** | **DELETE** | Same as E1. |
| W2 | `PostToolUse Write .ts/.tsx` — `antd` warning | No | **DELETE** | Same as P2 (preference; 864-file false-positive surface). → `component-library.md`. |
| W3 | `PostToolUse Write` new file — license-header warning | **Yes** (UI license step) | **DELETE** | Closest bucket-2 candidate (its header grep *is* a cheap real check), but it's UI-only (misses `.java`/`.py`) and blocking every new file lacking a header is high-friction (the header is auto-added by `yarn license-header-fix`). Redundant with `frontend-react.md` + CLAUDE.md cross-cutting + CI. **See proposal below.** |
| W4 | `PostToolUse Write .ts/.tsx` — `console.*` warning | **Yes** | **DELETE** | Same as E5. |
| — | **`PreToolUse Edit\|Write` — block writes to generated output** | Yes (UI drift job) | **ADD (blocker)** | Hard invariant, cheap (path match), false-positive-safe (carve-outs verified). Highest-priority conversion. |

## The new blocker — generated-output protection

Matches (anywhere in `file_path`): `openmetadata-ui/src/main/resources/ui/src/generated/`,
`ingestion(-core)?/src/metadata/generated/`, `/target/generated-sources/`. On match: emits a `block`
decision + `exit 2` with a message directing the agent to edit the schema under
`openmetadata-spec/src/main/resources/json/schema/` and run `make generate`.

**False positives considered (and why the matcher avoids them):**
- **The schema source itself** (`openmetadata-spec/.../json/schema/**`) — not under any generated
  prefix → allowed (verified in tests).
- **`make generate` / regeneration** — the matcher is on `Edit|Write` (file tools), not `Bash`, so the
  regeneration command is never blocked.
- **`src/generated/antlr/**`** — this *is* generated (JS ANTLR), so blocking it is correct, not a false
  positive. Verified `ui/src/generated/` contains **0** hand-authored files.
- **Hand-maintained `src/jsons/` files** (`profilerSettings.json`, `ssoSchemas/`) — deliberately **not**
  matched; `src/jsons/` is excluded from the blocker entirely (verified allowed in tests).
- **Files with "generated" in the name elsewhere** — the matcher keys on the specific directory paths,
  not the bare word, so a hand-authored file outside these trees is not matched.
- **Ingestion generated trees** are gitignored (0 tracked), so no legitimate committed file lives there.

**Deliberately NOT blocked (proposed, not shipped):** the gitignored `parseSchemas.js` outputs under
`src/jsons/{connectionSchemas,ingestionSchemas,governanceSchemas,applicationSchemas,configuration}/` —
editing them is futile (regenerated) but harmless (gitignored), and a `src/jsons/**` matcher risks the
two hand-maintained files above. Left out to honor "a blocker that fires on legitimate work is worse
than no hook."

## antd assessment (the specific question)

**Should the antd blocker cover `Edit` and `Write`, not just `Bash`? No.**
- **What the current matcher caught:** matcher `Bash` → the hook only ran on Bash tool calls, so a
  normal `Edit`/`Write` of a `.tsx` importing antd **never invoked it**. In practice it caught ~nothing.
- **Why not extend to `Edit|Write`:** the command matches *any* antd import and **cannot distinguish a
  new antd import from a legacy file that already has one** — both FIRE in the test below. Moving the
  matcher to `Edit|Write` would block edits to the **864** existing antd files (18.3% of the UI, 68.5%
  edited in the last 90 days per audit 08b F1). That is the definition of "fires on legitimate work."
- **And it isn't a hard invariant:** there is no CI rule banning antd (audit verdict F1 = DOCUMENT).
- **Disposition:** delete the inert Bash hook; the "no Ant Design for new work" guidance lives in
  `.claude/rules/component-library.md`.

## Proposals (unsure — deferred to you rather than shipped)
1. **spotless advisory** — deleted per framework, but it targets the single most common CI failure
   (java-checkstyle ~12% fail). If you want an edit-time nudge back, it's a one-line advisory re-add.
2. **license header** — could be kept/expanded as a cheap real-check advisory covering `.java`/`.py`
   too (not just UI), instead of deleted.
3. **`src/jsons/` parseSchemas outputs** — add to the generated blocker with explicit carve-outs for
   `profilerSettings.json` and `ssoSchemas/`, or leave out (current choice).

## Guidance relocation (no new rule files needed)
Every deleted hook's guidance already exists in the prompt-7 rules: spotless → `java.md`;
`make generate` / `parse-schema` / never-edit-generated → `schema-first.md` (updated with the blocker
note); `any` / `console` / license → `frontend-react.md`; i18n → `i18n.md`; antd →
`component-library.md`.

## Test evidence

### generated-output blocker
```
-- SHOULD TRIGGER (block, exit 2) --
Edit ui/src/generated TS type                       exit=2  BLOCKED
Write ui/src/generated/antlr JS                      exit=2  BLOCKED
Edit ingestion Pydantic model                        exit=2  BLOCKED
Write Java POJO under target/                         exit=2  BLOCKED
-- SHOULD NOT TRIGGER (allow, exit 0) --
Edit the SCHEMA source (correct path)                exit=0  allowed
Edit a normal Java file                              exit=0  allowed
Edit a normal React component                        exit=0  allowed
Edit hand-maintained src/jsons carve-out (ssoSchemas) exit=0  allowed
Edit a connector source (not generated)              exit=0  allowed
```

### `--no-verify` blocker
```
-- SHOULD TRIGGER --
git commit --no-verify                               exit=2  BLOCKED
-- SHOULD NOT TRIGGER --
normal git commit                                    exit=0  allowed
git status                                           exit=0  allowed
```

### antd command (illustrating why it can't move to Edit/Write)
```
Bash: echo an antd import into a file (contrived)    exit=2 FIRES
Edit: real .tsx adding an antd import                exit=2 FIRES
Edit: legacy file that ALREADY imports antd          exit=2 FIRES   <- would block 864 legit legacy edits
Edit: a non-antd change                              exit=0 silent
```

---

## Format + license blockers — repo-wide via pre-commit (for all contributors)

Requested: make **spotless (Java format)**, **Python format**, **UI format**, and **license header**
blockers **for all contributors**. The correct gate point is `git commit` (these are post-edit checks),
and the repo's mechanism is `.pre-commit-config.yaml`.

| Blocker | Before | Action |
|---|---|---|
| Java format (spotless) | **already** `google-style-java` (`mvn spotless:apply`) | none — already enforced |
| Python format | **already** `ruff-check` + `ruff-format` | none — already enforced |
| UI format | gap (config prettier only covered `openmetadata-service/.../json/schema/`) | **added `ui-prettier`** |
| License header (UI) | gap | **added `ui-license-header`** |
| License header (Java/Python) | **not viable repo-wide** | **deferred — see below** |

Two `local` hooks added to `.pre-commit-config.yaml`, using the project's own tooling (matches CI):
- **`ui-prettier`** → `scripts/check-ui-format.sh`: project `prettier --check` (v2.8.8, UI
  `.prettierrc.yaml`) on changed `ui/(src|playwright)` + `ui-core-components/src`
  `*.{ts,tsx,js,jsx,json}`, excluding `generated/`.
- **`ui-license-header`** → `scripts/check-ui-license.sh`: Apache-2.0 header required on **newly-added**
  UI source files (`git diff --cached --diff-filter=A`), excluding `generated/`.
Both **fail open** if UI `node_modules` are absent (skip with a message; CI is the backstop).

**Java/Python license deferred (not shipped):** a repo-wide "must have the Apache header" check would
fire on legitimate work — the repo has **two license headers** (core = Apache-2.0, `ingestion/` =
**Collate Community License 1.0**) and many headerless files (measured ~64% of `.java`, most `.py`;
some `.java` have no header at all). And `license-check-and-add` **scans the whole tree, ignoring file
args** (verified), so it can't be scoped safely. Enforcing those needs a separate effort (correct
license per area + a sweep). The UI hook is scoped to *new* UI files only, which is safe.

**Activation:** `.pre-commit-config.yaml` is committed, but pre-commit only runs once installed — and
**this checkout has it NOT installed** (`.git/hooks/pre-commit` absent). Each contributor/agent runs
`make install_test precommit_install` once (now added to the CLAUDE.md bootstrap). The `--no-verify`
blocker prevents skipping; CI enforces regardless.

**Reverted:** an earlier iteration shipped a self-contained agent-side commit gate
(`.claude/hooks/precommit-gate.sh` + a `PreToolUse` hook). Per the "repo-wide instead" choice it was
removed. *(That build surfaced a real bug worth remembering: the `ruff` on `PATH` is a `pyenv` shim
that exits 127 without a venv, so a naive `command -v`/exit-code check would false-block every Python
commit — hence the shipped scripts fail open and block only on the exact violation.)*

### Test evidence (hook scripts run directly; `pre-commit` CLI isn't runnable in this env)
```
ui-prettier (scripts/check-ui-format.sh):
  trigger: unformatted UI .ts                    exit=1 BLOCK
  non-trigger: prettier-clean UI .ts             exit=0 pass
ui-license-header (scripts/check-ui-license.sh):
  trigger: NEW UI .ts, no header                 exit=1 BLOCK
  non-trigger: NEW UI .ts WITH header            exit=0 pass
  non-trigger: MODIFIED headerless (not added)   exit=0 pass   <- editing an existing file is never blocked
```
`.pre-commit-config.yaml` parses; hook ids: `check-json, ruff-check, ruff-format, prettier,
google-style-java, token-audit, token-drift, ui-prettier, ui-license-header`.

## The new blocker — `.github/workflows/**` edit protection (added on request)

The agent must not modify CI workflows on its own — they are a supply-chain / prompt-injection surface
(cf. `08d-hazards.md §5`, the `claude.yml` CI-agent trust boundary). A `PreToolUse Edit|Write` hook
blocks any edit/write whose `file_path` is under `.github/workflows/`.

**Authorization path (the "unless explicitly authorized" part):** the hook allows the edit when
`CLAUDE_ALLOW_WORKFLOW_EDITS=1` is set in the environment. This is **user-controlled** — the agent
cannot self-authorize, because an `export` in an agent Bash call does not persist to the hook's (freshly
forked) shell; only a value the user set on the Claude Code process is visible. So the agent is blocked
by default, and a human explicitly opts in (or applies the change themselves).

**False positives considered:** keys on `file_path`, not content — a doc/source file that merely
*mentions* `.github/workflows/...` is not blocked (verified). `.github/ISSUE_TEMPLATE/**` and other
`.github` paths are not matched.

### Test evidence
```
-- SHOULD TRIGGER (block, exit 2) --
Edit .github/workflows/claude.yml                     exit=2 BLOCKED
Write /abs/repo/.github/workflows/new.yml             exit=2 BLOCKED
-- SHOULD NOT TRIGGER (allow) --
Edit a normal source file                             exit=0 allowed
Edit .github/ISSUE_TEMPLATE/bug.md                    exit=0 allowed
Edit a doc that mentions .github/workflows/ in content exit=0 allowed
-- AUTHORIZED BYPASS (user set env) --
Edit workflow WITH CLAUDE_ALLOW_WORKFLOW_EDITS=1       exit=0 allowed
```
