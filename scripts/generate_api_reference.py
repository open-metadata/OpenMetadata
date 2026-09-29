#!/usr/bin/env python3
"""Generate docs/generated/api-reference.md — an index of REST endpoints.

The source is the JAX-RS resource classes under
``openmetadata-service/src/main/java/org/openmetadata/service/resources/**/*Resource.java``.
It is NOT ``openapi.yml`` — that file is a 300-byte SwaggerBundle config stub
(title / version / security scheme) with no endpoints; the full OpenAPI document is
assembled at runtime by Dropwizard from these annotations, and is not committed.

For each endpoint:
  - HTTP method + path are EXACT — parsed from ``@GET``/``@POST``/``@PUT``/``@DELETE``/``@PATCH``
    plus the class-level and method-level ``@Path``.
  - purpose comes from ``@Operation(summary = "…")`` when present, and is left blank
    otherwise. It is never inferred — a blank cell means "no summary annotation," not
    "no purpose."

Endpoints are grouped by resource package (the directory under ``resources/``) and
sorted, so the output is deterministic (byte-identical across runs, no timestamps).
Do not edit by hand — run ``make generate-api-reference`` (or ``make generate-reference-docs``).
"""

import os
import re

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
RESOURCE_ROOT = "openmetadata-service/src/main/java/org/openmetadata/service/resources"
OUT_PATH = "docs/generated/api-reference.md"

HTTP_METHODS = ("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS")
HTTP_ANNOTATION_RE = re.compile(r"^\s*@(" + "|".join(HTTP_METHODS) + r")\b")
PATH_RE = re.compile(r'@Path\(\s*"([^"]*)"\s*\)')
SUMMARY_RE = re.compile(r'summary\s*=\s*"((?:[^"\\]|\\.)*)"')
CLASS_DECL_RE = re.compile(r"\b(class|interface)\s+\w+")
METHOD_SIG_RE = re.compile(r"^(public|protected|private)\b")


def repo(*parts):
    return os.path.join(REPO_ROOT, *parts)


def join_path(base, suffix):
    combined = "/" + "/".join(part for part in (base + "/" + suffix).split("/") if part)
    return combined if combined != "/" else "/"


def class_base_path(lines):
    """The @Path that annotates the class declaration (applies to every method)."""
    base = ""
    pending = ""
    for line in lines:
        path_match = PATH_RE.search(line)
        if path_match is not None:
            pending = path_match.group(1)
        if CLASS_DECL_RE.search(line) is not None:
            base = pending
            break
    return base


def annotation_block_above(lines, sig_index):
    """The contiguous annotation/JavaDoc lines directly above a method signature.

    Stops at a blank line or a closing brace (the end of the previous member), so
    multi-line ``@Operation(...)`` blocks are captured whole regardless of their
    internal continuation lines.
    """
    block = []
    cursor = sig_index - 1
    while cursor >= 0:
        stripped = lines[cursor].strip()
        if stripped == "" or stripped == "}":
            break
        block.append(lines[cursor])
        cursor -= 1
    block.reverse()
    return block


def endpoint_from_block(block, base_path):
    verb = None
    for line in block:
        verb_match = HTTP_ANNOTATION_RE.match(line)
        if verb_match is not None:
            verb = verb_match.group(1)
            break
    if verb is None:
        return None
    text = " ".join(block)
    path_match = PATH_RE.search(text)
    method_path = path_match.group(1) if path_match is not None else ""
    summary_match = SUMMARY_RE.search(text)
    summary = summary_match.group(1) if summary_match is not None else ""
    return (verb, join_path(base_path, method_path), summary)


def parse_resource(full):
    with open(full, encoding="utf-8") as handle:
        lines = handle.read().splitlines()
    base_path = class_base_path(lines)
    endpoints = []
    for index, line in enumerate(lines):
        if METHOD_SIG_RE.match(line.strip()) is None or "(" not in line:
            continue
        block = annotation_block_above(lines, index)
        endpoint = endpoint_from_block(block, base_path)
        if endpoint is not None:
            endpoints.append(endpoint)
    return endpoints


def collect():
    groups = {}
    for dirpath, _dirs, files in os.walk(repo(RESOURCE_ROOT)):
        for name in sorted(files):
            if not name.endswith("Resource.java"):
                continue
            full = os.path.join(dirpath, name)
            endpoints = parse_resource(full)
            if not endpoints:
                continue
            package = os.path.relpath(dirpath, repo(RESOURCE_ROOT)).replace(os.sep, "/")
            if package == ".":
                package = "(root)"
            groups.setdefault(package, []).extend(endpoints)
    for package in groups:
        groups[package] = sorted(set(groups[package]), key=lambda item: (item[1], item[0], item[2]))
    return groups


def render(groups):
    total = sum(len(items) for items in groups.values())
    with_summary = sum(1 for items in groups.values() for item in items if item[2])
    lines = [
        "<!-- GENERATED FILE — DO NOT EDIT. Run `make generate-api-reference`. -->",
        "",
        "# API Reference (endpoint index)",
        "",
        "Every REST endpoint, grouped by resource package. **Generated** from the JAX-RS",
        "resource classes under",
        "`openmetadata-service/src/main/java/org/openmetadata/service/resources/**` — do not",
        "hand-edit; run `make generate-api-reference` (or `make generate-reference-docs`).",
        "",
        "- **Method + path are exact** (from `@GET`/`@POST`/… and `@Path`).",
        "- **Purpose** is the `@Operation(summary=…)` where present; a blank cell means there is",
        "  no summary annotation, not that the endpoint has no purpose. Purposes are never inferred.",
        "- Source is the annotations, **not** `openapi.yml` (a config stub with no endpoints; the",
        "  full spec is assembled at runtime by Dropwizard).",
        "",
        f"**{total} endpoints** across {len(groups)} resource packages · {with_summary} carry a summary.",
        "",
    ]
    for package in sorted(groups):
        lines.append(f"## {package}")
        lines.append("")
        lines.append("| Method | Path | Purpose |")
        lines.append("|---|---|---|")
        for verb, path, summary in groups[package]:
            escaped = summary.replace("|", "\\|")
            lines.append(f"| `{verb}` | `{path}` | {escaped} |")
        lines.append("")
    return "\n".join(lines).rstrip("\n") + "\n"


def main():
    groups = collect()
    output = render(groups)
    os.makedirs(repo(os.path.dirname(OUT_PATH)), exist_ok=True)
    with open(repo(OUT_PATH), "w", encoding="utf-8") as handle:
        handle.write(output)
    total = sum(len(items) for items in groups.values())
    print(f"wrote {OUT_PATH}: {total} endpoints in {len(groups)} packages")


if __name__ == "__main__":
    main()
