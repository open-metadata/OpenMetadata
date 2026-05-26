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
"""Unit tests for metadata.readers.archive — all readers, adapters, and helpers."""

import importlib.util
import struct
import tarfile
import zipfile
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest

from metadata.readers.archive import (
    _ZIP64_SENTINEL,
    MAX_ARCHIVE_SIZE_BYTES,
    ADLSBlobAdapter,
    ArchiveEntry,
    GCSBlobAdapter,
    S3BlobAdapter,
    TarArchiveReader,
    ZipArchiveReader,
    ZipRangeReader,
    ZipReader,
    _is_safe_archive_path,
    detect_inner_format,
    get_archive_reader,
    get_first_schema_entry,
    infer_columns_from_archive_entry,
    is_archive_format,
    iter_archive_entries_with_schema,
    open_archive_reader,
)
from metadata.readers.dataframe.reader_factory import SupportedTypes

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

_CSV_CONTENT = b"id,name,value\n1,Alice,100\n2,Bob,200\n"
_CSV2_CONTENT = b"id,name,value\n3,Carol,300\n4,Dave,400\n"
_JSON_CONTENT = b'[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]'
_JSONL_CONTENT = b'{"id": 1, "name": "Alice"}\n{"id": 2, "name": "Bob"}\n'
_TSV_CONTENT = b"id\tname\tvalue\n1\tAlice\t100\n2\tBob\t200\n"


class _MockBlob:
    """Minimal in-memory RangeReadableBlob — implements the protocol for ZipRangeReader."""

    def __init__(self, data: bytes, size_override: int | None = None) -> None:
        self._data = data
        self._size = size_override if size_override is not None else len(data)

    def get_size(self) -> int:
        return self._size

    def read_range(self, offset: int, length: int) -> bytes:
        return self._data[offset : offset + length]

    def read_all(self) -> bytes:
        return self._data


def _make_zip(files: dict, compression: int = zipfile.ZIP_DEFLATED) -> bytes:
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", compression=compression) as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buf.getvalue()


def _make_tar(files: dict, mode: str = "w:gz") -> bytes:
    buf = BytesIO()
    with tarfile.open(fileobj=buf, mode=mode) as tf:
        for name, content in files.items():
            data = content if isinstance(content, bytes) else content.encode()
            info = tarfile.TarInfo(name=name)
            info.size = len(data)
            tf.addfile(info, BytesIO(data))
    return buf.getvalue()


def _make_seven_z(files: dict) -> bytes:
    import py7zr

    buf = BytesIO()
    with py7zr.SevenZipFile(buf, mode="w") as szf:
        for name, content in files.items():
            data = content if isinstance(content, bytes) else content.encode()
            szf.writestr(data, name)
    return buf.getvalue()


def _make_parquet(data: dict) -> bytes:
    import pandas as pd

    buf = BytesIO()
    pd.DataFrame(data).to_parquet(buf, index=False)
    return buf.getvalue()


def _make_complex_parquet() -> bytes:
    import pyarrow as pa
    import pyarrow.parquet as pq

    meta = pa.StructArray.from_arrays(
        [pa.array(["hello"]), pa.array([1], type=pa.int32())],
        names=["k", "v"],
    )
    table = pa.table(
        {
            "id": pa.array([1], type=pa.int64()),
            "meta": meta,
            "tags": pa.array([["a", "b"]], type=pa.list_(pa.string())),
        }
    )
    buf = BytesIO()
    pq.write_table(table, buf)
    return buf.getvalue()


def _make_empty_parquet() -> bytes:
    import pyarrow as pa
    import pyarrow.parquet as pq

    schema = pa.schema([("id", pa.int64()), ("name", pa.string())])
    buf = BytesIO()
    pq.write_table(schema.empty_table(), buf)
    return buf.getvalue()


def _make_entry(name: str, content: bytes) -> ArchiveEntry:
    """Create an ArchiveEntry with fixed in-memory content for testing."""
    return ArchiveEntry(name=name, size=len(content), loader=lambda: BytesIO(content))


# ---------------------------------------------------------------------------
# TestIsSafeArchivePath
# ---------------------------------------------------------------------------


class TestIsSafeArchivePath:
    def test_absolute_path(self):
        assert _is_safe_archive_path("/etc/passwd") is False

    def test_dotdot_prefix(self):
        assert _is_safe_archive_path("../evil.csv") is False

    def test_dotdot_in_path(self):
        assert _is_safe_archive_path("a/../evil.csv") is False

    def test_backslash_dotdot(self):
        assert _is_safe_archive_path("a\\..\\evil.csv") is False

    def test_normal_file(self):
        assert _is_safe_archive_path("data.csv") is True

    def test_nested_normal(self):
        assert _is_safe_archive_path("folder/sub/data.csv") is True

    def test_root_slash(self):
        assert _is_safe_archive_path("/") is False

    def test_double_slash_prefix(self):
        assert _is_safe_archive_path("//etc/passwd") is False

    def test_deeply_nested_safe_path(self):
        assert _is_safe_archive_path("a/b/c/d/e/f/data.csv") is True

    def test_hidden_file_is_safe(self):
        assert _is_safe_archive_path(".hidden_file.csv") is True

    def test_double_dot_in_filename_is_safe(self):
        # "file..csv" has ".." as part of the name, not as a path component
        assert _is_safe_archive_path("file..csv") is True

    def test_dotdot_as_standalone_segment(self):
        assert _is_safe_archive_path("good/../evil") is False

    def test_windows_backslash_traversal(self):
        assert _is_safe_archive_path("folder\\..\\evil.csv") is False


# ---------------------------------------------------------------------------
# TestADLSBlobAdapter
# ---------------------------------------------------------------------------


class TestADLSBlobAdapter:
    def test_get_size_returns_properties_size(self):
        client = MagicMock()
        client.get_blob_properties.return_value.size = 500
        adapter = ADLSBlobAdapter(client)
        assert adapter.get_size() == 500

    def test_get_size_returns_zero_when_none(self):
        client = MagicMock()
        client.get_blob_properties.return_value.size = None
        adapter = ADLSBlobAdapter(client)
        assert adapter.get_size() == 0

    def test_read_range_calls_download_blob(self):
        client = MagicMock()
        adapter = ADLSBlobAdapter(client)
        adapter.read_range(10, 20)
        client.download_blob.assert_called_once_with(offset=10, length=20)

    def test_read_range_returns_bytes(self):
        client = MagicMock()
        client.download_blob.return_value.readall.return_value = b"hello"
        adapter = ADLSBlobAdapter(client)
        result = adapter.read_range(0, 5)
        assert result == b"hello"

    def test_read_all_calls_download_blob_no_kwargs(self):
        client = MagicMock()
        client.download_blob.return_value.readall.return_value = b"all data"
        adapter = ADLSBlobAdapter(client)
        result = adapter.read_all()
        client.download_blob.assert_called_once_with()
        assert result == b"all data"


# ---------------------------------------------------------------------------
# TestS3BlobAdapter
# ---------------------------------------------------------------------------


class TestS3BlobAdapter:
    def test_get_size(self):
        s3_client = MagicMock()
        s3_client.head_object.return_value = {"ContentLength": 1024}
        adapter = S3BlobAdapter(s3_client, "my-bucket", "path/to/file.zip")
        assert adapter.get_size() == 1024
        s3_client.head_object.assert_called_once_with(Bucket="my-bucket", Key="path/to/file.zip")

    def test_read_range_range_header_format(self):
        s3_client = MagicMock()
        s3_client.get_object.return_value = {"Body": MagicMock(read=MagicMock(return_value=b"data"))}
        adapter = S3BlobAdapter(s3_client, "bucket", "key")
        adapter.read_range(0, 100)
        call_kwargs = s3_client.get_object.call_args[1]
        assert call_kwargs["Range"] == "bytes=0-99"

    def test_read_range_off_by_one(self):
        s3_client = MagicMock()
        s3_client.get_object.return_value = {"Body": MagicMock(read=MagicMock(return_value=b"xxxxx"))}
        adapter = S3BlobAdapter(s3_client, "bucket", "key")
        adapter.read_range(10, 5)
        call_kwargs = s3_client.get_object.call_args[1]
        assert call_kwargs["Range"] == "bytes=10-14"

    def test_read_range_returns_body_read(self):
        s3_client = MagicMock()
        s3_client.get_object.return_value = {"Body": MagicMock(read=MagicMock(return_value=b"result"))}
        adapter = S3BlobAdapter(s3_client, "bucket", "key")
        result = adapter.read_range(0, 6)
        assert result == b"result"

    def test_read_all(self):
        s3_client = MagicMock()
        s3_client.get_object.return_value = {"Body": MagicMock(read=MagicMock(return_value=b"full"))}
        adapter = S3BlobAdapter(s3_client, "bucket", "key")
        result = adapter.read_all()
        call_kwargs = s3_client.get_object.call_args[1]
        assert "Range" not in call_kwargs
        assert result == b"full"


