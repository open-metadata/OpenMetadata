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
"""Compressed archive support."""

import struct
import tarfile
import traceback
import zipfile
import zlib
from abc import ABC, abstractmethod
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from functools import partial
from io import BytesIO
from typing import Protocol

import pandas as pd

from metadata.readers.dataframe.avro import AvroDataFrameReader
from metadata.readers.dataframe.reader_factory import SupportedTypes
from metadata.utils.datalake.datalake_utils import DataFrameColumnParser
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

ARCHIVE_EXTENSIONS = frozenset({".zip", ".tar", ".tar.gz", ".tgz", ".7z", ".rar"})

# Guard against downloading enormous archives.
MAX_ARCHIVE_SIZE_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB

# Each inner file is fully read into a BytesIO buffer before being processed.
_MAX_INNER_FILE_BYTES = 256 * 1024 * 1024  # 256 MB

# ZIP binary signatures (per PKWARE APPNOTE spec, section 4.3).
# Every structural record in a ZIP starts with one of these 4-byte markers.
_EOCD_SIGNATURE = b"PK\x05\x06"  # End of Central Directory record
_CD_ENTRY_SIGNATURE = b"PK\x01\x02"  # Central Directory file header
_LOCAL_FILE_SIGNATURE = b"PK\x03\x04"  # Local file header (precedes actual file data)

_ZIP64_SENTINEL = 0xFFFF_FFFF

# Maximum bytes to scan from the end of a ZIP to locate the EOCD record.
# 65535 is the max ZIP comment length + 22 bytes for the fixed EOCD structure.
_EOCD_MAX_SCAN = 65558

# Encoding used to decode filenames from ZIP Central Directory entries.
# 'replace' error strategy substitutes ? for undecodable bytes rather than raising.
_UTF8 = "utf-8"


class RangeReadableBlob(Protocol):
    """Structural interface for cloud blob objects that support partial reads.

    Implement this protocol (or use the provided adapters) to plug any cloud
    storage client into ZipRangeReader / open_archive_reader.
    """

    def get_size(self) -> int: ...

    def read_range(self, offset: int, length: int) -> bytes: ...

    def read_all(self) -> bytes: ...


class ADLSBlobAdapter:
    """Adapts an azure-storage-blob BlobClient to RangeReadableBlob."""

    def __init__(self, blob_client) -> None:
        self._client = blob_client

    def get_size(self) -> int:
        return self._client.get_blob_properties().size or 0

    def read_range(self, offset: int, length: int) -> bytes:
        return self._client.download_blob(offset=offset, length=length).readall()

    def read_all(self) -> bytes:
        return self._client.download_blob().readall()


class S3BlobAdapter:
    """Adapts a boto3 S3 client + coordinates to RangeReadableBlob."""

    def __init__(self, s3_client, bucket: str, key: str) -> None:
        self._client = s3_client
        self._bucket = bucket
        self._key = key

    def get_size(self) -> int:
        return self._client.head_object(Bucket=self._bucket, Key=self._key)["ContentLength"]

    def read_range(self, offset: int, length: int) -> bytes:
        range_header = f"bytes={offset}-{offset + length - 1}"
        return self._client.get_object(
            Bucket=self._bucket, Key=self._key, Range=range_header
        )["Body"].read()

    def read_all(self) -> bytes:
        return self._client.get_object(Bucket=self._bucket, Key=self._key)["Body"].read()


class GCSBlobAdapter:
    """Adapts a google-cloud-storage Blob to RangeReadableBlob."""

    def __init__(self, bucket_client, path: str) -> None:
        self._blob = bucket_client.blob(path)

    def get_size(self) -> int:
        if self._blob.size is None:
            self._blob.reload()
        return self._blob.size or 0

    def read_range(self, offset: int, length: int) -> bytes:
        return self._blob.download_as_bytes(start=offset, end=offset + length - 1)

    def read_all(self) -> bytes:
        return self._blob.download_as_bytes()


