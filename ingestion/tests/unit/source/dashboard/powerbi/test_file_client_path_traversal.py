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
Tests that the PowerBI .pbit download path cannot escape the extract directory.
"""

import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.dashboard.powerbi.file_client import (
    PowerBIFileConfigException,
    _safe_local_path,
    download_pbit_files,
    get_blobs_grouped_by_dir,
)

MALICIOUS_KEYS = [
    "reports/../../outside/pwned.pbit",
    "../../../../etc/cron.d/pwn.pbit",
    "/etc/cron.d/abs.pbit",
    "a/b/../../../../../../tmp/x.pbit",
]

LEGIT_KEYS = [
    "report.pbit",
    "reports/sales/q1.pbit",
    "reports/2026/august/dashboard.pbit",
]


class TestSafeLocalPath:
    def test_rejects_paths_escaping_extract_dir(self, tmp_path):
        extract_dir = tmp_path / "extract"
        extract_dir.mkdir()
        for blob in MALICIOUS_KEYS:
            with pytest.raises(PowerBIFileConfigException, match="escapes the extract directory"):
                _safe_local_path(str(extract_dir), blob)

    def test_allows_legitimate_keys_and_stays_inside(self, tmp_path):
        extract_dir = tmp_path / "extract"
        extract_dir.mkdir()
        base = os.path.realpath(str(extract_dir))
        for blob in LEGIT_KEYS:
            resolved = _safe_local_path(str(extract_dir), blob)
            assert resolved.startswith(base + os.sep)


class _FakeReader:
    """Mimics the ADLS reader sink: open(local_file_path, "wb").write(...)."""

    def download(self, path, local_file_path, **__):
        with Path(local_file_path).open("wb") as fh:
            fh.write(b"attacker-controlled bytes")


class TestDownloadPbitFiles:
    @patch(
        "metadata.ingestion.source.dashboard.powerbi.file_client.get_reader",
        return_value=_FakeReader(),
    )
    def test_malicious_key_does_not_write_outside_extract_dir(self, _get_reader, tmp_path):
        extract_dir = tmp_path / "extract"
        extract_dir.mkdir()
        outside = tmp_path / "outside"
        outside.mkdir()
        marker = outside / "pwned.pbit"

        malicious_blob = "reports/../../outside/pwned.pbit"
        grouped = get_blobs_grouped_by_dir([malicious_blob])
        assert grouped, "the malicious key should still pass the .pbit filter"

        download_pbit_files(
            blob_grouped_by_directory=grouped,
            config=MagicMock(),
            client=MagicMock(),
            bucket_name="bucket",
            extract_dir=str(extract_dir),
        )

        assert not marker.exists(), "path traversal wrote outside the extract directory"

    @patch(
        "metadata.ingestion.source.dashboard.powerbi.file_client.get_reader",
        return_value=_FakeReader(),
    )
    def test_legitimate_key_writes_inside_extract_dir(self, _get_reader, tmp_path):
        extract_dir = tmp_path / "extract"
        extract_dir.mkdir()

        grouped = get_blobs_grouped_by_dir(["reports/sales/q1.pbit"])
        download_pbit_files(
            blob_grouped_by_directory=grouped,
            config=MagicMock(),
            client=MagicMock(),
            bucket_name="bucket",
            extract_dir=str(extract_dir),
        )

        written = extract_dir / "reports" / "sales" / "q1.pbit"
        assert written.exists(), "a legitimate .pbit key should download inside the extract directory"
        assert written.read_bytes() == b"attacker-controlled bytes"

    @patch(
        "metadata.ingestion.source.dashboard.powerbi.file_client.get_reader",
        return_value=_FakeReader(),
    )
    def test_escaping_key_does_not_skip_other_keys_in_same_group(self, _get_reader, tmp_path):
        """A traversal key must be skipped individually, without aborting the
        legitimate keys grouped with it."""
        extract_dir = tmp_path / "extract"
        extract_dir.mkdir()
        outside = tmp_path / "outside"
        outside.mkdir()

        # both blobs share the "sub" directory group; one escapes, one is legit
        grouped = {"sub": ["sub/../../outside/bad.pbit", "sub/good.pbit"]}
        download_pbit_files(
            blob_grouped_by_directory=grouped,
            config=MagicMock(),
            client=MagicMock(),
            bucket_name="bucket",
            extract_dir=str(extract_dir),
        )

        assert not (outside / "bad.pbit").exists(), "the escaping key must be skipped"
        assert (extract_dir / "sub" / "good.pbit").exists(), "the legitimate key in the same group must still download"
