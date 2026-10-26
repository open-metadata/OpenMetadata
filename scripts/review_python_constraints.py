#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Report setup.py constraints that exclude newer stable package releases."""

import argparse
import ast
import hashlib
import json
import logging
import os
import re
import runpy
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

BEGIN = "<!-- python-constraint-review:begin -->"
END = "<!-- python-constraint-review:end -->"
STATE = r"<!-- python-constraint-state: (.*?) -->"
TITLE = "Python dependency constraints: upgrade review"
OWNERS = "@open-metadata/ingestion"
LOGGER = logging.getLogger(__name__)


def request_json(url, *, method="GET", payload=None, token=None):
    """Perform a bounded JSON request."""
    headers = {"Accept": "application/json", "User-Agent": "OpenMetadata-dependency-review"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None if payload is None else json.dumps(payload).encode()
    if data is not None:
        headers["Content-Type"] = "application/json"
    with urlopen(Request(url, data=data, headers=headers, method=method), timeout=30) as response:
        return json.load(response)


def declarations(project):
    """Evaluate the shared setuptools requirement composition."""
    import setuptools
    from packaging.requirements import Requirement

    captured = {}
    original = setuptools.setup
    try:
        setuptools.setup = lambda **kwargs: captured.update(kwargs)
        runpy.run_path(str(project / "setup.py"), run_name="__main__")
    finally:
        setuptools.setup = original
    groups = {"base": captured["install_requires"], **captured["extras_require"]}
    requirements = {}
    for group, values in groups.items():
        for value in values:
            requirement = Requirement(value)
            key = str(requirement)
            record = requirements.setdefault(key, {"requirement": key, "extras": []})
            record["extras"].append(group)
    for record in requirements.values():
        record["extras"] = sorted(set(record["extras"]))
    return sorted(requirements.values(), key=lambda item: item["requirement"].lower())


def locations(project):
    """Locate literal requirements and adjacent constraint comments."""
    from packaging.requirements import InvalidRequirement, Requirement

    source = (project / "setup.py").read_text()
    lines = source.splitlines()
    result = {}
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.Constant) or not isinstance(node.value, str):
            continue
        try:
            requirement = Requirement(node.value)
        except InvalidRequirement:
            continue
        comments = []
        index = node.lineno - 2
        while index >= 0 and lines[index].lstrip().startswith("#"):
            comments.insert(0, lines[index].strip().removeprefix("#").strip())
            index -= 1
        if "#" in lines[node.end_lineno - 1]:
            comments.append(lines[node.end_lineno - 1].split("#", 1)[1].strip())
        result[str(requirement)] = {"line": node.lineno, "comment": " ".join(comments)}
    return result


def stable_releases(metadata):
    """Return non-yanked stable releases with uploaded files."""
    from packaging.version import InvalidVersion, Version

    releases = []
    for value, files in metadata["releases"].items():
        try:
            version = Version(value)
        except InvalidVersion:
            continue
        usable = [item for item in files if not item.get("yanked", False)]
        if usable and not version.is_prerelease and not version.is_devrelease:
            releases.append((version, usable))
    if not releases:
        raise ValueError("No stable, non-yanked releases with files")
    return sorted(releases, reverse=True)


def findings(record, releases, locked, pythons):
    """Classify a requirement against release-level Python metadata."""
    from packaging.requirements import Requirement
    from packaging.specifiers import SpecifierSet
    from packaging.version import Version

    requirement = Requirement(record["requirement"])
    installed = sorted({Version(value) for value in locked if Version(value) in requirement.specifier})
    baseline = installed[-1] if installed else Version("0")
    latest = releases[0][0]
    compatible = {}
    for python in pythons:
        compatible[python] = next(
            (
                str(version)
                for version, files in releases
                if any(Version(python) in SpecifierSet(item.get("requires_python") or "") for item in files)
            ),
            None,
        )
    blocked = sorted(
        {
            value
            for value in compatible.values()
            if value and Version(value) > baseline and Version(value) not in requirement.specifier
        },
        key=Version,
    )
    if requirement.url:
        status = "direct URL; manual review"
        blocked = []
    elif blocked:
        status = "constraint review"
    elif any(value and Version(value) > baseline for value in compatible.values()):
        status = "lock refresh or resolver investigation"
    elif latest > baseline:
        status = "newer release requires another Python version"
    else:
        status = "current"
    return {
        **record,
        "locked": [str(version) for version in installed],
        "latest": str(latest),
        "compatible": compatible,
        "blocked": blocked,
        "status": status,
    }


def scan(project, index_url, pythons):
    """Inspect all declared extras without resolving or installing packages."""
    from packaging.requirements import Requirement
    from packaging.utils import canonicalize_name

    try:
        import tomllib
    except ModuleNotFoundError:
        import tomli as tomllib

    records = declarations(project)
    references = locations(project)
    lock = tomllib.loads((project / "uv.lock").read_text())
    locked = {}
    for package in lock["package"]:
        locked.setdefault(canonicalize_name(package["name"]), []).append(package["version"])
    names = sorted({canonicalize_name(Requirement(record["requirement"]).name) for record in records})

    def fetch(name):
        return name, stable_releases(request_json(f"{index_url.rstrip('/')}/pypi/{quote(name)}/json"))

    with ThreadPoolExecutor(max_workers=8) as executor:
        releases = dict(executor.map(fetch, names))
    rows = []
    for record in records:
        name = canonicalize_name(Requirement(record["requirement"]).name)
        row = findings(record, releases[name], locked.get(name, []), pythons)
        row.update(references.get(record["requirement"], {}))
        rows.append(row)
    return {"python_versions": pythons, "packages_checked": len(names), "requirements": rows}


