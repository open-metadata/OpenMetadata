#!/usr/bin/env python3
"""Render Snyk JSON reports as Markdown. Usage: python3 scripts/snyk_summary.py [dir] > REPORT.md"""
import json, os, glob, sys

SEV_ICON = {"critical": "🚨", "high": "🔴", "medium": "🟠", "low": "🟡"}
SEV_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def esc(s):
    return str(s).replace("|", "\\|").replace("`", "'").replace("\n", " ")


def sev_key(s):
    return SEV_RANK.get((s or "low").lower(), 3)


def load(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as e:
        return {"_error": str(e)}


def iter_projects(data):
    if isinstance(data, list):
        for d in data:
            yield d
    elif isinstance(data, dict):
        yield data


def render_deps(name, data):
    print(f"\n### 📦 {name}\n")
    total_vulns = 0
    libs = {}
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
            total_vulns += 1
    if not libs:
        print("✅ No vulnerabilities.\n")
        return
    print(f"> **{len(libs)} vulnerable librar{'y' if len(libs)==1 else 'ies'} · {total_vulns} finding{'s' if total_vulns!=1 else ''}**\n")
    print("| Sev | Package | Version | CVE / ID | Title | Fix in | Paths |")
    print("|---|---|---|---|---|---|---|")
    for (pkg, ver), info in sorted(libs.items(), key=lambda kv: sev_key(kv[1]["sev"])):
        sev = info["sev"]
        ids = sorted(info["cves"]) or sorted(i for i in info["ids"] if i)[:1]
        ids_str = ", ".join(f"[{c}](https://nvd.nist.gov/vuln/detail/{c})" if c.startswith("CVE") else c for c in ids) or "—"
        title = sorted(info["titles"])[0][:80] if info["titles"] else ""
        fix = ", ".join(sorted(info["fixedIn"])[:2]) or "—"
        print(f"| {SEV_ICON.get(sev,'⚪')} {sev} | `{esc(pkg)}` | {esc(ver)} | {esc(ids_str)} | {esc(title)} | {esc(fix)} | {info['paths']} |")
    print()


def render_code(name, data):
    print(f"\n### 🔎 {name} (Code)\n")
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
    if not findings:
        print("✅ No code findings.\n")
        return
    by_rule = {}
    for (rid, uri, level), lines in findings.items():
        by_rule.setdefault(rid, []).append((uri, level, lines))
    total = sum(len(v) for v in by_rule.values())
    print(f"> **{total} location{'s' if total!=1 else ''} across {len(by_rule)} rule{'s' if len(by_rule)!=1 else ''}**\n")
    for rid, items in sorted(by_rule.items()):
        desc = rules.get(rid, rid)
        print(f"<details><summary><b>{esc(rid)}</b> — {esc(desc)} ({len(items)})</summary>\n")
        print("| Level | File | Lines |")
        print("|---|---|---|")
        for uri, level, lines in sorted(items):
            ln = ", ".join(str(x) for x in sorted(set(lines))[:10])
            icon = "🔴" if level == "error" else "🟠"
            print(f"| {icon} {level} | `{esc(uri)}` | {esc(ln)} |")
        print("\n</details>\n")


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "security-report"
    print("## 🛡️ Snyk Security Scan\n")
    files = sorted(glob.glob(os.path.join(src, "*.json")))
    if not files:
        print(f"> No JSON reports found in `{src}/`.")
        return
    for path in files:
        name = os.path.basename(path).replace(".json", "")
        data = load(path)
        if "_error" in data:
            print(f"\n### ⚠️ {name}\nFailed to parse: {data['_error']}\n")
            continue
        if isinstance(data, dict) and "runs" in data:
            render_code(name, data)
        else:
            render_deps(name, data)


if __name__ == "__main__":
    main()
