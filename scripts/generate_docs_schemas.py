#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
This script generates all markdown files from JSON Schemas.

It prints out the content that should be pasted into the menu.md.

We should automate this at some point.

Note that it currently has a bug where we generate an entry:

```
  - category: Main Concepts / Metadata Standard / Schemas / Openmetadata-docs / Content / Main-concepts / Metadata-standard / Schemas
    url: /main-concepts/metadata-standard/schemas
```
which is incorrect and should be removed when pasting this in.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List
import re
import jsonschema2md

SOURCES_ROOT = "openmetadata-spec/src/main/resources/json/schema"
SINK_ROOT = "openmetadata-docs/content/v1.10.x-SNAPSHOT"
SCHEMAS_ROOT = SINK_ROOT + "/main-concepts/metadata-standard/schemas/"

PARSER = jsonschema2md.Parser(
    examples_as_yaml=False,
    show_examples="all",
)
NOW = datetime.now(timezone.utc)


def build_new_file(file: Path) -> Path:
    return Path(str(file).replace(SOURCES_ROOT, SCHEMAS_ROOT).replace(".json", ".md"))


def generate_slug(new_file: Path, is_file) -> str:
    url = str(new_file.parent).replace(SINK_ROOT, "").lower()
    if is_file:
        return url + f"/{new_file.stem.lower()}"
    return url


def to_tile(string: str) -> str:
    """
    Convert string to title
    """
    return string[0].upper() + string[1:]


def write_md(new_file: Path, lines: List[str]) -> None:
    new_absolute = new_file.absolute()
    new_absolute.parent.mkdir(exist_ok=True, parents=True)
    with open(new_absolute, "w") as f:
        for line in lines:
            f.write(line)


def prepare_menu(new_file: Path, is_file: bool) -> None:
    slug = generate_slug(new_file, is_file)
    category_root = "- category: Main Concepts / Metadata Standard / Schemas / "
    category_suffix = str(new_file.parent).replace(SCHEMAS_ROOT, "")
    title = [to_tile(new_file.stem)] if is_file else []
    category_suffix_list = (
        list(map(lambda x: x.capitalize(), category_suffix.split("/"))) + title
    )
    category = category_root + " / ".join(category_suffix_list)
    print(category)
    print(f"  url: {slug}")


def generate_folder_content(directory: Path, slug: str) -> List[str]:
    """
    Generate default content for a folder (directory index).
    """
    folder_name = to_tile(directory.stem)
    sub_items = list(directory.iterdir())
    content = [f"# {folder_name}\n\n"]
    content.append(f"This folder contains the following items:\n\n")   
    for item in sub_items:
        item_slug = item.stem.lower()
        if item.is_dir():
            content.append(f"- [**{to_tile(item.stem)}**]({slug}/{item_slug})\n")
        else:
            content.append(f"- [**{to_tile(item.stem)}**]({slug}/{item_slug})\n")    
    return content


def generate_header(new_file: Path, is_file: bool) -> List[str]:
    sep = "---\n"
    title = f"title: {new_file.stem}\n"
    slug = f"slug: {generate_slug(new_file, is_file)}\n"
    return [sep, title, slug, sep, "\n"]

def generated_at() -> List[str]:
    return [f"\n\nDocumentation file automatically generated at {NOW}.\n"]

def remove_a_tags(lines: List[str]) -> List[str]:
    """
    Remove <a> tags from the given lines of Markdown content.
    """
    cleaned_lines = []
    for line in lines:
        cleaned_line = re.sub(r'<a[^>]*>(.*?)</a>', r'\1', line)
        cleaned_lines.append(cleaned_line)
    return cleaned_lines

def main() -> None:
    """
    Main execution to generate the markdown docs
    based on the JSON Schemas

    We build a list of (FilePath, True or False, if it is file or index)
    """

    results = [(file, True) for file in Path(SOURCES_ROOT).rglob("*.json")]
    directories = [Path(x[0]) for x in os.walk(SOURCES_ROOT)]
    indexes = list((directory / "index.md", False) for directory in directories)
    all_elems = results + indexes
    all_elems.sort()

    for elem, is_file in all_elems:
        new_file = build_new_file(elem)
        if is_file:
            with open(elem.absolute()) as f:
                md_lines = PARSER.parse_schema(json.load(f))
                md_lines = remove_a_tags(md_lines)  # Remove <a> tags
        else:
            md_lines = [f"# {to_tile(elem.parent.stem)}"]
        all_lines = generate_header(new_file, is_file) + md_lines + generated_at()
        write_md(new_file, all_lines)
        prepare_menu(new_file, is_file)

    for elem, is_file in indexes:
        new_file = build_new_file(elem)
        slug = generate_slug(new_file, is_file=False)
        md_lines = generate_folder_content(elem.parent, slug)
        all_lines = generate_header(new_file, is_file=False) + md_lines + generated_at()
        write_md(new_file, all_lines)
        prepare_menu(new_file, is_file=False)

if __name__ == "__main__":
    main()