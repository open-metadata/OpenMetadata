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
Wires :class:`UnitycatalogMetricViewLineage` into the Unity Catalog lineage source,
which holds a SQL warehouse engine and runs once the whole service is ingested, so the
only thing it needs is the hook.
"""

import traceback
from collections.abc import Iterable

from sqlalchemy import text
from sqlalchemy.engine import Engine

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.unitycatalog.metric_view_lineage import (
    UnitycatalogMetricViewLineage,
)
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class UnitycatalogMetricViewLineageMixin:
    """``source relation -> metric view`` lineage for the Unity Catalog lineage source.

    The attributes below are the host source's; they are declared, not assigned, so the
    mixin stays a mixin and the contract it needs from its host is explicit.
    """

    config: WorkflowSource
    source_config: DatabaseServiceQueryLineagePipeline
    metadata: OpenMetadata
    status: Status
    engine: Engine

    def yield_metric_view_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """Run the metric-view extraction, gated on the same ``processViewLineage``
        flag as every other view-derived edge -- a metric view is a view."""
        if not self.source_config.processViewLineage:
            return
        service_name = model_str(self.config.serviceName)
        logger.info("Processing Unity Catalog Metric View Lineage")
        extractor = UnitycatalogMetricViewLineage(
            service_name=service_name,
            run_query=self._run_metric_view_query,
            resolve_table_by_fqn=self._resolve_metric_view_table,
            databases=self._metric_view_databases(service_name),
            source_config=self.source_config,
            status=self.status,
        )
        yield from extractor.iter_lineage()

    def _metric_view_databases(self, service_name: str) -> list[str]:
        """The catalogs in scope, taken from what the metadata workflow ingested.

        Listing from OpenMetadata rather than from ``SHOW CATALOGS`` keeps the pass to
        catalogs that actually have entities to attach lineage to, and applies the
        run's own database filter on top.
        """
        databases = []
        for database in self.metadata.list_all_entities(entity=Database, params={"service": service_name}):
            name = model_str(database.name)
            if filter_by_database(self.source_config.databaseFilterPattern, name):
                self.status.filter(model_str(database.fullyQualifiedName), "Catalog Filtered Out")
                continue
            databases.append(name)
        return databases

    def _run_metric_view_query(self, query: str) -> list[tuple]:
        with self.engine.connect() as connection:
            return [tuple(row) for row in connection.execute(text(query))]

    def _resolve_metric_view_table(self, table_fqn: str) -> Table | None:
        try:
            return self.metadata.get_by_name(entity=Table, fqn=table_fqn)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.debug("Failed to resolve Table [%s]: %s", table_fqn, exc)
            return None