_DF_READERS: dict[SupportedTypes, Callable[[BytesIO], object]] = {
    SupportedTypes.CSV: partial(pd.read_csv, nrows=100),
    SupportedTypes.CSVGZ: partial(pd.read_csv, compression="gzip", nrows=100),
    SupportedTypes.TSV: partial(pd.read_csv, sep="\t", nrows=100),
    SupportedTypes.PARQUET: pd.read_parquet,
    SupportedTypes.PARQUET_PQ: pd.read_parquet,
    SupportedTypes.PARQUET_PQT: pd.read_parquet,
    SupportedTypes.PARQUET_PARQ: pd.read_parquet,
    SupportedTypes.PARQUET_SNAPPY: pd.read_parquet,
    SupportedTypes.JSON: partial(pd.read_json, lines=False),
    SupportedTypes.JSONGZ: partial(pd.read_json, lines=False),
    SupportedTypes.JSONZIP: partial(pd.read_json, lines=False),
    SupportedTypes.JSONL: partial(pd.read_json, lines=True),
    SupportedTypes.JSONLGZ: partial(pd.read_json, lines=True),
    SupportedTypes.JSONLZIP: partial(pd.read_json, lines=True),
}


@dataclass
class _EOCDRecord:
    cd_offset: int
    cd_size: int

    _STRUCT = struct.Struct("<4sHHHHIIH")

    @classmethod
    def from_bytes(cls, data: bytes, offset: int) -> "_EOCDRecord":
        fields = cls._STRUCT.unpack_from(data, offset)
        # sig, disk_num, disk_cd_start, entries_this_disk, total_entries, cd_size, cd_offset, comment_len
        return cls(cd_size=fields[5], cd_offset=fields[6])


@dataclass
class _CDEntry:
    compress_method: int
    comp_size: int
    uncomp_size: int
    fname_len: int
    extra_len: int
    comment_len: int
    local_offset: int

    _STRUCT = struct.Struct("<4sHHHHHHIIIHHHHHII")
    FIXED_SIZE = 46

    @classmethod
    def from_bytes(cls, data: bytes, offset: int) -> "_CDEntry":
        fields = cls._STRUCT.unpack_from(data, offset)
        # sig, ver_by, ver_need, flag, compress_method, mtime, mdate, crc,
        # comp_size, uncomp_size, fname_len, extra_len, comment_len,
        # disk, int_attr, ext_attr, local_offset
        return cls(
            compress_method=fields[4],
            comp_size=fields[8],
            uncomp_size=fields[9],
            fname_len=fields[10],
            extra_len=fields[11],
            comment_len=fields[12],
            local_offset=fields[16],
        )


@dataclass
class _ZipEntry:
    name: str
    local_offset: int
    comp_size: int
    uncomp_size: int
    compress_method: int


@dataclass
class _LocalFileHeader:
    fname_len: int
    extra_len: int

    _STRUCT = struct.Struct("<4sHHHHHIIIHH")

    @classmethod
    def from_bytes(cls, data: bytes) -> "_LocalFileHeader":
        fields = cls._STRUCT.unpack_from(data)
        # sig, ver, flag, method, mtime, mdate, crc, comp_size, uncomp_size, fname_len, extra_len
        return cls(fname_len=fields[9], extra_len=fields[10])


@dataclass
class ArchiveEntry:
    name: str
    data: BytesIO
    size: int


class ArchiveReader(ABC):
    @abstractmethod
    def entries(self) -> Iterator[ArchiveEntry]: ...

    @abstractmethod
    def close(self) -> None: ...

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


class ZipArchiveReader(ArchiveReader):
    """Fallback ZIP reader — loads the entire archive into memory. Used when range requests fail."""

    def __init__(self, data: bytes) -> None:
        try:
            self._zip_file = zipfile.ZipFile(BytesIO(data))
        except zipfile.BadZipFile as exc:
            raise ValueError("Corrupted ZIP") from exc

    def entries(self) -> Iterator[ArchiveEntry]:
        for entry_info in self._zip_file.infolist():
            if entry_info.is_dir():
                continue
            if entry_info.file_size > _MAX_INNER_FILE_BYTES:
                logger.warning(
                    f"Skipping {entry_info.filename!r}: uncompressed size {entry_info.file_size} exceeds limit"
                )
                continue
            try:
                with self._zip_file.open(entry_info) as file_handle:
                    yield ArchiveEntry(
                        name=entry_info.filename,
                        data=BytesIO(file_handle.read()),
                        size=entry_info.file_size,
                    )
            except Exception as exc:
                logger.warning(f"Skipping archive entry {entry_info.filename!r}: {exc}")

    def close(self) -> None:
        self._zip_file.close()


