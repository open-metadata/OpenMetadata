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
.lkml files parser
"""
import fnmatch
import traceback
from pathlib import Path
from typing import Dict, List, Optional

import lkml
from pydantic import ValidationError

from metadata.ingestion.source.dashboard.looker.models import (
    Includes,
    LkmlFile,
    LookMlView,
    ViewName,
)
from metadata.readers.file.base import Reader, ReadException
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

EXTENSIONS = (".lkml", ".lookml")


class LkmlParser:
    """
    Parses and caches the visited files & views.

    Here we'll just parse VIEWs, as we are already getting
    the explores from the API.

    The goal is to make sure we parse files only once
    and store the results of the processed views.

    We want to parse the minimum number of files each time
    until we find the view we are looking for.

    Approach:
    When we parse, it is because we are looking for a view definition, then
    1. When parsing any source file the outcome is
        a. Look for any defined view, and cache it
        b. The parsing result is the list of includes
    2. Is my view present in the cache?
        yes. Then return it
        no. Then keep parsing `includes` until the response is yes.
    """

    def __init__(self, reader: Reader):
        self._views_cache: Dict[ViewName, LookMlView] = {}
        self._visited_files: Dict[Includes, List[Includes]] = {}

        # To store the raw string of the lkml explores
        self.parsed_files: Dict[Includes, str] = {}

        self.reader = reader

        self._file_tree: Optional[List[Includes]] = None

    @property
    def file_tree(self) -> List[Includes]:
        """
        Parse the file tree of the repo
        """
        if not self._file_tree:
            self._file_tree = self.reader.get_tree()

        return self._file_tree or []

    def parse_file(self, path: Includes) -> Optional[List[Includes]]:
        """
        Internal parser. Parse the file and cache the views

        If a lkml include starts with //, means that it is pointing to
        a external repository. we won't send it to the reader
        """

        # If visited, return its includes to continue parsing
        if path in self._visited_files:
            return self._visited_files[path]

        # If the path starts with //, we will ignore it for now
        if path.startswith("//"):
            logger.info(f"We do not support external includes yet. Skipping {path}")
            return []

        try:
            return self._process_file(path)

        except ReadException as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error trying to read the file [{path}]: {err}")
        except ValidationError as err:
            logger.error(
                f"Validation error building the .lkml file from [{path}]: {err}"
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Unknown error building the .lkml file from [{path}]: {err}")

        return None

    def _process_file(self, path: Includes) -> Optional[List[Includes]]:
        """
        Processing of a single path
        """
        file = self._read_file(path)
        lkml_file = LkmlFile.model_validate(lkml.load(file))
        self.parsed_files[path] = file

        # Cache everything
        expanded_includes = self._expand_includes(lkml_file.includes)
        self._visited_files[path] = expanded_includes
        for view in lkml_file.views:
            view.source_file = path
            self._views_cache[view.name] = view

        return expanded_includes

    def _expand_includes(
        self, includes: Optional[List[Includes]]
    ) -> Optional[List[Includes]]:
        """
        If we have * in includes, expand them based on the file tree
        """
        if not includes:
            return includes

        return [expanded for path in includes for expanded in self._expand(path)]

    def _expand(self, path: Includes) -> List[Includes]:
        """
        Match files in tree if there's any * in the include
        """
        suffixes = Path(path).suffixes
        if "*" in path:
            if set(suffixes).intersection(set(EXTENSIONS)):
                return fnmatch.filter(self.file_tree, path)
            for suffix in EXTENSIONS:
                res = fnmatch.filter(self.file_tree, Includes(str(path) + suffix))
                if res:
                    return res
            # Nothing matched, we cannot find the file
            logger.warning(f"We could not match any file from the include {path}")
            return []

        return [path]

    def _read_file(self, path: Includes) -> str:
        """
        Read the LookML file
        """
        suffixes = Path(path).suffixes

        # Check if any suffix is in our extension list
        if not set(suffixes).intersection(set(EXTENSIONS)):
            for suffix in EXTENSIONS:
                try:
                    return self.reader.read(path + suffix)
                except ReadException as err:
                    logger.debug(f"Error trying to read the file [{path}]: {err}")

        else:
            return self.reader.read(path)

        raise ReadException(f"Error trying to read the file [{path}]")

    def get_view_from_cache(self, view_name: ViewName) -> Optional[LookMlView]:
        """
        Check if view is cached, and return it.
        Otherwise, return None
        """
        if view_name in self._views_cache:
            return self._views_cache[view_name]

        return None

    def find_view(self, view_name: ViewName, path: Includes) -> Optional[LookMlView]:
        """
        Parse an incoming file (either from a `source_file` or an `include`),
        cache the views and return the list of includes to parse if
        we still don't find the view afterwards
        """
        cached_view = self.get_view_from_cache(view_name)
        if cached_view:
            return cached_view

        for include in self.parse_file(path) or []:
            cached_view = self.get_view_from_cache(view_name)
            if cached_view:
                return cached_view

            # Recursively parse inner includes
            self.find_view(view_name, include)

        # We might not find the view ever
        return self.get_view_from_cache(view_name)

    def __repr__(self):
        """
        Customize string repr for logs
        """
        return (
            f"Parser at [{self.reader.credentials.repositoryOwner.root}/"
            f"{self.reader.credentials.repositoryName.root}]"
        )
