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
Module for getting versions of OpenMetadata and python
"""

import os
import re
import sys

from packaging.version import parse

try:
    from importlib.metadata import version
except ImportError:
    from importlib_metadata import version


class VersionParsingException(Exception):
    """
    Used when we cannot parse version information from a string
    """


def get_client_version_from_string(raw_version: str) -> str:
    """
    Given a raw version string, such as `0.10.1.dev0` or
    `0.11.0-SNAPSHOT`, we should extract the major.minor.patch
    :param raw_version: raw string with version info
    :return: Clean version string
    """
    try:
        return re.match(r"\d+.\d+.\d+.\d+", raw_version).group(0)
    except AttributeError as err:
        raise VersionParsingException(
            f"Can't extract client version from {raw_version}: {err}"
        )


def get_server_version_from_string(raw_version: str) -> str:
    """
    Given a raw version string, such as `0.10.1.dev0` or
    `0.11.0-SNAPSHOT`, we should extract the major.minor.patch
    :param raw_version: raw string with version info
    :return: Clean version string
    """
    try:
        return re.match(r"\d+.\d+.\d+", raw_version).group(0)
    except AttributeError as err:
        raise VersionParsingException(
            f"Can't extract server version from {raw_version}: {err}"
        )


def get_client_version() -> str:
    """
    Get openmetadata-ingestion module version
    :return: client version
    """
    raw_version = version("openmetadata-ingestion")
    return get_client_version_from_string(raw_version)


def get_metadata_version() -> str:
    """
    Return the OpenMetadata version
    """

    metadata_pkg_dir = os.path.join(os.path.dirname(__file__), "..", "..")
    metadata_pkg_dir = os.path.abspath(metadata_pkg_dir)

    return f"metadata {get_client_version()} from {metadata_pkg_dir} (python {get_major_minor_version()})"


def get_major_minor_version() -> str:
    """
    Return the major-minor version of the current Python as a string, e.g.
    "3.7" or "3.10".
    """
    major, minor, *_ = sys.version_info
    return f"{major}.{minor}"


def match_versions(version1: str, version2: str) -> bool:
    """Check if both versions match in minor and major"""
    server_semver = parse(version1)
    client_semver = parse(version2)

    return (
        server_semver.major == client_semver.major
        and server_semver.minor == client_semver.minor
    )
