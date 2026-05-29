#!/usr/bin/env python3
"""Render a Retire.js JSON report as Markdown + Slack-friendly summary.

Usage:
  python3 scripts/retire_slack_summary.py <retire-report.json | dir> \\
      [--counts-file PATH] [--slack-file PATH] [--top N]

Mirrors the surface of scripts/snyk_summary.py so the notify job can
consume `_retire_counts.json` and `_retire_slack.txt` identically.
"""
import argparse
import json
import os
import sys

SEV_ICON = {"critical": "🚨", "high": "🔴", "medium": "🟠", "low": "🟡"}
SEV_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}
NM = "node_modules/"


def esc(s):
    return str(s).replace("|", "\\|").replace("`", "'").replace("\n", " ")


def sev_key(s):
    return SEV_RANK.get((s or "low").lower(), 3)


def resolve_report_path(src):
    if os.path.isdir(src):
        return os.path.join(src, "retire-report.json")
    return src


def short_path(filepath):
    if NM in filepath:
        return filepath[filepath.find(NM) + len(NM):]
    return filepath


def vuln_id(vuln):
    """Stable identifier for dedup across files."""
    ids = vuln.get("identifiers") or {}
    return json.dumps(ids, sort_keys=True)


def vuln_title(vuln):
    ids = vuln.get("identifiers") or {}
    cves = ids.get("CVE") or []
    if cves:
        return cves[0]
    ghsa = ids.get("githubID")
    if ghsa:
        return ghsa
    summary = ids.get("summary") or ""
    return summary.split("\n")[0][:60] or "—"


def vuln_summary(vuln):
    ids = vuln.get("identifiers") or {}
    summary = ids.get("summary") or ""
    return summary.split("\n")[0][:80]


def vuln_fix(vuln):
    """Retire.js encodes fix as `below: <first-fixed-version>`."""
    below = vuln.get("below")
    if below:
        return str(below)
    return "no fix"


def collect_libs(data):
    """Aggregate vulnerabilities per (component, version), deduped."""
    libs = {}
    findings = data.get("data") or []
    for item in findings:
        filepath = item.get("file", "")
        short = short_path(filepath)
        for result in item.get("results") or []:
            key = (result.get("component", "?"), result.get("version", "?"))
            entry = libs.setdefault(key, {
                "files": [],
                "vulns": [],
                "seen": set(),
            })
            if short and short not in entry["files"]:
                entry["files"].append(short)
            for v in result.get("vulnerabilities") or []:
                vid = vuln_id(v)
                if vid in entry["seen"]:
                    continue
                entry["seen"].add(vid)
                entry["vulns"].append(v)
    return libs


def lib_top_severity(info):
    if not info["vulns"]:
        return "low"
    return min(
        (v.get("severity", "low") for v in info["vulns"]),
        key=sev_key,
    )


def count_severities(libs):
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for info in libs.values():
        for v in info["vulns"]:
            sev = (v.get("severity") or "low").lower()
            if sev in counts:
                counts[sev] += 1
    return counts


def render_md(libs):
    out = ["## 🛡️ Vulnerability JS Scan\n"]
    if not libs:
        out.append("✅ No vulnerable libraries found.\n")
        return "\n".join(out)
    total_vulns = sum(len(info["vulns"]) for info in libs.values())
    out.append(
        f"> **{len(libs)} vulnerable librar"
        f"{'y' if len(libs) == 1 else 'ies'} · {total_vulns} "
        f"CVE{'s' if total_vulns != 1 else ''} found**\n"
    )
    ordered = sorted(libs.items(), key=lambda kv: sev_key(lib_top_severity(kv[1])))
    for (component, version), info in ordered:
        top_icon = SEV_ICON.get(lib_top_severity(info), "⚪")
        out.append(f"### {top_icon} {component} {version}\n")
        out.append("| Severity | CVE | Summary | Fix |")
        out.append("|---|---|---|---|")
        for v in sorted(info["vulns"], key=lambda x: sev_key(x.get("severity"))):
            sev = v.get("severity", "")
            icon = SEV_ICON.get(sev, "⚪")
            ids = v.get("identifiers") or {}
            cves = ids.get("CVE") or []
            if cves:
                cve_str = ", ".join(
                    f"[{c}](https://nvd.nist.gov/vuln/detail/{c})" for c in cves
                )
            else:
                cve_str = ids.get("githubID") or "—"
            summary = vuln_summary(v) or "—"
            fix = vuln_fix(v)
            out.append(
                f"| {icon} {sev} | {esc(cve_str)} | {esc(summary)} | {esc(fix)} |"
            )
        if info["files"]:
            out.append("\n**Bundled in:**")
            for f in info["files"]:
                out.append(f"- `{f}`")
        out.append("")
    return "\n".join(out)


