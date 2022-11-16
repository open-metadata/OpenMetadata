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
Module for getting versions of OpenMetadata and python
"""

import os
import sys

import pkg_resources

version = pkg_resources.require("openmetadata-ingestion")[0].version


def get_metadata_version() -> str:
    """
    Return the OpenMetadata version
    """

    metadata_pkg_dir = os.path.join(os.path.dirname(__file__), "..", "..")
    metadata_pkg_dir = os.path.abspath(metadata_pkg_dir)

    return f"metadata {version} from {metadata_pkg_dir} (python {get_major_minor_version()})"


def get_major_minor_version() -> str:
    """
    Return the major-minor version of the current Python as a string, e.g.
    "3.7" or "3.10".
    """
    major, minor, *_ = sys.version_info
    return f"{major}.{minor}"
