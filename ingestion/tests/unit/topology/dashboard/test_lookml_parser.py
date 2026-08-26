#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
LkmlParser tests.

The parser reads through the Reader abstraction, so these drive it from an in-memory
implementation. That keeps include resolution testable without a repository host, and
lets the cases below exercise shapes a fixture repo cannot easily hold.
"""

import pytest

from metadata.ingestion.source.dashboard.looker.models import Includes, ViewName
from metadata.ingestion.source.dashboard.looker.parser import LkmlParser
from metadata.readers.file.base import Reader, ReadException

CATS_VIEW = """
view: cats {
  sql_table_name: public.cats ;;
  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
  }
}
"""

DOGS_VIEW = """
view: dogs {
  sql_table_name: public.dogs ;;
}
"""


class InMemoryReader(Reader):
    """Reader backed by a path -> contents mapping, recording every read it serves."""

    def __init__(self, files: dict[str, str], tree: list[str] | None = None):
        self.files = files
        self._tree = list(files) if tree is None else tree
        self.read_paths: list[str] = []

    def read(self, path: str, **kwargs) -> str:
        self.read_paths.append(path)
        if path not in self.files:
            raise ReadException(f"Error trying to read the file [{path}]")

        return self.files[path]

    def _get_tree(self) -> list[str]:
        return self._tree


def parser_for(files: dict[str, str], tree: list[str] | None = None) -> LkmlParser:
    return LkmlParser(InMemoryReader(files, tree=tree))


def test_parse_file_caches_raw_contents():
    parser = parser_for({"cats.explore.lkml": 'include: "cats.view.lkml"\n'})

    parser.parse_file(Includes("cats.explore.lkml"))

    assert "cats.view.lkml" in parser.parsed_files[Includes("cats.explore.lkml")]


def test_find_view_follows_includes():
    parser = parser_for(
        {
            "cats.explore.lkml": 'include: "cats.view.lkml"\n',
            "cats.view.lkml": CATS_VIEW,
        }
    )

    view = parser.find_view(view_name=ViewName("cats"), path=Includes("cats.explore.lkml"))

    assert view is not None
    assert view.name == "cats"
    assert view.sql_table_name == "public.cats"
    assert view.source_file == "cats.view.lkml"


def test_find_view_traverses_nested_includes():
    parser = parser_for(
        {
            "root.lkml": 'include: "middle.lkml"\n',
            "middle.lkml": 'include: "leaf.lkml"\n',
            "leaf.lkml": CATS_VIEW,
        }
    )

    assert parser.find_view(view_name=ViewName("cats"), path=Includes("root.lkml")) is not None


@pytest.mark.parametrize("extension", [".lkml", ".lookml"])
def test_include_without_extension_is_resolved(extension):
    """An include may omit the extension; the parser appends the supported ones."""
    parser = parser_for(
        {
            "cats.explore.lkml": 'include: "cats.view"\n',
            f"cats.view{extension}": CATS_VIEW,
        }
    )

    assert parser.find_view(view_name=ViewName("cats"), path=Includes("cats.explore.lkml")) is not None


def test_wildcard_include_expands_from_the_file_tree():
    parser = parser_for(
        {
            "cats.explore.lkml": 'include: "/views/*.view.lkml"\n',
            "/views/cats.view.lkml": CATS_VIEW,
            "/views/dogs.view.lkml": DOGS_VIEW,
        }
    )

    assert parser.find_view(view_name=ViewName("dogs"), path=Includes("cats.explore.lkml")) is not None


def test_wildcard_include_without_extension_expands():
    parser = parser_for(
        {
            "cats.explore.lkml": 'include: "/views/*"\n',
            "/views/cats.view.lkml": CATS_VIEW,
        }
    )

    assert parser.find_view(view_name=ViewName("cats"), path=Includes("cats.explore.lkml")) is not None


def test_external_includes_are_never_read():
    """`//` includes point at another repository and must not reach the reader."""
    reader = InMemoryReader({"cats.explore.lkml": 'include: "//other-project/cats.view.lkml"\n'})
    parser = LkmlParser(reader)

    assert parser.find_view(view_name=ViewName("cats"), path=Includes("cats.explore.lkml")) is None
    assert not any("other-project" in path for path in reader.read_paths)


def test_each_file_is_read_only_once():
    reader = InMemoryReader(
        {
            "cats.explore.lkml": 'include: "cats.view.lkml"\n',
            "cats.view.lkml": CATS_VIEW,
        }
    )
    parser = LkmlParser(reader)

    parser.find_view(view_name=ViewName("cats"), path=Includes("cats.explore.lkml"))
    parser.find_view(view_name=ViewName("cats"), path=Includes("cats.explore.lkml"))

    assert reader.read_paths.count("cats.explore.lkml") == 1


def test_missing_view_returns_none():
    parser = parser_for(
        {
            "cats.explore.lkml": 'include: "cats.view.lkml"\n',
            "cats.view.lkml": CATS_VIEW,
        }
    )

    assert parser.find_view(view_name=ViewName("hamsters"), path=Includes("cats.explore.lkml")) is None


def test_unreadable_include_does_not_abort_the_search():
    """A broken include is logged and skipped; sibling includes still resolve."""
    parser = parser_for(
        {
            "cats.explore.lkml": 'include: "missing.view.lkml"\ninclude: "cats.view.lkml"\n',
            "cats.view.lkml": CATS_VIEW,
        }
    )

    assert parser.find_view(view_name=ViewName("cats"), path=Includes("cats.explore.lkml")) is not None
