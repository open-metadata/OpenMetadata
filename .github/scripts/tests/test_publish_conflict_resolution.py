"""Publishing a conflict resolution: what may be pushed, and what the PR is told."""

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


load_script("merge_queue_metrics")
load_script("conflict_resolvers")
publish = load_script("publish_conflict_resolution")

GENERATED = "openmetadata-ui/src/main/resources/ui/src/generated/entity/table.ts"


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout.strip()


def commit(repo, path, content, message):
    file = repo / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content)
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", message)
    return git(repo, "rev-parse", "HEAD")


@pytest.fixture
def history(tmp_path):
    """A PR head, a main commit, the resolve job's merge commit, and verify's bundle."""
    src = tmp_path / "src"
    src.mkdir()
    git(src, "init", "-q", "-b", "main")
    git(src, "config", "user.email", "ci@example.com")
    git(src, "config", "user.name", "ci")
    git(src, "config", "uploadpack.allowAnySHA1InWant", "true")
    commit(src, "Foo.java", "base\n", "base")
    git(src, "checkout", "-qb", "pr")
    head = commit(src, "Foo.java", "pr\n", "pr change")
    git(src, "checkout", "-q", "main")
    commit(src, "Bar.java", "main\n", "main change")
    git(src, "checkout", "-q", "pr")
    git(src, "merge", "-q", "--no-edit", "main")
    merge = git(src, "rev-parse", "HEAD")
    return src, head, merge


def bundle(src, head, out):
    git(src, "bundle", "create", str(out), f"{head}..HEAD")
    return out


def test_a_result_that_only_regenerates_builds_on_the_merge_and_may_be_pushed(history, tmp_path):
    src, head, merge = history
    regen = commit(src, GENERATED, "export interface T {}\n", "regenerate")
    pushed, problems = publish.verified_head(tmp_path / "scratch", str(src), head, merge, bundle(src, head, tmp_path / "v.bundle"))
    assert (pushed, problems) == (regen, [])


def test_verify_editing_source_files_is_refused(history, tmp_path):
    src, head, merge = history
    commit(src, "Foo.java", "sneaky\n", "not a regeneration")
    _, problems = publish.verified_head(tmp_path / "scratch", str(src), head, merge, bundle(src, head, tmp_path / "v.bundle"))
    assert problems and "not generated output" in problems[0]


def test_a_result_not_built_on_the_resolution_is_refused(history, tmp_path):
    src, head, merge = history
    git(src, "reset", "-q", "--hard", head)
    commit(src, "Foo.java", "rewritten\n", "rewrote history")
    _, problems = publish.verified_head(tmp_path / "scratch", str(src), head, merge, bundle(src, head, tmp_path / "v.bundle"))
    assert problems == ["verify's result does not build on the resolution's merge commit"]


@pytest.mark.parametrize(
    ("state", "check", "expected"),
    [
        ("resolved", {"ok": True, "requeue": "auto"}, "auto"),
        ("resolved", {"ok": True, "requeue": "human"}, "human"),
        ("resolved", {"ok": False, "requeue": "none"}, "none"),
        ("declined", {}, "none"),
    ],
)
def test_requeue_policy(state, check, expected):
    assert publish.requeue_policy(state, {}, check) == expected


def test_the_comment_names_files_dropped_lines_and_carries_the_head_marker():
    art = {
        "plan": {"locale": ["en-us.json"], "ai": ["Foo.java"], "human": [".github/workflows/x.yml"]},
        "check": {"dropped": {"Foo.java": {"pr": ["int a() { return 2; }"], "main": []}}},
        "notes": "kept both",
        "abort": "",
    }
    body = publish.render("resolved", art, pushed=False, requeue="human", problems=[], mode="dry-run", head="abc123")
    assert "Resolved mechanically:** `en-us.json`" in body
    assert "Resolved by Claude:** `Foo.java`" in body
    assert "`int a() { return 2; }`" in body and "this PR" in body
    assert "Dry run" in body
    assert body.endswith("<!-- ci-conflict-resolve: abc123 -->")
