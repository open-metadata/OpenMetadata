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
from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import (
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import (
    Source as LineageSourceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import test_connection_common
from metadata.ingestion.source.database.saphana.cdata_parser import (
    ParsedLineage,
    parse_registry,
)
from metadata.ingestion.source.database.saphana.models import (
    SapHanaLineageModel,
    SapHanaObjectDependency,
)
from metadata.ingestion.source.database.saphana.queries import (
    SAPHANA_LINEAGE,
    SAPHANA_OBJECT_DEPENDENCIES,
)
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import get_ssl_connection

logger = ingestion_logger()


class SaphanaLineageSource(Source):
    """
    Get the lineage information of:
    - calculationview
    - analyticview
    - attributeview

    We support the following relationships:
    - Analytic View and Attribute View based on a Table
    - Calculation View based on an Analytic View, Attribute View, Calculation View or Table

    Parse the CDATA XML definition from _SYS_REPO.ACTIVE_OBJECT
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
        get_engine: bool = True,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.source_config = self.config.sourceConfig.config
        self.engine = get_ssl_connection(self.service_connection) if get_engine else None

        logger.info(
            "Initializing SAP Hana Lineage Source. Note that we'll parse the lineage from CDATA XML definition "
            + "from _SYS_REPO.ACTIVE_OBJECT and we won't use the time-specific input parameters."
        )

    def prepare(self):
        """By default, there's nothing to prepare"""

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SapHanaConnection = config.serviceConnection.root.config
        if not isinstance(connection, SapHanaConnection):
            raise InvalidSourceException(f"Expected SapHanaConnection, but got {connection}")
        return cls(config, metadata)

    def close(self) -> None:
        self.engine.dispose()

    def _iter(self, *_, **__) -> Iterable[Either[AddLineageRequest]]:
        """Run every lineage pass this source supports and send the results to the sink.

        The two passes are independent and cover different deployments. On-prem HANA
        answers the repository pass, HANA Cloud answers only the dependency pass.
        """
        yield from self.yield_cdata_lineage()
        yield from self.yield_object_dependency_lineage()

    def yield_cdata_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """Lineage for calculation, analytic and attribute views, from _SYS_REPO.

        On-prem and HXE only. HANA Cloud has no classic repository, so this yields
        nothing there.
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
                logger.warning("_SYS_REPO not available for calc/analytic/attribute view lineage: %s", exc)
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

    def yield_object_dependency_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """Lineage from HANA's own dependency catalog, SYS.OBJECT_DEPENDENCIES.

        Independent of _SYS_REPO, so this is the only path that produces lineage on
        SAP HANA Cloud, where the classic repository and the calculation, analytic
        and attribute views it holds do not exist at all.
        """
        with self.engine.connect() as conn:
            try:
                result = conn.execution_options(stream_results=True, max_row_buffer=100).execute(
                    text(SAPHANA_OBJECT_DEPENDENCIES)
                )
            except Exception as exc:
                # A deployment may restrict SYS views. Degrade to no lineage rather than
                # failing the workflow, the same way the _SYS_REPO path does.
                logger.warning("Could not read SYS.OBJECT_DEPENDENCIES for lineage: %s", exc)
                return

            for row in result:
                try:
                    dependency = SapHanaObjectDependency.model_validate(row._asdict())

                    if filter_by_table(
                        self.source_config.tableFilterPattern,  # pyright: ignore[reportAttributeAccessIssue]
                        dependency.dependent_object_name,
                    ):
                        self.status.filter(dependency.dependent_object_name, "View Object Filtered Out")
                        continue

                    yield from self.build_dependency_lineage(dependency)
                except Exception as exc:
                    self.status.failed(
                        error=StackTraceError(
                            name=str(row),
                            error=f"Error processing object dependency due to [{exc}]",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def build_dependency_lineage(self, dependency: SapHanaObjectDependency) -> Iterable[Either[AddLineageRequest]]:
        """Resolve both endpoints of a dependency and emit the edge"""
        from_entity = self.metadata.get_by_name(
            entity=Table,
            fqn=dependency.get_base_fqn(metadata=self.metadata, service_name=self.config.serviceName),
        )
        to_entity = self.metadata.get_by_name(
            entity=Table,
            fqn=dependency.get_dependent_fqn(metadata=self.metadata, service_name=self.config.serviceName),
        )

        # Depending on an object OpenMetadata never ingested is expected, not an error.
        if not from_entity or not to_entity:
            missing = dependency.base_object_name if not from_entity else dependency.dependent_object_name
            self.status.filter(missing, "Object not found in OpenMetadata")
            return

        yield Either(
            right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(
                        id=from_entity.id,
                        type=ENTITY_REFERENCE_TYPE_MAP[Table.__name__],
                    ),
                    toEntity=EntityReference(
                        id=to_entity.id,
                        type=ENTITY_REFERENCE_TYPE_MAP[Table.__name__],
                    ),
                    lineageDetails=LineageDetails(source=LineageSourceType.ViewLineage),
                )
            )
        )

    def test_connection(self) -> None:
        test_connection_common(self.metadata, self.engine, self.service_connection)
