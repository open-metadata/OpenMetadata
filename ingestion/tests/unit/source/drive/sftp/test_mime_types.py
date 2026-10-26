#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import mimetypes
import stat
from types import SimpleNamespace

import pytest
from paramiko import SFTPAttributes

from metadata.generated.schema.entity.services.connections.drive.sftpConnection import SftpConnection
from metadata.ingestion.source.drive.sftp.metadata import SftpSource
from metadata.ingestion.source.drive.sftp.models import SftpDirectoryInfo


@pytest.mark.parametrize("nested", [False, True], ids=["root", "nested"])
@pytest.mark.parametrize(
    "host_markdown_type", [None, "text/x-host-markdown"], ids=["missing-os-mapping", "existing-os-mapping"]
)
def test_file_discovery_preserves_known_mime_types_and_fills_markdown_gap(monkeypatch, nested, host_markdown_type):
    registry = mimetypes.MimeTypes()
    for mapping in registry.types_map:
        mapping.pop(".md", None)
        mapping.pop(".markdown", None)
    if host_markdown_type:
        registry.add_type(host_markdown_type, ".md")
        registry.add_type(host_markdown_type, ".markdown")
    monkeypatch.setattr(mimetypes, "_db", registry)
    monkeypatch.setattr(mimetypes, "inited", True)

    expected = {
        "notes.md": host_markdown_type or "text/markdown",
        "NOTES.MD": host_markdown_type or "text/markdown",
        "notes.markdown": host_markdown_type or "text/markdown",
        "config.json": "application/json",
        "README": None,
        "file.unknown_extension": None,
    }
    entries = []
    for filename in expected:
        entry = SFTPAttributes()
        entry.filename = filename
        entry.st_mode = stat.S_IFREG | 0o644
        entry.st_size = 12
        entry.st_mtime = 1704067200
        entries.append(entry)
    directory = "/data/nested" if nested else "/data"
    source = SftpSource.__new__(SftpSource)
    source.service_connection = SftpConnection(
        host="localhost", authType={"username": "testuser", "password": "testpass"}, rootDirectories=["/data"]
    )
    source.client = SimpleNamespace(
        sftp=SimpleNamespace(listdir_attr=lambda path: entries if path == directory else [])
    )
    source._directories_cache = (
        {directory: SftpDirectoryInfo(name="nested", full_path=directory, path=["nested"], parents=[])}
        if nested
        else {}
    )

    source._fetch_all_files()

    files = source._files_by_parent_cache[directory if nested else "root"]
    assert {file.name: file.mime_type for file in files} == expected
    assert {file.full_path for file in files} == {f"{directory}/{name}" for name in expected}