# ---------------------------------------------------------------------------
# TestGCSBlobAdapter
# ---------------------------------------------------------------------------


class TestGCSBlobAdapter:
    def _make_bucket(self, blob_size=None):
        blob = MagicMock()
        blob.size = blob_size
        bucket = MagicMock()
        bucket.blob.return_value = blob
        return bucket, blob

    def test_get_size_no_reload_when_size_set(self):
        bucket, blob = self._make_bucket(blob_size=100)
        adapter = GCSBlobAdapter(bucket, "path/to/file.zip")
        assert adapter.get_size() == 100
        blob.reload.assert_not_called()

    def test_get_size_reloads_when_size_is_none(self):
        bucket, blob = self._make_bucket(blob_size=None)
        blob.reload.side_effect = lambda: setattr(blob, "size", 200)
        adapter = GCSBlobAdapter(bucket, "path/to/file.zip")
        adapter.get_size()
        blob.reload.assert_called_once()

    def test_get_size_returns_zero_after_reload_when_still_none(self):
        bucket, _blob = self._make_bucket(blob_size=None)
        adapter = GCSBlobAdapter(bucket, "path/to/file.zip")
        result = adapter.get_size()
        assert result == 0

    def test_read_range_end_is_offset_plus_length_minus_one(self):
        bucket, blob = self._make_bucket(blob_size=500)
        blob.download_as_bytes.return_value = b"x" * 20
        adapter = GCSBlobAdapter(bucket, "path/file.zip")
        adapter.read_range(10, 20)
        blob.download_as_bytes.assert_called_once_with(start=10, end=29)

    def test_read_range_start_zero(self):
        bucket, blob = self._make_bucket(blob_size=500)
        blob.download_as_bytes.return_value = b"x" * 50
        adapter = GCSBlobAdapter(bucket, "path/file.zip")
        adapter.read_range(0, 50)
        blob.download_as_bytes.assert_called_once_with(start=0, end=49)

    def test_read_all(self):
        bucket, blob = self._make_bucket(blob_size=100)
        blob.download_as_bytes.return_value = b"all content"
        adapter = GCSBlobAdapter(bucket, "path/file.zip")
        result = adapter.read_all()
        blob.download_as_bytes.assert_called_once_with()
        assert result == b"all content"


# ---------------------------------------------------------------------------
# TestIsArchiveFormat
# ---------------------------------------------------------------------------


class TestIsArchiveFormat:
    def test_zip(self):
        assert is_archive_format("zip") is True

    def test_tar(self):
        assert is_archive_format("tar") is True

    def test_tar_gz(self):
        assert is_archive_format("tar.gz") is True

    def test_tgz(self):
        assert is_archive_format("tgz") is True

    def test_7z(self):
        assert is_archive_format("7z") is True

    def test_rar(self):
        assert is_archive_format("rar") is True

    def test_csv_is_false(self):
        assert is_archive_format("csv") is False

    def test_none_is_false(self):
        assert is_archive_format(None) is False

    def test_empty_is_false(self):
        assert is_archive_format("") is False

    def test_case_insensitive(self):
        assert is_archive_format("ZIP") is True


# ---------------------------------------------------------------------------
# TestDetectInnerFormat
# ---------------------------------------------------------------------------


class TestDetectInnerFormat:
    def test_csv(self):
        assert detect_inner_format("data.csv") == SupportedTypes.CSV

    def test_parquet(self):
        assert detect_inner_format("data.parquet") == SupportedTypes.PARQUET

    def test_parquet_snappy_longest_match(self):
        assert detect_inner_format("data.parquet.snappy") == SupportedTypes.PARQUET_SNAPPY

    def test_json(self):
        assert detect_inner_format("data.json") == SupportedTypes.JSON

    def test_jsonl(self):
        assert detect_inner_format("data.jsonl") == SupportedTypes.JSONL

    def test_avro(self):
        assert detect_inner_format("data.avro") == SupportedTypes.AVRO

    def test_unsupported_returns_none(self):
        assert detect_inner_format("image.png") is None

    def test_case_insensitive(self):
        assert detect_inner_format("DATA.CSV") == SupportedTypes.CSV

    def test_nested_path(self):
        assert detect_inner_format("folder/sub/data.csv") == SupportedTypes.CSV

    def test_no_extension_returns_none(self):
        assert detect_inner_format("Makefile") is None

    def test_archive_extension_returns_none(self):
        assert detect_inner_format("data.zip") is None


# ---------------------------------------------------------------------------
# TestArchiveEntryLazyLoading
# ---------------------------------------------------------------------------


class TestArchiveEntryLazyLoading:
    """Verify that ArchiveEntry uses cached_property for lazy data loading."""

    def test_loader_not_called_on_construction(self):
        called = []

        def loader():
            called.append(1)
            return BytesIO(b"data")

        ArchiveEntry(name="f.csv", size=4, loader=loader)
        assert called == []

    def test_loader_called_on_first_data_access(self):
        loader = MagicMock(return_value=BytesIO(b"hello"))
        entry = ArchiveEntry(name="f.csv", size=5, loader=loader)
        _ = entry.data
        loader.assert_called_once()

    def test_loader_called_only_once_for_repeated_accesses(self):
        loader = MagicMock(return_value=BytesIO(b"hello"))
        entry = ArchiveEntry(name="f.csv", size=5, loader=loader)
        _ = entry.data
        _ = entry.data
        _ = entry.data
        assert loader.call_count == 1

    def test_data_returns_same_instance_on_repeated_access(self):
        entry = ArchiveEntry(name="f.csv", size=5, loader=lambda: BytesIO(b"hello"))
        first = entry.data
        second = entry.data
        assert first is second

    def test_failing_loader_raises_on_data_access(self):
        def bad_loader():
            raise OSError("disk failure")

        entry = ArchiveEntry(name="f.csv", size=5, loader=bad_loader)
        with pytest.raises(OSError, match="disk failure"):
            _ = entry.data

    def test_name_and_size_accessible_without_triggering_loader(self):
        called = []

        def loader():
            called.append(1)
            return BytesIO(b"data")

        entry = ArchiveEntry(name="my_file.csv", size=99, loader=loader)
        assert entry.name == "my_file.csv"
        assert entry.size == 99
        assert called == []

    def test_data_seek_after_read_works_via_cached_bytesio(self):
        entry = _make_entry("f.csv", _CSV_CONTENT)
        entry.data.read()  # exhaust buffer
        entry.data.seek(0)
        assert entry.data.read() == _CSV_CONTENT


# ---------------------------------------------------------------------------
# TestZipArchiveReader
# ---------------------------------------------------------------------------


