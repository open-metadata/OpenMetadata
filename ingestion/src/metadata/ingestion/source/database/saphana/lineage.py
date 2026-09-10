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
SAP Hana lineage module
"""

import traceback
from collections.abc import Iterable

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import test_connection_common
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.saphana.cdata_parser import (
    ParsedLineage,
    parse_registry,
)
from metadata.ingestion.source.database.saphana.models import SapHanaLineageModel
from metadata.ingestion.source.database.saphana.queries import (
    SAPHANA_LINEAGE,
    SAPHANA_QUERY_HISTORY_STATEMENT,
)
from metadata.ingestion.source.database.saphana.query_parser import (
    SapHanaQueryParserSource,
)
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SaphanaLineageSource(SapHanaQueryParserSource, LineageSource):
    """SAP Hana lineage, from two passes covering disjoint kinds of object.

    The shared LineageSource handles everything expressed in SQL: view definitions
    (with column-level lineage), query history, and stored procedures. This is the
    only pass that produces anything on SAP HANA Cloud.

    The CDATA pass handles the repository model types, which are XML rather than SQL
    and exist only in _SYS_REPO on on-prem and HXE instances:
    - Analytic View and Attribute View based on a Table
    - Calculation View based on an Analytic, Attribute or Calculation View, or a Table

    The two never describe the same object, so every edge has exactly one origin.
    """

    sql_stmt = SAPHANA_QUERY_HISTORY_STATEMENT

    # CREATE TABLE ... AS SELECT is absent by necessity, not oversight: the plan cache
    # holds no DDL, so there is nothing for a pattern to match.
    filters = """
        AND (
            UPPER(STATEMENT_STRING) LIKE 'INSERT INTO%%SELECT%%'
            OR UPPER(STATEMENT_STRING) LIKE 'UPSERT%%SELECT%%'
            OR UPPER(STATEMENT_STRING) LIKE 'REPLACE%%SELECT%%'
            OR UPPER(STATEMENT_STRING) LIKE 'MERGE INTO%%'
            OR UPPER(STATEMENT_STRING) LIKE 'UPDATE%%SET%%'
        )
        """

    def close(self) -> None:
        # The base class leaves engine as None when built with get_engine=False.
        if self.engine is not None:
            self.engine.dispose()

    def _iter(self, *_, **__) -> Iterable[Either[AddLineageRequest]]:
        """Run the SQL-based passes, then the repository pass for calculation views.

        Both passes report their own edge count, because "the run succeeded and
        produced nothing" is the failure mode users actually hit, and it is
        indistinguishable from success unless the counts are stated.
        """
        sql_edges = 0
        for either in super()._iter():
            sql_edges += 1 if either.right else 0
            yield either
        logger.info(
            "SAP HANA SQL lineage produced %d edges from view definitions, query history and stored procedures",
            sql_edges,
        )

        cdata_edges = 0
        for either in self.yield_cdata_lineage():
            cdata_edges += 1 if either.right else 0
            yield either
        logger.info("SAP HANA repository lineage produced %d edges from _SYS_REPO models", cdata_edges)

        if not sql_edges and not cdata_edges:
            logger.warning(
                "SAP HANA lineage finished with no edges. Check that the metadata workflow has already "
                "ingested the tables and views, that processViewLineage or processQueryLineage is enabled, "
                "and that the ingestion user can read SYS.VIEWS and SYS.M_SQL_PLAN_CACHE."
            )

    def yield_cdata_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """Lineage for calculation, analytic and attribute views, from _SYS_REPO.

        On-prem and HXE only. HANA Cloud has no classic repository, so this yields
        nothing there and the SQL passes above carry the whole result.
        """
        with self.engine.connect() as conn:
            try:
                result = conn.execution_options(stream_results=True, max_row_buffer=100).execute(text(SAPHANA_LINEAGE))
            except DBAPIError as exc:
                # SAP HANA Cloud never has _SYS_REPO (classic repository, deprecated since 2018,
                # never carried into Cloud) - only on-prem/HXE instances do. HANA raises 362
                # (invalid schema name) or 259 (invalid table name) for that specific case - only
                # swallow those. Anything else (connection drop, timeout, insufficient privilege)
                # is a real failure and should not be silently reported as "no lineage found".
                error_code = getattr(getattr(exc, "orig", None), "errorcode", None)
                if error_code not in (362, 259):
                    raise
                logger.info(
                    "_SYS_REPO is not present, so there are no repository models to read. This is normal on "
                    "SAP HANA Cloud, where the classic repository was never carried over. View, query and "
                    "stored-procedure lineage are unaffected. Cause: %s",
                    exc,
                )
                result = []
            for row in result:
                try:
                    lineage_model = SapHanaLineageModel.validate(row._asdict())

                    if filter_by_table(
                        self.source_config.tableFilterPattern,  # pyright: ignore[reportAttributeAccessIssue]
                        lineage_model.name,
                    ):
                        self.status.filter(
                            lineage_model.name,
                            "View Object Filtered Out",
                        )
                        continue

                    logger.debug("Processing lineage for view: %s", lineage_model.name)
                    yield from self.parse_cdata(metadata=self.metadata, lineage_model=lineage_model)
                except Exception as exc:
                    self.status.failed(
                        error=StackTraceError(
                            name=row["OBJECT_NAME"],
                            error=f"Error validating lineage model due to [{exc}]",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def parse_cdata(
        self, metadata: OpenMetadata, lineage_model: SapHanaLineageModel
    ) -> Iterable[Either[AddLineageRequest]]:
        """Parse the CDATA XML definition from _SYS_REPO.ACTIVE_OBJECT"""
        parse_fn = parse_registry.registry.get(lineage_model.object_suffix.value)
        try:
            parsed_lineage: ParsedLineage = parse_fn(lineage_model.cdata)
            to_entity: Table = metadata.get_by_name(
                entity=Table,
                fqn=lineage_model.get_fqn(
                    metadata=metadata,
                    service_name=self.config.serviceName,
                ),
            )

            if to_entity:
                yield from parsed_lineage.to_request(
                    metadata=metadata,
                    engine=self.engine,
                    service_name=self.config.serviceName,
                    to_entity=to_entity,
                )
        except Exception as exc:
            error = (
                f"Error parsing CDATA XML for {lineage_model.object_suffix} at "
                + f"{lineage_model.name} due to [{exc}]"
            )
            self.status.failed(
                error=StackTraceError(
                    name=lineage_model.name,
                    error=error,
                    stackTrace=traceback.format_exc(),
                )
            )

    def test_connection(self) -> None:
        test_connection_common(self.metadata, self.engine, self.service_connection)
