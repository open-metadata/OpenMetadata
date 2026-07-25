# Hook Configuration Scope — and Why the Premise No Longer Holds

**Read-only audit.** Nothing was created or modified. No `settings.json` was written.

## Verdict (Task 1): the non-inheritance premise is OUTDATED — behaviour changed at Claude Code v2.1.211

The prompt's premise — *"`.claude/settings.json` does not inherit from parent directories — it loads
only from the directory Claude Code was started in"* — describes **pre-v2.1.211** behaviour. Current
Claude Code resolves the project settings file to the **git repository root**, so a session started in
*any* subdirectory of the repo loads the root `.claude/settings.json` and all 12 hooks.

**Verified two independent ways, both against current docs (not from memory):**

1. **First-hand WebFetch** of `https://code.claude.com/docs/en/settings.md`, verbatim:
   > "Claude Code reads and writes this file at the root of the git repository, resolved through
   > worktrees to the main checkout, **so one file covers sessions started in any subdirectory or
   > worktree of the repository.**"
   > "**Before v2.1.211, the file always lived in the starting directory.** Claude Code still reads a
   > `.claude/settings.local.json` that an earlier version left there."
   Exceptions where it *does* stay in the start directory: (1) "outside a git repository", (2) "when the
   repository root is your home directory", (3) "in Agent SDK sessions".

2. **claude-code-guide subagent** corroborated the same, adding from `hooks.md`: hooks are
   *"project-root scoped, not per-directory … applies to the entire project, regardless of which
   subdirectory Claude Code is working in."*

**Consequence:** for this repository, the git root **is** the repo root (it is not `$HOME`). Every
plausible place a contributor launches Claude Code (root, `ingestion/`, the UI dirs, any Maven module)
is *inside* the git repo, so under current behaviour **all 12 root hooks apply from all of them.** The
scope gap the prompt set out to close **does not exist for in-repo launches on current Claude Code.**

Per the stop-instruction ("if the behaviour has changed, say so and stop — the rest is unnecessary"),
**Tasks 4–5 (MUST/SHOULD classification and minimum-duplication proposals) are moot and are not
pursued.** What remains useful — the corrected coverage matrix and the residual edge cases — is below.

---

## Task 2 evidence — where contributors plausibly start (measured)

- **The 12-hook file is committed, despite `.gitignore`.** `git ls-files .claude/settings.json` → **1
  (tracked)**, even though `.gitignore:26-27` lists `.claude/*` and `.claude`. It was force-added, so a
  tracked file is not evicted by a later ignore rule — a fresh clone **does** contain it, and
  contributors receive the hooks. By contrast `.claude/settings.local.json` is **untracked + ignored**
  (correctly local-only), and `git check-ignore` confirms other `.claude/` paths (`agents`, `hooks/`,
  `plans/`, `audit-results/`) are ignored. So only `settings.json` is shared out of `.claude/`.
- **Only one `settings.json` exists under any `.claude/`** — the root one. `find . -name settings.json
  -path '*.claude*'` → 1. No subdirectory settings file exists (consistent with the prompt).
- **Tooling entry points** (where a subsystem-focused contributor might `cd` and launch):
  - Makefiles: `./Makefile`, `./ingestion/Makefile`, `./openmetadata-k8s-operator/Makefile`.
  - `pom.xml`: repo root + all 12 module dirs.
  - `package.json` (tracked, non-node_modules): repo root (`name: open-metadata`, minimal scripts),
    `openmetadata-ui/src/main/resources/ui/`, `openmetadata-ui-core-components/src/main/resources/ui/`,
    `docker/development/mock-oidc-provider/`.
- **What the contributor docs say to `cd` into:** `CONTRIBUTING.md` is a stub that defers to the docs
  site (`docs.open-metadata.org/developers/contribute/build-code-and-run-tests`). `DEVELOPER.md` /
  `CLAUDE.md` run `mvn`/`make generate` **from the repo root** and say `cd openmetadata-ui/src/main/
  resources/ui` for frontend and `cd ingestion` for Python work — i.e. subsystem dirs are the documented
  working directories for those languages, while backend/codegen commands run at root.
- **Devcontainer anchors at root:** `.devcontainer/{dev,full-stack}/devcontainer.json` are **tracked**
  and set `workspaceFolder: /workspaces/OpenMetadata` (the repo root); `postCreateCommand` runs
  `.devcontainer/dev/post-create.sh`.
- **Editor configs are local, and point at root:** `.vscode/settings.json` and `.idea/workspace.xml`
  are **untracked/ignored** (per-developer), but their presence means editors open the **repo root** as
  the workspace.
- **`claude.yml` sets no `working-directory`** — the CI agent runs at the repo-root checkout (so it sits
  where the root `.claude/settings.json` is).