class TestZipArchiveReader:
    def test_yields_files_not_dirs(self):
        zip_bytes = _make_zip({"dir/": b"", "dir/file.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            entries = list(reader.entries())
        names = [e.name for e in entries]
        assert "dir/file.csv" in names
        assert "dir/" not in names

    def test_raises_on_corrupted(self):
        with pytest.raises(ValueError, match="Corrupted ZIP"):
            ZipArchiveReader(b"not a zip file")

    def test_entry_data_is_seekable(self):
        # Data must be accessed inside the context — loader calls zf.open which needs the file open
        zip_bytes = _make_zip({"file.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            entries = list(reader.entries())
            assert entries[0].data.seekable()

    def test_data_accessible_inside_context(self):
        zip_bytes = _make_zip({"file.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            entries = list(reader.entries())
            assert entries[0].data.read() == _CSV_CONTENT

    def test_entry_name_and_size(self):
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            entries = list(reader.entries())
        # name and size are plain attributes — no loader needed
        assert entries[0].name == "data.csv"
        assert entries[0].size == len(_CSV_CONTENT)

    def test_multiple_entries(self):
        zip_bytes = _make_zip({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            entries = list(reader.entries())
        assert len(entries) == 2

    def test_large_file_is_skipped(self):
        import metadata.readers.archive as arch_mod

        zip_bytes = _make_zip({"big.csv": _CSV_CONTENT}, compression=zipfile.ZIP_STORED)
        original = arch_mod._MAX_INNER_FILE_BYTES
        try:
            arch_mod._MAX_INNER_FILE_BYTES = 5
            with ZipArchiveReader(zip_bytes) as reader:
                entries = list(reader.entries())
        finally:
            arch_mod._MAX_INNER_FILE_BYTES = original
        assert entries == []

    def test_exception_opening_entry_raises_on_data_access(self):
        # With lazy loading, entries() yields the ArchiveEntry without calling open().
        # The OSError surfaces only when entry.data is accessed.
        zip_bytes = _make_zip({"file.csv": _CSV_CONTENT})
        reader = ZipArchiveReader(zip_bytes)
        with patch.object(reader._zip_file, "open", side_effect=OSError("disk error")):
            entries = list(reader.entries())
            assert len(entries) == 1
            with pytest.raises(ValueError):
                _ = entries[0].data
        reader.close()

    def test_skips_suspicious_path(self):
        zip_bytes = _make_zip({"safe.csv": _CSV_CONTENT})
        reader = ZipArchiveReader(zip_bytes)
        with patch("metadata.readers.archive._is_safe_archive_path", return_value=False):
            entries = list(reader.entries())
        reader.close()
        assert entries == []

    def test_empty_archive_yields_nothing(self):
        zip_bytes = _make_zip({})
        with ZipArchiveReader(zip_bytes) as reader:
            entries = list(reader.entries())
        assert entries == []

    def test_zip_with_nested_dir_structure(self):
        zip_bytes = _make_zip({"a/b/c/data.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            entries = list(reader.entries())
        assert len(entries) == 1
        assert entries[0].name == "a/b/c/data.csv"


# ---------------------------------------------------------------------------
# TestTarArchiveReader
# ---------------------------------------------------------------------------


class TestTarArchiveReader:
    def test_yields_files(self):
        tar_bytes = _make_tar({"file.csv": _CSV_CONTENT})
        with TarArchiveReader(tar_bytes) as reader:
            entries = list(reader.entries())
        assert len(entries) == 1
        assert entries[0].name == "file.csv"

    def test_raises_on_corrupted(self):
        with pytest.raises(ValueError, match="Corrupted TAR"):
            TarArchiveReader(b"not a tar file")

    def test_auto_detects_tar_gz(self):
        tar_bytes = _make_tar({"data.csv": _CSV_CONTENT}, mode="w:gz")
        with TarArchiveReader(tar_bytes) as reader:
            entries = list(reader.entries())
        assert len(entries) == 1

    def test_plain_tar(self):
        tar_bytes = _make_tar({"data.csv": _CSV_CONTENT}, mode="w:")
        with TarArchiveReader(tar_bytes) as reader:
            entries = list(reader.entries())
        assert len(entries) == 1

    def test_skips_directory_members(self):
        buf = BytesIO()
        with tarfile.open(fileobj=buf, mode="w:") as tf:
            di = tarfile.TarInfo(name="mydir")
            di.type = tarfile.DIRTYPE
            tf.addfile(di)
            fi = tarfile.TarInfo(name="mydir/data.csv")
            fi.size = len(_CSV_CONTENT)
            tf.addfile(fi, BytesIO(_CSV_CONTENT))
        tar_bytes = buf.getvalue()
        with TarArchiveReader(tar_bytes) as reader:
            entries = list(reader.entries())
        assert len(entries) == 1
        assert entries[0].name == "mydir/data.csv"

    def test_skips_path_traversal(self):
        buf = BytesIO()
        with tarfile.open(fileobj=buf, mode="w:") as tf:
            evil = tarfile.TarInfo(name="../evil.csv")
            evil.size = len(_CSV_CONTENT)
            tf.addfile(evil, BytesIO(_CSV_CONTENT))
            safe = tarfile.TarInfo(name="safe.csv")
            safe.size = len(_CSV_CONTENT)
            tf.addfile(safe, BytesIO(_CSV_CONTENT))
        tar_bytes = buf.getvalue()
        with TarArchiveReader(tar_bytes) as reader:
            entries = list(reader.entries())
        names = [e.name for e in entries]
        assert "safe.csv" in names
        assert "../evil.csv" not in names

    def test_skips_absolute_path_entry(self):
        buf = BytesIO()
        with tarfile.open(fileobj=buf, mode="w:") as tf:
            abs_entry = tarfile.TarInfo(name="/etc/passwd")
            abs_entry.size = len(_CSV_CONTENT)
            tf.addfile(abs_entry, BytesIO(_CSV_CONTENT))
            safe = tarfile.TarInfo(name="safe.csv")
            safe.size = len(_CSV_CONTENT)
            tf.addfile(safe, BytesIO(_CSV_CONTENT))
        tar_bytes = buf.getvalue()
        with TarArchiveReader(tar_bytes) as reader:
            entries = list(reader.entries())
        names = [e.name for e in entries]
        assert "safe.csv" in names
        assert "/etc/passwd" not in names

    def test_large_file_is_skipped(self):
        import metadata.readers.archive as arch_mod

        tar_bytes = _make_tar({"big.csv": _CSV_CONTENT}, mode="w:")
        original = arch_mod._MAX_INNER_FILE_BYTES
        try:
            arch_mod._MAX_INNER_FILE_BYTES = 5
            with TarArchiveReader(tar_bytes) as reader:
                entries = list(reader.entries())
        finally:
            arch_mod._MAX_INNER_FILE_BYTES = original
        assert entries == []

    def test_none_extractfile_entry_raises_on_data_access(self):
        # entries() yields the ArchiveEntry; the None-extractfile error is lazy
        tar_bytes = _make_tar({"file.csv": _CSV_CONTENT}, mode="w:")
        reader = TarArchiveReader(tar_bytes)
        with patch.object(reader._tar_file, "extractfile", return_value=None):
            entries = list(reader.entries())
            assert len(entries) == 1
            with pytest.raises(ValueError):
                _ = entries[0].data
        reader.close()

    def test_exception_in_extractfile_raises_on_data_access(self):
        tar_bytes = _make_tar({"file.csv": _CSV_CONTENT}, mode="w:")
        reader = TarArchiveReader(tar_bytes)
        with patch.object(reader._tar_file, "extractfile", side_effect=OSError("bad read")):
            entries = list(reader.entries())
            assert len(entries) == 1
            with pytest.raises(ValueError):
                _ = entries[0].data
        reader.close()

    def test_data_accessible_inside_context(self):
        tar_bytes = _make_tar({"data.csv": _CSV_CONTENT}, mode="w:")
        with TarArchiveReader(tar_bytes) as reader:
            entries = list(reader.entries())
            assert entries[0].data.read() == _CSV_CONTENT

    def test_symlink_member_is_skipped(self):
        buf = BytesIO()
        with tarfile.open(fileobj=buf, mode="w:") as tf:
            sym = tarfile.TarInfo(name="link.csv")
            sym.type = tarfile.SYMTYPE
            sym.linkname = "data.csv"
            tf.addfile(sym)
            real = tarfile.TarInfo(name="data.csv")
            real.size = len(_CSV_CONTENT)
            tf.addfile(real, BytesIO(_CSV_CONTENT))
        tar_bytes = buf.getvalue()
        with TarArchiveReader(tar_bytes) as reader:
            entries = list(reader.entries())
        names = [e.name for e in entries]
        assert "link.csv" not in names
        assert "data.csv" in names

    def test_hardlink_member_is_skipped(self):
        buf = BytesIO()
        with tarfile.open(fileobj=buf, mode="w:") as tf:
            real = tarfile.TarInfo(name="data.csv")
            real.size = len(_CSV_CONTENT)
            tf.addfile(real, BytesIO(_CSV_CONTENT))
            hard = tarfile.TarInfo(name="hardlink.csv")
            hard.type = tarfile.LNKTYPE
            hard.linkname = "data.csv"
            hard.size = 0
            tf.addfile(hard)
        tar_bytes = buf.getvalue()
        with TarArchiveReader(tar_bytes) as reader:
            entries = list(reader.entries())
        names = [e.name for e in entries]
        assert "hardlink.csv" not in names
        assert "data.csv" in names


# ---------------------------------------------------------------------------
# TestZipRangeReader — all tests use _MockBlob (RangeReadableBlob protocol)
# ---------------------------------------------------------------------------


class TestZipRangeReader:
    def test_reads_csv_via_range_requests(self):
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT})
        blob = _MockBlob(zip_bytes)
        with ZipRangeReader(blob) as reader:
            entries = list(reader.entries())
        assert len(entries) == 1
        assert entries[0].name == "data.csv"
        assert entries[0].data.read() == _CSV_CONTENT

    def test_entry_size_is_uncompressed_length(self):
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT})
        blob = _MockBlob(zip_bytes)
        with ZipRangeReader(blob) as reader:
            entries = list(reader.entries())
        assert entries[0].size == len(_CSV_CONTENT)

    def test_empty_blob_raises(self):
        blob = _MockBlob(b"", size_override=0)
        with pytest.raises(ValueError, match="empty"):
            ZipRangeReader(blob)

    def test_oversized_blob_raises(self):
        blob = _MockBlob(b"", size_override=MAX_ARCHIVE_SIZE_BYTES + 1)
        with pytest.raises(ValueError, match="exceeds limit"):
            ZipRangeReader(blob)

    def test_no_eocd_signature_raises(self):
        blob = _MockBlob(b"\x00" * 100)
        with pytest.raises(ValueError, match="No EOCD"):
            ZipRangeReader(blob)

    def test_zip64_sentinel_raises(self):
        sentinel = _ZIP64_SENTINEL
        eocd = struct.pack("<4sHHHHIIH", b"PK\x05\x06", 0, 0, 1, 1, sentinel, sentinel, 0)
        blob = _MockBlob(eocd)
        with pytest.raises(ValueError, match="ZIP64"):
            ZipRangeReader(blob)

    def test_skips_directory_entries(self):
        zip_bytes = _make_zip({"dir/": b"", "dir/data.csv": _CSV_CONTENT})
        blob = _MockBlob(zip_bytes)
        with ZipRangeReader(blob) as reader:
            entries = list(reader.entries())
        names = [e.name for e in entries]
        assert "dir/" not in names
        assert "dir/data.csv" in names

    def test_large_inner_file_skipped(self):
        import metadata.readers.archive as arch_mod

        zip_bytes = _make_zip({"big.csv": _CSV_CONTENT})
        original = arch_mod._MAX_INNER_FILE_BYTES
        try:
            arch_mod._MAX_INNER_FILE_BYTES = 5
            blob = _MockBlob(zip_bytes)
            with ZipRangeReader(blob) as reader:
                entries = list(reader.entries())
        finally:
            arch_mod._MAX_INNER_FILE_BYTES = original
        assert entries == []

    def test_multiple_files_all_yielded(self):
        zip_bytes = _make_zip({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT})
        blob = _MockBlob(zip_bytes)
        with ZipRangeReader(blob) as reader:
            entries = list(reader.entries())
        assert len(entries) == 2
        assert {e.name for e in entries} == {"a.csv", "b.csv"}

    def test_stored_method_zero(self):
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT}, compression=zipfile.ZIP_STORED)
        blob = _MockBlob(zip_bytes)
        with ZipRangeReader(blob) as reader:
            entries = list(reader.entries())
        assert entries[0].data.read() == _CSV_CONTENT

    def test_deflate_method_eight(self):
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT}, compression=zipfile.ZIP_DEFLATED)
        blob = _MockBlob(zip_bytes)
        with ZipRangeReader(blob) as reader:
            entries = list(reader.entries())
        assert entries[0].data.read() == _CSV_CONTENT

    def test_unsupported_method_raises_on_data_access(self):
        """Unsupported compression method (e.g. 99) silently yields the entry but raises on .data."""
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT})
        blob = _MockBlob(zip_bytes)
        reader = ZipRangeReader(blob)
        for entry in reader._cd_entries:
            entry.compress_method = 99
        entries = list(reader.entries())
        reader.close()
        assert len(entries) == 1
        with pytest.raises(ValueError, match="Unsupported ZIP compression method"):
            _ = entries[0].data

    def test_invalid_local_header_raises_on_data_access(self):
        """If local file header signature is wrong, accessing .data raises ValueError."""
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT})

        class _CorruptBlob(_MockBlob):
            def read_range(self, offset: int, length: int) -> bytes:
                data = super().read_range(offset, length)
                if length == 30:
                    return b"\x00" * 30
                return data

        blob = _CorruptBlob(zip_bytes)
        reader = ZipRangeReader(blob)
        entries = list(reader.entries())
        reader.close()
        assert len(entries) == 1
        with pytest.raises(ValueError, match="Invalid local file header"):
            _ = entries[0].data

    def test_exception_during_download_raises_on_data_access(self):
        """If read_range raises after CD is parsed, accessing .data raises."""
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT})

        class _FailingBlob(_MockBlob):
            def __init__(self, data):
                super().__init__(data)
                self._calls = 0

            def read_range(self, offset: int, length: int) -> bytes:
                self._calls += 1
                if self._calls > 2:
                    raise OSError("network failure")
                return super().read_range(offset, length)

        blob = _FailingBlob(zip_bytes)
        reader = ZipRangeReader(blob)
        entries = list(reader.entries())
        reader.close()
        assert len(entries) == 1
        with pytest.raises(OSError, match="network failure"):
            _ = entries[0].data

    def test_post_decompress_size_exceeds_limit_skips(self):
        """After deflate decompression, if uncompressed data exceeds limit, entry is skipped."""
        import metadata.readers.archive as arch_mod

        original = arch_mod._MAX_INNER_FILE_BYTES
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT}, compression=zipfile.ZIP_DEFLATED)
        try:
            blob = _MockBlob(zip_bytes)
            reader = ZipRangeReader(blob)
            arch_mod._MAX_INNER_FILE_BYTES = 5
            entries = list(reader.entries())
            reader.close()
        finally:
            arch_mod._MAX_INNER_FILE_BYTES = original
        assert entries == []

    def test_eocd_with_zip_comment(self):
        """ZIP with a file comment is still parseable via range reader."""
        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_STORED) as zf:
            zf.comment = b"This is a test ZIP comment " * 4
            zf.writestr("data.csv", _CSV_CONTENT)
        zip_bytes = buf.getvalue()
        blob = _MockBlob(zip_bytes)
        with ZipRangeReader(blob) as reader:
            entries = list(reader.entries())
        assert len(entries) == 1
        assert entries[0].data.read() == _CSV_CONTENT

    def test_path_traversal_skipped(self):
        zip_bytes = _make_zip({"safe.csv": _CSV_CONTENT})
        blob = _MockBlob(zip_bytes)
        reader = ZipRangeReader(blob)
        with patch("metadata.readers.archive._is_safe_archive_path", return_value=False):
            entries = list(reader.entries())
        reader.close()
        assert entries == []


