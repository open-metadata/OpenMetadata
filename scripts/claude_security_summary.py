#!/usr/bin/env python3
"""Render Claude security-review JSON report(s) as Markdown + a Slack summary.

Accepts a single report file or a directory of them (the nightly sweep fans out
across slices, each producing its own report). Findings are merged and deduped;
severity totals are always recomputed here rather than trusted from the model.

The coverage table is the point of this script as much as the findings: a slice
that crashed, or an agent that ran out of budget mid-scope, must show up as a
visible gap. A merged report that silently omits a failed slice would read as
"clean" and is exactly how a vulnerability gets missed.

Usage:
  python3 scripts/claude_security_summary.py <report.json | dir> \\
      [--counts-file PATH] [--slack-file PATH] [--top N] [--expect a,b,c]
"""
import argparse
import glob
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


def report_paths(src):
    """A file, or every *.json under a directory tree. Files starting with `_`
    are this script's own outputs and are never re-ingested."""
    if os.path.isfile(src):
        return [src]
    if os.path.isdir(src):
        found = glob.glob(os.path.join(src, "**", "*.json"), recursive=True)
        return sorted(p for p in found if not os.path.basename(p).startswith("_"))
    return []


def scope_of(data, path):
    """Slice name: the model's own coverage.scope, else the artifact dir name."""
    if isinstance(data, dict):
        cov = data.get("coverage")
        if isinstance(cov, dict) and cov.get("scope"):
            return str(cov["scope"])
        if data.get("scope"):
            return str(data["scope"])
    parent = os.path.basename(os.path.dirname(path))
    return parent or os.path.basename(path)


def norm_findings(data, scope):
    """Pull findings out of a report, tolerating a bare list and junk entries —
    the report is model-written, so nothing in it is trusted."""
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
        line = f.get("line")
        if not isinstance(line, int):
            try:
                line = int(str(line))
            except (TypeError, ValueError):
                line = None
        out.append({
            "severity": sev,
            "category": f.get("category") or "—",
            "ecosystem": (f.get("ecosystem") or "").lower(),
            "title": f.get("title") or f.get("description") or "(no title)",
            "file": f.get("file") or "—",
            "line": line,
            "remediation": f.get("remediation") or "",
            "scope": scope,
        })
    return out


def dedupe(findings):
    """Same defect reported by two slices (overlapping scopes) collapses to one."""
    seen, out = set(), []
    for f in findings:
        key = (f["file"].lower(), f["line"], f["category"].lower(), f["title"].lower()[:60])
        if key in seen:
            continue
        seen.add(key)
        out.append(f)
    return out


def coverage_of(data, scope, parse_error=None):
    if parse_error:
        return {"scope": scope, "state": "error", "files": None, "notes": f"unreadable report: {parse_error}"}
    cov = data.get("coverage") if isinstance(data, dict) else None
    if not isinstance(cov, dict):
        # No coverage block. Findings are still usable, but completeness is unknown
        # and must not be presented as complete.
        return {"scope": scope, "state": "unknown", "files": None, "notes": "no coverage block in report"}
    complete = cov.get("complete")
    files = cov.get("files_reviewed")
    return {
        "scope": scope,
        "state": "complete" if complete is True else ("partial" if complete is False else "unknown"),
        "files": files if isinstance(files, int) else None,
        "notes": str(cov.get("notes") or ""),
    }


COV_ICON = {"complete": "✅", "partial": "⚠️", "unknown": "❔", "error": "❌", "missing": "❌"}


def count_severities(findings):
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


def gaps(coverage):
    return [c for c in coverage if c["state"] in ("partial", "unknown", "error", "missing")]


