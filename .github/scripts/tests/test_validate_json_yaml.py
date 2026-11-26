import subprocess
from pathlib import Path

import pytest


VALIDATOR = Path(__file__).resolve().parents[3] / "scripts/validate_json_yaml.sh"


@pytest.fixture
def repository(tmp_path):
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    return tmp_path


def write_tracked(repository, files):
    for name, content in files.items():
        path = repository / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    subprocess.run(["git", "add", "--", *files], cwd=repository, check=True)


def validate(repository):
    return subprocess.run(
        ["bash", VALIDATOR], cwd=repository, capture_output=True, text=True
    )


def test_validates_tracked_files_and_keeps_parser_exclusions(repository):
    write_tracked(
        repository,
        {
            "empty.json": " \n",
            "values.json": "{}\ntrue\n",
            "multi document.yaml": "a: 1\n---\nb: 2\n",
            "fixtures/.vscode/bad.json": "{",
            "fixtures/great_expectations/resources/bad.yaml": "value: [",
            "fixtures/playwright/test-data/bad.yml": "value: [",
        },
    )
    (repository / "untracked.yaml").write_text("value: [", encoding="utf-8")
    (repository / "link.yaml").symlink_to("untracked.yaml")
    subprocess.run(["git", "add", "--", "link.yaml"], cwd=repository, check=True)

    result = validate(repository)
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize(
    ("files", "invalid"),
    [
        ({"a.json": '{"value":', "b.json": "true}"}, "a.json"),
        ({"a.json": "{}", "b.json": "{"}, "b.json"),
        ({"multi document.yml": "a: 1\n---\nb: ["}, "multi document.yml"),
    ],
)
def test_reports_invalid_file_and_exits_unsuccessfully(repository, files, invalid):
    write_tracked(repository, files)

    result = validate(repository)
    assert result.returncode != 0
    assert invalid in result.stderr