# ---------------------------------------------------------------------------
# TestZipReader
# ---------------------------------------------------------------------------


class TestZipReader:
    def test_uses_range_reader_for_valid_blob(self):
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT})
        blob = _MockBlob(zip_bytes)
        with ZipReader(blob) as reader:
            assert isinstance(reader._reader, ZipRangeReader)

    def test_falls_back_when_range_reader_raises(self):
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT})

        class _FailRangeBlob(_MockBlob):
            def read_range(self, *_) -> bytes:
                raise OSError("range not supported")

        blob = _FailRangeBlob(zip_bytes)
        with ZipReader(blob) as reader:
            entries = list(reader.entries())
        assert len(entries) == 1

    def test_fallback_oversized_raises(self):
        blob = _MockBlob(b"", size_override=MAX_ARCHIVE_SIZE_BYTES + 1)
        with pytest.raises(ValueError, match="exceeds limit"):
            ZipReader(blob)

    def test_entries_delegates_to_inner(self):
        zip_bytes = _make_zip({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT})
        blob = _MockBlob(zip_bytes)
        with ZipReader(blob) as reader:
            entries = list(reader.entries())
        assert {e.name for e in entries} == {"a.csv", "b.csv"}

    def test_close_calls_inner_close(self):
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT})
        blob = _MockBlob(zip_bytes)
        reader = ZipReader(blob)
        inner_close = MagicMock()
        reader._reader.close = inner_close
        reader.close()
        inner_close.assert_called_once()


