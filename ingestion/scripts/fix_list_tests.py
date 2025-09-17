#!/usr/bin/env python3
"""Fix list tests to use ListResponse.entities instead of direct len()"""

import re
from pathlib import Path


def fix_list_tests(file_path):
    """Fix list tests in a single file"""
    with open(file_path, "r") as f:
        content = f.read()

    # Pattern to match len(result) where result comes from .list()
    patterns = [
        (
            r"self\.assertEqual\(len\(result\), (\d+)\)",
            r"self.assertEqual(len(result.entities), \1)",
        ),
        (r"self\.assertEqual\(result\[0\]\.", r"self.assertEqual(result.entities[0]."),
        (r"self\.assertEqual\(result\[1\]\.", r"self.assertEqual(result.entities[1]."),
        (r"self\.assertEqual\(result\[2\]\.", r"self.assertEqual(result.entities[2]."),
        (r"for .+ in result:", r"for \g<0> in result.entities:"),
    ]

    changed = False
    for pattern, replacement in patterns:
        new_content, count = re.subn(pattern, replacement, content)
        if count > 0:
            content = new_content
            changed = True
            print(f"  Fixed {count} occurrence(s) of pattern: {pattern}")

    if changed:
        with open(file_path, "w") as f:
            f.write(content)
        print(f"✓ Fixed {file_path}")
        return True
    return False


def main():
    test_dir = Path("tests/unit/sdk")
    files_to_fix = [
        "test_container_entity.py",
        "test_database_entity.py",
        "test_database_schema_entity.py",
        "test_glossary_entity.py",
    ]

    fixed_count = 0
    for file_name in files_to_fix:
        file_path = test_dir / file_name
        if file_path.exists():
            if fix_list_tests(file_path):
                fixed_count += 1
        else:
            print(f"⚠ File not found: {file_path}")

    print(f"\nFixed {fixed_count} files")


if __name__ == "__main__":
    main()
