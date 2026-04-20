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
from typing import Dict, Iterable, Iterator, List, Optional, cast

from pydantic import BaseModel

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.settings.settings import Settings
from metadata.generated.schema.type.filterPattern import FilterPattern
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
    filter_by_schema,
    filter_by_table,
    validate_regex,
)

FIELDS = ["tableProfilerConfig", "columns", "customMetrics", "tags"]


class RegexFilter(BaseModel):
    regex: str
    mode: str


def _combine_patterns(patterns: List[str]) -> str:
    if len(patterns) == 1:
        return patterns[0]
    return "|".join(f"({p})" for p in patterns)


def _build_regex_from_filter(
    filter_pattern: Optional[FilterPattern],
) -> Optional[RegexFilter]:
    """Build a RegexFilter from a FilterPattern for server-side filtering.

    When both includes and excludes are set, includes take precedence.
    Validates that all regex patterns compile before sending them to the server.
    """
    if not filter_pattern:
        return None
    validate_regex(filter_pattern.includes)
    validate_regex(filter_pattern.excludes)
    if filter_pattern.includes:
        return RegexFilter(
            regex=_combine_patterns(filter_pattern.includes), mode="include"
        )
    if filter_pattern.excludes:
        return RegexFilter(
            regex=_combine_patterns(filter_pattern.excludes), mode="exclude"
        )
    return None


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
        self.database_filter_pattern = _build_regex_from_filter(
            self.source_config.databaseFilterPattern
        )
        self.schema_filter_pattern = _build_regex_from_filter(
            self.source_config.schemaFilterPattern
        )
        self.table_filter_pattern = _build_regex_from_filter(
            self.source_config.tableFilterPattern
        )
        self.source_config = cast(
            EntityFilterConfigInterface, self.source_config
        )  # Satisfy typechecker

    def _build_database_params(self) -> Dict[str, str]:
        params: Dict[str, str] = {"service": self.config.source.serviceName}  # type: ignore
        db_filter = self.database_filter_pattern
        if db_filter:
            params["databaseRegex"] = db_filter.regex
            params["regexMode"] = db_filter.mode
            if self.source_config.useFqnForFiltering:
                params["regexFilterByFqn"] = "true"
        return params

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

    def _get_database_entities(self) -> Iterable[Database]:
        """Get database entities"""
        if not self.config.source.serviceName:
            raise ValueError("serviceName must be provided in the source configuration")

        params = self._build_database_params()
        databases = self.metadata.list_all_entities(
            entity=Database,
            params=params,
        )

        count = 0
        for database in databases:
            count += 1
            yield database

        if count == 0:
            raise ValueError(
                "databaseFilterPattern returned 0 result. At least 1 database must be returned by the filter pattern."
                f"\n\t- includes: {self.source_config.databaseFilterPattern.includes if self.source_config.databaseFilterPattern else None}"  # pylint: disable=line-too-long
                f"\n\t- excludes: {self.source_config.databaseFilterPattern.excludes if self.source_config.databaseFilterPattern else None}"  # pylint: disable=line-too-long
            )

    def _build_table_params(self, database: Database) -> Dict[str, str]:
        params: Dict[str, str] = {
            "service": self.config.source.serviceName,  # type: ignore
            "database": database.fullyQualifiedName.root,  # type: ignore
        }

        schema_filter = self.schema_filter_pattern
        table_filter = self.table_filter_pattern

        conflicting_modes = (
            schema_filter is not None
            and table_filter is not None
            and schema_filter.mode != table_filter.mode
        )

        regex_mode: Optional[str] = None
        if schema_filter and (not conflicting_modes or schema_filter.mode == "include"):
            params["databaseSchemaRegex"] = schema_filter.regex
            regex_mode = schema_filter.mode

        if table_filter and (not conflicting_modes or table_filter.mode == "include"):
            params["tableRegex"] = table_filter.regex
            regex_mode = table_filter.mode

        if regex_mode:
            params["regexMode"] = regex_mode
            if self.source_config.useFqnForFiltering:
                params["regexFilterByFqn"] = "true"

        return params

    def _has_conflicting_filter_modes(self) -> bool:
        schema_filter = self.schema_filter_pattern
        table_filter = self.table_filter_pattern
        return (
            schema_filter is not None
            and table_filter is not None
            and schema_filter.mode != table_filter.mode
        )

    def _filter_deferred_excludes(self, table: Table) -> bool:
        """Apply exclude filters that were deferred to client-side
        because schema and table filters use conflicting modes."""
        schema_filter = self.schema_filter_pattern
        table_filter = self.table_filter_pattern

        if schema_filter and schema_filter.mode == "exclude" and table.databaseSchema:
            exclude_only = FilterPattern(
                excludes=self.source_config.schemaFilterPattern.excludes
            )
            schema_name = (
                table.databaseSchema.fullyQualifiedName
                if self.source_config.useFqnForFiltering
                else table.databaseSchema.name
            )
            if schema_name and filter_by_schema(exclude_only, schema_name):
                self.status.filter(
                    schema_name,
                    f"Schema pattern not allowed for schema {schema_name}",
                )
                return True

        if table_filter and table_filter.mode == "exclude":
            exclude_only = FilterPattern(
                excludes=self.source_config.tableFilterPattern.excludes
            )
            table_name = table.name.root
            if table.fullyQualifiedName and self.source_config.useFqnForFiltering:
                table_name = table.fullyQualifiedName.root
            if filter_by_table(exclude_only, table_name):
                self.status.filter(
                    table_name,
                    f"Table pattern not allowed for table {table_name}",
                )
                return True

        return False

    def _get_table_entities(self, database: Database) -> Iterable[Table]:
        """Given a database, get all table entities"""
        params = self._build_table_params(database)
        tables = self.metadata.list_all_entities(
            entity=Table,
            fields=FIELDS,
            params=params,
        )

        has_deferred = self._has_conflicting_filter_modes()

        for table in tables:
            if has_deferred and self._filter_deferred_excludes(table):
                continue
            if (
                self.source_config.classificationFilterPattern
                and self.filter_classifications(table)
            ):
                continue
            if self._filter_views(table):
                continue
            yield table

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
