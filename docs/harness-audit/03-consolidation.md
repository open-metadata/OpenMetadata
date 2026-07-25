# Skill Directory Consolidation

Collapsed three skill locations into one source of truth: **`skills/`** (the plugin). `.claude/skills/`
and `.agents/skills/` now contain only **relative symlinks** into `skills/`. Changes are **staged, not
committed** (per repo convention — commit only when asked).

## What changed at a glance

| Before | After |
|---|---|
| `skills/` — 13 real skills | **19 real skills** (the 6 below moved in) |
| `.claude/skills/` — 12 symlinks + **6 real** SKILL.md dirs | **20 symlinks**, 0 real |
| `.agents/skills/` — **2 real** SKILL.md dirs (diverged copies) | **2 symlinks** into `skills/` |
| `java-checkstyle` / `ui-checkstyle` — 2 diverged copies each (.claude + .agents) | **1 merged** copy in `skills/`, both locations symlink to it |
| `pr-checklist`, `openmetadata-workflow` — plugin-only, no symlink | **symlinked** into `.claude/skills/` |

All 20 `.claude/skills/*` and both `.agents/skills/*` symlinks are recorded in the git index as mode
`120000` and resolve (verified below). Symlinks are relative, `../../skills/<name>`, matching the 12
that already existed.

---

## Task 1 — the two checkstyle merges

For each skill there were **two diverged copies** (`.claude/skills/<x>/SKILL.md` for Claude Code;
`.agents/skills/<x>/SKILL.md` for Codex). The merged single source is now `skills/<x>/SKILL.md`, keeping
every correct instruction from both. What differed:

### java-checkstyle
| Aspect | `.claude` copy | `.agents` copy | Merged / resolution |
|---|---|---|---|
| Frontmatter | full (`user-invocable`, `argument-hint`, `allowed-tools`) | name+description only | **kept full** (plugin skill format; harmless to Codex reading the body) |
| Title | "Java Checkstyle / Spotless" | "…(Codex agent)" | dropped the audience tag — now shared |
| `--check` / Arguments section | present | absent | **kept** |
| Commit policy | "Do NOT auto-commit … only if the user asked" | "Only commit if the user asked" | **agreed** → unified permissive-with-guard (see below) |
| Python out-of-scope | (not mentioned) | **"`make py_format` (black + isort + pycln)"** | **`.agents` was WRONG** — corrected to **ruff** |

### ui-checkstyle
| Aspect | `.claude` copy | `.agents` copy | Merged / resolution |
|---|---|---|---|
| CI structure | "**three per-area jobs** `lint-src`/`lint-playwright`/`lint-core-components`" | same "**three per-area jobs**" | **BOTH WRONG** — corrected from CI |
| Commit policy | Step 4 "**Do NOT auto-commit**" | Step 3 "**commit … as its own `Fix UI checkstyle` commit** unless folding" | **contradiction** — resolved (see below) |
| Python out-of-scope | (not mentioned) | **"`make py_format` (black + isort + pycln)"** | **`.agents` was WRONG** — corrected to **ruff** |
| `--check` mode, tsc/eslint notes | present, fuller | shorter | **kept the fuller `.claude` version** |

### The three contradictions and how each was settled

1. **Python formatter (`make py_format`).** `.agents` copies (both) said **"black + isort + pycln"**.
   **Wrong.** `ingestion/Makefile:54-56` defines `py_format` as `ruff check --fix` + `ruff format`;
   `py-checkstyle.yml` runs `make py_format_check` (ruff). Merged text says **ruff**, with an explicit
   "not black/isort/pycln" note so the error can't creep back.

2. **UI CI structure ("three jobs").** Both `ui-checkstyle` copies claimed three per-area jobs named
   `lint-src`/`lint-playwright`/`lint-core-components`. **Wrong per `.github/workflows/ui-checkstyle.yml`:**
   there is **one `checkstyle` job** (behind `check-changes` + `authorize`) whose *steps* gate **six**
   checks — src lint, licence header, i18n sync, app-docs, playwright lint, core-components lint —
   summarized by the required `ui-checkstyle` status check. The merged skill now describes the real
   structure and keeps the (correct) local `organize-imports → eslint → prettier` sequence.

