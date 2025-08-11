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
Validate Server Mixin version methods
"""
from metadata.__version__ import (
    get_client_version_from_string,
    get_server_version_from_string,
    match_versions,
)


def test_get_version_from_string():
    """
    We should be able to parse regular version responses
    """
    assert "0.11.0" == get_server_version_from_string("0.11.0.dev0")
    assert "0.11.0" == get_server_version_from_string("0.11.0")
    assert "1111.11.111" == get_server_version_from_string("1111.11.111")
    assert "1111.11.111" == get_server_version_from_string("1111.11.111-SNAPSHOT")
    assert "0.11.1" == get_server_version_from_string("0.11.1.0.0.1.patch")


def test_get_client_version_from_string():
    """
    We should be able to parse regular version responses
    """
    assert "0.13.2.5" == get_client_version_from_string("0.13.2.5.dev0")
    assert "0.11.0.1" == get_client_version_from_string("0.11.0.1")
    assert "1111.11.111.1" == get_client_version_from_string("1111.11.111.1")
    assert "1111.11.111.2" == get_client_version_from_string("1111.11.111.2-SNAPSHOT")
    assert "0.11.1.0" == get_client_version_from_string("0.11.1.0.0.1.patch")


def test_match_version():
    """We only match major and minor versions"""
    assert match_versions("0.11.0", "0.11.0")
    assert match_versions("0.11.0", "0.11.1")
    assert not match_versions("1.3.0", "1.4.0")
    assert not match_versions("1.3.0", "2.3.0")
