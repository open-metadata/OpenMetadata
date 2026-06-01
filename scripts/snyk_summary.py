#!/usr/bin/env python3
"""Render Snyk JSON reports as Markdown.

Usage:
  python3 scripts/snyk_summary.py [dir] \\
      [--counts-file PATH] [--slack-file PATH] [--top N]
"""
import argparse
import glob
import json
import os
import sys

SEV_ICON = {"critical": "🚨", "high": "🔴", "medium": "🟠", "low": "🟡"}
SEV_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def esc(s):
    return str(s).replace("|", "\\|").replace("`", "'").replace("\n", " ")


def sev_key(s):
    return SEV_RANK.get((s or "low").lower(), 3)


def load(path):
    try:
        with open(path) as f:
            return json.load(f), None
    except Exception as e:
        return None, str(e)


def iter_projects(data):
    if isinstance(data, list):
        for d in data:
            yield d
    elif isinstance(data, dict):
        yield data


def collect_deps(data):
    """Aggregate vulnerabilities by (package, version). Return (libs_dict, total_findings)."""
    libs = {}
    total = 0
    for proj in iter_projects(data):
        if not isinstance(proj, dict):
            continue
        for v in proj.get("vulnerabilities", []) or []:
            key = (v.get("packageName", "?"), v.get("version", "?"))
            entry = libs.setdefault(key, {
                "sev": "low", "cves": set(), "titles": set(),
                "fixedIn": set(), "paths": 0, "ids": set(),
            })
            if sev_key(v.get("severity")) < sev_key(entry["sev"]):
                entry["sev"] = v.get("severity", "low")
            for cve in (v.get("identifiers", {}) or {}).get("CVE", []) or []:
                entry["cves"].add(cve)
            entry["titles"].add(v.get("title", ""))
            for fx in v.get("fixedIn", []) or []:
                entry["fixedIn"].add(fx)
            entry["ids"].add(v.get("id", ""))
            entry["paths"] += 1
            total += 1
    return libs, total


def collect_code(data):
    """Aggregate Snyk Code SARIF results. Return (by_rule_dict, rules_desc_dict, total)."""
    runs = data.get("runs", []) if isinstance(data, dict) else []
    findings = {}
    rules = {}
    for run in runs:
        for rule in (run.get("tool", {}).get("driver", {}).get("rules", []) or []):
            rules[rule.get("id")] = rule.get("shortDescription", {}).get("text", rule.get("name", ""))
        for r in run.get("results", []) or []:
            rid = r.get("ruleId", "?")
            level = r.get("level", "warning")
            for loc in r.get("locations", []) or []:
                phys = loc.get("physicalLocation", {})
                uri = phys.get("artifactLocation", {}).get("uri", "?")
                line = phys.get("region", {}).get("startLine", "?")
                findings.setdefault((rid, uri, level), []).append(line)
    by_rule = {}
    for (rid, uri, level), lines in findings.items():
        by_rule.setdefault(rid, []).append((uri, level, lines))
    total = sum(len(v) for v in by_rule.values())
    return by_rule, rules, total


def render_deps_md(name, libs, total):
    out = [f"\n### 📦 {name}\n"]
    if not libs:
        out.append("✅ No vulnerabilities.\n")
        return "\n".join(out)
    out.append(f"> **{len(libs)} vulnerable librar{'y' if len(libs)==1 else 'ies'} · {total} finding{'s' if total!=1 else ''}**\n")
    out.append("| Sev | Package | Version | CVE / ID | Title | Fix in | Paths |")
    out.append("|---|---|---|---|---|---|---|")
    for (pkg, ver), info in sorted(libs.items(), key=lambda kv: sev_key(kv[1]["sev"])):
        sev = info["sev"]
        ids = sorted(info["cves"]) or sorted(i for i in info["ids"] if i)[:1]
        ids_str = ", ".join(f"[{c}](https://nvd.nist.gov/vuln/detail/{c})" if c.startswith("CVE") else c for c in ids) or "—"
        title = sorted(info["titles"])[0][:80] if info["titles"] else ""
        fix = ", ".join(sorted(info["fixedIn"])[:2]) or "—"
        out.append(f"| {SEV_ICON.get(sev,'⚪')} {sev} | `{esc(pkg)}` | {esc(ver)} | {esc(ids_str)} | {esc(title)} | {esc(fix)} | {info['paths']} |")
    out.append("")
    return "\n".join(out)


def render_code_md(name, by_rule, rules, total):
    out = [f"\n### 🔎 {name} (Code)\n"]
    if not by_rule:
        out.append("✅ No code findings.\n")
        return "\n".join(out)
    out.append(f"> **{total} location{'s' if total!=1 else ''} across {len(by_rule)} rule{'s' if len(by_rule)!=1 else ''}**\n")
    for rid, items in sorted(by_rule.items()):
        desc = rules.get(rid, rid)
        out.append(f"<details><summary><b>{esc(rid)}</b> — {esc(desc)} ({len(items)})</summary>\n")
        out.append("| Level | File | Lines |")
        out.append("|---|---|---|")
        for uri, level, lines in sorted(items):
            ln = ", ".join(str(x) for x in sorted(set(lines))[:10])
            icon = "🔴" if level == "error" else "🟠"
            out.append(f"| {icon} {level} | `{esc(uri)}` | {esc(ln)} |")
        out.append("\n</details>\n")
    return "\n".join(out)


