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
.lkml files parser
"""

import re
from pathlib import Path

import lkml
from cachetools import LRUCache

from metadata.ingestion.source.dashboard.looker.models import (
    Includes,
    LkmlFile,
    LookMlField,
    LookMlView,
    ViewName,
)
from metadata.readers.file.api_reader import ApiReader
from metadata.readers.file.base import ReadException
from metadata.readers.file.local import LocalReader
from metadata.utils.logger import ingestion_logger
from metadata.utils.singleton import Singleton

logger = ingestion_logger()

EXTENSIONS = (".lkml", ".lookml")
VIEW_FILE_SUFFIX = ".view.lkml"
VIEW_FILE_SUFFIXES = (".view.lkml", ".view.lookml")
MODEL_FILE_SUFFIXES = (".model.lkml", ".model.lookml")
IMPORTED_PROJECTS_DIR = "imported_projects"
MODEL_VIEWS_CACHE_MAXSIZE = 128

# `view: +orders` refines the `orders` view instead of declaring a new one
REFINEMENT_PREFIX = "+"
FIELD_LISTS = ("dimensions", "dimension_groups", "measures")


def _normalize_relative_pattern(rel_dir: str, pattern: str) -> str | None:
    """Normalize a relative LookML include pattern and reject paths escaping the project root."""
    combined = f"{rel_dir}/{pattern}" if rel_dir else pattern
    stack: list[str] = []
    for segment in combined.split("/"):
        if not segment or segment == ".":
            continue
        if segment == "..":
            if not stack or stack[-1] == "**":
                return None
            stack.pop()
        else:
            stack.append(segment)
    return "/".join(stack) if stack else None


def _glob_to_regex(pattern: str) -> re.Pattern[str]:
    """Compile a normalized LookML include glob (`*`, `**`, `?`) into a path regex."""
    parts: list[str] = ["^"]
    idx = 0
    length = len(pattern)
    while idx < length:
        if pattern.startswith("**/", idx):
            parts.append("(?:.+/)?")
            idx += 3
        elif pattern.startswith("/**", idx) and idx + 3 == length:
            parts.append("(?:/.*)?")
            idx += 3
        elif pattern.startswith("**", idx):
            parts.append(".*")
            idx += 2
        elif pattern[idx] == "*":
            parts.append("[^/]*")
            idx += 1
        elif pattern[idx] == "?":
            parts.append("[^/]")
            idx += 1
        else:
            parts.append(re.escape(pattern[idx]))
            idx += 1
    parts.append("$")
    return re.compile("".join(parts))


def refine_field(base: LookMlField, refinement: LookMlField) -> LookMlField:
    """
    A refinement overrides the field parameters it sets and keeps the others.
    `filters` is additive: the refinement's filters are appended to the base ones.
    """
    update = {key: getattr(refinement, key) for key in refinement.model_fields_set}
    if base.filters__all and refinement.filters__all:
        update["filters__all"] = base.filters__all + refinement.filters__all
    return base.model_copy(update=update)


def refine_fields(base: list[LookMlField], refinement: list[LookMlField]) -> list[LookMlField]:
    """
    Fields declared in a refinement are added to the view,
    or refine the field of the same name if it exists.
    """
    fields = {field.name: field for field in base}
    for field in refinement:
        fields[field.name] = refine_field(fields[field.name], field) if field.name in fields else field
    return list(fields.values())


def refine_view(base: LookMlView, refinement: LookMlView) -> LookMlView:
    """
    Apply a `view: +name` refinement to its base view.

    A refinement overrides the view parameters it sets and keeps the others.
    `extends` is additive, and the base keeps its name and source file.
    https://docs.cloud.google.com/looker/docs/lookml-refinements
    """
    update = {}
    for key in refinement.model_fields_set - {"name", "source_file"}:
        value = getattr(refinement, key)
        if key in FIELD_LISTS:
            value = refine_fields(getattr(base, key), value)
        elif key == "extends__all":
            value = (base.extends__all or []) + (value or [])
        elif key == "derived_table" and base.derived_table and value:
            value = base.derived_table.model_copy(update=value.model_dump(exclude_unset=True))
        update[key] = value
    return base.model_copy(update=update)


class BulkLkmlParser(metaclass=Singleton):
    """
    Parses and caches the visited files & views.

    Here we'll just parse VIEWs, as we are already getting
    the explores from the API.

    The goal is to make sure we parse files only once
    and store the results of the processed views.

    We want to parse the minimum number of files each time
    until we find the view we are looking for.

    Approach:
    When we parse, we parse all files *.view.lkml to get all view and cached them. It can speed up the process and avoid
    infinity loop when parsing includes. Refinements (`view: +name`) can be declared in any LookML file, so they are
    read from every *.lkml file and merged into their base view once every file is parsed, since a refinement
    can be read before the view it refines.

    Supports multiple readers to aggregate views from multiple repositories.
    """

    def __init__(
        self,
        reader: LocalReader,
        additional_readers: list[LocalReader] | None = None,
    ):
        self._views_cache: dict[ViewName, LookMlView] = {}
        self._base_views: dict[ViewName, LookMlView] = {}
        self._refinements: list[LookMlView] = []
        self._visited_files: dict[Includes, list[Includes]] = {}
        self._lkml_files: dict[Includes, LkmlFile] = {}
        self._file_readers: dict[Includes, LocalReader] = {}
        self._model_views_cache: LRUCache[str, dict[ViewName, LookMlView] | None] = LRUCache(
            maxsize=MODEL_VIEWS_CACHE_MAXSIZE
        )

        # To store the raw string of the lkml explores
        self.parsed_files: dict[Includes, str] = {}
        self.parsed_view: dict[str, list[Includes]] = {}

        self.reader = reader
        self.additional_readers = additional_readers or []

        # Parse views from the primary reader
        self.__parse_all_views(self.reader)

        # Parse views from additional readers
        for additional_reader in self.additional_readers:
            self.__parse_all_views(additional_reader)

        self.__apply_refinements()

    def __parse_all_views(self, reader: LocalReader):
        # Refinements can be declared in any LookML file, so read them all. `get_local_files` matches
        # substrings, hence the suffix check. Sorted, since `os.walk` order depends on the file system
        # and refinements apply in order.
        file_paths = sorted(path for path in reader.get_local_files(search_key=".lkml") if path.endswith(".lkml"))
        # Heuristic: local wildcard includes never reach imported projects, so their refinements only
        # apply through an explicit `//project` include, which we cannot see here. Skip them.
        imported_projects = Path(reader.base_path) / IMPORTED_PROJECTS_DIR
        for _path in file_paths:
            try:
                include_path = Includes(_path)
                file = self._read_file(include_path, reader)
                lkml_file = LkmlFile.model_validate(lkml.load(file))
                self.parsed_files[include_path] = file
                self._lkml_files[include_path] = lkml_file
                self._file_readers[include_path] = reader
                imported = Path(_path).is_relative_to(imported_projects)
                for view in lkml_file.views:
                    view.source_file = _path
                    if not view.name.startswith(REFINEMENT_PREFIX):
                        # Base views are only taken from view files, so a view of the same name
                        # declared in a model or explore file cannot replace them
                        if _path.endswith(VIEW_FILE_SUFFIXES):
                            self._base_views[view.name] = view
                            self._views_cache[view.name] = view
                    elif imported:
                        logger.debug("Skipping refinement [%s] from imported project file %s", view.name, _path)
                    else:
                        self._refinements.append(view)
            except Exception as err:
                logger.debug(f"Error parsing file {_path}: {err}")

    def __apply_refinements(self):
        """
        Merge each refinement into the view it refines, in the order they were read,
        so a later refinement overrides an earlier one. Used as the project-wide
        fallback when no model file is present:
        ADR:2026-11-26-looker-refinements-scope-to-model-include-graph
        """
        for refinement in self._refinements:
            view_name = ViewName(refinement.name.removeprefix(REFINEMENT_PREFIX))
            base = self._views_cache.get(view_name)
            if base is None:
                logger.debug("Skipping refinement [%s]: view [%s] is not defined", refinement.name, view_name)
                continue
            self._views_cache[view_name] = refine_view(base, refinement)

    def _read_file(self, path: Includes, reader: LocalReader | None = None) -> str:
        """
        Read the LookML file
        """
        reader_to_use = reader or self.reader
        suffixes = Path(path).suffixes

        # Check if any suffix is in our extension list
        if not set(suffixes).intersection(set(EXTENSIONS)):
            for suffix in EXTENSIONS:
                try:
                    return reader_to_use.read(path + suffix)
                except ReadException as err:
                    logger.debug(f"Error trying to read the file [{path}]: {err}")

        else:
            return reader_to_use.read(path)

        raise ReadException(f"Error trying to read the file [{path}]")

    def get_view_from_cache(self, view_name: ViewName) -> LookMlView | None:
        """
        Check if view is cached, and return it.
        Otherwise, return None
        """
        if view_name in self._views_cache:
            return self._views_cache[view_name]

        return None

    def _project_root_for_file(self, file_path: Includes) -> tuple[Path, bool]:
        """Return `(project_root, is_imported_project)` for a parsed LookML file."""
        reader = self._file_readers.get(file_path, self.reader)
        reader_base = Path(reader.base_path)
        imported_dir = reader_base / IMPORTED_PROJECTS_DIR
        path = Path(file_path)
        if path.is_relative_to(imported_dir):
            rel = path.relative_to(imported_dir)
            if len(rel.parts) >= 2:
                return imported_dir / rel.parts[0], True
        return reader_base, False

    def _match_files_under_root(
        self,
        root: Path,
        norm_pattern: str,
        is_imported_root: bool,
    ) -> list[Includes]:
        """Match parsed `.lkml` files under `root` against a normalized relative glob pattern."""
        patterns = [norm_pattern]
        if not norm_pattern.endswith(EXTENSIONS):
            patterns.extend(f"{norm_pattern}{ext}" for ext in EXTENSIONS)
        regexes = [_glob_to_regex(pat) for pat in patterns]
        imported_dir = root / IMPORTED_PROJECTS_DIR

        matches: list[Includes] = []
        for file_path in self._lkml_files:
            path = Path(file_path)
            if not path.is_relative_to(root):
                continue
            if not is_imported_root and path.is_relative_to(imported_dir):
                continue
            rel_posix = path.relative_to(root).as_posix()
            if any(rx.match(rel_posix) for rx in regexes):
                matches.append(file_path)
        return sorted(matches)

    def _resolve_include(self, current_file: Includes, raw_include: str) -> list[Includes]:
        """Resolve a LookML `include:` pattern relative to `current_file`."""
        pattern = raw_include.strip()
        if not pattern:
            return []

        if pattern.startswith("//"):
            rest = pattern[2:]
            if "/" not in rest:
                return []
            ext_project, rel_pattern = rest.split("/", 1)
            if not ext_project or not rel_pattern:
                return []
            norm = _normalize_relative_pattern("", rel_pattern)
            if not norm:
                return []
            matches: set[Includes] = set()
            for reader in (self.reader, *self.additional_readers):
                reader_base = Path(reader.base_path)
                imp_root = reader_base / IMPORTED_PROJECTS_DIR / ext_project
                matches.update(self._match_files_under_root(imp_root, norm, is_imported_root=True))
                if reader_base.name == ext_project:
                    matches.update(self._match_files_under_root(reader_base, norm, is_imported_root=False))
            return sorted(matches)

        project_root, is_imported = self._project_root_for_file(current_file)
        if pattern.startswith("/"):
            norm = _normalize_relative_pattern("", pattern.lstrip("/"))
        else:
            rel_file = Path(current_file).relative_to(project_root)
            rel_dir = "" if rel_file.parent == Path() else rel_file.parent.as_posix()
            norm = _normalize_relative_pattern(rel_dir, pattern)

        if not norm:
            return []
        return self._match_files_under_root(project_root, norm, is_imported_root=is_imported)

    def _find_model_files(self, model_name: str) -> list[Includes]:
        """Locate `<model_name>.model.lkml` (or `.model.lookml`) across configured readers."""
        target_names = {f"{model_name}{suffix}" for suffix in MODEL_FILE_SUFFIXES}
        primary_matches: list[Includes] = []
        imported_matches: list[Includes] = []
        for file_path in self._lkml_files:
            if Path(file_path).name not in target_names:
                continue
            _, is_imported = self._project_root_for_file(file_path)
            if is_imported:
                imported_matches.append(file_path)
            else:
                primary_matches.append(file_path)
        return sorted(primary_matches or imported_matches)

    def _expand_model_includes(self, model_files: list[Includes]) -> list[Includes]:
        """Expand a model's `include:` graph in cycle-safe depth-first post-order."""
        visited: set[Includes] = set()
        ordered: list[Includes] = []

        def visit(file_path: Includes) -> None:
            if file_path in visited:
                return
            visited.add(file_path)
            lkml_file = self._lkml_files.get(file_path)
            if not lkml_file:
                return
            for include in lkml_file.includes or []:
                for target in self._resolve_include(file_path, include):
                    if target not in visited:
                        visit(target)
            ordered.append(file_path)

        for model_file in model_files:
            visit(model_file)
        return ordered

    def _get_model_views(self, model_name: str) -> dict[ViewName, LookMlView] | None:
        """
        Build and cache the refined view map scoped to `<model_name>.model.lkml`:
        ADR:2026-11-26-looker-refinements-scope-to-model-include-graph
        """
        if model_name in self._model_views_cache:
            return self._model_views_cache[model_name]

        model_files = self._find_model_files(model_name)
        if not model_files:
            self._model_views_cache[model_name] = None
            return None

        ordered_files = self._expand_model_includes(model_files)
        model_views: dict[ViewName, LookMlView] = {}

        for file_path in ordered_files:
            if not file_path.endswith(VIEW_FILE_SUFFIXES):
                continue
            lkml_file = self._lkml_files.get(file_path)
            if not lkml_file:
                continue
            for view in lkml_file.views:
                if not view.name.startswith(REFINEMENT_PREFIX):
                    model_views[view.name] = view

        for file_path in ordered_files:
            lkml_file = self._lkml_files.get(file_path)
            if not lkml_file:
                continue
            for view in lkml_file.views:
                if not view.name.startswith(REFINEMENT_PREFIX):
                    continue
                target_name = ViewName(view.name.removeprefix(REFINEMENT_PREFIX))
                base = model_views.get(target_name) or self._base_views.get(target_name)
                if base is None:
                    logger.debug("Skipping refinement [%s]: view [%s] is not defined", view.name, target_name)
                    continue
                model_views[target_name] = refine_view(base, view)

        self._model_views_cache[model_name] = model_views
        return model_views

    def find_view(self, view_name: ViewName, model_name: str | None = None) -> LookMlView | None:
        """
        Return the resolved `LookMlView` for `view_name`.

        When `model_name` is provided and `<model_name>.model.lkml` is present,
        refinements are scoped to that model's `include:` graph; otherwise falls
        back to the project-wide view cache.
        """
        if model_name:
            model_views = self._get_model_views(model_name)
            if model_views is not None:
                if view_name in model_views:
                    return model_views[view_name]
                if view_name in self._base_views:
                    return self._base_views[view_name]

        cached_view = self.get_view_from_cache(view_name)
        if cached_view:
            return cached_view

        return None

    def __repr__(self):
        """
        Customize string repr for logs
        """
        if isinstance(self.reader, ApiReader):
            return (
                f"Parser at [{self.reader.credentials.repositoryOwner.root}/"
                f"{self.reader.credentials.repositoryName.root}]"
            )
        return f"Parser at [{self.reader}]"
