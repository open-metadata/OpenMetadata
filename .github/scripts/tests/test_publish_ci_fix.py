"""The fix agent's patch policy, checked on real git diffs."""

import importlib.util
import subprocess
import sys
from pathlib import Path

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
publish = load_script("publish_ci_fix")

TEST = "openmetadata-integration-tests/src/test/java/org/x/TableResourceIT.java"
SPEC = "openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Glossary.spec.ts"


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout.strip()


def repo_with(tmp_path, base_files, patch_files, deleted=()):
    src = tmp_path / "src"
    src.mkdir(parents=True)
    git(src, "init", "-q", "-b", "main")
    git(src, "config", "user.email", "ci@example.com")
    git(src, "config", "user.name", "ci")
    git(src, "config", "uploadpack.allowAnySHA1InWant", "true")
    for path, content in base_files.items():
        (src / path).parent.mkdir(parents=True, exist_ok=True)
        (src / path).write_text(content)
    git(src, "add", "-A")
    git(src, "commit", "-qm", "base")
    base = git(src, "rev-parse", "HEAD")
    for path, content in patch_files.items():
        (src / path).parent.mkdir(parents=True, exist_ok=True)
        (src / path).write_text(content)
    for path in deleted:
        (src / path).unlink()
    git(src, "add", "-A")
    git(src, "commit", "-qm", "fix")
    bundle = tmp_path / "fix.bundle"
    git(src, "bundle", "create", str(bundle), f"{base}..HEAD")
    return src, base, bundle


def checked(tmp_path, base_files, patch_files, deleted=()):
    src, base, bundle = repo_with(tmp_path, base_files, patch_files, deleted)
    return publish.load_bundle(tmp_path / "scratch", str(src), base, bundle)[1]


def test_a_focused_test_fix_passes_the_policy(tmp_path):
    result = checked(
        tmp_path,
        {TEST: "class T {\n  void t() { waitFor(index); assertEquals(2, count()); }\n}\n"},
        {TEST: "class T {\n  void t() { waitForSearchIndex(index); assertEquals(2, count()); }\n}\n"},
    )
    assert result.violations == [] and result.flags == []


def test_skipping_or_deleting_a_test_is_refused(tmp_path):
    result = checked(tmp_path, {SPEC: "test('colors', async () => {});\n"}, {SPEC: "test.skip('colors', async () => {});\n"})
    assert any("skip marker" in v for v in result.violations)
    deleted = checked(tmp_path / "d", {TEST: "class T {}\n", "README.md": "x\n"}, {"README.md": "y\n"}, deleted=[TEST])
    assert any("deletes the test file" in v for v in deleted.violations)


def test_build_and_ci_files_are_off_limits(tmp_path):
    result = checked(tmp_path, {"pom.xml": "<a/>\n", ".github/workflows/ci.yml": "on: push\n"}, {"pom.xml": "<b/>\n", ".github/workflows/ci.yml": "on: pr\n"})
    assert len(result.violations) == 2


def test_weakened_assertions_and_timeouts_are_flagged_not_refused(tmp_path):
    result = checked(
        tmp_path,
        {SPEC: "await expect(row).toBeVisible();\nawait page.waitForTimeout(1000);\n"},
        {SPEC: "await page.waitForTimeout(30000);\n"},
    )
    assert result.violations == []
    assert any("removes 1 assertion line" in f for f in result.flags)
    assert any("timeout" in f for f in result.flags)


def test_a_patch_not_built_on_its_base_is_refused(tmp_path):
    src, base, bundle = repo_with(tmp_path, {TEST: "a\n"}, {TEST: "b\n"})
    other = git(src, "commit-tree", "-m", "orphan", git(src, "rev-parse", "HEAD^{tree}"))
    head, result = publish.load_bundle(tmp_path / "scratch", str(src), other, bundle)
    assert result.violations == ["the patch does not build on the commit it started from"]


def test_a_published_fix_says_which_ci_tests_it():
    # Nothing in the fix workflow runs the patched code; the CI it lands in does.
    policy = publish.PolicyResult()
    on_pr = publish.render("pr", "7", policy, "", "", "Pushed onto `b` as abc.", "on")
    assert "this PR's CI tests it" in on_pr and "merge queue" in on_pr
    from_issue = publish.render("issue", "8", policy, "", "", "Opened #9 from `ci-fix/flaky-8`.", "on")
    assert "the new PR's CI tests it" in from_issue
    unfinished = publish.render("pr", "7", policy, "", "", "", "on", state="agent-failed")
    assert "not published" in unfinished and "did not finish" in unfinished
