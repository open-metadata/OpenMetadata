import importlib.util
import subprocess
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location(
    "entity_repository_size", Path(__file__).parents[1] / "entity_repository_size.py"
)
size = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(size)


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def repository(tmp_path, name="native"):
    root = tmp_path / name
    root.mkdir()
    git(root, "init", "-q")
    path = root / "service/src/main/java/Example.java"
    path.parent.mkdir(parents=True)
    path.write_text("class Example {\n  int one;\n  int two;\n}\n")
    git(root, "add", ".")
    git(
        root,
        "-c",
        "user.name=Size Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-qm",
        "Initial fixture",
    )
    return root, path


def test_new_files_and_companion_growth_cannot_escape_the_budget(tmp_path):
    native, source = repository(tmp_path)
    companion, other = repository(tmp_path, "companion")
    source.write_text("class Example {}\n")
    extra = other.with_name("Additional.java")
    extra.write_text("class Additional {\n  int one;\n  int two;\n  int three;\n}\n")
    result = size.evaluate([(native, "HEAD"), (companion, "HEAD")])
    assert not result["passed"]
    assert result["delta"]["physical"] == 2
    assert len(result["repositories"][1]["files"]) == 1


def test_deleted_implementations_count_and_tests_do_not(tmp_path):
    root, source = repository(tmp_path)
    source.unlink()
    test = root / "service/src/test/java/LargeTest.java"
    test.parent.mkdir(parents=True)
    test.write_text("// regression\n" * 500)
    result = size.evaluate([(root, "HEAD")])
    assert result["passed"]
    assert result["delta"]["physical"] == -4
    assert result["delta"]["nonblank"] == -4


@pytest.mark.parametrize("replacement", ["class Example { int one; int two; }\n", ""])
def test_formatting_or_comment_removal_cannot_satisfy_the_ratchet(
    tmp_path, replacement
):
    root, source = repository(tmp_path)
    if replacement:
        source.write_text(replacement)
    else:
        source.write_text("class Example {\n  int one;\n  int two;\n}\n// comment\n")
        git(root, "add", ".")
        git(
            root,
            "-c",
            "user.name=Size Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "-qm",
            "Add comment",
        )
        source.write_text("class Example {\n  int one;\n  int two;\n}\n")
    assert not size.evaluate([(root, "HEAD")])["passed"]


def test_rename_cannot_be_reported_as_deleted_code(tmp_path):
    root, source = repository(tmp_path)
    source.rename(source.with_name("Renamed.java"))
    result = size.evaluate([(root, "HEAD")])
    assert not result["passed"]
    assert result["delta"] == {"physical": 0, "nonblank": 0, "tokens": 0}


def test_scope_cannot_count_the_same_checkout_twice(tmp_path):
    root, _ = repository(tmp_path)
    with pytest.raises(ValueError, match="Duplicate repository"):
        size.evaluate([(root, "HEAD"), (root, "HEAD")])


def test_token_count_preserves_comment_markers_inside_java_strings():
    assert size.measure('String value = "//not a comment";\n')["tokens"] == 5
    assert size.measure("/* comment */\n\n")["tokens"] == 0