class ZipRangeReader(ArchiveReader):
    """ZIP reader that uses HTTP range requests instead of a full download.

    Fetches only the EOCD tail + Central Directory to build the file index,
    then downloads individual entry data on demand.
    """

    def __init__(self, blob: RangeReadableBlob) -> None:
        blob_size: int = blob.get_size()
        if blob_size == 0:
            raise ValueError("ZIP blob is empty")
        if blob_size > MAX_ARCHIVE_SIZE_BYTES:
            raise ValueError(f"ZIP size {blob_size} exceeds limit {MAX_ARCHIVE_SIZE_BYTES}")
        self._blob = blob
        self._cd_entries: list[_ZipEntry] = self._read_central_directory(blob_size)

    def _read_central_directory(self, blob_size: int) -> list[_ZipEntry]:
        tail_offset = max(0, blob_size - _EOCD_MAX_SCAN)
        tail = self._blob.read_range(tail_offset, blob_size - tail_offset)

        eocd_rel = tail.rfind(_EOCD_SIGNATURE)
        if eocd_rel == -1:
            raise ValueError("No EOCD signature — not a valid ZIP file")

        eocd = _EOCDRecord.from_bytes(tail, eocd_rel)
        if _ZIP64_SENTINEL in {eocd.cd_offset, eocd.cd_size}:
            raise ValueError(
                "ZIP64 archive detected — range-request reader does not support ZIP64 EOCD; falling back to full download"
            )
        cd_data = self._blob.read_range(eocd.cd_offset, eocd.cd_size)

        entries: list[_ZipEntry] = []
        pos = 0
        while pos + _CDEntry.FIXED_SIZE <= len(cd_data):
            if cd_data[pos : pos + 4] != _CD_ENTRY_SIGNATURE:
                break
            cd_entry = _CDEntry.from_bytes(cd_data, pos)
            fname = cd_data[pos + _CDEntry.FIXED_SIZE : pos + _CDEntry.FIXED_SIZE + cd_entry.fname_len].decode(
                _UTF8, errors="replace"
            )
            entries.append(
                _ZipEntry(
                    name=fname,
                    local_offset=cd_entry.local_offset,
                    comp_size=cd_entry.comp_size,
                    uncomp_size=cd_entry.uncomp_size,
                    compress_method=cd_entry.compress_method,
                )
            )
            pos += _CDEntry.FIXED_SIZE + cd_entry.fname_len + cd_entry.extra_len + cd_entry.comment_len
        return entries

    def entries(self) -> Iterator[ArchiveEntry]:
        for zip_entry in self._cd_entries:
            if zip_entry.name.endswith("/"):
                continue
            if zip_entry.uncomp_size > _MAX_INNER_FILE_BYTES:
                logger.warning(f"Skipping {zip_entry.name!r}: uncompressed size {zip_entry.uncomp_size} exceeds limit")
                continue
            try:
                local_hdr = self._blob.read_range(zip_entry.local_offset, 30)
                if local_hdr[:4] != _LOCAL_FILE_SIGNATURE:
                    logger.warning(f"Invalid local file header for {zip_entry.name!r}")
                    continue
                local_header = _LocalFileHeader.from_bytes(local_hdr)
                data_offset = zip_entry.local_offset + 30 + local_header.fname_len + local_header.extra_len
                compressed = self._blob.read_range(data_offset, zip_entry.comp_size)
                if zip_entry.compress_method == 0:
                    data = compressed
                elif zip_entry.compress_method == 8:
                    data = zlib.decompress(compressed, -15)
                else:
                    logger.warning(
                        f"Unsupported ZIP compression method {zip_entry.compress_method} for {zip_entry.name!r}"
                    )
                    continue
                yield ArchiveEntry(name=zip_entry.name, data=BytesIO(data), size=len(data))
            except Exception as exc:
                logger.warning(f"Skipping archive entry {zip_entry.name!r}: {exc}")

    def close(self) -> None:
        pass


class ZipReader(ArchiveReader):
    """ZIP reader that tries range requests first and falls back to a full download."""

    def __init__(self, blob: RangeReadableBlob) -> None:
        try:
            self._reader: ArchiveReader = ZipRangeReader(blob)
        except Exception as exc:
            logger.warning(f"ZipRangeReader failed ({exc}), falling back to full download")
            blob_size = blob.get_size()
            if blob_size > MAX_ARCHIVE_SIZE_BYTES:
                raise ValueError(f"ZIP size {blob_size} exceeds limit {MAX_ARCHIVE_SIZE_BYTES}") from exc
            data = blob.read_all()
            self._reader = ZipArchiveReader(data)

    def entries(self) -> Iterator[ArchiveEntry]:
        return self._reader.entries()

    def close(self) -> None:
        self._reader.close()


