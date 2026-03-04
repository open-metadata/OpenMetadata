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
from typing import Dict, List, Optional

import lkml

from metadata.ingestion.source.dashboard.looker.models import (
    Includes,
    LkmlFile,
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
IMPORTED_PROJECTS_DIR = "imported_projects"


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
    infinity loop when parsing includes.

    Supports multiple readers to aggregate views from multiple repositories.
    """

    def __init__(
        self,
        reader: LocalReader,
        additional_readers: Optional[List[LocalReader]] = None,
    ):
        self._views_cache: Dict[ViewName, LookMlView] = {}
        self._visited_files: Dict[Includes, List[Includes]] = {}

        # To store the raw string of the lkml explores
        self.parsed_files: Dict[Includes, str] = {}
        self.parsed_view: Dict[str, List[Includes]] = {}

        self.reader = reader
        self.additional_readers = additional_readers or []

        # Parse views from the primary reader
        self.__parse_all_views(self.reader)

        # Parse views from additional readers
        for additional_reader in self.additional_readers:
            self.__parse_all_views(additional_reader)

    def __parse_all_views(self, reader: LocalReader):
        file_paths = reader.get_local_files(search_key=".view.lkml")
        for _path in file_paths:
            try:
                file = self._read_file(Includes(_path), reader)
                lkml_file = LkmlFile.model_validate(lkml.load(file))
                self.parsed_files[Includes(_path)] = file
                for view in lkml_file.views:
                    view.source_file = _path
                    self._views_cache[view.name] = view
            except Exception as err:
                logger.debug(f"Error parsing file {_path}: {err}")

    def _read_file(self, path: Includes, reader: Optional[LocalReader] = None) -> str:
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

    def get_view_from_cache(self, view_name: ViewName) -> Optional[LookMlView]:
        """
        Check if view is cached, and return it.
        Otherwise, return None
        """
        if view_name in self._views_cache:
            return self._views_cache[view_name]

        return None

    def find_view(self, view_name: ViewName) -> Optional[LookMlView]:
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
