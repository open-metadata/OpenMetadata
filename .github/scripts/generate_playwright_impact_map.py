#!/usr/bin/env python3
"""
Generate a source→spec map from static analysis of Playwright specs.

Playwright specs are black-box UI drivers — their static imports name the
API helpers under `playwright/support/**`, not the UI components they
exercise at runtime. A pure import-graph therefore captures only one
narrow slice of dependencies (direct type imports from `src/generated/**`
and `src/enums/**`), which misses the bulk of the interesting mappings.

To fill the gap this script combines TWO signals:

  (1) **Import graph.** Follow relative `import`s transitively out of
      each spec up to `MAX_HOPS` deep and record every resolved file
      under `openmetadata-ui/src/main/resources/ui/src/`. Catches
      schema/enum edits precisely.

  (2) **testId cross-reference.** Extract every string used in
      `getByTestId('X')` / `[data-testid="X"]` inside each spec, then
      match against `data-testid="X"` occurrences in `src/**`. A testId
      is a runtime contract between spec and component, so this is a
      stronger signal for component/page changes than the import graph.
      Skips ubiquitous testIds (used by more than `TESTID_MAX_OWNERS`
      files) — a common wrapper like `loader` is not useful evidence
      that a spec depends on the wrapper.

Both signals are unioned into per-source `mappings` entries at the same
shape as `.github/playwright/impact-map.json`. Emitted to
`.github/playwright/impact-map.generated.json`, committed alongside
the hand-authored map. `select_playwright_tests.py` merges the two at
plan time — hand-authored entries win, generated ones fill the gaps.

Regenerate after touching a spec, a helper it imports, or a `src/**`
file whose testIds changed:

    python3 .github/scripts/generate_playwright_impact_map.py

CI runs the same command with `--check` and fails if the committed
generated file is out of date, so drift cannot silently reintroduce
the coverage gap this script closes.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

UI_ROOT = Path("openmetadata-ui/src/main/resources/ui")
SPEC_ROOT = UI_ROOT / "playwright/e2e"
SRC_ROOT = UI_ROOT / "src"

# Transitive crawl bound. 4 hops covers spec → helper → helper → src → src,
# which is deeper than any current spec's actual path. Bounded to keep the
# output stable and prevent one shared util from collapsing an entire feature
# area into a single entry.
MAX_HOPS = 4

# Extensions the module resolver tries, in order. `.d.ts` catches ambient
# declarations that specs import for types only — still counted because a
# schema type change ripples into every spec that reads the schema shape.
RESOLVE_SUFFIXES = (".ts", ".tsx", ".d.ts")

# Line-level import parser. Tolerant of `import type`, default, namespace,
# named, and side-effect forms. Does not attempt to parse strings inside
# comments or template literals — none of our specs use dynamic require.
IMPORT_RE = re.compile(
    r"""
    ^\s*
    (?:import|export)\b
    [^'"\n]*                     # any bindings (including empty for side-effect)
    (?:from\s+)?
    (['"])([^'"]+)\1
    """,
    re.VERBOSE | re.MULTILINE,
)

# testIds referenced by a spec. Covers the two conventions the codebase uses:
#
#   page.getByTestId('foo')
#   page.locator('[data-testid="foo"]') and its class/id variants
#
# Restricted to string literals only — dynamic testIds (`getByTestId(\`foo-${id}\`)`)
# cannot be matched against src/ definitions and would produce false positives if
# we tried; the specs use those sparingly.
TESTID_CALL_RE = re.compile(r"""getByTestId\(\s*['"]([^'"]+)['"]""")
TESTID_ATTR_RE = re.compile(r"""\[data-testid=['"]([^'"]+)['"]\]""")

# `data-testid="X"` in src/. Same two shapes JSX supports plus the string form
# some utility components take.
SRC_TESTID_RE = re.compile(r"""data-testid=['"]([^'"]+)['"]""")

# A testId defined in more than this many src/ files is treated as a shared
# wrapper (`loader`, `close-button`, `save-btn`, …) and dropped — spec→wrapper
# is not evidence that the spec exercises the wrapper's behaviour, and mapping
# to every use site of `loader` would explode the output.
TESTID_MAX_OWNERS = 3

# Delegated spec globs are managed by the hand-authored map already —
# regenerating them here would double-schedule them or list them under the
# wrong project. Keep them out of the generated map entirely.
DELEGATED_SPEC_PATTERNS = (
    "playwright/e2e/Auth/",
    "playwright/e2e/nightly/",
    "playwright/e2e/Http2/",
    "playwright/e2e/VisualRegression/",
)


def is_delegated(spec_rel: str) -> bool:
    return any(spec_rel.startswith(prefix) for prefix in DELEGATED_SPEC_PATTERNS)


def resolve_import(from_file: Path, spec: str) -> Path | None:
    """
    Resolve a single import target to a filesystem path, or return None.

    Only relative imports are followed. Bare package imports (`@playwright/test`,
    `lodash`, `@openmetadata/ui-core-components`) are skipped — they either live
    outside the tree or are already covered by `sharedInfrastructure`.
    """
    if not spec.startswith("."):
        return None

    base = (from_file.parent / spec).resolve()

    candidates: list[Path] = []
    if base.suffix in RESOLVE_SUFFIXES:
        candidates.append(base)
    else:
        for ext in RESOLVE_SUFFIXES:
            candidates.append(Path(str(base) + ext))
        for ext in RESOLVE_SUFFIXES:
            candidates.append(base / f"index{ext}")

    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def parse_imports(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    return [match.group(2) for match in IMPORT_RE.finditer(text)]


def crawl(spec_path: Path, repo_root: Path) -> set[Path]:
    """Return the set of resolved `src/**` files reachable from spec_path."""
    visited: set[Path] = {spec_path}
    frontier: list[tuple[Path, int]] = [(spec_path, 0)]
    src_hits: set[Path] = set()
    src_root_abs = (repo_root / SRC_ROOT).resolve()

    while frontier:
        current, depth = frontier.pop()
        if depth >= MAX_HOPS:
            continue
        for imported in parse_imports(current):
            resolved = resolve_import(current, imported)
            if resolved is None or resolved in visited:
                continue
            visited.add(resolved)
            try:
                resolved.relative_to(src_root_abs)
                src_hits.add(resolved)
            except ValueError:
                pass  # not under src/ — keep crawling but don't record it
            frontier.append((resolved, depth + 1))

    return src_hits


def extract_spec_testids(spec_path: Path) -> set[str]:
    text = spec_path.read_text(encoding="utf-8", errors="replace")
    return set(TESTID_CALL_RE.findall(text)) | set(TESTID_ATTR_RE.findall(text))


def build_src_testid_index(repo_root: Path) -> dict[str, set[str]]:
    """
    testId → set of `src/**` files that define it.

    Walks every `.ts`/`.tsx` under `src/` once; the O(files) walk beats
    per-spec grep by ~100x because most specs share testIds.
    """
    src_root_abs = (repo_root / SRC_ROOT).resolve()
    index: dict[str, set[str]] = {}
    for source_path in src_root_abs.rglob("*.ts*"):
        if source_path.suffix not in (".ts", ".tsx"):
            continue
        text = source_path.read_text(encoding="utf-8", errors="replace")
        source_rel = source_path.relative_to(repo_root).as_posix()
        for testid in SRC_TESTID_RE.findall(text):
            index.setdefault(testid, set()).add(source_rel)
    return index


def build_map(repo_root: Path) -> dict:
    spec_root_abs = (repo_root / SPEC_ROOT).resolve()
    src_testid_index = build_src_testid_index(repo_root)

    # spec_rel → set of source files (relative to repo root, POSIX)
    spec_sources: dict[str, set[str]] = {}
    for spec_path in sorted(spec_root_abs.rglob("*.spec.ts")):
        spec_rel = spec_path.relative_to(repo_root / UI_ROOT).as_posix()
        if is_delegated(spec_rel):
            continue

        # (1) Import-graph signal.
        sources = {
            source.relative_to(repo_root).as_posix()
            for source in crawl(spec_path, repo_root)
        }

        # (2) testId cross-reference signal.
        for testid in extract_spec_testids(spec_path):
            owners = src_testid_index.get(testid, set())
            # Skip testIds owned by too many files — they are wrapper/utility
            # testIds ("loader", "close-btn", "save-button", …), not evidence
            # that the spec depends on any one owner in particular.
            if 0 < len(owners) <= TESTID_MAX_OWNERS:
                sources.update(owners)

        spec_sources[spec_rel] = sources

    # Invert: source → set of specs.
    source_specs: dict[str, set[str]] = {}
    for spec_rel, sources in spec_sources.items():
        for source in sources:
            source_specs.setdefault(source, set()).add(spec_rel)

    # Emit one mapping per source file. Grouping equal-spec-set sources would
    # be nicer for humans but a machine-readable file is fine here, and the
    # planner iterates entries anyway. Sorted for stable diffs.
    entries = [
        {"sources": [source], "specs": sorted(specs)}
        for source, specs in sorted(source_specs.items())
    ]

    return {
        "version": 1,
        "generatedFrom": (
            "Auto-generated by .github/scripts/generate_playwright_impact_map.py. "
            "Do not edit by hand — regenerate with the script and commit the diff. "
            "Hand-authored routing overrides in .github/playwright/impact-map.json "
            "always win at plan time."
        ),
        "mappings": entries,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(".github/playwright/impact-map.generated.json"),
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help=(
            "Verify the committed output matches what the generator produces. "
            "Exit 1 with a diff summary if stale."
        ),
    )
    return parser.parse_args()


def diff_summary(existing: str, generated: str) -> str:
    existing_lines = existing.splitlines()
    generated_lines = generated.splitlines()
    added = sum(
        1 for line in generated_lines if line not in existing_lines
    )
    removed = sum(1 for line in existing_lines if line not in generated_lines)
    return f"+{added} lines, -{removed} lines"


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd()

    generated = json.dumps(build_map(repo_root), indent=2, sort_keys=True) + "\n"

    if args.check:
        if not args.output.exists():
            print(
                f"{args.output} is missing. "
                "Run: python3 .github/scripts/generate_playwright_impact_map.py",
                file=sys.stderr,
            )
            return 1
        existing = args.output.read_text(encoding="utf-8")
        if existing != generated:
            print(
                f"{args.output} is out of date ({diff_summary(existing, generated)}).\n"
                "Run: python3 .github/scripts/generate_playwright_impact_map.py",
                file=sys.stderr,
            )
            return 1
        print(f"{args.output} is up to date.")
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(generated, encoding="utf-8")
    entry_count = len(json.loads(generated)["mappings"])
    print(f"Wrote {args.output} ({entry_count} source→spec entries).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
