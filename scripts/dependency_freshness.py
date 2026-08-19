#!/usr/bin/env python3
"""Report how far behind the latest release each dependency is.

Snyk answers a different question. Its `fixedIn` field is, by design, the *smallest*
upgrade that clears a specific vulnerability -- Snyk's own documentation says it
"always recommends the smallest upgrade needed to resolve a vulnerability". Taking that
advice literally lands the pin on the floor of the fixed range, which is routinely
already one or more releases behind. When the next CVE in that library is disclosed --
and for netty, jetty and BouncyCastle that is roughly monthly -- the scan fires again.

This script reports the other number: the latest release available today. Read next to
the Snyk findings it turns "bump to 12.1.10 because CVE-2026-10050" into "bump to
12.1.12, which is where the line actually is". Nothing here looks at vulnerabilities;
it is purely a freshness signal, and it is advisory -- it never fails a build.

Inputs are the raw output of the ecosystem's own tooling, so no network calls happen
here:

    mvn versions:display-dependency-updates ...  > maven-updates.txt
    pip list --outdated --format=json            > pip-updates.json
    npm outdated --json                          > npm-updates.json   (exit code 1 is normal)

Usage:
    dependency_freshness.py [--maven FILE] [--pip FILE] [--npm FILE]
                            [--slack-file PATH] [--json-file PATH]
                            [--title TEXT]

Markdown goes to stdout (append it to $GITHUB_STEP_SUMMARY).
"""
import argparse
import json
import os
import re
import sys

# `[INFO]   io.netty:netty-codec ......... 4.2.16.Final -> 4.2.17.Final`
MAVEN_LINE = re.compile(
    r"^\[INFO\]\s+(?P<ga>[\w.\-]+:[\w.\-]+)\s+\.{2,}\s+(?P<cur>\S+)\s+->\s+(?P<latest>\S+)\s*$"
)

# Cap on rows rendered per ecosystem. Slack sections are capped at ~3000 characters and
# a job summary nobody scrolls is the same as no report, so truncate loudly rather than
# emitting 140 lines of BOM members.
MAX_ROWS = 40


def group_key(group_id):
    """Collapse a Maven groupId to the family that versions together.

    A BOM bump moves every member artifact at once: one jetty release produces ~50
    identical rows across org.eclipse.jetty, .ee10, .http2, .quic and friends. Keying on
    the first three dot-segments folds those into one row -- `com.fasterxml.jackson`
    covers .core/.jr/.module, `org.eclipse.jetty` covers all the sub-groups, and short
    groupIds like `io.netty` are left alone.
    """
    parts = group_id.split(".")
    return ".".join(parts[:3]) if len(parts) > 3 else group_id


def parse_maven(path):
    """Group `versions:display-dependency-updates` output by (family, current, latest)."""
    rows = {}
    with open(path) as f:
        for line in f:
            m = MAVEN_LINE.match(line.rstrip("\n"))
            if not m:
                continue
            group_id, artifact = m.group("ga").split(":", 1)
            key = (group_key(group_id), m.group("cur"), m.group("latest"))
            entry = rows.setdefault(key, set())
            entry.add(artifact)
    return [
        {
            "name": family,
            "current": cur,
            "latest": latest,
            "artifacts": len(arts),
        }
        for (family, cur, latest), arts in sorted(rows.items())
    ]


def parse_pip(path):
    """Read `pip list --outdated --format=json`."""
    with open(path) as f:
        data = json.load(f)
    return sorted(
        (
            {
                "name": p.get("name", "?"),
                "current": p.get("version", "?"),
                "latest": p.get("latest_version", "?"),
                "artifacts": 1,
            }
            for p in data
            if isinstance(p, dict)
        ),
        key=lambda r: r["name"].lower(),
    )


