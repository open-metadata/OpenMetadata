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
External Location Manager for Unity Catalog

Manages external location discovery and lineage from multiple sources:
- system.access.table_lineage (usage-based lineage)
- DESCRIBE TABLE EXTENDED (table metadata)
- information_schema.external_locations (metadata enrichment)
"""

import traceback
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Dict, Iterable, Optional, Tuple

from sqlalchemy.exc import OperationalError

from metadata.ingestion.source.database.databricks.queries import (
    DATABRICKS_GET_EXTERNAL_LOCATION_LINEAGE,
    DATABRICKS_GET_EXTERNAL_LOCATIONS,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class LineageSource(Enum):
    """Source of external location lineage"""

    SYSTEM_TABLE = "system.access.table_lineage"
    TABLE_METADATA = "DESCRIBE TABLE EXTENDED"


@dataclass(frozen=True)
class ExternalLocationMetadata:
    """Immutable external location metadata from Unity Catalog"""

    name: str
    url: str
    credential_name: str
    owner: str
    comment: Optional[str] = None


@dataclass(frozen=True)
class ExternalTableLocation:
    """Represents external location for a table"""

    catalog: str
    schema: str
    table: str
    storage_path: str
    source: LineageSource
    last_updated: Optional[datetime] = None

    @property
    def qualified_name(self) -> Tuple[str, str, str]:
        """Return tuple of (catalog, schema, table)"""
        return (self.catalog, self.schema, self.table)


@dataclass
class ExternalLocationConfig:
    """Configuration for external location features"""

    enable_system_table_lineage: bool = True
    enable_metadata_enrichment: bool = True
    lineage_lookback_days: int = 90
    internal_storage_prefixes: Tuple[str, ...] = (
        "dbfs:",
        "dbfs/",
        "file:",
        "/dbfs/",
    )


class ExternalLocationIngestionError(Exception):
    """Raised when external location ingestion fails critically"""

    pass


class ExternalLocationManager:
    """
    Manages external location discovery and lineage from multiple sources.

    Responsibilities:
    - Fetch external locations from system tables
    - Fetch external locations from table metadata
    - Fetch external location metadata
    - Merge and deduplicate from multiple sources
    - Normalize storage paths
    """

    def __init__(self, connection, config: ExternalLocationConfig, catalog_name: str):
        self.connection = connection
        self.config = config
        self.catalog_name = catalog_name
        self._locations: Dict[Tuple[str, str, str], ExternalTableLocation] = {}
        self._metadata: Dict[str, ExternalLocationMetadata] = {}

    def populate_from_system_tables(self) -> int:
        """
        Fetch external locations from system.access.table_lineage

        Returns:
            Number of locations populated
        """
        if not self.config.enable_system_table_lineage:
            logger.info("System table lineage disabled via configuration")
            return 0

        try:
            query = DATABRICKS_GET_EXTERNAL_LOCATION_LINEAGE.format(
                catalog=self.catalog_name, days=self.config.lineage_lookback_days
            )
            logger.info(
                f"Fetching external location lineage from system tables for catalog: {self.catalog_name}"
            )

            results = self.connection.execute(query)
            count = 0

            for row in results:
                source_path = row.source_path
                target_catalog = row.target_table_catalog
                target_schema = row.target_table_schema
                target_table = row.target_table_name

                if not source_path or self._is_internal_storage(source_path):
                    continue

                location = ExternalTableLocation(
                    catalog=target_catalog,
                    schema=target_schema,
                    table=target_table,
                    storage_path=self._normalize_path(source_path),
                    source=LineageSource.SYSTEM_TABLE,
                )
                self._add_location(location)
                count += 1

                logger.debug(
                    f"Captured external lineage: {location.storage_path} -> "
                    f"{location.catalog}.{location.schema}.{location.table}"
                )

            logger.info(
                f"Populated {count} external locations from system tables "
                f"(catalog: {self.catalog_name})"
            )
            return count

        except OperationalError as e:
            logger.warning(
                f"System tables not accessible for catalog {self.catalog_name}: {e}"
            )
            return 0
        except Exception as e:
            logger.error(
                f"Unexpected error querying system tables for catalog {self.catalog_name}: {e}"
            )
            logger.debug(traceback.format_exc())
            return 0

    def populate_metadata(self) -> int:
        """
        Fetch external location metadata from information_schema.external_locations

        Returns:
            Number of metadata entries populated
        """
        if not self.config.enable_metadata_enrichment:
            logger.info("Metadata enrichment disabled via configuration")
            return 0

        try:
            query = DATABRICKS_GET_EXTERNAL_LOCATIONS
            logger.info("Fetching external locations metadata")

            results = self.connection.execute(query)
            count = 0

            for row in results:
                metadata = ExternalLocationMetadata(
                    name=row.external_location_name,
                    url=row.url,
                    credential_name=row.storage_credential_name,
                    owner=row.external_location_owner,
                    comment=row.comment,
                )
                normalized_url = self._normalize_path(metadata.url)
                if normalized_url:
                    self._metadata[normalized_url] = metadata
                    count += 1

                    logger.debug(
                        f"Captured external location metadata: {metadata.name} -> {metadata.url}"
                    )

            logger.info(f"Populated {count} external location metadata entries")
            return count

        except OperationalError as e:
            logger.warning(f"information_schema.external_locations not accessible: {e}")
            return 0
        except Exception as e:
            logger.error(f"Unexpected error fetching external locations metadata: {e}")
            logger.debug(traceback.format_exc())
            return 0

    def add_location_from_describe(
        self, catalog: str, schema: str, table: str, path: str
    ) -> None:
        """
        Add external location discovered via DESCRIBE TABLE EXTENDED

        Args:
            catalog: Catalog name
            schema: Schema name
            table: Table name
            path: Storage path from DESCRIBE TABLE
        """
        if not path or self._is_internal_storage(path):
            return

        normalized_path = self._normalize_path(path)
        if not normalized_path:
            return

        location = ExternalTableLocation(
            catalog=catalog,
            schema=schema,
            table=table,
            storage_path=normalized_path,
            source=LineageSource.TABLE_METADATA,
        )
        self._add_location(location)

        logger.info(
            f"Captured external location from DESCRIBE TABLE: {normalized_path} -> "
            f"{catalog}.{schema}.{table}"
        )

    def _add_location(self, location: ExternalTableLocation) -> None:
        """
        Add location, prioritizing system table lineage over table metadata

        Args:
            location: External table location to add
        """
        existing = self._locations.get(location.qualified_name)

        # System table lineage takes precedence over DESCRIBE TABLE
        if existing and existing.source == LineageSource.SYSTEM_TABLE:
            if location.source == LineageSource.TABLE_METADATA:
                logger.debug(
                    f"Skipping DESCRIBE TABLE location for {location.qualified_name}, "
                    f"already have system table lineage"
                )
                return

        self._locations[location.qualified_name] = location

    def get_metadata_for_path(self, path: str) -> Optional[ExternalLocationMetadata]:
        """
        Get external location metadata for a storage path

        Args:
            path: Storage path

        Returns:
            External location metadata if found
        """
        return self._metadata.get(path)

    def iter_locations(self) -> Iterable[ExternalTableLocation]:
        """Iterate all discovered external table locations"""
        return iter(self._locations.values())

    @property
    def location_count(self) -> int:
        """Total number of external table locations discovered"""
        return len(self._locations)

    @property
    def metadata_count(self) -> int:
        """Total number of external location metadata entries"""
        return len(self._metadata)

    def _normalize_path(self, path: str) -> Optional[str]:
        """
        Normalize storage path for consistent matching

        Args:
            path: Raw storage path

        Returns:
            Normalized path or None
        """
        if not path:
            return None
        return path.rstrip("/")

    def _is_internal_storage(self, path: str) -> bool:
        """
        Check if path is internal storage (DBFS, etc.)

        Args:
            path: Storage path

        Returns:
            True if internal storage
        """
        return any(
            path.startswith(prefix) for prefix in self.config.internal_storage_prefixes
        )
