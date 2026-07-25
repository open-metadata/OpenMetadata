#!/usr/bin/env python3
"""Generate AGENTS.md as a mirror of CLAUDE.md.

CLAUDE.md is the single source of truth for agent guidance. AGENTS.md (read by Codex
and other agents) is derived from it, so the two can never drift: edit CLAUDE.md, then
run ``make sync-agents-md``. The harness-integrity check (check 2) warns on any PR where
AGENTS.md is not exactly ``render(CLAUDE.md)``.

Deterministic (no timestamps) so ``git diff`` stays empty until CLAUDE.md changes.
"""

import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", ".."))
CLAUDE_PATH = os.path.join(REPO, "CLAUDE.md")
AGENTS_PATH = os.path.join(REPO, "AGENTS.md")

BANNER = "<!-- GENERATED FILE — DO NOT EDIT. Mirrors CLAUDE.md; run `make sync-agents-md`. -->"

HEADER = """# AGENTS.md

> **This file mirrors [CLAUDE.md](CLAUDE.md)** so Codex and other agents get exactly the
> same guidance as Claude Code. It is generated from CLAUDE.md — do not edit AGENTS.md
> directly; edit CLAUDE.md and run `make sync-agents-md`."""


def render(claude_text):
    """AGENTS.md content derived from CLAUDE.md text (drop CLAUDE.md's H1, prepend the mirror header)."""
    lines = claude_text.splitlines()
    if lines and lines[0].strip() == "# CLAUDE.md":
        lines = lines[1:]
        while lines and lines[0].strip() == "":
            lines = lines[1:]
    body = "\n".join(lines).rstrip("\n")
    return f"{BANNER}\n\n{HEADER}\n\n{body}\n"


def main():
    with open(CLAUDE_PATH, encoding="utf-8") as handle:
        output = render(handle.read())
    with open(AGENTS_PATH, "w", encoding="utf-8") as handle:
        handle.write(output)
    print(f"wrote AGENTS.md ({len(output.splitlines())} lines) from CLAUDE.md")


if __name__ == "__main__":
    main()