3. **Commit behavior (ui-checkstyle only — the two copies contradicted).** CI is **silent** on who
   commits, so this is not resolvable from CI. Resolved per the **user's stated preference** (recorded
   on this exact contradiction in `00-findings.md`: *"auto-commit should be ok unless agent is unsure"*):
   the merged policy is **permissive-with-guard** — *don't fold into an unrelated commit; if the user
   asked, follow their preference; otherwise, when confident the diff is a purely mechanical reformat you
   may commit it as its own `Fix <UI|Java> checkstyle` commit; if unsure it's purely mechanical, do not
   auto-commit — surface the diff and let the user decide.* For **consistency of the single source**, the
   same policy was applied to `java-checkstyle` (whose two copies had agreed on the stricter "only if
   asked"). This is the one place the merge relaxes an instruction beyond a pure contradiction-resolution;
   it is deliberate and follows the user's expressed preference.

---

## Task 2 — real SKILL.md files moved into `skills/`

Six skills lived as **real dirs** in `.claude/skills/` (source of truth in the wrong place); each is now
a real dir in `skills/`, with a `../../skills/<name>` symlink left behind:

- `java-checkstyle`, `ui-checkstyle` — **merged** content (Task 1), then symlinked from both `.claude`
  and `.agents`.
- `playwright`, `playwright-validation`, `ui-core-components`, `writing-playwright-tests` — **clean
  `git mv`** (history preserved; git recorded them as renames), then symlinked from `.claude`.

Each dir contained only `SKILL.md` (verified before moving), so nothing else needed to travel.

---

## Task 3 — the two missing symlinks (`pr-checklist`, `openmetadata-workflow`)

Git history of how the symlink set was built:
- `007a77e4ac` (#26836) added the first symlinks (agents, code-review, planning, systematic-debugging,
  tdd, test-enforcement, verification) **and** created `skills/openmetadata-workflow/SKILL.md` +
  `skills/hooks/hooks.json` in the same commit — but **no `openmetadata-workflow` symlink**.
- `ce5c335989` (#26320) and `64f4f63d3a` (#26323) added the connector-* and test-locally symlinks.
- `pr-checklist` was created later in `b837ade95a` (#27891) and **never symlinked**.

**Assessment:**
- **`pr-checklist`** — created after the symlink-adding commits and simply never linked. Looks like an
  **oversight**, not a decision. **Symlink added.**
- **`openmetadata-workflow`** — created *with* the symlinks but left unlinked. There is a **plausible
  deliberate reason**: its frontmatter is `name`+`description` only (no `user-invocable`), and it is a
  *meta-skill designed to be injected by the `SessionStart` hook* in `skills/hooks/hooks.json`, not
  invoked. **However**, that SessionStart auto-load only fires **when the plugin is installed** — so an
  in-repo contributor who hasn't installed the plugin got it **neither** way. **Symlink added** to close
  that gap (it now shows up as an available skill — confirmed in the live skill listing). Caveat: the
  symlink makes it *discoverable/invocable*; it does **not** restore *auto-load at session start* for
  non-plugin users — that would require adding the `SessionStart` hook to `.claude/settings.json`, a
  hooks change deliberately **not** made here (flagged under Task 5).

---

## Task 4 — pointing `.agents/skills/` at the same source

`.agents/skills/{java-checkstyle,ui-checkstyle}` are now relative symlinks `../../skills/<name>` (same
depth and style as `.claude/skills/`), so a consumer opening `.agents/skills/java-checkstyle/SKILL.md`
transparently reads the merged `skills/java-checkstyle/SKILL.md`. The old **diverged** `.agents` copies
were deleted.

**Whether symlinks are honoured there:** at the filesystem level any tool that `open()`s the path
resolves the symlink transparently, so a Codex agent reading the file gets the merged content. I could
**not empirically verify** the Codex runtime that reads `.agents/` (no such environment here), so this is
a caveat, not a guarantee. **If** a specific consumer does not follow symlinks (e.g. it materializes only
tracked *regular* files from a git archive, or a sandbox that strips links), the fallback is a
**sync step** — a pre-commit hook or CI job that copies `skills/{java,ui}-checkstyle/SKILL.md` into
`.agents/skills/…` — which reintroduces duplication and therefore needs the copy to be generated, never
hand-edited (source stays `skills/`). Symlink is preferred unless Codex is shown not to support it.
`AGENTS.md:200,216` still reference `.agents/skills/{java,ui}-checkstyle/SKILL.md`; those paths still
resolve (through the symlink), so no doc edit was needed.

---

## Task 5 — `skills/hooks/hooks.json` vs `.claude/settings.json`

**What each contains:**

| | `.claude/settings.json` (project settings) | `skills/hooks/hooks.json` (plugin hooks) |
|---|---|---|
| SessionStart | — | **`cat openmetadata-workflow/SKILL.md`** |
| PreToolUse(Bash) | `--no-verify` block **+ antd-import block** | `--no-verify` block only |
| PostToolUse | 10 advisory: java-spotless, `make generate`, `yarn parse-schema`, `any`-type, `console`, i18n (Edit×6) + java-spotless, antd-write, licence, `console` (Write×4) | 2: java-spotless reminder, `make generate` reminder (matcher `Edit|Write`) |

**Conflicts / divergence:**
- The `make generate` reminder text **differs**: settings.json — *"Remember to run `make generate` to
  regenerate Pydantic models and rebuild dependent modules."* vs hooks.json — *"Run `make generate` to
  regenerate models."* (If both are active, both fire; identical handlers dedupe, divergent wording does
  not.)
- settings.json is a **superset** of the shared hooks (it adds the antd block and 8 more PostToolUse
  reminders); hooks.json adds the **SessionStart** loader that settings.json lacks.
- No hard *contradiction* (no hook tells the agent the opposite of another) — the difference is coverage
  and wording.

**Which actually takes effect for an in-repo session:**
- **`.claude/settings.json` always applies.** It is committed and, on current Claude Code, resolves to
  the **git repo root**, so every in-repo session loads its 12 hooks regardless of launch subdirectory
  (see `07-settings-scope.md`).
- **`skills/hooks/hooks.json` applies only when the `openmetadata-skills` plugin is installed** (it is
  the plugin's hook file, referenced by `skills/.claude-plugin/plugin.json` `"hooks"`). A contributor who
  merely has the repo checked out, without installing the plugin, does **not** get the SessionStart
  auto-load of `openmetadata-workflow`, nor the plugin's copies of the spotless/generate reminders — they
  get only the settings.json hooks.
- **When both are active** (plugin installed + repo checked out), hooks from both merge and run; identical
  handlers dedupe, so the practical overlap is the duplicated `--no-verify` block and the java-spotless
  reminder, plus a possible double `make generate` reminder due to the wording difference.

**Not changed** (per constraints — Task 5 is report-only): the two hook files were left as-is. The one
gap worth the maintainers' attention is that the **SessionStart auto-load lives only in the plugin**, so
the "workflow skill auto-loads" promise doesn't hold for non-plugin in-repo users even after the symlink
was added.

---

## Verification — the plugin still resolves

1. **`plugin.json` parses** and does **not enumerate skills** (auto-discovery) —
   `python3 -c "json.load(open('skills/.claude-plugin/plugin.json'))"` → valid; `hooks: ./hooks/hooks.json`.
2. **All 19 `skills/*/SKILL.md` have `name:` frontmatter** (0 missing); the 6 moved dirs are real dirs
   with `SKILL.md`, not stray symlinks.
3. **All 20 `.claude/skills/*` and both `.agents/skills/*` symlinks resolve** (`test -e` on each → OK; no
   broken links); index records them as mode `120000`.
4. **Internal `skills/` symlinks still resolve** — `connector-{standards,building,review}` and
   `test-locally` → `../standards` all OK.
5. **Live confirmation:** after the moves, the Claude Code skill listing surfaced `java-checkstyle`,
   `ui-checkstyle`, `openmetadata-workflow`, and `pr-checklist` as available skills — i.e. the harness
   discovered the merged + newly-symlinked skills through `skills/`.

## Not done (by constraint)
- No commit/push (staged only).
- No substance changes to any skill except the two checkstyle merges.
- No hook-file edits (Task 5 is a report).