# ---------------------------------------------------------------------------
# TestSevenZipArchiveReader
# ---------------------------------------------------------------------------


class TestSevenZipArchiveReader:
    def test_basic_entries(self):
        if importlib.util.find_spec("py7zr") is None:
            pytest.skip("py7zr not installed")
        from metadata.readers.archive import SevenZipArchiveReader

        seven_z_bytes = _make_seven_z({"data.csv": _CSV_CONTENT})
        # Data must be accessed inside the context — temp dir is cleaned up on close
        with SevenZipArchiveReader(seven_z_bytes) as reader:
            entries = list(reader.entries())
            assert len(entries) == 1
            assert entries[0].name == "data.csv"
            assert entries[0].data.read() == _CSV_CONTENT

    def test_multiple_files(self):
        if importlib.util.find_spec("py7zr") is None:
            pytest.skip("py7zr not installed")
        from metadata.readers.archive import SevenZipArchiveReader

        seven_z_bytes = _make_seven_z({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT})
        with SevenZipArchiveReader(seven_z_bytes) as reader:
            entries = list(reader.entries())
        assert len(entries) == 2
        assert {e.name for e in entries} == {"a.csv", "b.csv"}

    def test_corrupted_7z_raises(self):
        if importlib.util.find_spec("py7zr") is None:
            pytest.skip("py7zr not installed")
        from metadata.readers.archive import SevenZipArchiveReader

        with pytest.raises(ValueError, match="Corrupted 7Z"):
            SevenZipArchiveReader(b"not a 7z file at all")

    def test_suspicious_path_raises(self):
        if importlib.util.find_spec("py7zr") is None:
            pytest.skip("py7zr not installed")
        from metadata.readers.archive import SevenZipArchiveReader

        seven_z_bytes = _make_seven_z({"normal.csv": _CSV_CONTENT})

        mock_info = MagicMock()
        mock_info.is_directory = False
        mock_info.filename = "../etc/passwd"

        mock_szf = MagicMock()
        mock_szf.__enter__ = MagicMock(return_value=mock_szf)
        mock_szf.__exit__ = MagicMock(return_value=False)
        mock_szf.list.return_value = [mock_info]

        with patch("py7zr.SevenZipFile", return_value=mock_szf), pytest.raises(ValueError, match="Suspicious path"):
            SevenZipArchiveReader(seven_z_bytes)

    def test_large_file_in_7z_raises_on_construction(self):
        """SevenZipArchiveReader raises ValueError during __init__ when an entry exceeds the size limit."""
        if importlib.util.find_spec("py7zr") is None:
            pytest.skip("py7zr not installed")
        import metadata.readers.archive as arch_mod
        from metadata.readers.archive import SevenZipArchiveReader

        seven_z_bytes = _make_seven_z({"big.csv": _CSV_CONTENT})
        original = arch_mod._MAX_INNER_FILE_BYTES
        try:
            arch_mod._MAX_INNER_FILE_BYTES = 5
            with pytest.raises(ValueError):
                SevenZipArchiveReader(seven_z_bytes)
        finally:
            arch_mod._MAX_INNER_FILE_BYTES = original


# ---------------------------------------------------------------------------
# TestRarArchiveReader
# ---------------------------------------------------------------------------


class TestRarArchiveReader:
    def test_bad_rar_file_raises_value_error(self):
        try:
            import rarfile
        except ImportError:
            pytest.skip("rarfile not installed")
        from metadata.readers.archive import RarArchiveReader

        with (
            patch("rarfile.RarFile", side_effect=rarfile.BadRarFile("bad header")),
            pytest.raises(ValueError, match="Corrupted RAR"),
        ):
            RarArchiveReader(b"fake_rar_bytes")

    def test_not_rar_file_propagates(self):
        try:
            import rarfile
        except ImportError:
            pytest.skip("rarfile not installed")
        from metadata.readers.archive import RarArchiveReader

        with pytest.raises(rarfile.NotRarFile):
            RarArchiveReader(b"definitely_not_rar")

    def test_entries_yields_files(self):
        if importlib.util.find_spec("rarfile") is None:
            pytest.skip("rarfile not installed")
        from metadata.readers.archive import RarArchiveReader

        mock_file_handle = MagicMock()
        mock_file_handle.read.return_value = _CSV_CONTENT

        mock_cm = MagicMock()
        mock_cm.__enter__ = lambda s: mock_file_handle
        mock_cm.__exit__ = MagicMock(return_value=False)

        mock_entry_info = MagicMock()
        mock_entry_info.is_dir.return_value = False
        mock_entry_info.file_size = len(_CSV_CONTENT)
        mock_entry_info.filename = "data.csv"

        mock_rar = MagicMock()
        mock_rar.infolist.return_value = [mock_entry_info]
        mock_rar.open.return_value = mock_cm

        with patch("rarfile.RarFile", return_value=mock_rar):
            reader = RarArchiveReader(b"fake_rar")
            entries = list(reader.entries())

        assert len(entries) == 1
        assert entries[0].name == "data.csv"
        assert entries[0].data.read() == _CSV_CONTENT

    def test_entries_skips_directories(self):
        if importlib.util.find_spec("rarfile") is None:
            pytest.skip("rarfile not installed")
        from metadata.readers.archive import RarArchiveReader

        dir_entry = MagicMock()
        dir_entry.is_dir.return_value = True
        dir_entry.filename = "subdir/"

        file_entry = MagicMock()
        file_entry.is_dir.return_value = False
        file_entry.file_size = len(_CSV_CONTENT)
        file_entry.filename = "data.csv"
        mock_file = MagicMock()
        mock_file.read.return_value = _CSV_CONTENT
        cm = MagicMock()
        cm.__enter__ = lambda s: mock_file
        cm.__exit__ = MagicMock(return_value=False)

        mock_rar = MagicMock()
        mock_rar.infolist.return_value = [dir_entry, file_entry]
        mock_rar.open.return_value = cm

        with patch("rarfile.RarFile", return_value=mock_rar):
            reader = RarArchiveReader(b"fake_rar")
            entries = list(reader.entries())

        assert len(entries) == 1
        assert entries[0].name == "data.csv"

    def test_entries_skips_suspicious_path(self):
        if importlib.util.find_spec("rarfile") is None:
            pytest.skip("rarfile not installed")
        from metadata.readers.archive import RarArchiveReader

        suspicious_entry = MagicMock()
        suspicious_entry.is_dir.return_value = False
        suspicious_entry.file_size = len(_CSV_CONTENT)
        suspicious_entry.filename = "../evil.csv"

        mock_rar = MagicMock()
        mock_rar.infolist.return_value = [suspicious_entry]

        with patch("rarfile.RarFile", return_value=mock_rar):
            reader = RarArchiveReader(b"fake_rar")
            entries = list(reader.entries())

        assert entries == []

    def test_entries_exception_raises_on_data_access(self):
        """With lazy loading, rar open failure surfaces on .data access, not during entries()."""
        if importlib.util.find_spec("rarfile") is None:
            pytest.skip("rarfile not installed")
        from metadata.readers.archive import RarArchiveReader

        bad_entry = MagicMock()
        bad_entry.is_dir.return_value = False
        bad_entry.file_size = 10
        bad_entry.filename = "broken.csv"

        mock_rar = MagicMock()
        mock_rar.infolist.return_value = [bad_entry]
        mock_rar.open.side_effect = OSError("rar extraction failed")

        with patch("rarfile.RarFile", return_value=mock_rar):
            reader = RarArchiveReader(b"fake_rar")
            entries = list(reader.entries())

        assert len(entries) == 1
        with pytest.raises(ValueError):
            _ = entries[0].data


