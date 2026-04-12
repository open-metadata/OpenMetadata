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
Test singleton guard for scan_dags_job_background.
Verifies fix for https://github.com/open-metadata/OpenMetadata/issues/23646
"""

from unittest.mock import MagicMock, patch

import openmetadata_managed_apis.api.utils as utils_module


def _reset_module_state():
    """Reset the module-level singleton state between tests."""
    utils_module._current_scan = None


def test_first_call_starts_process():
    """First call should spawn a new ScanDagsTask process."""
    _reset_module_state()

    mock_process = MagicMock()
    with patch.object(utils_module, "ScanDagsTask", return_value=mock_process):
        with patch.object(utils_module.threading, "Thread"):
            utils_module.scan_dags_job_background()

    mock_process.start.assert_called_once()
    assert utils_module._current_scan is mock_process


def test_skips_when_scan_alive():
    """While a scan is alive, new calls should skip (not spawn another)."""
    _reset_module_state()

    alive_process = MagicMock()
    alive_process.is_alive.return_value = True
    utils_module._current_scan = alive_process

    with patch.object(utils_module, "ScanDagsTask") as mock_cls:
        utils_module.scan_dags_job_background()

    mock_cls.assert_not_called()
    assert utils_module._current_scan is alive_process


def test_replaces_finished_scan_with_new_one():
    """When previous scan finished, a new call should start a fresh scan."""
    _reset_module_state()

    finished_process = MagicMock()
    finished_process.is_alive.return_value = False
    utils_module._current_scan = finished_process

    new_process = MagicMock()
    with patch.object(utils_module, "ScanDagsTask", return_value=new_process):
        with patch.object(utils_module.threading, "Thread"):
            utils_module.scan_dags_job_background()

    new_process.start.assert_called_once()
    assert utils_module._current_scan is new_process


def test_reaper_clears_current_scan():
    """Reaper thread should join process and clear _current_scan."""
    _reset_module_state()

    finished_process = MagicMock()
    utils_module._current_scan = finished_process

    with patch.object(utils_module, "ScanDagsTask") as mock_cls:
        utils_module._reap_scan(finished_process)

    finished_process.join.assert_called_once()
    mock_cls.assert_not_called()
    assert utils_module._current_scan is None


def test_reaper_never_forks():
    """Reaper thread must never start a new process (fork from non-main thread)."""
    _reset_module_state()

    finished_process = MagicMock()
    utils_module._current_scan = finished_process

    with patch.object(utils_module, "ScanDagsTask") as mock_cls:
        utils_module._reap_scan(finished_process)

    mock_cls.assert_not_called()


def test_no_daemon_flag_on_process():
    """ScanDagsTask must NOT be created with daemon=True (spawns children)."""
    _reset_module_state()

    mock_process = MagicMock()
    mock_process.daemon = False
    with patch.object(
        utils_module, "ScanDagsTask", return_value=mock_process
    ) as mock_cls:
        with patch.object(utils_module.threading, "Thread"):
            utils_module.scan_dags_job_background()

    mock_cls.assert_called_once_with()
    assert mock_process.daemon is False


def test_stale_reaper_does_not_clear_replaced_scan():
    """Stale reaper must not clear _current_scan if another scan replaced it."""
    _reset_module_state()

    old_process = MagicMock()
    new_process = MagicMock()
    utils_module._current_scan = new_process

    utils_module._reap_scan(old_process)

    old_process.join.assert_called_once()
    assert utils_module._current_scan is new_process
