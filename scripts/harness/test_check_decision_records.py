"""Each case breaks one rule in a scratch repository and expects check_decision_records to name it.

Run with ``python -m pytest scripts/harness/test_check_decision_records.py``.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).with_name("check_decision_records.py")
SPEC = importlib.util.spec_from_file_location("check_decision_records", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
GUARD = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = GUARD
SPEC.loader.exec_module(GUARD)

SLUG = "2026-10-01-a-cache-entry-expires-after-one-hour"
RECORD = """# A cache entry expires after one hour

- **Status:** Accepted
- **Revisions:** v1 2026-10-01 (initial)
- **Deciders:** someone
- **Guard:** reviewer

## Context
"""


def write(root: Path, rel: str, text: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    subprocess.run(["git", "add", rel], cwd=root, check=True)


def messages(root: Path) -> list[str]:
    return [f"{file}:{line}: {message}" for file, line, message in GUARD.check(root)]


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    write(tmp_path, f"docs/decisions/{SLUG}.md", RECORD)
    write(tmp_path, "docs/decisions/README.md", "# Decision records\n\nCite as `ADR:<date>-<slug>`.\n")
    return tmp_path


def test_this_tree_is_clean() -> None:
    assert messages(GUARD.REPO) == []


def test_a_resolving_citation_is_clean(repo: Path) -> None:
    write(repo, "Cache.java", f"// ADR:{SLUG}\nclass Cache {{}}\n")
    write(repo, "notes.md", f"See `docs/decisions/{SLUG}.md`.\n")
    assert messages(repo) == []


def test_a_dangling_citation_fails(repo: Path) -> None:
    write(repo, "Cache.java", "class Cache {}\n// ADR:2026-10-01-a-cache-entry-never-expires\n")
    assert messages(repo) == [
        "Cache.java:2: ADR:2026-10-01-a-cache-entry-never-expires resolves to no record under "
        "docs/decisions/; a record in another repo is cited as ADR:<repo>/<date>-<slug>"
    ]


def test_a_citation_wrapped_at_a_hyphen_fails(repo: Path) -> None:
    write(repo, "Cache.java", "// ADR:2026-10-01-a-cache-entry-\n// expires-after-one-hour\n")
    assert len(messages(repo)) == 1


def test_a_missing_record_path_fails(repo: Path) -> None:
    write(repo, "notes.md", "See docs/decisions/2026-10-01-gone.md.\n")
    assert messages(repo) == ["notes.md:1: docs/decisions/2026-10-01-gone.md does not exist"]


def test_a_path_into_another_tree_is_not_resolved_here(repo: Path) -> None:
    write(repo, "notes.md", "ai-platform/docs/decisions/2026-08-27-x.md and "
                            "https://github.com/o/r/blob/main/docs/decisions/2026-08-27-x.md\n")
    assert messages(repo) == []


def test_a_record_in_another_repo_is_checked_for_shape_only(repo: Path) -> None:
    write(repo, "pom.xml", "<!-- ADR:ai-platform/2026-08-27-transitive-cves-get-an-override -->\n")
    assert messages(repo) == []


def test_an_unknown_repo_fails(repo: Path) -> None:
    write(repo, "pom.xml", "<!-- ADR:aiplatform/2026-08-27-transitive-cves-get-an-override -->\n")
    assert messages(repo) == [
        "pom.xml:1: ADR:aiplatform/2026-08-27-transitive-cves-get-an-override names no known repo "
        "(one of: ai-platform, openmetadata-collate)"
    ]


def test_this_repo_is_cited_unqualified(repo: Path) -> None:
    write(repo, "Cache.java", f"// ADR:{GUARD.THIS_REPO}/{SLUG}\n")
    assert messages(repo) == [
        f"Cache.java:1: ADR:{GUARD.THIS_REPO}/{SLUG} is a record in this repo; cite it as ADR:{SLUG}"
    ]


def test_a_qualified_citation_needs_a_record_name(repo: Path) -> None:
    write(repo, "Cache.java", "// ADR:ai-platform/latest\n")
    assert messages(repo) == ["Cache.java:1: ADR:ai-platform/latest is not a <date>-<slug> record name"]


def test_the_retired_numbering_fails(repo: Path) -> None:
    write(repo, "pom.xml", "<!-- mirrors ai-platform's ADR-0018 -->\n")
    assert messages(repo) == [
        "pom.xml:1: ADR-0018 is ai-platform's retired numbering; cite the record as "
        "ADR:ai-platform/<date>-<slug>"
    ]


def test_placeholders_are_not_citations(repo: Path) -> None:
    write(repo, "notes.md", "Cite `ADR:<date>-<slug>`, `ADR:<repo>/<date>-<slug>` or "
                            "`ADR:ai-platform/<date>-<slug>`, named `docs/decisions/YYYY-MM-DD-slug.md`; "
                            "`# ADR: title` is prose.\n")
    assert messages(repo) == []


def test_a_slug_with_an_underscore_is_reported(repo: Path) -> None:
    write(repo, "Cache.java", "// ADR:2026-10-01-cache_ttl\n")
    assert messages(repo) == [
        "Cache.java:1: ADR:2026-10-01-cache_ttl resolves to no record under docs/decisions/; a "
        "record in another repo is cited as ADR:<repo>/<date>-<slug>"
    ]


def test_untracked_files_are_not_scanned(repo: Path) -> None:
    (repo / "scratch.md").write_text("ADR:2026-10-01-nothing\n", encoding="utf-8")
    assert messages(repo) == []


@pytest.mark.parametrize("name", ["cache-ttl.md", "2026-10-01-Cache_TTL.md", "2026-10-1-cache.md"])
def test_a_record_name_is_a_date_and_a_kebab_slug(repo: Path, name: str) -> None:
    write(repo, f"docs/decisions/{name}", RECORD)
    assert [m for m in messages(repo) if "name a record" in m] == [
        f"docs/decisions/{name}:1: name a record YYYY-MM-DD-short-kebab-slug.md; the filename is "
        "its identity and ADR:<date>-<slug> resolves straight to it"
    ]


@pytest.mark.parametrize("first", ["# ADR: A cache entry expires after one hour", "A cache entry", ""])
def test_the_first_line_states_the_decision(repo: Path, first: str) -> None:
    write(repo, f"docs/decisions/{SLUG}.md", RECORD.replace("# A cache entry expires after one hour", first))
    assert messages(repo) == [
        f"docs/decisions/{SLUG}.md:1: the first line is '# <the decision, stated as a sentence>'"
    ]


@pytest.mark.parametrize("field", ["Status", "Revisions", "Guard"])
def test_a_header_field_is_required(repo: Path, field: str) -> None:
    kept = [line for line in RECORD.splitlines() if not line.startswith(f"- **{field}:**")]
    write(repo, f"docs/decisions/{SLUG}.md", "\n".join(kept) + "\n")
    assert f"docs/decisions/{SLUG}.md:1: the header has no '- **{field}:**' line" in messages(repo)


def test_a_header_field_below_the_header_does_not_count(repo: Path) -> None:
    moved = RECORD.replace("- **Guard:** reviewer\n", "") + "\n" * 14 + "- **Guard:** reviewer\n"
    write(repo, f"docs/decisions/{SLUG}.md", moved)
    assert messages(repo) == [f"docs/decisions/{SLUG}.md:1: the header has no '- **Guard:**' line"]


def test_v1_is_dated_like_the_filename(repo: Path) -> None:
    write(repo, f"docs/decisions/{SLUG}.md", RECORD.replace("v1 2026-10-01", "v1 2026-10-05"))
    assert messages(repo) == [
        f"docs/decisions/{SLUG}.md:4: v1 is dated 2026-10-05 but the filename says 2026-10-01; "
        "the date never moves"
    ]


def test_revisions_start_at_v1(repo: Path) -> None:
    write(repo, f"docs/decisions/{SLUG}.md", RECORD.replace("v1 2026-10-01 (initial)", "2026-10-01"))
    assert messages(repo) == [f"docs/decisions/{SLUG}.md:1: Revisions starts 'v1 YYYY-MM-DD (initial)'"]


def test_a_superseded_record_names_a_successor_that_exists(repo: Path) -> None:
    write(repo, f"docs/decisions/{SLUG}.md",
          RECORD.replace("Accepted", "Superseded by ADR:2026-10-02-a-cache-entry-expires-after-a-day"))
    assert messages(repo) == [
        f"docs/decisions/{SLUG}.md:3: ADR:2026-10-02-a-cache-entry-expires-after-a-day resolves to no "
        "record under docs/decisions/; a record in another repo is cited as ADR:<repo>/<date>-<slug>"
    ]