# ---------------------------------------------------------------------------
# TestGetArchiveReader
# ---------------------------------------------------------------------------


class TestGetArchiveReader:
    def test_zip_raises_since_not_handled_directly(self):
        with pytest.raises(ValueError, match="Unsupported"):
            get_archive_reader("zip", b"data")

    def test_tar_gz_returns_tar_reader(self):
        tar_bytes = _make_tar({"f.csv": _CSV_CONTENT})
        with get_archive_reader("tar.gz", tar_bytes) as reader:
            assert isinstance(reader, TarArchiveReader)

    def test_tgz_returns_tar_reader(self):
        tar_bytes = _make_tar({"f.csv": _CSV_CONTENT})
        with get_archive_reader("tgz", tar_bytes) as reader:
            assert isinstance(reader, TarArchiveReader)

    def test_plain_tar_returns_tar_reader(self):
        tar_bytes = _make_tar({"f.csv": _CSV_CONTENT}, mode="w:")
        with get_archive_reader("tar", tar_bytes) as reader:
            assert isinstance(reader, TarArchiveReader)

    def test_case_insensitive_tar(self):
        tar_bytes = _make_tar({"f.csv": _CSV_CONTENT})
        with get_archive_reader("TAR.GZ", tar_bytes) as reader:
            assert isinstance(reader, TarArchiveReader)

    def test_7z_returns_seven_zip_reader(self):
        if importlib.util.find_spec("py7zr") is None:
            pytest.skip("py7zr not installed")
        from metadata.readers.archive import SevenZipArchiveReader

        seven_z_bytes = _make_seven_z({"f.csv": _CSV_CONTENT})
        with get_archive_reader("7z", seven_z_bytes) as reader:
            assert isinstance(reader, SevenZipArchiveReader)

    def test_rar_returns_rar_reader(self):
        if importlib.util.find_spec("rarfile") is None:
            pytest.skip("rarfile not installed")
        from metadata.readers.archive import RarArchiveReader

        mock_rar = MagicMock()
        mock_rar.infolist.return_value = []
        with patch("rarfile.RarFile", return_value=mock_rar):
            reader = get_archive_reader("rar", b"fake_rar")
        assert isinstance(reader, RarArchiveReader)
        reader.close()

    def test_unknown_format_raises(self):
        with pytest.raises(ValueError, match="Unsupported"):
            get_archive_reader("bz2", b"data")


# ---------------------------------------------------------------------------
# TestOpenArchiveReader
# ---------------------------------------------------------------------------


class TestOpenArchiveReader:
    def test_zip_returns_zip_reader(self):
        zip_bytes = _make_zip({"f.csv": _CSV_CONTENT})
        blob = _MockBlob(zip_bytes)
        with open_archive_reader(blob, "zip") as reader:
            assert isinstance(reader, ZipReader)

    def test_zip_case_insensitive(self):
        zip_bytes = _make_zip({"f.csv": _CSV_CONTENT})
        blob = _MockBlob(zip_bytes)
        with open_archive_reader(blob, "ZIP") as reader:
            assert isinstance(reader, ZipReader)

    def test_tar_gz_full_download(self):
        tar_bytes = _make_tar({"f.csv": _CSV_CONTENT})
        blob = _MockBlob(tar_bytes)
        with open_archive_reader(blob, "tar.gz") as reader:
            entries = list(reader.entries())
        assert len(entries) == 1

    def test_oversized_non_zip_raises(self):
        blob = _MockBlob(b"", size_override=MAX_ARCHIVE_SIZE_BYTES + 1)
        with pytest.raises(ValueError, match="exceeds limit"):
            open_archive_reader(blob, "tar.gz")


# ---------------------------------------------------------------------------
# TestZipBombProtection
# ---------------------------------------------------------------------------


class TestZipBombProtection:
    """Security-focused tests verifying size guards across all readers."""

    def test_zip_archive_reader_skips_entry_exceeding_size_limit(self):
        import metadata.readers.archive as arch_mod

        zip_bytes = _make_zip({"big.csv": b"x" * 10}, compression=zipfile.ZIP_STORED)
        original = arch_mod._MAX_INNER_FILE_BYTES
        try:
            arch_mod._MAX_INNER_FILE_BYTES = 5
            with ZipArchiveReader(zip_bytes) as reader:
                entries = list(reader.entries())
        finally:
            arch_mod._MAX_INNER_FILE_BYTES = original
        assert entries == []

    def test_zip_range_reader_skips_entry_exceeding_size_limit(self):
        import metadata.readers.archive as arch_mod

        zip_bytes = _make_zip({"big.csv": b"x" * 10}, compression=zipfile.ZIP_STORED)
        original = arch_mod._MAX_INNER_FILE_BYTES
        try:
            arch_mod._MAX_INNER_FILE_BYTES = 5
            blob = _MockBlob(zip_bytes)
            with ZipRangeReader(blob) as reader:
                entries = list(reader.entries())
        finally:
            arch_mod._MAX_INNER_FILE_BYTES = original
        assert entries == []

    def test_tar_reader_skips_entry_exceeding_size_limit(self):
        import metadata.readers.archive as arch_mod

        tar_bytes = _make_tar({"big.csv": b"x" * 10}, mode="w:")
        original = arch_mod._MAX_INNER_FILE_BYTES
        try:
            arch_mod._MAX_INNER_FILE_BYTES = 5
            with TarArchiveReader(tar_bytes) as reader:
                entries = list(reader.entries())
        finally:
            arch_mod._MAX_INNER_FILE_BYTES = original
        assert entries == []

    def test_zip_bomb_lying_uncomp_size_raises_on_data_access(self):
        """Entry with lying uncomp_size=0 in CD passes eager check but fails on decompression."""
        import metadata.readers.archive as arch_mod

        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT}, compression=zipfile.ZIP_DEFLATED)
        original = arch_mod._MAX_INNER_FILE_BYTES
        try:
            arch_mod._MAX_INNER_FILE_BYTES = 5
            blob = _MockBlob(zip_bytes)
            reader = ZipRangeReader(blob)
            # Simulate a zip bomb: lie that uncompressed size is 0
            for cd_entry in reader._cd_entries:
                cd_entry.uncomp_size = 0
            entries = list(reader.entries())  # passes eager check (0 <= 5)
            assert len(entries) == 1
            with pytest.raises(ValueError):
                _ = entries[0].data  # comp_size or decompression limit triggers
            reader.close()
        finally:
            arch_mod._MAX_INNER_FILE_BYTES = original

    def test_max_archive_size_enforced_for_zip_range_reader(self):
        blob = _MockBlob(b"", size_override=MAX_ARCHIVE_SIZE_BYTES + 1)
        with pytest.raises(ValueError, match="exceeds limit"):
            ZipRangeReader(blob)

    def test_max_archive_size_enforced_for_zip_reader(self):
        blob = _MockBlob(b"", size_override=MAX_ARCHIVE_SIZE_BYTES + 1)
        with pytest.raises(ValueError, match="exceeds limit"):
            ZipReader(blob)

    def test_max_archive_size_enforced_for_non_zip_via_open_archive_reader(self):
        blob = _MockBlob(b"", size_override=MAX_ARCHIVE_SIZE_BYTES + 1)
        with pytest.raises(ValueError, match="exceeds limit"):
            open_archive_reader(blob, "tar.gz")

    def test_multiple_small_entries_all_yielded_no_count_limit(self):
        """Many small entries are all yielded — the guard is per-entry size, not count."""
        files = {f"file_{i}.csv": _CSV_CONTENT for i in range(20)}
        zip_bytes = _make_zip(files)
        with ZipArchiveReader(zip_bytes) as reader:
            entries = list(reader.entries())
        assert len(entries) == 20


# ---------------------------------------------------------------------------
# TestInferColumnsFromArchiveEntry
# ---------------------------------------------------------------------------


