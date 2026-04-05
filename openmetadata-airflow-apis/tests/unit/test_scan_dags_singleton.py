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
    utils_module._rescan_requested = False


def test_first_call_starts_process():
    """First call should spawn a new ScanDagsTask process."""
    _reset_module_state()

    mock_process = MagicMock()
    with patch.object(utils_module, "ScanDagsTask", return_value=mock_process):
        utils_module.scan_dags_job_background()

    mock_process.start.assert_called_once()
    assert utils_module._current_scan is mock_process


def test_skips_when_scan_alive_and_sets_rescan_flag():
    """While a scan is alive, new calls should be deferred (not spawn another)."""
    _reset_module_state()

    alive_process = MagicMock()
    alive_process.is_alive.return_value = True
    utils_module._current_scan = alive_process

    with patch.object(utils_module, "ScanDagsTask") as mock_cls:
        utils_module.scan_dags_job_background()

    mock_cls.assert_not_called()
    assert utils_module._current_scan is alive_process
    assert utils_module._rescan_requested is True


def test_joins_finished_process_and_starts_new_when_rescan_requested():
    """Completed scan with rescan flag should be join()ed and replaced."""
    _reset_module_state()
    utils_module._rescan_requested = True

    finished_process = MagicMock()
    finished_process.is_alive.return_value = False
    utils_module._current_scan = finished_process

    new_process = MagicMock()
    with patch.object(utils_module, "ScanDagsTask", return_value=new_process):
        utils_module.scan_dags_job_background()

    finished_process.join.assert_called_once_with(timeout=5)
    new_process.start.assert_called_once()
    assert utils_module._current_scan is new_process


def test_no_new_scan_when_finished_without_rescan_flag():
    """Completed scan without rescan flag should not start a new scan."""
    _reset_module_state()
    utils_module._rescan_requested = False

    finished_process = MagicMock()
    finished_process.is_alive.return_value = False
    utils_module._current_scan = finished_process

    with patch.object(utils_module, "ScanDagsTask") as mock_cls:
        utils_module.scan_dags_job_background()

    finished_process.join.assert_called_once_with(timeout=5)
    mock_cls.assert_not_called()
    assert utils_module._current_scan is None


def test_rescan_flag_cleared_on_new_scan():
    """_rescan_requested should be reset to False when a new scan starts."""
    _reset_module_state()
    utils_module._rescan_requested = True

    finished_process = MagicMock()
    finished_process.is_alive.return_value = False
    utils_module._current_scan = finished_process

    new_process = MagicMock()
    with patch.object(utils_module, "ScanDagsTask", return_value=new_process):
        utils_module.scan_dags_job_background()

    assert utils_module._rescan_requested is False
    new_process.start.assert_called_once()


def test_no_daemon_flag_on_process():
    """ScanDagsTask must NOT be created with daemon=True (spawns children)."""
    _reset_module_state()

    mock_process = MagicMock()
    with patch.object(
        utils_module, "ScanDagsTask", return_value=mock_process
    ) as mock_cls:
        utils_module.scan_dags_job_background()

    mock_cls.assert_called_once_with()
