"""Conflict resolution against real git merges: classification, mechanical resolution,
the checks on a model's edits, and the re-queue verdict."""

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("conflict_resolvers", SCRIPTS / "conflict_resolvers.py")
resolvers = importlib.util.module_from_spec(spec)
sys.modules["conflict_resolvers"] = resolvers
spec.loader.exec_module(resolvers)

UI = resolvers.UI
LOCALE = f"{UI}/src/locale/languages/en-us.json"
GENERATED = f"{UI}/src/generated/entity/data/table.ts"
JAVA = "openmetadata-service/src/main/java/org/openmetadata/Foo.java"


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout


def write(repo, path, content):
    file = repo / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content, encoding="utf-8")


def locale(**labels):
    return resolvers.dump_locale({"label": labels, "message": {}})


def conflicted_repo(tmp_path, base, pr, main):
    """A PR branch and main that both changed the files in `base`; `git merge main` on the
    PR branch is left stopped on the conflicts."""
    repo = tmp_path / "repo"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.email", "ci@example.com")
    git(repo, "config", "user.name", "ci")
    for path, content in base.items():
        write(repo, path, content)
    write(repo, "README.md", "unrelated\n")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "base")
    git(repo, "checkout", "-qb", "pr")
    for path, content in pr.items():
        write(repo, path, content)
    git(repo, "commit", "-qam", "pr change")
    git(repo, "checkout", "-q", "main")
    for path, content in main.items():
        write(repo, path, content)
    git(repo, "commit", "-qam", "main change")
    git(repo, "checkout", "-q", "pr")
    merged = subprocess.run(["git", "merge", "main"], cwd=repo, capture_output=True, text=True)
    assert merged.returncode != 0, "the fixture must conflict"
    return repo


JAVA_BASE = "class Foo {\n  int a() { return 1; }\n}\n"
JAVA_PR = "class Foo {\n  int a() { return 2; }\n  int prOnly() { return 3; }\n}\n"
JAVA_MAIN = "class Foo {\n  int a() { return 4; }\n  int mainOnly() { return 5; }\n}\n"


@pytest.fixture
def repo(tmp_path):
    return conflicted_repo(
        tmp_path,
        base={
            LOCALE: locale(a="A", shared="S"),
            GENERATED: "export interface Table { a: string }\n",
            f"{UI}/yarn.lock": "lock v1\n",
            ".github/workflows/ci.yml": "on: push\n",
            "pom.xml": "<version>1</version>\n",
            JAVA: JAVA_BASE,
        },
        pr={
            LOCALE: locale(a="A", shared="S", b="B"),
            GENERATED: "export interface Table { a: string; pr: number }\n",
            f"{UI}/yarn.lock": "lock pr\n",
            ".github/workflows/ci.yml": "on: pull_request\n",
            "pom.xml": "<version>pr</version>\n",
            JAVA: JAVA_PR,
        },
        main={
            LOCALE: locale(a="A", shared="S", c="C"),
            GENERATED: "export interface Table { a: string; main: boolean }\n",
            f"{UI}/yarn.lock": "lock main\n",
            ".github/workflows/ci.yml": "on: merge_group\n",
            "pom.xml": "<version>main</version>\n",
            JAVA: JAVA_MAIN,
        },
    )


def test_every_conflict_lands_in_exactly_one_class(repo):
    plan = resolvers.classify(resolvers.conflicted_paths(repo))
    assert plan.locale == [LOCALE]
    assert plan.generated == [GENERATED]
    assert plan.lockfile == [f"{UI}/yarn.lock"]
    assert plan.human == [".github/workflows/ci.yml"]
    assert plan.sensitive == ["pom.xml"]
    assert plan.ai == [JAVA]
    assert plan.mechanical_only() is False


def test_mechanical_resolution_merges_locale_keys_and_takes_mains_generated_files(repo):
    plan = resolvers.classify(resolvers.conflicted_paths(repo))
    plan, commands = resolvers.apply(repo, plan)

    merged = json.loads((repo / LOCALE).read_text())
    assert merged["label"] == {"a": "A", "b": "B", "c": "C", "shared": "S"}
    assert (repo / LOCALE).read_text() == locale(a="A", b="B", c="C", shared="S")
    assert (repo / GENERATED).read_text().endswith("main: boolean }\n")
    still = resolvers.conflicted_paths(repo)
    assert LOCALE not in still and GENERATED not in still and f"{UI}/yarn.lock" not in still
    flat = [" ".join(c) for c in commands]
    assert any("json2ts-generate-all.sh" in c for c in flat)
    assert any(f"cd {UI} && yarn install" in c for c in flat)


