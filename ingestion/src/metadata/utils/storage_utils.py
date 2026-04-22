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

"""
Shared constants and helpers for object-storage connectors (S3, GCS,
Azure) and the datalake connector. Centralised here so every connector
that walks bucket trees can reuse the same sentinel-file detection and
cold-storage filtering.
"""
from typing import FrozenSet

# -------------------------------------------------------------------
# Path segments that are always skipped during listing / discovery.
# These are internal directories written by Spark, Delta Lake, and
# other big-data frameworks. A manifest entry whose ``dataPath``
# contains any of these segments will be dropped before we try to
# sample files or infer schema.
# -------------------------------------------------------------------
DEFAULT_EXCLUDE_SEGMENTS: FrozenSet[str] = frozenset(
    {
        "_delta_log",
        "_temporary",
        "_spark_metadata",
        ".tmp",
        "_SUCCESS",
    }
)

# -------------------------------------------------------------------
# S3 storage classes that indicate the object is in cold / archival
# tier. Reading these files would fail or incur high retrieval costs,
# so they are skipped during ``list_keys`` and sample-file selection.
# -------------------------------------------------------------------
COLD_STORAGE_CLASSES: FrozenSet[str] = frozenset(
    {
        "GLACIER",
        "DEEP_ARCHIVE",
        "GLACIER_IR",
    }
)


def is_excluded_artifact(key: str) -> bool:
    """Return ``True`` if *key* looks like a Spark / Delta / Hadoop
    sentinel artifact that must never be used for schema inference or
    container creation.

    This function is intentionally cloud-agnostic — it operates on
    plain key strings so it can be called from S3, GCS, Azure, or
    the datalake connector.

    Checked artefacts:

    - **Segment-based**: any path component in ``DEFAULT_EXCLUDE_SEGMENTS``
      (e.g. ``_delta_log``, ``_temporary``, ``_spark_metadata``, ``.tmp``)
    - **Leaf-name based**: ``_SUCCESS``, ``_SUCCESS.*``,
      ``_committed_*``, ``_started_*``, ``*.crc`` (Hadoop CRC sidecars)
    """
    segments = set(key.split("/"))
    # Fast path: any directory segment is a known internal path.
    if segments & DEFAULT_EXCLUDE_SEGMENTS:
        return True

    leaf = key.rsplit("/", 1)[-1]
    if leaf == "_SUCCESS" or leaf.startswith("_SUCCESS."):
        return True
    if leaf.startswith("_committed_") or leaf.startswith("_started_"):
        return True
    if leaf.endswith(".crc"):
        return True

    return False
