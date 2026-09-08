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
"""Unit tests for DB2 CLI driver installation."""

from concurrent.futures import ThreadPoolExecutor
from importlib.metadata import PackageNotFoundError
from subprocess import CalledProcessError
from threading import Event
from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.database.db2.utils import install_clidriver

UTILS_MODULE = "metadata.ingestion.source.database.db2.utils"


@pytest.fixture
def clidriver_install_command():
    url_response = MagicMock()
    url_response.__enter__.return_value = url_response
    with (
        patch(f"{UTILS_MODULE}._CLIDRIVER_INSTALL_STATE.version", None),
        patch("platform.system", return_value="linux"),
        patch("platform.architecture", return_value=("64bit", "")),
        patch("urllib.request.urlopen", return_value=url_response),
        patch(
            "importlib.metadata.distribution",
            side_effect=PackageNotFoundError("ibm_db"),
        ),
        patch("subprocess.check_call") as install_command,
    ):
        yield install_command


def test_same_clidriver_version_is_installed_once(clidriver_install_command):
    install_clidriver("12.1.0")
    install_clidriver("12.1.0")

    assert clidriver_install_command.call_count == 1


def test_failed_clidriver_installation_is_retried(clidriver_install_command):
    clidriver_install_command.side_effect = [
        CalledProcessError(1, ["pip", "install"]),
        None,
    ]

    with pytest.raises(CalledProcessError):
        install_clidriver("12.1.0")

    install_clidriver("12.1.0")
    assert clidriver_install_command.call_count == 2


def test_changing_clidriver_version_reinstalls(clidriver_install_command):
    install_clidriver("11.5.9")
    install_clidriver("12.1.0")
    install_clidriver("12.1.0")

    assert clidriver_install_command.call_count == 2


def test_concurrent_clidriver_installation_is_serialized(clidriver_install_command):
    installation_started = Event()
    allow_installation_to_finish = Event()

    def block_installation(_command):
        installation_started.set()
        assert allow_installation_to_finish.wait(timeout=5)

    clidriver_install_command.side_effect = block_installation

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(install_clidriver, "12.1.0")
        assert installation_started.wait(timeout=5)
        second = executor.submit(install_clidriver, "12.1.0")
        allow_installation_to_finish.set()

        first.result(timeout=5)
        second.result(timeout=5)

    assert clidriver_install_command.call_count == 1
