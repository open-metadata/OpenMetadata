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
BurstIQ Lineage Source Module

Simple lineage extraction from /api/metadata/edge endpoint.
Each edge contains:
- fromDictionary -> toDictionary (table lineage)
- condition: [{fromCol, toCol}] (column lineage)
"""
import traceback
from typing import Iterable, Optional

from pydantic import ValidationError

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.burstIQConnection import (
    BurstIQConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.burstiq.client import BurstIQClient
from metadata.ingestion.source.database.burstiq.models import BurstIQEdge
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class BurstiqLineageSource(Source):
    """
    BurstIQ Lineage Source

    Fetches edges from /api/metadata/edge and creates lineage with column mappings.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.client: Optional[BurstIQClient] = None
        self.test_connection()

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: BurstIQConnection = config.serviceConnection.root.config
        if not isinstance(connection, BurstIQConnection):
            raise InvalidSourceException(
                f"Expected BurstIQConnection, but got {connection}"
            )
        return cls(config, metadata)

    def test_connection(self):
        """Test the connection to the BurstIQ server"""
        return

    def _get_client(self) -> BurstIQClient:
        """Lazy-load BurstIQ client"""
        if not self.client:
            self.client = BurstIQClient(self.service_connection)
        return self.client

    def prepare(self):
        """Nothing to prepare"""
        pass

    def close(self):
        """Close the BurstIQ client"""
        if self.client:
            self.client.close()

    def _get_table_entity(self, dictionary_name: str) -> Optional[Table]:
        """
        Get table entity from OpenMetadata

        Args:
            dictionary_name: BurstIQ dictionary name

        Returns:
            Table entity or None
        """
        try:
            table_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                service_name=self.config.serviceName,
                database_name="default",
                schema_name="default",
                table_name=dictionary_name,
            )
            return self.metadata.get_by_name(entity=Table, fqn=table_fqn)
        except Exception as exc:
            logger.debug(f"Table not found for dictionary {dictionary_name}: {exc}")
            return None

    def _process_edge(self, edge_data: dict) -> Optional[Either[AddLineageRequest]]:
        """
        Process a single edge and create lineage request

        Args:
            edge_data: Edge data from API: {fromDictionary, toDictionary, condition: [{fromCol, toCol}]}

        Returns:
            Either[AddLineageRequest] or None
        """
        try:
            # Parse edge
            edge = BurstIQEdge.model_validate(edge_data)

            # Get source and target tables
            from_table = self._get_table_entity(edge.fromDictionary)
            to_table = self._get_table_entity(edge.toDictionary)

            if not from_table or not to_table:
                logger.debug(
                    f"Skipping edge {edge.name}: tables not found "
                    f"({edge.fromDictionary} -> {edge.toDictionary})"
                )
                return None

            # Build column lineage from condition
            column_lineage = []
            if edge.condition:
                for col_map in edge.condition:
                    from_col_fqn = get_column_fqn(from_table, col_map.fromCol)
                    to_col_fqn = get_column_fqn(to_table, col_map.toCol)

                    if from_col_fqn and to_col_fqn:
                        column_lineage.append(
                            ColumnLineage(
                                fromColumns=[from_col_fqn], toColumn=to_col_fqn
                            )
                        )

            # Create lineage details
            lineage_details = None
            if column_lineage:
                lineage_details = LineageDetails(
                    columnsLineage=column_lineage,
                    source=LineageSource.QueryLineage,
                )

            # Create lineage edge
            entities_edge = EntitiesEdge(
                fromEntity=EntityReference(id=from_table.id.root, type="table"),
                toEntity=EntityReference(id=to_table.id.root, type="table"),
                lineageDetails=lineage_details,
            )

            logger.info(
                f"Created lineage: {edge.fromDictionary} -> {edge.toDictionary} "
                f"({len(column_lineage)} columns)"
            )

            return Either(right=AddLineageRequest(edge=entities_edge))

        except ValidationError as exc:
            return Either(
                left=StackTraceError(
                    name=f"Validation error for edge",
                    error=str(exc),
                    stackTrace=traceback.format_exc(),
                )
            )
        except Exception as exc:
            return Either(
                left=StackTraceError(
                    name=f"Error processing edge",
                    error=str(exc),
                    stackTrace=traceback.format_exc(),
                )
            )

    def _iter(self) -> Iterable[Either[AddLineageRequest]]:
        """
        Main iteration method - fetch edges and create lineage

        Yields:
            Either[AddLineageRequest]
        """
        try:
            client = self._get_client()

            # Fetch all edges from API
            logger.info("Fetching edges from BurstIQ /api/metadata/edge...")
            edges = client.get_edges()
            logger.info(f"Processing {len(edges)} edges")

            # Process each edge
            for edge_data in edges:
                result = self._process_edge(edge_data)
                if result:
                    yield result

            logger.info("Lineage extraction complete")

        except Exception as exc:
            logger.error(f"Lineage extraction failed: {exc}")
            logger.debug(traceback.format_exc())
            yield Either(
                left=StackTraceError(
                    name="Lineage Extraction Error",
                    error=str(exc),
                    stackTrace=traceback.format_exc(),
                )
            )
