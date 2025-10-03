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
Doris lineage module
"""
import re
import traceback
from queue import Queue
from typing import Iterable, List, Optional, Union

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
    DorisConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.db_utils import get_view_lineage
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DorisLineageSource(LineageSource):
    """
    Doris lineage source that only processes view lineage using SHOW CREATE TABLE
    """

    dialect = Dialect.MYSQL  # Doris uses MySQL-compatible syntax

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DorisConnection = config.serviceConnection.root.config
        if not isinstance(connection, DorisConnection):
            raise InvalidSourceException(
                f"Expected DorisConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _preprocess_doris_sql(self, sql: str) -> str:
        """
        Preprocess Doris SQL and convert the default_cluster: syntax to standard format
        For example: default_cluster: dtdt. table_2->dtdt. table_2
        """
        if not sql:
            return sql

        # `default_cluster:database.table`
        pattern1 = r'`default_cluster:([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*)`'
        processed_sql = re.sub(pattern1, r'`\1`', sql)

        # `default_cluster:database`.`table`
        pattern2 = r'`default_cluster:([a-zA-Z_][a-zA-Z0-9_]*)`\.`([a-zA-Z_][a-zA-Z0-9_]*)`'
        processed_sql = re.sub(pattern2, r'`\1`.`\2`', processed_sql)

        # default_cluster:database.table
        pattern3 = r'default_cluster:([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*)'
        processed_sql = re.sub(pattern3, r'\1', processed_sql)

        if processed_sql != sql:
            logger.debug(f"before SQL: {sql}")
            logger.debug(f"after SQL: {processed_sql}")

        return processed_sql

    def doris_view_lineage_processor(
        self,
        views: List[TableView],
        queue: Queue,
        metadata: OpenMetadata,
        service_name: str,
        connectionType: str,
        processCrossDatabaseLineage: bool,
        crossDatabaseServiceNames: List[str],
        parsingTimeoutLimit: int,
        overrideViewLineage: bool,
    ) -> Iterable[Either[OMetaLineageRequest]]:

        try:
            for view in views:
                # remove 'default_cluster:' prefix from view definition
                if view.view_definition:
                    original_definition = view.view_definition
                    processed_definition = self._preprocess_doris_sql(original_definition)

                    processed_view = TableView(
                        table_name=view.table_name,
                        schema_name=view.schema_name,
                        db_name=view.db_name,
                        view_definition=processed_definition
                    )
                else:
                    processed_view = view

                if (
                    self._filter_by_database(processed_view.db_name)
                    or self._filter_by_schema(processed_view.schema_name)
                    or self._filter_by_table(processed_view.table_name)
                ):
                    self.status.filter(
                        processed_view.table_name,
                        "View Filtered Out",
                    )
                    continue

                service_names = [service_name]
                if processCrossDatabaseLineage and crossDatabaseServiceNames:
                    service_names.extend(crossDatabaseServiceNames)

                # get lineage rels
                for lineage in get_view_lineage(
                    view=processed_view,
                    metadata=metadata,
                    service_names=service_names,
                    connection_type=connectionType,
                    timeout_seconds=parsingTimeoutLimit,
                ):
                    if lineage.right is not None:
                        view_fqn = fqn.build(
                            metadata=metadata,
                            entity_type=Table,
                            service_name=service_name,
                            database_name=processed_view.db_name,
                            schema_name=processed_view.schema_name,
                            table_name=processed_view.table_name,
                            skip_es_search=True,
                        )

                        result = Either(
                            right=OMetaLineageRequest(
                                lineage_request=lineage.right,
                                override_lineage=overrideViewLineage,
                                entity_fqn=view_fqn,
                                entity=Table,
                            )
                        )

                        queue.put(result)
                        self.status.scanned(processed_view.table_name)
                    else:
                        self.status.warning(
                            processed_view.table_name,
                            f"Could not build lineage for {processed_view.table_name}",
                        )
        except Exception as exc:
            logger.error(f"Error processing Doris view lineage: {exc}")
            logger.debug(traceback.format_exc())

    def yield_view_lineage(self) -> Iterable[Either[OMetaLineageRequest]]:

        logger.info("Processing Doris View Lineage with multi-threading support")


        producer_fn = self.view_lineage_producer
        processor_fn = self.doris_view_lineage_processor

        args = (
            self.metadata,
            self.config.serviceName,
            self.service_connection.type.value,
            self.source_config.processCrossDatabaseLineage,
            self.source_config.crossDatabaseServiceNames,
            self.source_config.parsingTimeoutLimit,
            self.source_config.overrideViewLineage,
        )

        yield from self.generate_lineage_with_processes(
            producer_fn,
            processor_fn,
            args,
            max_threads=self.source_config.threads,
        )

    def _filter_by_database(self, db_name: str) -> bool:
        from metadata.utils.filters import filter_by_database
        return filter_by_database(
            self.source_config.databaseFilterPattern,
            db_name,
        )

    def _filter_by_schema(self, schema_name: str) -> bool:
        """检查 schema 过滤"""
        from metadata.utils.filters import filter_by_schema
        return filter_by_schema(
            self.source_config.schemaFilterPattern,
            schema_name,
        )

    def _filter_by_table(self, table_name: str) -> bool:
        from metadata.utils.filters import filter_by_table
        return filter_by_table(
            self.source_config.tableFilterPattern,
            table_name,
        )

    def _iter(
        self, *_, **__
    ) -> Iterable[Either[OMetaLineageRequest]]:
        """
        Only process view lineage, skip query logs and stored procedures
        """
        logger.info("Processing Doris View Lineage")

        # Only process view lineage
        if self.source_config.processViewLineage:
            yield from self.yield_view_lineage() or []

        # Skip other lineage types
        logger.info("Skipping query lineage and stored procedure lineage for Doris")