class TarArchiveReader(ArchiveReader):
    """TAR/TAR.GZ reader — loads the entire archive into memory (TAR format requires random access)."""

    def __init__(self, data: bytes) -> None:
        try:
            self._tar_file = tarfile.open(fileobj=BytesIO(data), mode="r:*")  # noqa: SIM115
        except tarfile.TarError as exc:
            raise ValueError("Corrupted TAR") from exc

    def entries(self) -> Iterator[ArchiveEntry]:
        for tar_member in self._tar_file.getmembers():
            if not tar_member.isfile():
                continue
            parts = tar_member.name.replace("\\", "/").split("/")
            if tar_member.name.startswith("/") or ".." in parts:
                logger.warning(f"Skipping suspicious path {tar_member.name!r}")
                continue
            if tar_member.size > _MAX_INNER_FILE_BYTES:
                logger.warning(f"Skipping {tar_member.name!r}: size {tar_member.size} exceeds limit")
                continue
            try:
                extracted_file = self._tar_file.extractfile(tar_member)
                if extracted_file is None:
                    continue
                yield ArchiveEntry(
                    name=tar_member.name,
                    data=BytesIO(extracted_file.read()),
                    size=tar_member.size,
                )
            except Exception as exc:
                logger.warning(f"Skipping archive entry {tar_member.name!r}: {exc}")

    def close(self) -> None:
        self._tar_file.close()


class SevenZipArchiveReader(ArchiveReader):
    """7z reader — py7zr requires full extraction to disk first; files are then read one at a time."""

    def __init__(self, data: bytes) -> None:
        import py7zr  # noqa: PLC0415

        self._raw_data = data
        try:
            # Validate the archive is readable before storing — fail fast with a clean error.
            py7zr.SevenZipFile(BytesIO(data), mode="r").close()
        except Exception as exc:
            raise ValueError("Corrupted 7Z") from exc

    def entries(self) -> Iterator[ArchiveEntry]:
        import tempfile  # noqa: PLC0415
        from pathlib import Path  # noqa: PLC0415

        import py7zr  # noqa: PLC0415

        # Validate all entry names from the archive index (header-only read, no decompression)
        # before any data hits disk. Raises immediately on suspicious paths.
        with py7zr.SevenZipFile(BytesIO(self._raw_data), mode="r") as szf:
            for info in szf.list():
                if info.is_directory:
                    continue
                parts = info.filename.replace("\\", "/").split("/")
                if info.filename.startswith("/") or ".." in parts:
                    raise ValueError(f"Suspicious path in archive: {info.filename!r}")

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            # py7zr has no streaming API — all files must be extracted to disk first.
            with py7zr.SevenZipFile(BytesIO(self._raw_data), mode="r") as seven_zip_file:
                seven_zip_file.extractall(path=tmpdir)
            for file_path in tmp_path.rglob("*"):
                if not file_path.is_file():
                    continue
                relative_name = str(file_path.relative_to(tmp_path))
                try:
                    # py7zr may extract files with restrictive permissions — ensure we can read them.
                    file_path.chmod(0o644)
                    size = file_path.stat().st_size
                    if size > _MAX_INNER_FILE_BYTES:
                        logger.warning(f"Skipping {relative_name!r}: size {size} exceeds limit")
                        continue
                    yield ArchiveEntry(name=relative_name, data=BytesIO(file_path.read_bytes()), size=size)
                except Exception as exc:
                    logger.warning(f"Skipping archive entry {relative_name!r}: {exc}")

    def close(self) -> None:
        pass  # nothing to close; each entries() call opens/closes its own handle


