import os
import subprocess
import sys
from pathlib import Path

import yaml


EXCLUDED_DIRS = ("/.vscode/", "/great_expectations/resources/", "/playwright/test-data/")
JSON_BATCH_SIZE = 128


def validate_json(paths: list[str]) -> bool:
    for start in range(0, len(paths), JSON_BATCH_SIZE):
        command = ["jq", "-n"]
        # Parse each file independently so incomplete documents cannot span files.
        for index, path in enumerate(paths[start : start + JSON_BATCH_SIZE]):
            command.extend(("--slurpfile", f"file{index}", path))
        if subprocess.run([*command, "empty"], check=False).returncode:
            return False
    return True


def validate_yaml(paths: list[str]) -> bool:
    for path in map(Path, paths):
        if path.is_symlink():
            continue
        try:
            with path.open() as stream:
                list(yaml.safe_load_all(stream))
        except (OSError, UnicodeError, yaml.YAMLError) as error:
            print(f"Invalid YAML in {path}: {error}", file=sys.stderr)
            return False
    return True


def main() -> int:
    tracked = subprocess.check_output(
        ["git", "ls-files", "-z", "--", "*.json", "*.yaml", "*.yml"]
    )
    paths = [
        path
        for path in os.fsdecode(tracked).split("\0")
        if path and not any(excluded in path for excluded in EXCLUDED_DIRS)
    ]

    print("Validating JSON files...", flush=True)
    if not validate_json([path for path in paths if path.endswith(".json")]):
        return 1

    print("Validating YAML files...", flush=True)
    yaml_paths = [path for path in paths if path.endswith((".yaml", ".yml"))]
    return int(not validate_yaml(yaml_paths))


if __name__ == "__main__":
    sys.exit(main())
