#!/usr/bin/env python3
"""Render the Claude security-review JSON report as Markdown + a Slack summary.

Reads the JSON that the Claude Security Review workflow asks the model to write
(security-review-report.json). Deliberately mirrors the surface of
scripts/snyk_summary.py and scripts/retire_slack_summary.py so the three
security reports (Snyk SCA, Retire.js SCA, Claude SAST) look uniform in Slack
and the job summary.

Usage:
  python3 scripts/claude_security_summary.py <report.json> \\
      [--counts-file PATH] [--slack-file PATH] [--top N]
"""
import argparse
import json
import os
import sys

SEV_ICON = {"critical": "🚨", "high": "🔴", "medium": "🟠", "low": "🟡"}
SEV_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}
ECO_LABEL = {"ui": "UI", "python": "Python", "java": "Java"}


def esc(s):
    return str(s).replace("|", "\\|").replace("`", "'").replace("\n", " ")


def sev_key(s):
    return SEV_RANK.get((s or "low").lower(), 3)


def norm_findings(data):
    """Pull the findings list out of the report, tolerating a bare list and
    missing/garbage fields — the report is model-written, so nothing is trusted."""
    if isinstance(data, list):
        raw = data
    elif isinstance(data, dict):
        raw = data.get("findings") or []
    else:
        raw = []
    out = []
    for f in raw:
        if not isinstance(f, dict):
            continue
        sev = (f.get("severity") or "low").lower()
        if sev not in SEV_RANK:
            sev = "low"
        out.append({
            "severity": sev,
            "category": f.get("category") or "—",
            "ecosystem": (f.get("ecosystem") or "").lower(),
            "title": f.get("title") or f.get("description") or "(no title)",
            "file": f.get("file") or "—",
            "line": f.get("line"),
            "remediation": f.get("remediation") or "",
        })
    return out


def count_severities(findings):
    """Recompute counts from the findings themselves — never trust the model's
    own `counts` block. A miscount here would under-report criticals."""
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in findings:
        counts[f["severity"]] += 1
    return counts


def loc(f):
    return f"{f['file']}:{f['line']}" if f["line"] else f["file"]


def cat_label(f):
    eco = ECO_LABEL.get(f["ecosystem"], "")
    return f"{eco} · {f['category']}" if eco else f["category"]


def tally_line(counts):
    return (
        f"{SEV_ICON['critical']} {counts['critical']} critical  ·  "
        f"{SEV_ICON['high']} {counts['high']} high  ·  "
        f"{SEV_ICON['medium']} {counts['medium']} medium  ·  "
        f"{SEV_ICON['low']} {counts['low']} low"
    )


def render_md(findings, counts, summary):
    out = ["## 🛡️ Claude Security Review (SAST)\n"]
    if summary:
        out.append(f"> {esc(summary)}\n")
    if not findings:
        out.append("✅ No security issues found in the reviewed code.\n")
        return "\n".join(out)
    out.append(f"> **{tally_line(counts)}**\n")
    out.append("| Sev | Category | Where | Issue | Fix |")
    out.append("|---|---|---|---|---|")
    for f in sorted(findings, key=lambda x: sev_key(x["severity"])):
        icon = SEV_ICON.get(f["severity"], "⚪")
        out.append(
            f"| {icon} {f['severity']} | {esc(cat_label(f))} | `{esc(loc(f))}` | "
            f"{esc(f['title'])} | {esc(f['remediation'][:120])} |"
        )
    out.append("")
    return "\n".join(out)


def render_slack(findings, counts, top):
    header = f"*🛡️ Claude Security Review (SAST)*\n{tally_line(counts)}"
    if not findings:
        return f"{header}\n> ✅ No security issues found in the reviewed code."
    rows = []
    for f in sorted(findings, key=lambda x: sev_key(x["severity"]))[:top]:
        icon = SEV_ICON.get(f["severity"], "⚪")
        eco = ECO_LABEL.get(f["ecosystem"], "")
        tag = f"[{eco}] " if eco else ""
        rows.append(f"  {icon} {tag}{f['title']} — `{loc(f)}`")
    extra = len(findings) - top
    if extra > 0:
        rows.append(f"  … +{extra} more (see Job Summary)")
    body = header + "\n" + "\n".join(rows)
    # Slack section-block text caps at 3000 chars; cut on a newline so a mrkdwn
    # link or emoji sequence is never split mid-token.
    if len(body) > 2800:
        cut = body.rfind("\n", 0, 2750)
        body = body[:cut if cut > 0 else 2750].rstrip() + "\n…truncated. See Job Summary."
    return body


def write_outputs(counts, slack_body, args):
    if args.counts_file:
        with open(args.counts_file, "w") as f:
            json.dump({**counts, "total": sum(counts.values())}, f)
    if args.slack_file:
        with open(args.slack_file, "w") as f:
            f.write(slack_body)


def emit(md, counts, slack_body, args):
    sys.stdout.write(md if md.endswith("\n") else md + "\n")
    write_outputs(counts, slack_body, args)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?", default="security-review-report.json")
    ap.add_argument("--counts-file")
    ap.add_argument("--slack-file")
    ap.add_argument("--top", type=int, default=8)
    args = ap.parse_args()

    empty = {"critical": 0, "high": 0, "medium": 0, "low": 0}

    if not os.path.exists(args.src):
        # No machine-readable report. Say so loudly — a missing report must never
        # read as a clean scan.
        md = (
            "## 🛡️ Claude Security Review (SAST)\n\n"
            f"> ⚠️ No report file at `{args.src}` — the review produced no "
            "machine-readable result. Check the run log and any PR comments; "
            "**do not treat this as a clean scan.**\n"
        )
        emit(md, empty, "*🛡️ Claude Security Review (SAST)*\n> ⚠️ No report produced — see run log.", args)
        return

    try:
        with open(args.src) as f:
            data = json.load(f)
    except Exception as e:  # noqa: BLE001 — any parse failure is reported, not raised
        md = f"## 🛡️ Claude Security Review (SAST)\n\n> ⚠️ Failed to parse `{args.src}`: {esc(e)}\n"
        emit(md, empty, f"*🛡️ Claude Security Review (SAST)*\n> ⚠️ Parse error: {esc(e)}", args)
        return

    findings = norm_findings(data)
    counts = count_severities(findings)
    summary = data.get("summary") if isinstance(data, dict) else None
    emit(render_md(findings, counts, summary), counts, render_slack(findings, counts, args.top), args)


if __name__ == "__main__":
    main()
