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
The ``yield_table_metrics`` implementation for the Unity Catalog metadata source.

How a view's stored text is read is left to the host source, which is the one part
that touches Unity Catalog; everything downstream of the YAML lives here.

Metrics only. The relations a metric view is computed over become lineage in the
lineage workflow (:mod:`...unitycatalog.metric_view_lineage`), which runs once the whole
service is ingested and can therefore resolve source tables this pass has not reached
yet.
"""

import traceback
from abc import abstractmethod
from collections.abc import Iterable

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.source.database.unitycatalog.metric_views import (
    build_metric_request,
    parse_metric_view,
)
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class UnitycatalogMetricViewMixin:
    """Turns each metric view met by the table topology node into ``Metric`` entities."""

    @abstractmethod
    def get_metric_view_text(self, table_name: str) -> str | None:
        """The view's stored text, which for a metric view is its YAML body."""

    @abstractmethod
    def get_metric_view_column_types(self, table_name: str) -> dict[str, str]:
        """``{column name: resolved Spark type}`` for the metric view's own columns,
        used to tell a TIME dimension from a CATEGORICAL one. Empty when unavailable —
        the dimension then carries no type rather than a guessed one."""

    @property
    def include_metric_views(self) -> bool:
        """The ``includeMetricViews`` connection opt-out.

        On the connection rather than the metadata pipeline because the lineage
        workflow has to read the same switch, and it never sees that pipeline's config.
        """
        return bool(self.service_connection.includeMetricViews)  # pyright: ignore[reportAttributeAccessIssue]

    def yield_table_metrics(
        self,
        table_name_and_type: tuple[str, TableType],
    ) -> Iterable[Either[CreateMetricRequest]]:
        """Yield one Metric per measure of a metric view.

        Not gated on ``TableType``: Unity Catalog reports a metric view's type
        differently across runtimes and APIs — the SDK's ``TableInfo.table_type`` is
        ``None`` for one — and the YAML body is the one signal every path agrees on.
        """
        if not self.include_metric_views:
            return
        view, _ = table_name_and_type
        database = self.context.get().database  # pyright: ignore[reportAttributeAccessIssue]
        schema = self.context.get().database_schema  # pyright: ignore[reportAttributeAccessIssue]
        try:
            definition = parse_metric_view(self.get_metric_view_text(view))
        except Exception as exc:  # pylint: disable=broad-except
            self._warn_metric_view(schema, view, f"could not read the view definition: {exc}")
            return
        if definition is None:
            return

        service = self.context.get().database_service  # pyright: ignore[reportAttributeAccessIssue]
        logger.info(
            "Metric view [%s.%s.%s]: emitting %d metric(s) with %d dimension(s)",
            database,
            schema,
            view,
            len(definition.measures),
            len(definition.all_dimensions),
        )
        # The view's own CreateTableRequest is still in the sink's bulk buffer (Metric
        # requests are written immediately, Table requests batch), so without a flush
        # the lookup below 404s on every first run and the metrics lose their assets[]
        # back-reference. Gated on the view being a metric view: the stage runs for
        # every table, and flushing per table would negate the bulk sink entirely.
        yield Either(right=Barrier(reason=f"unitycatalog_metric_view:{schema}.{view}"))  # pyright: ignore[reportCallIssue]

        view_entity = self._get_metric_view_table(service, database, schema, view)
        view_ref = None
        if view_entity is None:
            self._warn_metric_view(schema, view, "the metric view's own Table entity could not be resolved")
        else:
            view_ref = EntityReference(id=view_entity.id, type="table")  # pyright: ignore[reportCallIssue]

        column_types = self._safe_column_types(view)
        for measure in definition.measures:
            try:
                request = build_metric_request(
                    service, database, schema, view, definition, measure, column_types, view_ref
                )
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                self._warn_metric_view(schema, view, f"measure [{measure.name}] could not be mapped: {exc}")
                continue
            if request is not None:
                yield Either(right=request)  # pyright: ignore[reportCallIssue]

    def _safe_column_types(self, view: str) -> dict[str, str]:
        try:
            return self.get_metric_view_column_types(view) or {}
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug("Could not read metric view [%s] column types: %s", view, exc)
            return {}

    def _warn_metric_view(self, schema: str, view: str, reason: str) -> None:
        """Report a metric-view problem as a run warning.

        A warning, never a failure: a metric view whose metadata is inaccessible must
        not fail the table it rides on, nor the rest of the schema.
        """
        message = f"Metric view [{schema}.{view}]: {reason}"
        logger.warning(message)
        self.status.warning(f"{schema}.{view}", message)  # pyright: ignore[reportAttributeAccessIssue]

    def _get_metric_view_table(self, service: str, database: str, schema: str, view: str) -> Table | None:
        return self.metadata.get_by_name(  # pyright: ignore[reportAttributeAccessIssue]
            entity=Table, fqn=fqn._build(service, database, schema, view)
        )
