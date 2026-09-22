# Vendored third-party skills

Skills copied verbatim from external repositories, kept in-tree so every contributor and CI run has
them with no install or network step.

| Skill | Upstream | Licence |
|---|---|---|
| `react-best-practices` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | MIT |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | MIT |
| `composition-patterns` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | MIT |

Each directory carries a `VENDORED.md` recording the exact upstream commit, the vendor date, and the
licence. MIT permits redistribution inside this Apache-2.0 repository provided the attribution above
is retained.

## Do not edit these files

Local edits are silently lost the next time a skill is refreshed from upstream. Repo-specific
guidance belongs in `.claude/rules/*.md`, which auto-loads by path glob and takes precedence over
anything here.

## Why vendored, and what they are for

These are **authoring-time aids**: they inform an agent while it writes code. They are *not* the
gate. Enforcement is deterministic and lives in `ui-checkstyle` — see
[`docs/ui-code-quality-gate.md`](../../docs/ui-code-quality-gate.md). A skill only fires if an agent
reads it, and a human reviewing by hand never will, which is precisely why the checks that matter are
scripts rather than prose.

The load-bearing subset of this guidance is distilled into `.claude/rules/frontend-performance.md`
and `.claude/rules/frontend-a11y.md`, because rules auto-load on matching files while skills load
only when invoked.
