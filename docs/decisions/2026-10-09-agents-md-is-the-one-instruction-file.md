# AGENTS.md is the one agent instruction file, and every other harness file is a symlink to it

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `scripts/harness/check_harness.py` checks 2 (agents-sync) and 3 (skill-symlinks), warnings
  like every harness check; reviewer
- **Related:** #30539 (whose direction this reverses), #34950;
  ADR:ai-platform/2026-10-08-agents-md-is-the-only-instruction-file

## Context

#30539 made `CLAUDE.md` the instruction file and `AGENTS.md` a symlink to it. Three sources stayed
outside that link: `openmetadata-ui-core-components/CLAUDE.md`, which Codex never read; a 27 KB
`.github/copilot-instructions.md` — a 2025 generated persona plus rules that contradicted the code
(prefer MUI, `.component.tsx` naming); and `.agents/skills`, which linked 8 of the 24 skills, while
`.claude/skills` lacked `dev-setup` because `.gitignore` ignores `.claude`. The `.claude/rules` index
had also lost `frontend-permissions.md`.

The harnesses fix how one file can be shared:

- Codex reads `AGENTS.md`, never `CLAUDE.md`, and has no import mechanism, so its file must hold the
  text. It reads at most `project_doc_max_bytes` (32,768 by default) summed over every `AGENTS.md`
  from the repository root down to its working directory, and drops the rest with a warning only in
  its own log.
- Claude Code reads `CLAUDE.md`. It treats an `@AGENTS.md` import that resolves outside the
  directory a session starts in as external and drops it until someone approves it interactively:
  `claude -p` 2.1.293 started in a subdirectory loaded neither file through imports and both
  through symlinks.
- Codex finds skills only under `.agents/skills`, Claude Code only under `.claude/skills`.

## Decision

1. **`AGENTS.md` holds the guidance.** Every `CLAUDE.md`, root or nested, and
   `.github/copilot-instructions.md` is a symlink to the `AGENTS.md` beside it — never a copy, never
   an `@AGENTS.md` import. No other harness keeps a file of its own (`GEMINI.md`, `.cursorrules`,
   `.cursor/rules/*`).
2. **A skill lives once, in `skills/`** (third-party ones in `skills/vendor/`), and both
   `.claude/skills/<name>` and `.agents/skills/<name>` link to it.
3. **Every `.claude/rules/*.md` is named in the `AGENTS.md` index.** Claude Code loads rules by path;
   the index is how every other harness finds them.
4. **The `AGENTS.md` files on any root-to-leaf path stay within 32,768 bytes**, unless
   `.codex/config.toml` sets another `project_doc_max_bytes`.

Rejected: `CLAUDE.md` as the source (#30539's direction) — `AGENTS.md` is the name Codex, Cursor and
Copilot's agent look for, and Codex needs the text there; deleting `copilot-instructions.md` —
Copilot code review reads only that path.

## Consequences

- One edit reaches every harness, and nothing asks anyone to keep two files in step.
- Whether Copilot code review follows the symlink is undocumented. If it does not, it runs without
  custom instructions instead of the old file.
- A Windows checkout without `core.symlinks` gets every link as a one-line text file.
- A new link under `.claude/` needs `git add -f`; the skill check catches one left untracked, because
  CI sees only tracked files.
- Revisit if Codex gains imports, or Claude Code stops treating a parent-directory import as external.