def test_a_locale_key_both_sides_changed_goes_to_the_model(tmp_path):
    repo = conflicted_repo(
        tmp_path,
        base={LOCALE: locale(a="A")},
        pr={LOCALE: locale(a="Apple")},
        main={LOCALE: locale(a="Avocado")},
    )
    plan, _ = resolvers.apply(repo, resolvers.classify(resolvers.conflicted_paths(repo)))
    assert plan.locale == [] and plan.ai == [LOCALE]


def model_resolves(repo, content):
    write(repo, JAVA, content)


def checked(repo, plan):
    originals = resolvers.capture_originals(repo, plan.conflicted())
    plan, _ = resolvers.apply(repo, plan)
    return plan, originals


def test_a_resolution_that_keeps_both_sides_passes_with_a_human_requeue(repo):
    plan, originals = checked(repo, resolvers.classify(resolvers.conflicted_paths(repo)))
    model_resolves(repo, "class Foo {\n  int a() { return 4; }\n  int prOnly() { return 3; }\n  int mainOnly() { return 5; }\n}\n")
    write(repo, ".github/workflows/ci.yml", "on: [pull_request, merge_group]\n")
    write(repo, "pom.xml", "<version>main</version>\n")
    result = resolvers.check(repo, plan, originals)
    assert result.ok()
    assert result.dropped[JAVA]["pr"] == ["int a() { return 2; }"]
    assert result.requeue(plan) == "human"


def test_edits_outside_the_conflict_and_leftover_markers_fail(repo):
    plan, originals = checked(repo, resolvers.classify(resolvers.conflicted_paths(repo)))
    write(repo, "README.md", "the model also tidied this\n")
    result = resolvers.check(repo, plan, originals)
    assert result.outside_scope == ["README.md"]
    assert JAVA in result.markers
    assert result.ok() is False and result.requeue(plan) == "none"


def test_dropped_lines_name_what_each_side_lost():
    dropped = resolvers.dropped_lines(
        base="a\nb\n", ours="a\nb\npr-line\n", theirs="a\nb\nmain-line\n", resolved="a\nb\nmain-line\n"
    )
    assert dropped == {"pr": ["pr-line"], "main": []}


def test_only_fully_mechanical_resolutions_requeue_themselves(tmp_path):
    repo = conflicted_repo(
        tmp_path,
        base={LOCALE: locale(a="A")},
        pr={LOCALE: locale(a="A", b="B")},
        main={LOCALE: locale(a="A", c="C")},
    )
    plan = resolvers.classify(resolvers.conflicted_paths(repo))
    originals = resolvers.capture_originals(repo, plan.conflicted())
    plan, _ = resolvers.apply(repo, plan)
    result = resolvers.check(repo, plan, originals)
    assert (result.ok(), result.requeue(plan)) == (True, "auto")
    assert resolvers.finalize(repo, plan) == []


def test_taking_mains_generated_files_leaves_the_requeue_to_a_person(tmp_path):
    # Regenerating would run the PR's code, so nothing here does; until the PR's own
    # workflows or its author regenerate, it does not go back in the queue by itself.
    repo = conflicted_repo(
        tmp_path,
        base={GENERATED: "export interface Table { a: string }\n"},
        pr={GENERATED: "export interface Table { a: string; pr: number }\n"},
        main={GENERATED: "export interface Table { a: string; main: boolean }\n"},
    )
    plan = resolvers.classify(resolvers.conflicted_paths(repo))
    originals = resolvers.capture_originals(repo, plan.conflicted())
    plan, commands = resolvers.apply(repo, plan)
    result = resolvers.check(repo, plan, originals)
    assert (result.ok(), result.requeue(plan)) == (True, "human")
    assert any("json2ts-generate-all.sh" in " ".join(c) for c in commands)


def test_a_locale_file_the_checkout_made_a_symlink_is_never_written_through(tmp_path):
    repo = conflicted_repo(
        tmp_path,
        base={LOCALE: locale(a="A")},
        pr={LOCALE: locale(a="A", b="B")},
        main={LOCALE: locale(a="A", c="C")},
    )
    outside = tmp_path / "tool.py"
    outside.write_text("trusted\n")
    (repo / LOCALE).unlink()
    (repo / LOCALE).symlink_to(outside)
    plan, _ = resolvers.apply(repo, resolvers.classify(resolvers.conflicted_paths(repo)))
    assert outside.read_text() == "trusted\n"
    assert (plan.locale, plan.human) == ([], [LOCALE])


def test_finalize_refuses_a_staged_conflict_marker(repo):
    plan, _ = checked(repo, resolvers.classify(resolvers.conflicted_paths(repo)))
    for path in (".github/workflows/ci.yml", "pom.xml"):
        write(repo, path, "resolved\n")
    problems = resolvers.finalize(repo, plan)
    assert problems and all("conflict marker" in p.lower() for p in problems)