class TestInferColumnsFromArchiveEntry:
    def test_csv_returns_columns(self):
        entry = _make_entry("data.csv", _CSV_CONTENT)
        columns = infer_columns_from_archive_entry(entry, SupportedTypes.CSV)
        assert len(columns) > 0
        col_names = [c.name.root for c in columns]
        assert "id" in col_names
        assert "name" in col_names
        assert "value" in col_names

    def test_json_returns_columns(self):
        entry = _make_entry("data.json", _JSON_CONTENT)
        columns = infer_columns_from_archive_entry(entry, SupportedTypes.JSON)
        assert len(columns) > 0
        col_names = [c.name.root for c in columns]
        assert "id" in col_names

    def test_jsonl_returns_columns(self):
        entry = _make_entry("data.jsonl", _JSONL_CONTENT)
        columns = infer_columns_from_archive_entry(entry, SupportedTypes.JSONL)
        assert len(columns) > 0

    def test_avro_delegates_to_avro_reader(self):
        entry = _make_entry("data.avro", b"fake_avro")
        mock_cols = [MagicMock()]
        with patch(
            "metadata.readers.archive.AvroDataFrameReader._get_avro_columns",
            return_value=mock_cols,
        ):
            cols = infer_columns_from_archive_entry(entry, SupportedTypes.AVRO)
        assert cols == mock_cols

    def test_avro_none_result_returns_empty_list(self):
        entry = _make_entry("data.avro", b"fake")
        with patch(
            "metadata.readers.archive.AvroDataFrameReader._get_avro_columns",
            return_value=None,
        ):
            cols = infer_columns_from_archive_entry(entry, SupportedTypes.AVRO)
        assert cols == []

    def test_no_reader_for_mf4_returns_empty(self):
        entry = _make_entry("data.MF4", b"\x00" * 10)
        cols = infer_columns_from_archive_entry(entry, SupportedTypes.MF4)
        assert cols == []

    def test_corrupted_data_returns_empty(self):
        entry = _make_entry("bad.csv", b"\x00\xff\xfe")
        cols = infer_columns_from_archive_entry(entry, SupportedTypes.CSV)
        assert cols == []

    def test_data_seek_called_before_read(self):
        entry = _make_entry("data.csv", _CSV_CONTENT)
        entry.data.read()  # exhaust the cached buffer
        cols = infer_columns_from_archive_entry(entry, SupportedTypes.CSV)
        assert len(cols) > 0

    def test_parquet_returns_columns(self):
        import pandas as pd

        buf = BytesIO()
        pd.DataFrame({"a": [1, 2], "b": ["x", "y"]}).to_parquet(buf, index=False)
        parquet_data = buf.getvalue()
        entry = _make_entry("data.parquet", parquet_data)
        cols = infer_columns_from_archive_entry(entry, SupportedTypes.PARQUET)
        assert len(cols) > 0
        col_names = [c.name.root for c in cols]
        assert "a" in col_names
        assert "b" in col_names

    def test_tsv_returns_columns(self):
        entry = _make_entry("data.tsv", _TSV_CONTENT)
        cols = infer_columns_from_archive_entry(entry, SupportedTypes.TSV)
        assert len(cols) > 0
        col_names = [c.name.root for c in cols]
        assert "id" in col_names
        assert "name" in col_names

    def test_parquet_complex_types_returns_struct_and_array(self):
        from metadata.generated.schema.entity.data.table import DataType

        parquet_bytes = _make_complex_parquet()
        entry = _make_entry("data.parquet", parquet_bytes)
        cols = infer_columns_from_archive_entry(entry, SupportedTypes.PARQUET)
        col_map = {c.name.root: c.dataType for c in cols}
        assert col_map["id"] == DataType.INT
        assert col_map["meta"] == DataType.STRUCT
        assert col_map["tags"] == DataType.ARRAY

    def test_parquet_empty_file_returns_columns_from_schema(self):
        parquet_bytes = _make_empty_parquet()
        entry = _make_entry("data.parquet", parquet_bytes)
        cols = infer_columns_from_archive_entry(entry, SupportedTypes.PARQUET)
        col_names = [c.name.root for c in cols]
        assert "id" in col_names
        assert "name" in col_names

    def test_csv_header_only_returns_columns(self):
        header_only = b"id,name,value\n"
        entry = _make_entry("data.csv", header_only)
        cols = infer_columns_from_archive_entry(entry, SupportedTypes.CSV)
        assert len(cols) > 0

    def test_infer_called_twice_uses_same_cached_data(self):
        entry = _make_entry("data.csv", _CSV_CONTENT)
        cols1 = infer_columns_from_archive_entry(entry, SupportedTypes.CSV)
        cols2 = infer_columns_from_archive_entry(entry, SupportedTypes.CSV)
        assert len(cols1) == len(cols2)


# ---------------------------------------------------------------------------
# TestGetFirstSchemaEntry
# ---------------------------------------------------------------------------