def render_md(findings, counts, coverage, summaries):
    out = ["## 🛡️ Claude Security Review (SAST)\n"]
    bad = gaps(coverage)
    if bad:
        out.append(
            f"> ⚠️ **Coverage is incomplete — {len(bad)} of {len(coverage)} slice(s) did not "
            "fully report. Findings below are NOT a clean bill of health for those areas.**\n"
        )
    out.append(f"> **{tally_line(counts)}** · {len(findings)} finding{'s' if len(findings) != 1 else ''}\n")

    if coverage:
        out.append("### Coverage\n")
        out.append("| Slice | Status | Files reviewed | Notes |")
        out.append("|---|---|---|---|")
        for c in sorted(coverage, key=lambda x: (x["state"] == "complete", x["scope"])):
            out.append(
                f"| `{esc(c['scope'])}` | {COV_ICON.get(c['state'], '❔')} {c['state']} | "
                f"{c['files'] if c['files'] is not None else '—'} | {esc(c['notes'][:100]) or '—'} |"
            )
        out.append("")

    out.append("### Findings\n")
    if not findings:
        out.append(
            "✅ No security issues found in the reviewed code."
            + (" (See coverage gaps above.)" if bad else "")
            + "\n"
        )
    else:
        out.append("| Sev | Category | Where | Issue | Fix | Slice |")
        out.append("|---|---|---|---|---|---|")
        for f in sorted(findings, key=lambda x: sev_key(x["severity"])):
            icon = SEV_ICON.get(f["severity"], "⚪")
            out.append(
                f"| {icon} {f['severity']} | {esc(cat_label(f))} | `{esc(loc(f))}` | "
                f"{esc(f['title'])} | {esc(f['remediation'][:120])} | `{esc(f['scope'])}` |"
            )
        out.append("")

    notes = [s for s in summaries if s]
    if notes:
        out.append("<details><summary>Per-slice summaries</summary>\n")
        for scope, text in notes:
            out.append(f"- **`{esc(scope)}`** — {esc(text)}")
        out.append("\n</details>\n")
    return "\n".join(out)


def render_slack(findings, counts, coverage, top):
    lines = [f"*🛡️ Claude Security Review (SAST)*", tally_line(counts)]
    bad = gaps(coverage)
    if bad:
        lines.append(
            f"⚠️ *Coverage incomplete:* {len(bad)}/{len(coverage)} slice(s) did not fully report "
            f"({', '.join(c['scope'] for c in bad[:5])}) — not a clean bill of health."
        )
    if not findings:
        lines.append("> ✅ No security issues found in the reviewed code.")
        return "\n".join(lines)
    for f in sorted(findings, key=lambda x: sev_key(x["severity"]))[:top]:
        icon = SEV_ICON.get(f["severity"], "⚪")
        eco = ECO_LABEL.get(f["ecosystem"], "")
        tag = f"[{eco}] " if eco else ""
        lines.append(f"  {icon} {tag}{f['title']} — `{loc(f)}`")
    extra = len(findings) - top
    if extra > 0:
        lines.append(f"  … +{extra} more (see Job Summary)")
    body = "\n".join(lines)
    # Slack section-block text caps at 3000 chars; cut on a newline so a mrkdwn
    # link or emoji sequence is never split mid-token.
    if len(body) > 2800:
        cut = body.rfind("\n", 0, 2750)
        body = body[:cut if cut > 0 else 2750].rstrip() + "\n…truncated. See Job Summary."
    return body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?", default="security-review-report.json")
    ap.add_argument("--counts-file")
    ap.add_argument("--slack-file")
    ap.add_argument("--top", type=int, default=8)
    ap.add_argument("--expect", default="",
                    help="comma-separated slice names that MUST have reported; "
                         "any missing one is rendered as a hard coverage gap")
    args = ap.parse_args()

    paths = report_paths(args.src)
    findings, coverage, summaries = [], [], []

    for path in paths:
        try:
            with open(path) as fh:
                data = json.load(fh)
        except Exception as e:  # noqa: BLE001 — a bad report is reported, never raised
            scope = os.path.basename(os.path.dirname(path)) or path
            coverage.append(coverage_of(None, scope, parse_error=str(e)))
            continue
        scope = scope_of(data, path)
        findings.extend(norm_findings(data, scope))
        coverage.append(coverage_of(data, scope))
        if isinstance(data, dict) and data.get("summary"):
            summaries.append((scope, str(data["summary"])))

    # Any expected slice that produced no report at all is a gap, not a silence.
    reported = {c["scope"] for c in coverage}
    for want in [s.strip() for s in args.expect.split(",") if s.strip()]:
        if want not in reported:
            coverage.append({"scope": want, "state": "missing", "files": None,
                             "notes": "no report produced — slice failed or was cancelled"})

    if not paths and not coverage:
        coverage.append({"scope": args.src, "state": "missing", "files": None,
                         "notes": "no report file found — review produced no machine-readable result"})

    findings = dedupe(findings)
    counts = count_severities(findings)
    md = render_md(findings, counts, coverage, summaries)
    slack = render_slack(findings, counts, coverage, args.top)

    sys.stdout.write(md if md.endswith("\n") else md + "\n")

    if args.counts_file:
        with open(args.counts_file, "w") as fh:
            json.dump({
                **counts,
                "total": sum(counts.values()),
                "slices_total": len(coverage),
                "slices_incomplete": len(gaps(coverage)),
            }, fh)
    if args.slack_file:
        with open(args.slack_file, "w") as fh:
            fh.write(slack)


if __name__ == "__main__":
    main()
