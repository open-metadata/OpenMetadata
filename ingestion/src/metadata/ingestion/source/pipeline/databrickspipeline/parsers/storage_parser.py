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
Cloud storage parser for Databricks notebooks
Extracts S3, ADLS, GCS file paths from read/write operations
"""

import re
from typing import List

from metadata.ingestion.source.pipeline.databrickspipeline.parsers.base_parser import (
    BaseSourceParser,
    SourceReference,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# S3 patterns: s3://bucket/path or s3a://bucket/path
S3_PATTERN = re.compile(
    r's3a?://([^/"\'\s]+)(/[^"\'\s]*)?',
    re.IGNORECASE,
)

# Azure ADLS Gen2: abfss://container@account.dfs.core.windows.net/path
ADLS_PATTERN = re.compile(
    r'abfss?://([^@"\'\s]+)@([^/"\'\s]+\.dfs\.core\.windows\.net)(/[^"\'\s]*)?',
    re.IGNORECASE,
)

# Google Cloud Storage: gs://bucket/path
GCS_PATTERN = re.compile(
    r'gs://([^/"\'\s]+)(/[^"\'\s]*)?',
    re.IGNORECASE,
)

# DBFS paths: /dbfs/mnt/... or dbfs:/mnt/...
DBFS_PATTERN = re.compile(
    r'(?:dbfs:|/dbfs)(/mnt/[^"\'\s]+)',
    re.IGNORECASE,
)

# Variable assignments for storage paths
STORAGE_VARIABLE_PATTERN = re.compile(
    r'^\s*([A-Z_][A-Z0-9_]*)\s*=\s*["\']([sg]s://[^"\']+|abfss?://[^"\']+|/(?:dbfs/)?mnt/[^"\']+)["\']\s*$',
    re.MULTILINE,
)


class StorageSourceParser(BaseSourceParser):
    """
    Parser for cloud storage paths in Databricks notebooks

    Supports:
    - S3: s3://bucket/path or s3a://bucket/path
    - Azure ADLS Gen2: abfss://container@account.dfs.core.windows.net/path
    - Google Cloud Storage: gs://bucket/path
    - DBFS mounts: /dbfs/mnt/data or dbfs:/mnt/data

    Patterns detected:
    - spark.read.parquet("s3://bucket/path")
    - spark.read.csv("abfss://container@account.dfs.core.windows.net/file.csv")
    - df.write.format("delta").save("gs://bucket/table")
    - PATH = "s3://bucket/data"; spark.read.load(PATH)
    """

    def get_source_type(self) -> str:
        return "storage"

    def can_parse(self, source_code: str) -> bool:
        """Check if code contains any cloud storage paths"""
        if not source_code:
            return False

        # Quick check for storage URL schemes
        return any(
            pattern in source_code
            for pattern in [
                "s3://",
                "s3a://",
                "abfss://",
                "gs://",
                "dbfs:",
                "/dbfs/",
                "/mnt/",
            ]
        )

    def extract_sources(self, source_code: str) -> List[SourceReference]:
        """Extract all cloud storage paths from code"""
        sources = []

        try:
            if not source_code:
                return sources

            # Extract variable assignments for resolution
            variables = self._extract_variables(source_code)

            # Track unique paths to avoid duplicates
            seen_paths = set()

            # Pattern 1: S3 paths
            for match in S3_PATTERN.finditer(source_code):
                bucket = match.group(1)
                path = match.group(2) or "/"
                full_path = f"s3://{bucket}{path}"

                # Resolve variable if needed
                full_path = variables.get(full_path, full_path)

                if full_path not in seen_paths:
                    seen_paths.add(full_path)
                    sources.append(self._create_s3_reference(bucket, path))

            # Pattern 2: Azure ADLS Gen2
            for match in ADLS_PATTERN.finditer(source_code):
                container = match.group(1)
                account = match.group(2)
                path = match.group(3) or "/"
                full_path = f"abfss://{container}@{account}{path}"

                full_path = variables.get(full_path, full_path)

                if full_path not in seen_paths:
                    seen_paths.add(full_path)
                    sources.append(
                        self._create_adls_reference(container, account, path)
                    )

            # Pattern 3: Google Cloud Storage
            for match in GCS_PATTERN.finditer(source_code):
                bucket = match.group(1)
                path = match.group(2) or "/"
                full_path = f"gs://{bucket}{path}"

                full_path = variables.get(full_path, full_path)

                if full_path not in seen_paths:
                    seen_paths.add(full_path)
                    sources.append(self._create_gcs_reference(bucket, path))

            # Pattern 4: DBFS mounts
            for match in DBFS_PATTERN.finditer(source_code):
                path = match.group(1)
                full_path = f"dbfs:{path}"

                full_path = variables.get(full_path, full_path)

                if full_path not in seen_paths:
                    seen_paths.add(full_path)
                    sources.append(self._create_dbfs_reference(path))

            logger.debug(f"Extracted {len(sources)} storage path references")

        except Exception as exc:
            logger.warning(f"Error extracting storage sources: {exc}")

        return sources

    def _extract_variables(self, source_code: str) -> dict:
        """Extract variable assignments for storage paths"""
        variables = {}
        try:
            for match in STORAGE_VARIABLE_PATTERN.finditer(source_code):
                var_name = match.group(1)
                var_value = match.group(2)
                variables[var_name] = var_value
                logger.debug(f"Found storage variable: {var_name} = {var_value}")
        except Exception as exc:
            logger.debug(f"Error extracting storage variables: {exc}")
        return variables

    def _create_s3_reference(self, bucket: str, path: str) -> SourceReference:
        """Create SourceReference for S3 path"""
        full_path = f"s3://{bucket}{path}"

        return SourceReference(
            source_type="s3_path",
            source_name=full_path,
            source_fqn=full_path,
            connection_details={"bucket": bucket, "path": path},
            metadata={
                "cloud_provider": "aws",
                "bucket": bucket,
                "path": path,
            },
        )

    def _create_adls_reference(
        self, container: str, account: str, path: str
    ) -> SourceReference:
        """Create SourceReference for Azure ADLS path"""
        full_path = f"abfss://{container}@{account}{path}"

        return SourceReference(
            source_type="adls_path",
            source_name=full_path,
            source_fqn=full_path,
            connection_details={
                "container": container,
                "account": account,
                "path": path,
            },
            metadata={
                "cloud_provider": "azure",
                "container": container,
                "storage_account": account,
                "path": path,
            },
        )

    def _create_gcs_reference(self, bucket: str, path: str) -> SourceReference:
        """Create SourceReference for Google Cloud Storage path"""
        full_path = f"gs://{bucket}{path}"

        return SourceReference(
            source_type="gcs_path",
            source_name=full_path,
            source_fqn=full_path,
            connection_details={"bucket": bucket, "path": path},
            metadata={
                "cloud_provider": "gcp",
                "bucket": bucket,
                "path": path,
            },
        )

    def _create_dbfs_reference(self, path: str) -> SourceReference:
        """Create SourceReference for DBFS mount path"""
        full_path = f"dbfs:{path}"

        # Try to infer underlying storage from mount name
        # Common pattern: /mnt/s3-bucket, /mnt/adls-container
        underlying_storage = "unknown"
        if "s3" in path.lower():
            underlying_storage = "s3"
        elif "adls" in path.lower() or "azure" in path.lower():
            underlying_storage = "adls"
        elif "gcs" in path.lower():
            underlying_storage = "gcs"

        return SourceReference(
            source_type="dbfs_mount",
            source_name=full_path,
            source_fqn=full_path,
            connection_details={"mount_path": path},
            metadata={
                "path": path,
                "underlying_storage": underlying_storage,
            },
        )

    def get_priority(self) -> int:
        """Medium priority - storage is common but less than Delta"""
        return 75
