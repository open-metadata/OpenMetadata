#!/usr/bin/env python3
"""Enforce whole-class coverage using complete, hash-verified JaCoCo inputs."""

import argparse
import csv
import hashlib
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

MINIMUM_PERCENT = 90


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verified_file(entry, directory):
    path = (directory / entry["path"]).resolve()
    if sha256(path) != entry["sha256"]:
        raise ValueError(f"Input hash differs: {path}")
    return path


def git(repository, *arguments):
    return subprocess.check_output(
        ["git", "-C", str(repository), *arguments], text=True
    )


def changed_sources(repository, source_roots, base_ref):
    base = git(repository, "merge-base", base_ref, "HEAD").strip()
    paths = git(
        repository,
        "diff",
        "--name-only",
        "--diff-filter=ACMR",
        "-z",
        base,
        "--",
        "*.java",
    ) + git(
        repository,
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        "*.java",
    )
    changed = {
        name
        for name in paths.split("\0")
        if name.endswith(".java")
        and "/src/main/java/" in "/" + name
        and (repository / name).is_file()
    }
    omitted = sorted(
        name
        for name in changed
        if not any(name.startswith(root.rstrip("/") + "/") for root in source_roots)
    )
    if omitted:
        raise ValueError(
            "Gate scope omits changed production sources: " + ", ".join(omitted)
        )
    return base, changed


def evaluate_report(report, changed, source_roots, executions):
    if not changed:
        raise ValueError("No changed production sources; verify the gate's scope")
    if not executions:
        raise ValueError("No test executions supplied")
    represented = set()
    seen_classes = set()
    classes = []
    for package in ET.parse(report).getroot().iter("package"):
        for element in package.findall("class"):
            name = element.attrib["name"]
            if name in seen_classes:
                raise ValueError(f"Duplicate class in JaCoCo report: {name}")
            seen_classes.add(name)
            source_name = element.attrib.get("sourcefilename")
            if source_name is None:
                continue
            sources = {
                f"{root.rstrip('/')}/{package.attrib['name']}/{source_name}"
                for root in source_roots
            } & changed
            if len(sources) > 1:
                raise ValueError(f"Ambiguous source roots for {name}")
            if not sources:
                continue
            source = sources.pop()
            represented.add(source)
            counter = element.find("counter[@type='LINE']")
            covered = int(counter.attrib["covered"]) if counter is not None else 0
            missed = int(counter.attrib["missed"]) if counter is not None else 0
            if min(covered, missed) < 0:
                raise ValueError(f"Invalid line counters for {name}")
            classes.append(
                {
                    "source": source,
                    "class": name,
                    "covered": covered,
                    "missed": missed,
                    "percent": 100 * covered / (covered + missed)
                    if covered + missed
                    else None,
                    "passed": 100 * covered >= MINIMUM_PERCENT * (covered + missed),
                }
            )
    missing = sorted(changed - represented)
    below = sorted(row["class"] for row in classes if not row["passed"])
    failures = [entry["name"] for entry in executions if entry["exit_code"] != 0]
    return {
        "passed": not (missing or below or failures),
        "coverage_passed": not (missing or below),
        "minimum_percent": MINIMUM_PERCENT,
        "scope": "Every executable class in changed production sources, including nested classes",
        "changed_sources": len(changed),
        "executable_classes": sum(
            row["covered"] + row["missed"] > 0 for row in classes
        ),
        "missing_sources": missing,
        "below_threshold": below,
        "failed_executions": failures,
        "classes": sorted(classes, key=lambda row: row["class"]),
    }


def collect_inputs(manifest, directory):
    artifacts = [verified_file(entry, directory) for entry in manifest["artifacts"]]
    if not artifacts:
        raise ValueError("No compiled production artifacts supplied")
    executions = []
    for entry in manifest["executions"]:
        data = verified_file(entry["data"], directory)
        result = verified_file(entry["result"], directory)
        executions.append(
            {
                "name": entry["name"],
                "data": str(data),
                "exit_code": int(result.read_text().strip()),
            }
        )
    if not executions:
        raise ValueError("No test executions supplied")
    return artifacts, executions


def verify_sources(repository, changed, source_hashes):
    if not isinstance(source_hashes, dict):
        raise ValueError("Build source hashes must map source paths to SHA-256 values")
    missing = changed - source_hashes.keys()
    if missing:
        raise ValueError(
            "Build provenance omits source hashes: " + ", ".join(sorted(missing))
        )
    for source in sorted(changed):
        if sha256(repository / source) != source_hashes[source]:
            raise ValueError(
                f"Source changed since the production artifacts were frozen: {source}"
            )


def generate_report(java, cli, artifacts, executions, output):
    report = output / "jacoco.xml"
    command = [java, "-Xmx1024m", "-jar", str(cli), "report"]
    command.extend(entry["data"] for entry in executions)
    for artifact in artifacts:
        command.extend(["--classfiles", str(artifact)])
    command.extend(["--xml", str(report)])
    log = output / "jacoco.log"
    with log.open("w") as stream:
        result = subprocess.run(
            command, stdout=stream, stderr=subprocess.STDOUT, check=False
        )
    if result.returncode or "[WARN]" in log.read_text():
        raise ValueError(
            f"JaCoCo failed or reported mismatched class data; inspect {log}"
        )
    return report


def run(manifest_file, output, java):
    manifest_file = manifest_file.resolve()
    directory = manifest_file.parent
    manifest = json.loads(manifest_file.read_text())
    repository = (directory / manifest["repository"]).resolve()
    roots = manifest["source_roots"]
    if not roots or any(
        Path(root).is_absolute() or ".." in Path(root).parts for root in roots
    ):
        raise ValueError("Source roots must be relative paths inside the repository")
    cli = verified_file(manifest["jacoco_cli"], directory)
    artifacts, executions = collect_inputs(manifest, directory)
    base, changed = changed_sources(repository, roots, manifest["base_ref"])
    verify_sources(repository, changed, manifest["source_sha256"])
    output.mkdir(parents=True, exist_ok=False)
    report = generate_report(java, cli, artifacts, executions, output)
    result = evaluate_report(report, changed, roots, executions)
    result["provenance"] = {
        "manifest": str(manifest_file),
        "manifest_sha256": sha256(manifest_file),
        "report_sha256": sha256(report),
        "base": base,
        "head": git(repository, "rev-parse", "HEAD").strip(),
        "source_roots": roots,
        "source_sha256": {path: sha256(repository / path) for path in sorted(changed)},
        "executions": executions,
    }
    (output / "gate.json").write_text(json.dumps(result, indent=2) + "\n")
    with (output / "classes.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=["source", "class", "covered", "missed", "percent", "passed"],
        )
        writer.writeheader()
        writer.writerows(result["classes"])
    print(
        f"{result['executable_classes']} executable classes; "
        f"{len(result['below_threshold'])} below {MINIMUM_PERCENT}%; "
        f"{len(result['missing_sources'])} missing sources; "
        f"{len(result['failed_executions'])} failed test executions"
    )
    return 0 if result["passed"] else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--java", default="java")
    args = parser.parse_args()
    try:
        return run(args.manifest, args.output, args.java)
    except (
        OSError,
        ValueError,
        KeyError,
        ET.ParseError,
        subprocess.CalledProcessError,
    ) as error:
        print(f"Coverage gate input failure: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
