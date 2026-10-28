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

from pathlib import Path

import lkml

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
IMPORTED_PROJECTS_DIR = "imported_projects"

# `view: +orders` refines the `orders` view instead of declaring a new one
REFINEMENT_PREFIX = "+"
FIELD_LISTS = ("dimensions", "dimension_groups", "measures")


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
        self._refinements: list[LookMlView] = []
        self._visited_files: dict[Includes, list[Includes]] = {}

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
                file = self._read_file(Includes(_path), reader)
                lkml_file = LkmlFile.model_validate(lkml.load(file))
                self.parsed_files[Includes(_path)] = file
                imported = Path(_path).is_relative_to(imported_projects)
                for view in lkml_file.views:
                    view.source_file = _path
                    if not view.name.startswith(REFINEMENT_PREFIX):
                        # Base views are only taken from view files, so a view of the same name
                        # declared in a model or explore file cannot replace them
                        if _path.endswith(VIEW_FILE_SUFFIX):
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
        so a later refinement overrides an earlier one. Refinements apply project-wide,
        whichever model includes them: ADR:2026-10-17-looker-refinements-apply-project-wide-in-path-order
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

    def find_view(self, view_name: ViewName) -> LookMlView | None:
        """
        Parse an incoming file (either from a `source_file` or an `include`),
        cache the views and return the list of includes to parse if
        we still don't find the view afterwards
        """
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