class TestGetFirstSchemaEntry:
    def test_returns_first_csv_entry(self):
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            result = get_first_schema_entry(reader)
        assert result is not None
        _entry, fmt = result
        assert fmt == SupportedTypes.CSV

    def test_skips_nested_archives_returns_csv(self):
        inner_zip = _make_zip({"inner.csv": _CSV_CONTENT})
        zip_bytes = _make_zip({"inner.zip": inner_zip, "data.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            result = get_first_schema_entry(reader)
        assert result is not None
        entry, _fmt = result
        assert entry.name == "data.csv"

    def test_returns_none_for_all_unsupported_types(self):
        zip_bytes = _make_zip({"image.png": b"\x89PNG\r\n", "readme.md": b"# hello"})
        with ZipArchiveReader(zip_bytes) as reader:
            result = get_first_schema_entry(reader)
        assert result is None

    def test_returns_none_for_empty_archive(self):
        zip_bytes = _make_zip({})
        with ZipArchiveReader(zip_bytes) as reader:
            result = get_first_schema_entry(reader)
        assert result is None

    def test_skips_nested_tgz(self):
        inner_tar = _make_tar({"inner.csv": _CSV_CONTENT})
        zip_bytes = _make_zip({"bundle.tar.gz": inner_tar, "data.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            result = get_first_schema_entry(reader)
        assert result is not None
        assert result[0].name == "data.csv"

    def test_json_inside_zip(self):
        zip_bytes = _make_zip({"data.json": _JSON_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            result = get_first_schema_entry(reader)
        assert result is not None
        entry, fmt = result
        assert fmt == SupportedTypes.JSON
        assert entry.name == "data.json"

    def test_parquet_inside_zip(self):
        parquet_bytes = _make_parquet({"a": [1, 2], "b": ["x", "y"]})
        zip_bytes = _make_zip({"data.parquet": parquet_bytes})
        with ZipArchiveReader(zip_bytes) as reader:
            result = get_first_schema_entry(reader)
        assert result is not None
        entry, fmt = result
        assert fmt == SupportedTypes.PARQUET
        assert entry.name == "data.parquet"

    def test_all_nested_archives_returns_none(self):
        inner = _make_zip({"data.csv": _CSV_CONTENT})
        outer = _make_zip({"a.zip": inner})
        with ZipArchiveReader(outer) as reader:
            result = get_first_schema_entry(reader)
        assert result is None


# ---------------------------------------------------------------------------
# TestIterArchiveEntriesWithSchema — entirely new
# ---------------------------------------------------------------------------


class TestIterArchiveEntriesWithSchema:
    def test_single_csv_yields_with_columns(self):
        zip_bytes = _make_zip({"data.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            results = list(iter_archive_entries_with_schema(reader))
        assert len(results) == 1
        entry, columns, entry_format = results[0]
        assert entry.name == "data.csv"
        assert entry_format == SupportedTypes.CSV
        assert len(columns) > 0

    def test_schema_inferred_exactly_once(self):
        zip_bytes = _make_zip({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT})
        with (
            patch(
                "metadata.readers.archive.infer_columns_from_archive_entry",
                return_value=[MagicMock()],
            ) as mock_infer,
            ZipArchiveReader(zip_bytes) as reader,
        ):
            list(iter_archive_entries_with_schema(reader))
        mock_infer.assert_called_once()

    def test_second_entry_gets_same_columns_object(self):
        zip_bytes = _make_zip({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            results = list(iter_archive_entries_with_schema(reader))
        assert len(results) == 2
        assert results[0][1] is results[1][1]

    def test_nested_archive_skipped_not_yielded(self):
        inner_zip = _make_zip({"inner.csv": _CSV_CONTENT})
        zip_bytes = _make_zip({"inner.zip": inner_zip, "data.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            results = list(iter_archive_entries_with_schema(reader))
        names = [r[0].name for r in results]
        assert "inner.zip" not in names
        assert "data.csv" in names

    def test_unknown_format_entry_yields_none_format(self):
        zip_bytes = _make_zip({"image.png": b"\x89PNG\r\n"})
        with ZipArchiveReader(zip_bytes) as reader:
            results = list(iter_archive_entries_with_schema(reader))
        assert len(results) == 1
        _entry, columns, entry_format = results[0]
        assert entry_format is None
        assert columns == []

    def test_unknown_first_csv_second_schema_from_csv(self):
        zip_bytes = _make_zip({"readme.txt": b"hello world", "data.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            results = list(iter_archive_entries_with_schema(reader))
        assert len(results) == 2
        txt_result = next(r for r in results if r[0].name == "readme.txt")
        csv_result = next(r for r in results if r[0].name == "data.csv")
        assert txt_result[1] == []
        assert len(csv_result[1]) > 0

    def test_empty_reader_yields_nothing(self):
        zip_bytes = _make_zip({})
        with ZipArchiveReader(zip_bytes) as reader:
            results = list(iter_archive_entries_with_schema(reader))
        assert results == []

    def test_retry_inference_after_failure(self):
        """If first CSV returns [] from infer, second CSV still gets a column inference attempt."""
        zip_bytes = _make_zip({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT})
        call_count = {"n": 0}

        def _infer_side_effect(entry, fmt):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return []
            return [MagicMock()]

        with (
            patch(
                "metadata.readers.archive.infer_columns_from_archive_entry",
                side_effect=_infer_side_effect,
            ),
            ZipArchiveReader(zip_bytes) as reader,
        ):
            results = list(iter_archive_entries_with_schema(reader))

        assert call_count["n"] == 2
        assert len(results) == 2

    def test_parquet_inside_zip_columns_inferred(self):
        parquet_bytes = _make_parquet({"a": [1, 2], "b": ["x", "y"]})
        zip_bytes = _make_zip({"data.parquet": parquet_bytes})
        with ZipArchiveReader(zip_bytes) as reader:
            results = list(iter_archive_entries_with_schema(reader))
        assert len(results) == 1
        _entry, columns, entry_format = results[0]
        assert entry_format == SupportedTypes.PARQUET
        assert len(columns) > 0
        col_names = [c.name.root for c in columns]
        assert "a" in col_names
        assert "b" in col_names

    def test_all_archive_files_yield_nothing(self):
        """If all entries are nested archives, nothing is yielded."""
        inner = _make_zip({"data.csv": _CSV_CONTENT})
        outer = _make_zip({"a.zip": inner, "b.zip": inner})
        with ZipArchiveReader(outer) as reader:
            results = list(iter_archive_entries_with_schema(reader))
        assert results == []

    def test_mixed_archive_and_data_files(self):
        inner_zip = _make_zip({"inner.csv": _CSV_CONTENT})
        zip_bytes = _make_zip({"nested.zip": inner_zip, "real.csv": _CSV_CONTENT, "image.png": b"\x89PNG"})
        with ZipArchiveReader(zip_bytes) as reader:
            results = list(iter_archive_entries_with_schema(reader))
        names = [r[0].name for r in results]
        assert "nested.zip" not in names
        assert "real.csv" in names
        assert "image.png" in names

    def test_data_loader_called_only_for_first_schema_entry(self):
        """For a multi-file archive, the data loader is triggered exactly once — for the first
        entry used to infer schema. Subsequent entries with the same schema are yielded without
        ever accessing their data.

        cached_property stores its result in instance.__dict__["data"] on first access.
        Entries whose loader was never called will have no "data" key in __dict__.
        """
        zip_bytes = _make_zip({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT, "c.csv": _CSV_CONTENT})
        with ZipArchiveReader(zip_bytes) as reader:
            results = list(iter_archive_entries_with_schema(reader))

        assert len(results) == 3
        entries = [r[0] for r in results]

        # Only the first entry should have had its data loader triggered
        loaders_triggered = [e.name for e in entries if "data" in e.__dict__]
        loaders_not_triggered = [e.name for e in entries if "data" not in e.__dict__]

        assert loaders_triggered == ["a.csv"]
        assert set(loaders_not_triggered) == {"b.csv", "c.csv"}

    def test_data_loader_not_called_when_schema_already_known(self):
        """Verify via mock loader that entries beyond the first never have their loader invoked."""
        loaded = []

        def _tracked_loader(name, content):
            def loader():
                loaded.append(name)
                return BytesIO(content)

            return loader

        entries_in = [
            ArchiveEntry("first.csv", len(_CSV_CONTENT), _tracked_loader("first.csv", _CSV_CONTENT)),
            ArchiveEntry("second.csv", len(_CSV2_CONTENT), _tracked_loader("second.csv", _CSV2_CONTENT)),
            ArchiveEntry("third.csv", len(_CSV_CONTENT), _tracked_loader("third.csv", _CSV_CONTENT)),
        ]

        mock_reader = MagicMock()
        mock_reader.entries.return_value = iter(entries_in)

        list(iter_archive_entries_with_schema(mock_reader))

        # Only first.csv's loader should have been called (to infer schema)
        assert loaded == ["first.csv"]


class TestParquetInArchiveFormats:
    def test_parquet_inside_tar(self):
        parquet_bytes = _make_parquet({"x": [1, 2], "y": ["a", "b"]})
        tar_bytes = _make_tar({"data.parquet": parquet_bytes})
        # infer_columns must run inside the context — tar file must be open
        with TarArchiveReader(tar_bytes) as reader:
            result = get_first_schema_entry(reader)
            assert result is not None
            entry, fmt = result
            assert fmt == SupportedTypes.PARQUET
            cols = infer_columns_from_archive_entry(entry, fmt)
        col_names = [c.name.root for c in cols]
        assert "x" in col_names
        assert "y" in col_names

    def test_parquet_inside_7z(self):
        if importlib.util.find_spec("py7zr") is None:
            pytest.skip("py7zr not installed")
        from metadata.readers.archive import SevenZipArchiveReader

        parquet_bytes = _make_parquet({"x": [1, 2], "y": ["a", "b"]})
        seven_z_bytes = _make_seven_z({"data.parquet": parquet_bytes})
        # infer_columns must run inside the context — temp dir is deleted on close
        with SevenZipArchiveReader(seven_z_bytes) as reader:
            result = get_first_schema_entry(reader)
            assert result is not None
            entry, fmt = result
            assert fmt == SupportedTypes.PARQUET
            cols = infer_columns_from_archive_entry(entry, fmt)
        col_names = [c.name.root for c in cols]
        assert "x" in col_names
        assert "y" in col_names

    def test_parquet_inside_rar(self):
        if importlib.util.find_spec("rarfile") is None:
            pytest.skip("rarfile not installed")
        from metadata.readers.archive import RarArchiveReader

        parquet_bytes = _make_parquet({"x": [1, 2], "y": ["a", "b"]})
        mock_file_handle = MagicMock()
        mock_file_handle.read.return_value = parquet_bytes
        mock_cm = MagicMock()
        mock_cm.__enter__ = lambda _: mock_file_handle
        mock_cm.__exit__ = MagicMock(return_value=False)
        mock_entry_info = MagicMock()
        mock_entry_info.is_dir.return_value = False
        mock_entry_info.file_size = len(parquet_bytes)
        mock_entry_info.filename = "data.parquet"
        mock_rar = MagicMock()
        mock_rar.infolist.return_value = [mock_entry_info]
        mock_rar.open.return_value = mock_cm
        with patch("rarfile.RarFile", return_value=mock_rar):
            reader = RarArchiveReader(b"fake_rar")
            result = get_first_schema_entry(reader)
        assert result is not None
        entry, fmt = result
        assert fmt == SupportedTypes.PARQUET
        cols = infer_columns_from_archive_entry(entry, fmt)
        col_names = [c.name.root for c in cols]
        assert "x" in col_names
        assert "y" in col_names