class RarArchiveReader(ArchiveReader):
    """RAR reader — loads the entire archive into memory (RAR format requires random access)."""

    def __init__(self, data: bytes) -> None:
        import rarfile  # noqa: PLC0415

        try:
            self._rar_file = rarfile.RarFile(BytesIO(data))
        except rarfile.BadRarFile as exc:
            raise ValueError("Corrupted RAR") from exc

    def entries(self) -> Iterator[ArchiveEntry]:
        for entry_info in self._rar_file.infolist():
            if entry_info.is_dir():
                continue
            if entry_info.file_size > _MAX_INNER_FILE_BYTES:
                logger.warning(f"Skipping {entry_info.filename!r}: size {entry_info.file_size} exceeds limit")
                continue
            try:
                with self._rar_file.open(entry_info) as file_handle:
                    yield ArchiveEntry(
                        name=entry_info.filename, data=BytesIO(file_handle.read()), size=entry_info.file_size
                    )
            except Exception as exc:
                logger.warning(f"Skipping archive entry {entry_info.filename!r}: {exc}")

    def close(self) -> None:
        self._rar_file.close()


def get_archive_reader(structure_format: str, data: bytes) -> ArchiveReader:
    fmt = structure_format.lower()
    if fmt in {"tar", "tar.gz", "tgz"}:
        return TarArchiveReader(data)
    if fmt == "7z":
        return SevenZipArchiveReader(data)
    if fmt == "rar":
        return RarArchiveReader(data)
    raise ValueError(f"Unsupported archive format: {structure_format!r}")


def open_archive_reader(blob: RangeReadableBlob, structure_format: str) -> ArchiveReader:
    """Open the appropriate reader for a blob without a full download where possible.

    ZIP uses HTTP range requests via ZipReader (falls back to full download only if needed).
    All other formats download the full blob first after a size guard.
    """
    fmt = structure_format.lower()
    if fmt == "zip":
        return ZipReader(blob)
    blob_size = blob.get_size()
    if blob_size > MAX_ARCHIVE_SIZE_BYTES:
        raise ValueError(f"Archive size {blob_size} exceeds limit {MAX_ARCHIVE_SIZE_BYTES}")
    data = blob.read_all()
    return get_archive_reader(structure_format, data)


def detect_inner_format(filename: str) -> SupportedTypes | None:
    """Return the SupportedTypes for the inner file, or None if unrecognised."""
    lower = filename.lower()
    for supported_type in SupportedTypes:
        if lower.endswith("." + supported_type.value):
            return supported_type
    return None


def is_archive_format(structure_format: str | None) -> bool:
    return bool(structure_format) and f".{structure_format.lower()}" in ARCHIVE_EXTENSIONS


def get_first_schema_entry(
    reader: ArchiveReader,
) -> tuple | None:
    """Return (entry, inner_format) for the first valid non-archive inner file.

    Uniform Schema Requirement: all entries share the same schema, so this
    single sample is sufficient for schema inference across the entire archive.
    """
    for entry in reader.entries():
        if entry.name.lower().endswith(tuple(ARCHIVE_EXTENSIONS)):
            logger.info(f"Skipping nested archive {entry.name!r}")
            continue
        inner_format = detect_inner_format(entry.name)
        if inner_format is not None:
            return entry, inner_format
    return None


def iter_archive_entries_with_schema(
    reader: ArchiveReader,
) -> Iterator[tuple[ArchiveEntry, list, SupportedTypes | None]]:
    """Yield (entry, columns, entry_format) for each valid non-archive inner file.

    Schema is inferred once from the first valid entry and reused for all subsequent
    entries (Uniform Schema Requirement). Nested archives are skipped with a log message.
    """
    columns: list = []
    for entry in reader.entries():
        if entry.name.lower().endswith(tuple(ARCHIVE_EXTENSIONS)):
            logger.info(f"Skipping nested archive {entry.name!r}")
            continue
        entry_format = detect_inner_format(entry.name)
        if not columns and entry_format is not None:
            columns = infer_columns_from_archive_entry(entry, entry_format)
        yield entry, columns, entry_format


def infer_columns_from_archive_entry(entry: ArchiveEntry, inner_format: SupportedTypes) -> list:
    """Infer column definitions by reading the entry's bytes into a DataFrame.

    Returns an empty list on any failure so callers can proceed without schema.
    """
    try:
        entry.data.seek(0)
        if inner_format == SupportedTypes.AVRO:
            return AvroDataFrameReader._get_avro_columns(entry.data) or []
        reader = _DF_READERS.get(inner_format)
        if reader is None:
            logger.warning(f"No reader for inner format {inner_format.value!r}")
            return []
        df = reader(entry.data)
        return DataFrameColumnParser.create(df, inner_format).get_columns()
    except Exception as exc:
        logger.warning(f"Failed to infer columns from {entry.name!r}: {exc}")
        logger.debug(traceback.format_exc())
        return []
