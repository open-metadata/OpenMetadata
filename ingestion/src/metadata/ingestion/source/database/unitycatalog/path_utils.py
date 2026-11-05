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
Storage path helpers for Unity Catalog lineage

Databricks reports the same physical location through two different system tables
(`system.access.table_lineage.source_path` and
`system.information_schema.tables.storage_path`) and through several equivalent URI
schemes, so the strings have to be canonicalised before they can be compared.
"""

SCHEME_SEPARATOR = "://"

# Hadoop-era aliases that address the same object store as the scheme they map to.
SCHEME_ALIASES = {
    "s3a": "s3",
    "s3n": "s3",
    "abfs": "abfss",
    "wasb": "abfss",
    "wasbs": "abfss",
    "gcs": "gs",
}


def normalize_storage_path(path: str | None) -> str | None:
    """
    Canonical key for comparing two storage URIs.

    The scheme is lower-cased and de-aliased, while the remainder is left byte for
    byte: object keys are case sensitive, so folding them would merge locations that
    are genuinely distinct.
    """
    if not path or not path.strip():
        return None

    path = path.strip()

    if SCHEME_SEPARATOR not in path:
        return path.rstrip("/") or None

    scheme, _, remainder = path.partition(SCHEME_SEPARATOR)
    scheme = scheme.lower()
    scheme = SCHEME_ALIASES.get(scheme, scheme)

    return f"{scheme}{SCHEME_SEPARATOR}{remainder.rstrip('/')}"


def container_path_candidates(path: str | None) -> list[str]:
    """
    Paths to try against the container index, most faithful first.

    A container's `fullPath` is written by whichever storage connector ingested it
    (the S3 one always emits `s3://`), so a Databricks location reported as `s3a://`
    only matches once de-aliased. The raw form is tried first for the containers
    whose path was recorded verbatim.
    """
    if not path or not path.strip():
        return []

    candidates = [path.strip().rstrip("/"), normalize_storage_path(path)]

    return list(dict.fromkeys(candidate for candidate in candidates if candidate))
