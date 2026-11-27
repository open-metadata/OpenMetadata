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
Tests that extracting a .pbit archive cannot write outside the extract directory.
"""

import io
import json
import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest

from metadata.ingestion.source.dashboard.powerbi.file_client import (
    _extract_pbit,
    get_datamodel_schema_files_from_pbit,
)

TRAVERSAL_MEMBERS = [
    "../../escape_parent.txt",
    "a/../../escape_nested.txt",
    "/escape_absolute.txt",
]


def _write_pbit(path: Path, members: dict[str, str]) -> None:
    with zipfile.ZipFile(path, "w") as zf:
        for name, content in members.items():
            zf.writestr(name, content)


class TestExtractPbit:
    def test_skips_members_escaping_extract_dir(self, tmp_path):
        pbit = tmp_path / "evil.pbit"
        _write_pbit(pbit, dict.fromkeys(TRAVERSAL_MEMBERS, "x"))
        dest = tmp_path / "work" / "extracted" / "evil"

        with (
            patch("metadata.ingestion.source.dashboard.powerbi.file_client.logger") as logger,
            zipfile.ZipFile(pbit) as zip_ref,
        ):
            _extract_pbit(zip_ref, str(dest))

        assert not dest.exists() or not any(dest.rglob("*")), "no traversal member may be written, even relocated"
        # where each member would land if it escaped dest (tmp/work/extracted/evil)
        assert not (tmp_path / "work" / "escape_parent.txt").exists()
        assert not (tmp_path / "work" / "extracted" / "escape_nested.txt").exists()
        assert not Path("/escape_absolute.txt").exists()
        assert logger.warning.call_count == len(TRAVERSAL_MEMBERS)

    def test_extracts_legitimate_members_next_to_skipped_ones(self, tmp_path):
        pbit = tmp_path / "report.pbit"
        _write_pbit(pbit, {"DataModelSchema": "schema", "Report/Layout": "layout", "../../bad.txt": "x"})
        dest = tmp_path / "extracted" / "report"

        with zipfile.ZipFile(pbit) as zip_ref:
            _extract_pbit(zip_ref, str(dest))

        assert (dest / "DataModelSchema").read_text() == "schema"
        assert (dest / "Report" / "Layout").read_text() == "layout"
        # ../../bad.txt from tmp/extracted/report would land in tmp; it must not be relocated into dest either
        assert not (tmp_path / "bad.txt").exists()
        assert not (dest / "bad.txt").exists()


def _write_damaged_pbit(path: Path) -> None:
    """A ZIP whose central directory is valid but whose deflate stream is garbage,
    so opening succeeds and only extraction fails (with zlib.error)."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("DataModelSchema", "schema " * 2000)
    data = bytearray(buffer.getvalue())
    with zipfile.ZipFile(io.BytesIO(bytes(data))) as zf:
        info = zf.infolist()[0]
    start = info.header_offset + 30 + len(info.filename) + len(info.extra)
    data[start : start + info.compress_size] = b"\xff" * info.compress_size
    path.write_bytes(bytes(data))


GOOD_PBIT_MEMBERS = {
    "Connections": json.dumps({"RemoteArtifacts": [{"DatasetId": "dataset-1", "ReportId": "report-1"}]}),
    "DataModelSchema": json.dumps({"model": {"tables": [{"name": "sales"}]}}),
}


def _write_corrupt_pbit(path: Path) -> None:
    path.write_bytes(b"not a zip archive")


class TestGetDatamodelSchemaFilesFromPbit:
    @pytest.mark.parametrize("write_bad_pbit", [_write_corrupt_pbit, _write_damaged_pbit], ids=["corrupt", "damaged"])
    def test_bad_pbit_does_not_drop_the_schemas_of_the_others(self, tmp_path, write_bad_pbit):
        write_bad_pbit(tmp_path / "bad.pbit")
        _write_pbit(tmp_path / "good.pbit", GOOD_PBIT_MEMBERS)

        result = get_datamodel_schema_files_from_pbit(str(tmp_path))

        assert result is not None, "one unreadable archive must not turn the whole run into None"
        assert len(result) == 1
        assert [table.name for table in result[0].tables] == ["sales"]
        assert result[0].connectionFile.RemoteArtifacts[0].DatasetId == "dataset-1"