Net: the dominant launch point is the **repo root** (devcontainer, editors, git root, most CLAUDE.md
commands, CI). The realistic *subsystem* launch points are **`ingestion/`** and
**`openmetadata-ui/src/main/resources/ui/`** (and, less often, `openmetadata-ui-core-components/.../ui/`
and individual Maven modules). **All are inside the git repo.**

---

## Coverage matrix — which of the 12 hooks apply, by starting directory

The 12 hooks = 2 blocking `PreToolUse(Bash)` (`--no-verify` block, antd-import block) + 6 advisory
`PostToolUse(Edit)` + 4 advisory `PostToolUse(Write)`. Because hooks are **project-root-scoped for the
whole session**, a matching hook (e.g. the `.java` spotless reminder) fires no matter which subdirectory
the edited file lives in — so the only question is whether the *root file loads at all*, which is binary
per start directory.

### Current behaviour (Claude Code ≥ v2.1.211) — what actually happens today

| Start directory | Inside git repo? | settings.json resolves to | **12 hooks apply?** |
|---|---|---|---|
| repo root `/` | yes (is the root) | itself | **All 12 ✅** |
| `ingestion/` | yes | git root (walk-up) | **All 12 ✅** |
| `openmetadata-ui/src/main/resources/ui/` | yes | git root | **All 12 ✅** |
| `openmetadata-ui-core-components/src/main/resources/ui/` | yes | git root | **All 12 ✅** |
| `openmetadata-service/` (any Maven module) | yes | git root | **All 12 ✅** |
| `openmetadata-k8s-operator/` | yes | git root | **All 12 ✅** |
| a directory **outside** the repo | no | start dir (no `.claude` → nothing) | **None ❌** (not working on this repo) |
| repo checked out **at `$HOME`** | yes, but root = home | start-dir exception | **Conditional ⚠️** (uses whatever `.claude` is in the start dir) |
| CI `claude.yml` / **Agent SDK / headless** session | n/a (Agent SDK exception) | controlled by `settingSources` | **Conditional ⚠️** — loads project hooks only if `settingSources` includes `project` |

### Pre-v2.1.211 behaviour — the world the prompt's premise assumed (for contrast)

| Start directory | 12 hooks apply? |
|---|---|
| repo root `/` | All 12 ✅ |
| `ingestion/` | **None ❌** |
| `openmetadata-ui/src/main/resources/ui/` | **None ❌** |
| `openmetadata-ui-core-components/.../ui/` | **None ❌** |
| any Maven module dir | **None ❌** |

Under the old behaviour the subsystem launch points lost every hook — which is exactly the gap the
prompt was written to address. The version bump closed it automatically for all in-repo launches.

---

## Residual edge cases (the only places the guarantee can still fail)

These are worth noting but do **not** justify per-subdirectory duplication:

1. **Agent SDK / headless sessions** (most relevant: the **CI agent in `claude.yml`**, which runs
   `anthropics/claude-code-action`). Per exception (3), Agent-SDK sessions control settings via
   `settingSources`; if the action does not include `project`, the committed root hooks may not load
   even though the checkout is at repo root. **This is the one live uncertainty** — it depends on
   claude-code-action's internals, which this audit did not inspect. (The CI token is read-only, so the
   two *blocking* PreToolUse hooks matter less there; see `08d §5`.)
2. **A contributor on Claude Code older than v2.1.211** would still see the old launch-dir-only
   behaviour and lose the hooks when starting in `ingestion/` or the UI dir.
3. **Repo cloned directly into `$HOME`** (root == home dir) hits exception (2).
4. **The committed `.claude/settings.json` could be silently dropped** by the `.gitignore .claude/*`
   rule if anyone ever `git rm --cached`s it or re-adds `.claude/` — because it is only tracked by an
   explicit force-add fighting an ignore rule. That fragility is real but is a git-hygiene concern, not
   a scope concern.

Separately, the **plugin hooks** in `skills/hooks/hooks.json` (committed; referenced by
`skills/.claude-plugin/plugin.json`) are a *different* delivery mechanism — they ship with the plugin
regardless of cwd if the plugin is installed, and partially overlap the root `settings.json` hooks
(see `00-findings.md` Dup-3). They are not tied to the launch directory.

---

## Why Tasks 4–5 are not pursued

The MUST/SHOULD classification and the three minimum-duplication options (per-subsystem
`settings.json` vs a SessionStart warning vs a documented launch dir) all exist to close a gap that
**current Claude Code has already closed** via git-root resolution. Proposing duplicated hook copies
now would *add* the drift risk the prompt warns about, to defend against a failure mode that only
affects (a) pre-v2.1.211 clients and (b) Agent-SDK sessions — neither of which a committed
per-subdirectory `settings.json` reliably fixes (the Agent-SDK case is governed by `settingSources`,
not by a file on disk). If the team must support old clients or harden the CI agent, the proportionate
moves are: pin/require a minimum Claude Code version, and verify `settingSources` in the CI action —
**not** scatter duplicate hook files. Left as an explicit non-recommendation, per the "do not pick
unilaterally / proposal only" constraint.
