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
Entity Fetcher Strategy
"""

import traceback
from abc import ABC, abstractmethod
from typing import Iterable, Iterator, Optional, cast

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.settings.settings import Settings
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.status import Status
from metadata.ingestion.models.entity_interface import EntityInterfaceWithTags
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.source.fetcher.config import EntityFilterConfigInterface
from metadata.profiler.source.fetcher.profiler_source_factory import (
    profiler_source_factory,
)
from metadata.profiler.source.model import ProfilerSourceAndEntity
from metadata.utils.db_utils import Table
from metadata.utils.filters import (
    filter_by_classification,
    filter_by_database,
    filter_by_schema,
    filter_by_table,
)

FIELDS = ["tableProfilerConfig", "columns", "customMetrics", "tags"]


class FetcherStrategy(ABC):
    """Fetcher strategy interface"""

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
        global_profiler_config: Optional[Settings],
        status: Status,
    ) -> None:
        self.config = config
        self.source_config = config.source.sourceConfig.config
        self.metadata = metadata
        self.global_profiler_config = global_profiler_config
        self.status = status

    def filter_classifications(self, entity: EntityInterfaceWithTags) -> bool:
        """Given a list of entities, filter out entities that do not match the classification filter pattern

        Args:
            entities (List[EntityInterfaceWithTags]): List of entities to filter implemnenting the `tags` attribute

        Raises:
            NotImplementedError: Must be implemented by subclass
        """
        classification_filter_pattern = getattr(
            self.source_config, "classificationFilterPattern", None
        )
        if not classification_filter_pattern:
            return False

        use_fqn_for_filtering = getattr(self.source_config, "useFqnForFiltering", False)

        if not entity.tags:
            # if we are not explicitly including entities with tags we'll add the ones without tags
            if not classification_filter_pattern.includes:
                return False
            return True

        for tag in entity.tags:
            tag_name = tag.tagFQN.root if use_fqn_for_filtering else tag.name
            if not tag_name:
                continue
            if filter_by_classification(classification_filter_pattern, tag_name):
                self.status.filter(
                    tag_name,
                    f"Classification pattern not allowed for entity {entity.fullyQualifiedName.root}",
                )  # type: ignore
                return True

        return False

    @abstractmethod
    def fetch(self) -> Iterator[Either[ProfilerSourceAndEntity]]:
        """Fetch entity"""
        raise NotImplementedError


class DatabaseFetcherStrategy(FetcherStrategy):
    """Database fetcher strategy"""

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
        global_profiler_config: Optional[Settings],
        status: Status,
    ) -> None:
        super().__init__(config, metadata, global_profiler_config, status)
        self.source_config = cast(
            EntityFilterConfigInterface, self.source_config
        )  # Satisfy typechecker

    def _filter_databases(self, databases: Iterable[Database]) -> Iterable[Database]:
        """Filter databases based on the filter pattern

        Args:
            databases (Database): Database to filter

        Returns:
            bool
        """
        filtered_databases = []

        for database in databases:
            database_name = database.name.root
            if database.fullyQualifiedName and self.source_config.useFqnForFiltering:
                database_name = database.fullyQualifiedName.root
            if filter_by_database(
                self.source_config.databaseFilterPattern, database_name
            ):
                self.status.filter(
                    database_name,
                    f"Database pattern not allowed for database {database_name}",
                )
                continue
            filtered_databases.append(database)

        return filtered_databases

    def _filter_schemas(self, table: Table) -> bool:
        """Filter tables based on the schema filter pattern

        Args:
            tables (List[Table]): Tables to filter

        Returns:
            List[Table]
        """

        if not table.databaseSchema:
            return False
        schema_name = (
            table.databaseSchema.fullyQualifiedName
            if self.source_config.useFqnForFiltering
            else table.databaseSchema.name
        )
        if schema_name and filter_by_schema(
            self.source_config.schemaFilterPattern, schema_name
        ):
            self.status.filter(
                schema_name, f"Schema pattern not allowed for schema {schema_name}"
            )
            return True

        return False

    def _filter_tables(self, table: Table) -> bool:
        """Filter tables based on the table filter pattern

        Args:
            tables (Iterable[Table]):

        Returns:
            Iterable[Table]:
        """
        table_name = table.name.root
        if table.fullyQualifiedName and self.source_config.useFqnForFiltering:
            table_name = table.fullyQualifiedName.root

        if filter_by_table(self.source_config.tableFilterPattern, table_name):
            self.status.filter(
                table_name, f"Table pattern not allowed for table {table_name}"
            )
            return True

        return False

    def _filter_views(self, table: Table) -> bool:
        """Filter the tables based on include views configuration"""
        # If we include views, nothing to filter
        if self.source_config.includeViews:
            return False

        # Otherwise, filter out views
        if table.tableType == TableType.View:
            self.status.filter(
                table.name.root, f"We are not including views {table.name.root}"
            )
            return True

        return False

    def _filter_column_metrics_computation(self):
        """Filter"""

    def _get_database_entities(self) -> Iterable[Database]:
        """Get database entities"""
        if not self.config.source.serviceName:
            raise ValueError("serviceName must be provided in the source configuration")

        databases = self.metadata.list_all_entities(
            entity=Database,
            params={"service": self.config.source.serviceName},
        )
        if not databases:
            raise ValueError(
                f"No databases found for service {self.config.source.serviceName}"
            )
        databases = cast(Iterable[Database], databases)

        if self.source_config.databaseFilterPattern:
            databases = self._filter_databases(databases)

        if not databases:
            raise ValueError(
                "databaseFilterPattern returned 0 result. At least 1 database must be returned by the filter pattern."
                f"\n\t- includes: {self.source_config.databaseFilterPattern.includes if self.source_config.databaseFilterPattern else None}"  # pylint: disable=line-too-long
                f"\n\t- excludes: {self.source_config.databaseFilterPattern.excludes if self.source_config.databaseFilterPattern else None}"  # pylint: disable=line-too-long
            )

        return cast(Iterable[Database], databases)

    def _filter_entities(self, tables: Iterable[Table]) -> Iterable[Table]:
        """Filter entities based on the filter pattern

        Args:
            entities (Iterable[EntityInterfaceWithTags]): Entities to filter

        Returns:
            Iterable[EntityInterfaceWithTags]
        """
        tables = [
            table
            for table in tables
            if (
                not self.source_config.schemaFilterPattern
                or not self._filter_schemas(table)
            )
            and (
                not self.source_config.tableFilterPattern
                or not self._filter_tables(table)
            )
            and (
                not self.source_config.classificationFilterPattern
                or not self.filter_classifications(table)
            )
            and not self._filter_views(table)
        ]

        return tables

    def _get_table_entities(self, database: Database) -> Iterable[Table]:
        """Given a database, get all table entities

        Args:
            database (Database): Database to get tables from

        Returns:
            Iterable[Table]
        """
        tables = self.metadata.list_all_entities(
            entity=Table,
            fields=FIELDS,
            params={
                "service": self.config.source.serviceName,
                "database": database.fullyQualifiedName.root,  # type: ignore
            },  # type: ignore
        )
        tables = cast(Iterable[Table], tables)
        tables = self._filter_entities(tables)

        return cast(Iterable[Table], tables)

    def fetch(self) -> Iterator[Either[ProfilerSourceAndEntity]]:
        """Fetch database entity"""
        for database in self._get_database_entities():
            try:
                profiler_source = profiler_source_factory.create(
                    self.config.source.type.lower(),
                    self.config,
                    database,
                    self.metadata,
                    self.global_profiler_config,
                )

                for table in self._get_table_entities(database):
                    yield Either(
                        left=None,
                        right=ProfilerSourceAndEntity(
                            profiler_source=profiler_source,
                            entity=table,
                        ),
                    )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=database.fullyQualifiedName.root,  # type: ignore
                        error=f"Error listing source and entities for database due to [{exc}]",
                        stackTrace=traceback.format_exc(),
                    ),
                    right=None,
                )