def render_lib_slack(component, version, info, top):
    head = f"📦 *{component}@{version}* — {len(info['vulns'])} CVE{'s' if len(info['vulns']) != 1 else ''}"
    rows = []
    ordered = sorted(info["vulns"], key=lambda v: sev_key(v.get("severity")))
    for v in ordered[:top]:
        icon = SEV_ICON.get(v.get("severity", "low"), "⚪")
        title = vuln_title(v)
        fix = vuln_fix(v)
        fix_label = "no fix" if fix == "no fix" else f"fix in {fix}"
        rows.append(f"  {icon} {title} · {fix_label}")
    extra = len(info["vulns"]) - top
    if extra > 0:
        rows.append(f"  … +{extra} more")
    return head + "\n" + "\n".join(rows) if rows else head


def render_slack(libs, totals, top):
    header = (
        f"*🛡️ Vulnerability JS Scan*\n"
        f"🚨 {totals['critical']} critical  ·  🔴 {totals['high']} high  ·  "
        f"🟠 {totals['medium']} medium  ·  🟡 {totals['low']} low"
    )
    if not libs:
        return f"{header}\n> ✅ No vulnerable libraries found."
    ordered = sorted(libs.items(), key=lambda kv: sev_key(lib_top_severity(kv[1])))
    sections = [
        render_lib_slack(component, version, info, top)
        for (component, version), info in ordered
    ]
    body = "\n\n".join([header] + sections)
    if len(body) > 2800:
        cut = body.rfind("\n", 0, 2750)
        if cut < 0:
            cut = 2750
        body = body[:cut].rstrip() + "\n…truncated. See Job Summary for full report."
    return body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?", default="retire-report.json")
    ap.add_argument("--counts-file")
    ap.add_argument("--slack-file")
    ap.add_argument("--top", type=int, default=5)
    args = ap.parse_args()

    path = resolve_report_path(args.src)
    totals = {"critical": 0, "high": 0, "medium": 0, "low": 0}

    if not os.path.exists(path):
        md = f"## 🛡️ Vulnerability JS Scan\n\n> Report file not found at `{path}`.\n"
        sys.stdout.write(md)
        if args.counts_file:
            with open(args.counts_file, "w") as f:
                json.dump({**totals, "total": 0}, f)
        if args.slack_file:
            with open(args.slack_file, "w") as f:
                f.write("*🛡️ Vulnerability JS Scan*\n> Report file not found.")
        return

    try:
        with open(path) as f:
            data = json.load(f)
    except Exception as e:
        md = f"## 🛡️ Vulnerability JS Scan\n\n> Failed to parse `{path}`: {e}\n"
        sys.stdout.write(md)
        if args.counts_file:
            with open(args.counts_file, "w") as f:
                json.dump({**totals, "total": 0}, f)
        if args.slack_file:
            with open(args.slack_file, "w") as f:
                f.write(f"*🛡️ Vulnerability JS Scan*\n> Parse error: {e}")
        return

    libs = collect_libs(data)
    totals.update(count_severities(libs))

    sys.stdout.write(render_md(libs) + "\n")

    if args.counts_file:
        with open(args.counts_file, "w") as f:
            json.dump({**totals, "total": sum(totals.values())}, f)

    if args.slack_file:
        with open(args.slack_file, "w") as f:
            f.write(render_slack(libs, totals, args.top))


if __name__ == "__main__":
    main()
