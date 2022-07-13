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

import json
import jsonschema2md
from datetime import datetime
from typing import List
from pathlib import Path

SOURCES_ROOT = "catalog-rest-service/src/main/resources/json/"
SINK_ROOT = "openmetadata-docs/content"
SCHEMAS_ROOT = SINK_ROOT + "/main-concepts/metadata-standard/schemas/"

PARSER = jsonschema2md.Parser(
    examples_as_yaml=False,
    show_examples="all",
)

NOW = datetime.utcnow()


def build_new_file(file: Path) -> Path:
    return Path(str(file).replace(SOURCES_ROOT, SCHEMAS_ROOT).replace(".json", ".md"))


def generate_slug(new_file: Path) -> str:
    return str(new_file.parent).replace(SINK_ROOT, "")


def write_md(new_file: Path, lines: List[str]) -> None:
    new_absolute = new_file.absolute()
    new_absolute.parent.mkdir(exist_ok=True, parents=True)

    with open(new_absolute, "w") as f:
        for line in lines:
            f.write(line)


def prepare_menu(new_file: Path) -> None:
    slug = generate_slug(new_file)
    category_root = "- category: Main Concepts / Metadata Standard / Schemas / "
    category_suffix = str(new_file.parent).replace(SCHEMAS_ROOT, "")
    category_suffix_list = list(map(lambda x: x.capitalize(), category_suffix.split("/"))) + ([new_file.stem] if new_file.stem != "index" else [])
    category = category_root + " / ".join(category_suffix_list)
    print(category)
    print(f"  url: {slug}")


def generate_header(new_file: Path) -> List[str]:
    sep = "---\n"
    title = f"title: {new_file.stem}\n"
    slug = f"slug: {generate_slug(new_file)}\n"
    return [sep, title, slug, sep, "\n"]


def generated_at() -> List[str]:
    return [f"\n\nDocumentation file automatically generated at {NOW}.\n"]


def main() -> None:
    """
    Main execution to generate the markdown docs
    based on the JSON Schemas
    """

    results = [
        file
        for file in Path(SOURCES_ROOT).rglob("*.json")
    ]

    for file in results:
        with open(file.absolute()) as f:
            md_lines = PARSER.parse_schema(json.load(f))

            new_file = build_new_file(file)
            all_lines = generate_header(new_file) + md_lines + generated_at()
            write_md(new_file, all_lines)
            prepare_menu(new_file)

    indexes = list({
        file.parent / "index.md" for file in results
    })

    for index in indexes:
        new_file = build_new_file(index)
        all_lines = generate_header(new_file) + [f"# {index.parent.stem}"] + generated_at()
        write_md(new_file, all_lines)
        prepare_menu(new_file.parent)


if __name__ == "__main__":
    main()
