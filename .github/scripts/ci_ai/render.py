"""The advisory section appended to the dequeue comment.

One section, one title, whether or not the model contributed: the deterministic part
(the same-run verification table and the repro commands) is always there, and the AI
part is added only when the call succeeded and survived post-processing. Every string
that did not come from this repository's code is escaped here: test names render as
code spans, model prose as inert text.
"""

from __future__ import annotations

from ci_ai import bundle as bundle_mod
from ci_ai import model as model_mod
from ci_ai import repro as repro_mod
from ci_ai import sanitize

MARKER = "<!-- ci-ai-explain -->"
TITLE = "### 🤖 Advisory explanation — does not affect merging"
CI_FIX_HINT = "To ask for an AI fix attempt, comment `/ci-fix` on this PR. A person still re-queues it after reviewing the fix."
VERDICT_TEXT = {
    "pr_caused": "caused by this PR",
    "entry_ahead": "caused by a PR ahead of this one in the queue, or by its interaction with this PR",
    "main_or_flaky": "unrelated to this PR: broken on main or flaky",
    "infra": "infrastructure",
    "unknown": "unclear from the evidence",
}
NEXT_STEP_TEXT = {
    "fix_then_requeue": "fix the failure, then re-queue.",
    "requeue_unchanged": "re-queue unchanged.",
    "wait_for_main": "wait for main to be fixed, then re-queue.",
    "ask_maintainer": "ask a maintainer to look at the evidence.",
}
CONTRADICTION = (
    "Note: the same-run re-runs reproduced the failure on this entry and not on its parent, "
    "so re-queueing without a change will most likely eject again."
)


def contradicts_evidence(tests: list[bundle_mod.BlockingTest], explanation: model_mod.Explanation) -> bool:
    introduced = any(test.gate_class == "introduced" for test in tests)
    return introduced and (explanation.verdict in ("main_or_flaky", "infra") or explanation.next_step == "requeue_unchanged")


def ai_part(explanation: model_mod.Explanation, tests: list[bundle_mod.BlockingTest], ahead: frozenset[str]) -> list[str]:
    lines = [
        f"**AI reading:** {VERDICT_TEXT[explanation.verdict]} ({explanation.confidence} confidence)",
        "",
        "> " + sanitize.markdown_text(explanation.explanation),
    ]
    if explanation.culprit_files:
        lines += ["", "**Files to look at**"]
        for path, why in explanation.culprit_files:
            owner = " (changed by a PR ahead)" if path in ahead else ""
            reason = f": {sanitize.markdown_text(why)}" if why else ""
            lines.append(f"- {sanitize.code_span(path, max_chars=300)}{owner}{reason}")
    lines += ["", f"**Suggested next step:** {NEXT_STEP_TEXT[explanation.next_step]}"]
    if contradicts_evidence(tests, explanation):
        lines += ["", CONTRADICTION]
    return lines


def verification_table(bundle: bundle_mod.Bundle) -> list[str]:
    if not bundle.tests:
        return []
    lines = ["**Same-run verification**", "", "| Test | Gate class | Entry re-runs | Parent re-runs |", "|---|---|---|---|"]
    for test in bundle.tests:
        lines.append(
            f"| {sanitize.code_span(test.test_id, table=True)} | {test.gate_class or 'unclassified'} "
            f"| {test.entry or 'not run'} | {test.parent or 'not run'} |"
        )
    if bundle.blocking_count > len(bundle.tests):
        lines += ["", f"… and {bundle.blocking_count - len(bundle.tests)} more blocking test(s)."]
    return lines


def repro_part(repros: list[repro_mod.Repro]) -> list[str]:
    if not repros:
        return []
    lines = ["**Reproduce locally** (commands from the repository's test planners, never from the model)"]
    for item in repros:
        note = f": {item.note}" if item.note else ""
        lines += ["", f"{sanitize.code_span(item.test_id, max_chars=300)}{note}"]
        if item.commands:
            lines.append(sanitize.code_block("\n".join(item.commands), "bash"))
    return lines


def blocking_jobs(decision_doc: dict) -> list[str]:
    decision = bundle_mod.as_dict(decision_doc.get("decision"))
    jobs = [item.get("job") for item in bundle_mod.as_list(decision.get("blocking")) if isinstance(item, dict) and item.get("job") and not item.get("test")]
    if not jobs:
        return []
    return ["**Blocking jobs without test evidence:** " + ", ".join(sanitize.code_span(job) for job in jobs[:10])]


def render_section(
    decision_doc: dict,
    bundle: bundle_mod.Bundle,
    repros: list[repro_mod.Repro],
    explanation: model_mod.Explanation | None,
    *,
    note: str = "",
    model: str = "",
    effort: str = "",
    cached: bool = False,
    ci_fix: bool = True,
) -> str:
    """The comment section. With an explanation it carries the AI reading; without one,
    only the deterministic evidence plus `note` saying why. The /ci-fix hint follows the
    AI verdict when there is one, else the same-run evidence; `ci_fix=False` (the AI
    layer is switched off) drops it."""
    blocks: list[list[str]] = []
    if explanation is not None:
        blocks.append(ai_part(explanation, bundle.tests, bundle.ahead_paths))
    elif note:
        blocks.append([f"_{note}_"])
    blocks += [verification_table(bundle), blocking_jobs(decision_doc), repro_part(repros)]
    pr_caused = explanation.verdict == "pr_caused" if explanation is not None else any(t.gate_class == "introduced" for t in bundle.tests)
    if ci_fix and pr_caused:
        blocks.append([CI_FIX_HINT])
    if explanation is not None:
        reused = " Reused from an earlier explanation of the same failure." if cached else ""
        footer = (
            f"Written by {sanitize.code_span(model)} (effort {sanitize.code_span(effort)}) from this run's evidence.{reused} "
            "The merge gate decided from same-run re-runs; this note is advisory and cannot change that."
        )
    else:
        footer = "The merge gate decided from same-run re-runs; this section is advisory."
    blocks.append([f"<sub>{footer}</sub>"])
    body = "\n\n".join("\n".join(block) for block in blocks if block)
    return f"{MARKER}\n{TITLE}\n\n{body}\n"