def actionable(report):
    """Identify distinct constraint/target upgrades needing owner review."""
    return {
        json.dumps([row["requirement"], version], separators=(",", ":"))
        for row in report["requirements"]
        for version in row["blocked"]
    }


def cell(value):
    return str(value).replace("|", "\\|").replace("\n", " ")


def markdown(report):
    """Render outstanding upgrades and their declared scope."""
    lines = [
        BEGIN,
        f"Checked {report['packages_checked']} packages from `ingestion/setup.py`, including every extra.",
        "",
        "These are review prompts, not validated upgrades. Python compatibility uses file `Requires-Python` metadata; "
        "wheel/platform availability, markers and dependency resolution still require validation.",
        "",
        "| Requirement | Locked | Latest stable | Latest by Python | Finding | Extras / marker / source |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for row in report["requirements"]:
        if row["status"] == "current":
            continue
        support = "; ".join(f"{python}: {version or 'none'}" for python, version in row["compatible"].items())
        scope = ", ".join(row["extras"])
        if row.get("line"):
            scope += f"; setup.py:{row['line']}"
        if row.get("comment"):
            scope += f"; {row['comment']}"
        values = [
            row["requirement"],
            ", ".join(row["locked"]) or "not locked",
            row["latest"],
            support,
            row["status"],
            scope,
        ]
        lines.append("| " + " | ".join(cell(value) for value in values) + " |")
    if not any(row["status"] != "current" for row in report["requirements"]):
        lines += ["", "No outstanding upgrades found."]
    lines += [
        "",
        "Review shared constraints, refresh the lock, and run affected connector and supported CI checks before acceptance.",
    ]
    lines += [f"<!-- python-constraint-state: {json.dumps(sorted(actionable(report)))} -->", END]
    return "\n".join(lines)


def publish(report, repository, api_url, token):
    """Maintain one issue and mention owners only for new actionable upgrades."""
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", repository):
        raise ValueError("Expected OWNER/REPOSITORY")
    root = f"{api_url.rstrip('/')}/repos/{repository}"

    def api(path, method="GET", payload=None):
        return request_json(root + path, method=method, payload=payload, token=token)

    def pages(path):
        page = 1
        while True:
            items = api(f"{path}&per_page=100&page={page}")
            yield from items
            if len(items) < 100:
                break
            page += 1

    issues = [
        issue
        for issue in pages("/issues?state=all&creator=github-actions%5Bbot%5D")
        if "pull_request" not in issue and BEGIN in (issue.get("body") or "")
    ]
    if len(issues) > 1:
        raise ValueError("Multiple constraint-review issues found; reconcile them before publication")
    body = markdown(report)
    keys = actionable(report)
    if not issues:
        if not keys:
            LOGGER.info("No actionable constraint upgrades; no issue created")
            return
        api("/issues", "POST", {"title": TITLE, "body": f"{OWNERS}: new dependency constraints need review.\n\n{body}"})
        LOGGER.info("Created constraint-review issue")
        return
    issue = issues[0]
    previous = issue["body"]
    match = re.search(STATE, previous)
    if not match or previous.count(BEGIN) != 1 or previous.count(END) != 1:
        raise ValueError("Issue managed section/state is missing or ambiguous")
    new = keys - set(json.loads(match[1]))
    path = f"/issues/{issue['number']}"
    if new:
        digest = hashlib.sha256(json.dumps(sorted(new)).encode()).hexdigest()
        marker = f"<!-- python-constraint-notification:{digest} -->"
        comments = pages(path + "/comments?direction=asc")
        if not any(marker in (comment.get("body") or "") for comment in comments):
            summary = "\n".join(
                f"- `{requirement}` → `{version}`" for requirement, version in map(json.loads, sorted(new))
            )
            api(
                path + "/comments",
                "POST",
                {"body": f"{OWNERS}: new constraint upgrades to review:\n\n{summary}\n\n{marker}"},
            )
    start, stop = previous.index(BEGIN), previous.index(END) + len(END)
    updated = previous[:start] + body + previous[stop:]
    changes = {}
    if updated != previous:
        changes["body"] = updated
    if new and issue["state"] == "closed":
        changes["state"] = "open"
    if changes:
        api(path, "PATCH", changes)
    LOGGER.info("Updated constraint review: %s new upgrades; %s changed issue fields", len(new), len(changes))


def main():
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    collect = commands.add_parser("scan")
    collect.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[1] / "ingestion")
    collect.add_argument("--index-url", default="https://pypi.org")
    collect.add_argument("--python", action="append", dest="pythons")
    collect.add_argument("--output-dir", required=True, type=Path)
    send = commands.add_parser("publish")
    send.add_argument("--report", required=True, type=Path)
    send.add_argument("--repository", required=True)
    send.add_argument("--api-url", default=os.environ.get("GITHUB_API_URL", "https://api.github.com"))
    args = parser.parse_args()
    if args.command == "scan":
        args.output_dir.mkdir(parents=True, exist_ok=True)
        report = scan(args.project.resolve(), args.index_url, args.pythons or ["3.10", "3.11", "3.12"])
        (args.output_dir / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        (args.output_dir / "report.md").write_text(markdown(report) + "\n")
        LOGGER.info(
            "Checked %s packages; %s constraint upgrades need review",
            report["packages_checked"],
            len(actionable(report)),
        )
    else:
        publish(json.loads(args.report.read_text()), args.repository, args.api_url, os.environ["GH_TOKEN"])


if __name__ == "__main__":
    main()
