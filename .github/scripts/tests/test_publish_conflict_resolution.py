"""Publishing a conflict resolution: what may be pushed, and what the PR is told."""

import importlib.util
import json
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
publish = load_script("publish_conflict_resolution")


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
def src(tmp_path):
    """A PR branch and main that both changed Foo.java (a conflict) and each changed a
    file of its own (merged cleanly); the PR branch is checked out."""
    repo = tmp_path / "src"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.email", "ci@example.com")
    git(repo, "config", "user.name", "ci")
    git(repo, "config", "uploadpack.allowAnySHA1InWant", "true")
    commit(repo, "Foo.java", "base\n", "base")
    git(repo, "checkout", "-qb", "pr")
    commit(repo, "Foo.java", "pr\n", "pr change")
    commit(repo, "Pr.java", "pr only\n", "pr file")
    git(repo, "checkout", "-q", "main")
    commit(repo, "Foo.java", "main\n", "main change")
    commit(repo, "Main.java", "main only\n", "main file")
    git(repo, "checkout", "-q", "pr")
    return repo


def resolve(repo, edits):
    """The resolve job: merge main, write `edits`, commit the merge. Returns (head, merge)."""
    head = git(repo, "rev-parse", "HEAD")
    subprocess.run(["git", "merge", "--no-ff", "--no-commit", "main"], cwd=repo, capture_output=True)
    for path, content in edits.items():
        (repo / path).write_text(content)
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "--no-edit")
    return head, git(repo, "rev-parse", "HEAD")


def check(repo, tmp_path, head, merge):
    bundle = tmp_path / "resolution.bundle"
    git(repo, "bundle", "create", str(bundle), f"{head}..HEAD")
    return publish.resolution_head(tmp_path / "scratch", str(repo), head, merge, bundle)


def test_a_merge_that_edits_only_the_conflicted_file_may_be_pushed(src, tmp_path):
    head, merge = resolve(src, {"Foo.java": "pr\nmain\n"})
    assert check(src, tmp_path, head, merge) == (merge, [])


def test_a_merge_that_also_edits_a_cleanly_merged_file_is_refused(src, tmp_path):
    head, merge = resolve(src, {"Foo.java": "pr\nmain\n", "Main.java": "tidied by the model\n"})
    _, problems = check(src, tmp_path, head, merge)
    assert problems == ["the resolution changed files merging main does not leave conflicted: Main.java"]


def test_a_merge_that_adds_a_file_is_refused(src, tmp_path):
    head, merge = resolve(src, {"Foo.java": "pr\nmain\n", "Extra.java": "new\n"})
    _, problems = check(src, tmp_path, head, merge)
    assert problems and problems[0].endswith("Extra.java")


def test_anything_after_the_merge_commit_is_refused(src, tmp_path):
    head, merge = resolve(src, {"Foo.java": "pr\nmain\n"})
    commit(src, "Foo.java", "rewritten\n", "after the merge")
    _, problems = check(src, tmp_path, head, merge)
    assert problems == ["the bundle is not the resolution's merge commit"]


def test_a_merge_into_another_commit_is_refused(src, tmp_path):
    head = git(src, "rev-parse", "HEAD")
    commit(src, "Pr.java", "moved on\n", "another commit")
    _, merge = resolve(src, {"Foo.java": "pr\nmain\n"})
    _, problems = check(src, tmp_path, head, merge)
    assert problems == ["the resolution is not a merge into the PR head it started from"]


@pytest.mark.parametrize(
    ("state", "check_result", "expected"),
    [
        ("resolved", {"ok": True, "requeue": "auto"}, "auto"),
        ("resolved", {"ok": True, "requeue": "human"}, "human"),
        ("resolved", {"ok": False, "requeue": "none"}, "none"),
        ("resolved", {}, "none"),
        ("declined", {}, "none"),
    ],
)
def test_requeue_policy(state, check_result, expected):
    assert publish.requeue_policy(state, {}, check_result) == expected


def artifacts(**overrides):
    return {
        "plan": {"locale": ["en-us.json"], "ai": ["Foo.java"], "human": [".github/workflows/x.yml"]},
        "regenerate": [],
        "check": {"dropped": {"Foo.java": {"pr": ["int a() { return 2; }"], "main": []}}},
        "notes": "kept both",
        "abort": "",
        **overrides,
    }


def test_the_comment_names_files_dropped_lines_and_carries_the_head_marker():
    body = publish.render("resolved", artifacts(), pushed=False, requeue="human", problems=[], mode="dry-run", head="abc123")
    assert "Resolved mechanically:** `en-us.json`" in body
    assert "Resolved by Claude:** `Foo.java`" in body
    assert "`int a() { return 2; }`" in body and "this PR" in body
    assert "This PR's CI builds and tests the merge commit" in body
    assert "Dry run" in body
    assert body.endswith("<!-- ci-conflict-resolve: abc123 -->")


def test_an_agent_that_did_not_finish_is_reported_not_published():
    body = publish.render("agent-failed", artifacts(), pushed=False, requeue="none", problems=[], mode="on", head="abc")
    assert "Claude did not finish, so nothing it edited is used" in body
    assert "re-queue the PR" not in body


def test_taken_generated_files_come_with_the_commands_that_regenerate_them():
    commands = [["bash", "-c", "cd openmetadata-ui/src/main/resources/ui && ./json2ts-generate-all.sh -l true"]]
    body = publish.render(
        "resolved", artifacts(regenerate=commands), pushed=True, requeue="human", problems=[], mode="on", head="abc"
    )
    assert "Regenerate before re-queueing" in body
    assert "bash -c 'cd openmetadata-ui/src/main/resources/ui && ./json2ts-generate-all.sh -l true'" in body


def test_a_resolution_whose_checks_did_not_pass_is_never_pushed(monkeypatch, tmp_path):
    (tmp_path / "plan.json").write_text(json.dumps({"plan": {"ai": ["Foo.java"]}}))
    (tmp_path / "merge-commit.txt").write_text("f" * 40)
    (tmp_path / "resolution.bundle").write_text("not reached")
    env = {"STATE": "resolved", "MODE": "on", "HEAD_SHA": "e" * 40, "HEAD_REPO": "o/r", "HEAD_REF": "b",
           "REPO": "o/r", "PR": "7", "GH_TOKEN": "t", "PUSH_TOKEN": "p"}
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    comments = []
    monkeypatch.setattr(publish, "post", lambda path, body, token: comments.append(body["body"]))
    monkeypatch.setattr(publish, "resolution_head", lambda *a: pytest.fail("must not reach the push"))
    assert publish.main(["--artifacts", str(tmp_path)]) == 0
    assert "Not pushed:** the resolution's checks did not pass" in comments[0]