def render_deps_slack(name, libs, total, top):
    if not libs:
        return f"📦 *{name}*: ✅ clean"
    head = f"📦 *{name}*: {len(libs)} libs · {total} findings"
    rows = []
    ordered = sorted(libs.items(), key=lambda kv: sev_key(kv[1]["sev"]))
    for (pkg, ver), info in ordered[:top]:
        icon = SEV_ICON.get(info["sev"], "⚪")
        title = (sorted(info["titles"])[0] if info["titles"] else "")[:60]
        fix = sorted(info["fixedIn"])[0] if info["fixedIn"] else "no fix"
        rows.append(f"  {icon} `{pkg}` {ver} — {title} (fix: {fix})")
    extra = len(libs) - top
    if extra > 0:
        rows.append(f"  … +{extra} more")
    return head + "\n" + "\n".join(rows)


def render_code_slack(name, by_rule, rules, total, top):
    if not by_rule:
        return f"🔎 *{name}*: ✅ clean"
    head = f"🔎 *{name}*: {total} findings · {len(by_rule)} rules"
    ordered = sorted(by_rule.items(), key=lambda kv: -len(kv[1]))
    rows = [f"  • `{rid}` ({len(items)})" for rid, items in ordered[:top]]
    extra = len(by_rule) - top
    if extra > 0:
        rows.append(f"  … +{extra} more")
    return head + "\n" + "\n".join(rows)


def count_severities(libs, by_rule):
    """Snyk Code SARIF uses level (error/warning/note); treat error=high, warning=medium, note=low.
    Dep libs already have explicit severity."""
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for info in libs.values():
        sev = (info["sev"] or "low").lower()
        if sev in counts:
            counts[sev] += info["paths"]
    for rid, items in by_rule.items():
        for uri, level, lines in items:
            mapped = {"error": "high", "warning": "medium", "note": "low"}.get(level, "medium")
            counts[mapped] += 1  # count locations to match render_code_md total
    return counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?", default="security-report")
    ap.add_argument("--counts-file")
    ap.add_argument("--slack-file")
    ap.add_argument("--top", type=int, default=5)
    args = ap.parse_args()

    md_parts = ["## 🛡️ Snyk Security Scan\n"]
    slack_parts = ["*🛡️ Snyk Security Scan*"]
    totals = {"critical": 0, "high": 0, "medium": 0, "low": 0}

    files = sorted(glob.glob(os.path.join(args.src, "*.json")))
    # exclude our own output files if present
    files = [f for f in files if not os.path.basename(f).startswith("_")]

    if not files:
        md_parts.append(f"> No JSON reports found in `{args.src}/`.")
        sys.stdout.write("\n".join(md_parts) + "\n")
        if args.counts_file:
            with open(args.counts_file, "w") as f:
                json.dump({**totals, "total": 0}, f)
        if args.slack_file:
            with open(args.slack_file, "w") as f:
                f.write("*🛡️ Snyk Security Scan*\n> No JSON reports found.")
        return

    for path in files:
        name = os.path.basename(path).replace(".json", "")
        data, err = load(path)
        if err is not None:
            md_parts.append(f"\n### ⚠️ {name}\nFailed to parse: {err}\n")
            slack_parts.append(f"⚠️ *{name}*: parse error — {err}")
            continue
        if isinstance(data, dict) and "runs" in data:
            by_rule, rules, total = collect_code(data)
            md_parts.append(render_code_md(name, by_rule, rules, total))
            slack_parts.append(render_code_slack(name, by_rule, rules, total, args.top))
            sub = count_severities({}, by_rule)
        else:
            libs, total = collect_deps(data)
            md_parts.append(render_deps_md(name, libs, total))
            slack_parts.append(render_deps_slack(name, libs, total, args.top))
            sub = count_severities(libs, {})
        for k in totals:
            totals[k] += sub[k]

    sys.stdout.write("\n".join(md_parts) + "\n")

    if args.counts_file:
        with open(args.counts_file, "w") as f:
            json.dump({**totals, "total": sum(totals.values())}, f)

    if args.slack_file:
        header = (
            f"*🛡️ Snyk Security Scan*\n"
            f"🚨 {totals['critical']} critical  ·  🔴 {totals['high']} high  ·  "
            f"🟠 {totals['medium']} medium  ·  🟡 {totals['low']} low"
        )
        body = "\n\n".join([header] + slack_parts[1:])
        # Slack section block text limit 3000 chars; leave headroom for shell-added header lines.
        # Truncate at the last newline before the limit so we don't cut a Slack mrkdwn link
        # (`<url|text>`) or a multi-codepoint emoji sequence mid-token.
        if len(body) > 2800:
            cut = body.rfind("\n", 0, 2750)
            if cut < 0:
                cut = 2750
            body = body[:cut].rstrip() + "\n…truncated. See Job Summary for full report."
        with open(args.slack_file, "w") as f:
            f.write(body)


if __name__ == "__main__":
    main()