def parse_npm(path):
    """Read `npm outdated --json`.

    Reports `latest`, not `wanted`: `wanted` is whatever the declared semver range
    permits, which is the same floor-seeking answer this script exists to look past.
    """
    with open(path) as f:
        text = f.read().strip()
    if not text:
        return []
    data = json.loads(text)
    rows = []
    for name, info in (data or {}).items():
        if not isinstance(info, dict):
            continue
        current = info.get("current") or info.get("wanted") or "?"
        latest = info.get("latest") or "?"
        if current == latest:
            continue
        rows.append({"name": name, "current": current, "latest": latest, "artifacts": 1})
    return sorted(rows, key=lambda r: r["name"].lower())


def render_md(title, rows):
    if not rows:
        return [f"\n#### {title}\n", "✅ Every dependency is at its latest release.\n"]
    shown = rows[:MAX_ROWS]
    out = [f"\n#### {title}\n", f"> **{len(rows)} behind latest**\n"]
    out.append("| Dependency | Current | Latest | Artifacts |")
    out.append("|---|---|---|---|")
    for r in shown:
        out.append(f"| `{r['name']}` | {r['current']} | **{r['latest']}** | {r['artifacts']} |")
    if len(rows) > len(shown):
        out.append("")
        out.append(f"_…and {len(rows) - len(shown)} more, see the uploaded artifact._")
    out.append("")
    return out


def render_slack(title, rows):
    if not rows:
        return f"*{title}*\n✅ all at latest"
    shown = rows[:15]
    lines = [f"*{title}* — {len(rows)} behind latest"]
    for r in shown:
        suffix = f" ({r['artifacts']} artifacts)" if r["artifacts"] > 1 else ""
        lines.append(f"• `{r['name']}` {r['current']} → *{r['latest']}*{suffix}")
    if len(rows) > len(shown):
        lines.append(f"_…and {len(rows) - len(shown)} more_")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--maven", help="output of `mvn versions:display-dependency-updates`")
    ap.add_argument("--pip", help="output of `pip list --outdated --format=json`")
    ap.add_argument("--npm", help="output of `npm outdated --json`")
    ap.add_argument("--slack-file", help="write a Slack-formatted summary here")
    ap.add_argument("--json-file", help="write the parsed rows here")
    ap.add_argument("--title", default="Dependency freshness", help="heading to render")
    args = ap.parse_args()

    sources = [
        ("Maven", args.maven, parse_maven),
        ("Python", args.pip, parse_pip),
        ("npm", args.npm, parse_npm),
    ]

    md = [f"\n## 🕒 {args.title}\n"]
    md.append(
        "_Latest release available today. Snyk reports the **smallest** upgrade that clears a "
        "given CVE, which is often already behind; this is where the line actually is._\n"
    )
    slack_sections = []
    payload = {}
    any_source = False

    for label, path, parser in sources:
        if not path:
            continue
        any_source = True
        if not os.path.exists(path):
            md.append(f"\n#### {label}\n")
            md.append(f"⚠️ `{path}` not found — the freshness check did not run.\n")
            payload[label.lower()] = {"error": "missing", "path": path, "rows": []}
            continue
        try:
            rows = parser(path)
        except Exception as e:  # advisory report: never break the build over a parse error
            md.append(f"\n#### {label}\n")
            md.append(f"⚠️ could not parse `{path}`: {e}\n")
            payload[label.lower()] = {"error": str(e), "path": path, "rows": []}
            continue
        md.extend(render_md(label, rows))
        slack_sections.append(render_slack(label, rows))
        payload[label.lower()] = {"behind": len(rows), "rows": rows}

    if not any_source:
        sys.exit("nothing to do: pass at least one of --maven / --pip / --npm")

    print("\n".join(md))

    if args.slack_file:
        with open(args.slack_file, "w") as f:
            f.write("\n\n".join(slack_sections))
    if args.json_file:
        with open(args.json_file, "w") as f:
            json.dump(payload, f, indent=2)


if __name__ == "__main__":
    main()
