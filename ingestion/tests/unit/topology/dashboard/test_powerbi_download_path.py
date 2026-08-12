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
PowerBI .pbit blobs are downloaded to a path built from the storage object key. That key is
attacker-influenced — anyone able to write to the configured bucket picks it — so a key containing
``..`` must not be able to place a file outside the extract directory.
"""

from pathlib import Path

import pytest

from metadata.ingestion.source.dashboard.powerbi.file_client import _resolve_download_path

ESCAPING_KEYS = [
    "../escaped.pbit",
    "../../../../etc/cron.d/evil.pbit",
    "dir/../../escaped.pbit",
    "/etc/passwd",
    "dir/subdir/../../../escaped.pbit",
]

CONTAINED_KEYS = [
    "report.pbit",
    "dir/report.pbit",
    "dir/subdir/report.pbit",
    "dir/../report.pbit",
]


@pytest.mark.parametrize("blob", ESCAPING_KEYS)
def test_keys_escaping_the_extract_dir_are_rejected(tmp_path, blob):
    assert _resolve_download_path(str(tmp_path), blob) is None


@pytest.mark.parametrize("blob", CONTAINED_KEYS)
def test_contained_keys_resolve_inside_the_extract_dir(tmp_path, blob):
    resolved = _resolve_download_path(str(tmp_path), blob)

    assert resolved is not None
    assert Path(resolved).is_relative_to(tmp_path.resolve())


def test_resolved_path_keeps_the_key_layout(tmp_path):
    resolved = _resolve_download_path(str(tmp_path), "dir/subdir/report.pbit")

    assert Path(resolved) == tmp_path.resolve() / "dir" / "subdir" / "report.pbit"


def test_sibling_directory_prefix_is_not_treated_as_contained(tmp_path):
    """``/tmp/x-evil`` shares a string prefix with ``/tmp/x`` but is not inside it."""
    extract_dir = tmp_path / "extract"
    extract_dir.mkdir()

    assert _resolve_download_path(str(extract_dir), "../extract-evil/report.pbit") is None
