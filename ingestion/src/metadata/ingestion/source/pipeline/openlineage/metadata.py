#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
OpenLineage source to extract metadata from Kafka events
"""
import json
import traceback
from collections import defaultdict
from itertools import groupby, product
from typing import Dict, Iterable, List, Optional, Tuple

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    OpenLineageConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
    Source,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.openlineage.models import (
    LineageEdge,
    LineageNode,
    OpenLineageEvent,
    TableDetails,
    TableFQN,
)
from metadata.ingestion.source.pipeline.openlineage.utils import (
    FQNNotFoundException,
    sanitize_data_type,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class OpenlineageSource(PipelineServiceSource):
    """
    Implements the necessary methods of PipelineServiceSource to facilitate registering OpenLineage pipelines with
    metadata into Open Metadata.

    Works under the assumption that OpenLineage integrations produce events to Kafka topic, which is a source of events
    for this connector.

    Only 'SUCCESS' OpenLineage events are taken into account in this connector.

    Configuring OpenLineage integrations: https://openlineage.io/docs/integrations/about
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: OpenLineageConnection = config.serviceConnection.root.config
        if not isinstance(connection, OpenLineageConnection):
            raise InvalidSourceException(
                f"Expected OpenLineageConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def close(self) -> None:
        self.metadata.close()

    @classmethod
    def _render_pipeline_name(cls, pipeline_details: OpenLineageEvent) -> str:
        """
        Renders pipeline name from parent facet of run facet. It is our expectation that every OL event contains parent
        run facet so we can always create pipeline entities and link them to lineage events.

        :param run_facet: Open Lineage run facet
        :return: pipeline name (not fully qualified name)
        """

        try:
            namespace = pipeline_details.run_facet["facets"]["parent"]["job"][
                "namespace"
            ]
            name = pipeline_details.run_facet["facets"]["parent"]["job"]["name"]
        except KeyError:
            namespace = pipeline_details.job["namespace"]
            name = pipeline_details.job["name"]

        result = f"{namespace}-{name}"

        logger.debug(f"Pipeline name rendered: {result}")

        return result

    @classmethod
    def _get_om_table_columns(cls, table_input: Dict) -> Optional[List]:
        """

        :param table_input:
        :return:
        """
        try:
            fields = table_input["facets"]["schema"]["fields"]

            # @todo check if this way of passing type is ok
            columns = [
                Column(
                    name=f.get("name").lower(),
                    dataType=sanitize_data_type(f.get("type")),
                )
                for f in fields
            ]
            return columns
        except KeyError:
            return None

    @classmethod
    def _get_ol_table_name(cls, table: Dict) -> str:
        return "/".join(table[f] for f in ["namespace", "name"]).replace("//", "/")

    def _build_ol_name_to_fqn_map(self, tables: List[TableDetails]):
        result = {}

        for table in tables:
            table_fqn = table.fqn

            if table_fqn:
                result[OpenlineageSource._get_ol_table_name(table.raw)] = table_fqn

        return result

    @classmethod
    def _create_output_lineage_dict(
        cls, lineage_info: List[Tuple[str, str, str, str]]
    ) -> Dict[str, Dict[str, List[ColumnLineage]]]:
        result = defaultdict(lambda: defaultdict(list))  # type: ignore
        for (output_table, input_table, output_column), group in groupby(
            lineage_info, lambda x: x[:3]
        ):
            input_columns = [input_col.lower() for _, _, _, input_col in group]

            result[output_table][input_table] += [
                ColumnLineage(toColumn=output_column.lower(), fromColumns=input_columns)
            ]

        return result  # type: ignore

    @classmethod
    def _get_create_table_request(cls, table: TableDetails) -> Optional[Either]:
        """
        If certain table from Open Lineage events doesn't already exist in Open Metadata, register appropriate entity.
        This makes sense especially for output facet of OpenLineage event - as database service ingestion is a scheduled
        process we might fall into situation where we received Open Lineage event about creation of a table that is yet
        to be ingested by database service ingestion process. To avoid missing on such lineage scenarios, we will create
        table entity beforehand.

        :param table: single object from inputs/outputs facet
        :return: request to create the entity (if needed)
        """
        if table.in_om:
            # if fqn found then it means table is already registered and we don't need to render create table request
            return None
        else:
            columns = OpenlineageSource._get_om_table_columns(table.raw) or []

            request = CreateTableRequest(
                name=table.name,
                columns=columns,
                databaseSchema=table.fqn[: table.fqn.rindex(".")],
            )

            return Either(right=request)

    def _get_column_lineage(
        self, inputs: List[TableDetails], outputs: List[TableDetails]
    ) -> Dict[str, Dict[str, List[ColumnLineage]]]:
        _result: List = []

        ol_name_to_fqn_map = self._build_ol_name_to_fqn_map(inputs + outputs)

        for table in outputs:
            output_table_fqn = table.fqn

            for field_name, field_spec in (
                table.raw.get("facets", {})
                .get("columnLineage", {})
                .get("fields", {})
                .items()
            ):
                for input_field in field_spec.get("inputFields", []):
                    input_table_ol_name = OpenlineageSource._get_ol_table_name(
                        input_field
                    )

                    _result.append(  # output table, input table, output column, input column
                        (
                            output_table_fqn,
                            ol_name_to_fqn_map.get(input_table_ol_name),
                            f"{output_table_fqn}.{field_name}",
                            f'{ol_name_to_fqn_map.get(input_table_ol_name)}.{input_field.get("field")}',
                        )
                    )

        return OpenlineageSource._create_output_lineage_dict(_result)

    def _get_table_fqn_from_om(
        self, table_name: str, schema_name: Optional[str]
    ) -> Optional[str]:
        """
        Based on partial schema and table names look for matching table object in open metadata.
        :param schema: schema name
        :param table: table name
        :return: fully qualified name of a Table in Open Metadata
        """
        result = None
        services = self.get_db_service_names()
        for db_service in services:
            logger.debug(
                f"Searching for Table FQN for schema: {schema_name} table: {table_name} within service: {db_service}"
            )
            result = fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                service_name=db_service,
                database_name=None,
                schema_name=schema_name,
                table_name=table_name,
            )

            if result:
                logger.debug(f"Table FQN Found: {result}")
                return result

        if not result:
            raise FQNNotFoundException(
                f"Table FQN not found for table: {table_name} within services: {services}"
            )

    def _get_schema_fqn_from_om(self, schema: str) -> Optional[str]:
        """
        Based on partial schema name look for any matching DatabaseSchema object in open metadata.

        :param schema: schema name
        :return: fully qualified name of a DatabaseSchema in Open Metadata
        """
        result = None
        services = self.get_db_service_names()

        for db_service in services:
            logger.debug(
                f"Searching for DatabaseSchema FQN for schema: {schema} within service: {db_service}"
            )
            result = fqn.build(
                metadata=self.metadata,
                entity_type=DatabaseSchema,
                service_name=db_service,
                database_name=None,
                schema_name=schema,
                skip_es_search=False,
            )

            if result:
                logger.debug(f"DatabaseSchema FQN found: {result}")
                return result

        if not result:
            raise FQNNotFoundException(
                f"Schema FQN not found within services: {services}"
            )

        return result

    def _get_table_details(self, data: Dict) -> Optional[TableDetails]:
        """
        extracts table entity fqn, schema and name from input/output entry collected from Open Lineage.

        :param data: single entry from inputs/outputs objects
        :return: TableDetails object with schema and name
        """
        candidates = [
            {"name": data["name"], "namespace": data["namespace"]}
        ] + data.get("facets", {}).get("symlinks", {}).get("identifiers", [])

        for candidate in candidates:
            schema_name = None
            table_fqn = None
            in_om = False

            name_parts = candidate["name"].split(".")

            if len(name_parts) == 1:
                table_name = name_parts[0]
            else:
                table_name = name_parts[-1]
                schema_name = name_parts[-2]

            try:
                table_fqn = self._get_table_fqn_from_om(table_name, schema_name)
                if table_fqn:
                    schema_name = table_fqn.split(".")[-2]
                logger.info(
                    f"Table FQN for schema: {schema_name} table: {table_name} found in OM: {table_fqn}."
                )
                in_om = True
            except FQNNotFoundException:
                logger.warn(
                    f"Table FQN for schema: {schema_name} table: {table_name} not found in OM."
                )
                if schema_name:
                    try:
                        schema_fqn = self._get_schema_fqn_from_om(schema_name)
                        table_fqn = f"{schema_fqn}.{table_name}"
                        logger.info(
                            f"Schema FQN for schema: {schema_name} found in OM: {schema_fqn}."
                        )
                    except FQNNotFoundException:
                        logger.warn(
                            f"Schema FQN for schema: {schema_name} not found in OM."
                        )

            if all([table_name, schema_name, table_fqn]):
                return TableDetails(
                    fqn=table_fqn,
                    name=table_name,
                    schema=schema_name,
                    in_om=in_om,
                    raw=data,
                )

        logger.warn(f"Table details for candidates: {candidates} not found.")
        return None

    def _enrich_table_details(self, event: OpenLineageEvent) -> OpenLineageEvent:
        """
        Find FQNs of entities listed in inputs and outputs of a raw OpenLineageEvent so they can be referenced/created
        in OpenMetadata.

        Args:
            event:

        Returns:

        """
        event.input_table_details = list(
            filter(
                lambda x: x is not None,
                [self._get_table_details(i) for i in event.inputs],
            )
        )
        event.output_table_details = list(
            filter(
                lambda x: x is not None,
                [self._get_table_details(o) for o in event.outputs],
            )
        )

        return event

    def _enrich_event(self, event: OpenLineageEvent):
        """
        Enrich raw OpenLineageEvent with attributes and values related to OpenMetadata integration.

        Args:
            event: raw OpenLineageEvent

        Returns: OpenLineageEvent with enriched fields.

        """
        event = self._enrich_table_details(event)

        logger.debug(f"Enriched event: {event}.")

        return event

    def yield_pipeline(
        self, pipeline_details: OpenLineageEvent
    ) -> Iterable[Either[CreatePipelineRequest]]:
        pipeline_name = self.get_pipeline_name(pipeline_details)
        try:
            logger.info(pipeline_details)
            description = f"""```json
            {json.dumps(pipeline_details.run_facet, indent=4).strip()}```"""
            request = CreatePipelineRequest(
                name=pipeline_name,
                service=self.context.get().pipeline_service,
                description=description,
            )

            logger.info(request)

            yield Either(right=request)
            self.register_record(pipeline_request=request)
        except Exception:
            logger.exception("error yielding pipeline", exc_info=True)
            yield Either(
                left=StackTraceError(
                    name=pipeline_name,
                    error="Failed to collect metadata required for pipeline creation.",
                    stackTrace=traceback.format_exc(),
                ),
            )

    def yield_pipeline_lineage_details(
        self, pipeline_details: OpenLineageEvent
    ) -> Iterable[Either[AddLineageRequest]]:
        inputs, outputs = (
            pipeline_details.input_table_details,
            pipeline_details.output_table_details,
        )

        input_edges: List[LineageNode] = []
        output_edges: List[LineageNode] = []

        for spec in [(inputs, input_edges), (outputs, output_edges)]:
            tables, tables_list = spec

            for table in tables:
                create_table_request = OpenlineageSource._get_create_table_request(
                    table
                )

                if create_table_request:
                    yield create_table_request

                table_fqn = table.fqn

                if table_fqn:
                    tables_list.append(
                        LineageNode(
                            fqn=TableFQN(value=table_fqn),
                            uuid=self.metadata.get_by_name(Table, table_fqn).id.root,
                        )
                    )

        edges = [
            LineageEdge(from_node=n[0], to_node=n[1])
            for n in product(input_edges, output_edges)
        ]

        column_lineage = self._get_column_lineage(inputs, outputs)

        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=self.context.get().pipeline,
        )

        pipeline_entity = self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn)
        for edge in edges:
            yield Either(
                right=AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(
                            id=edge.from_node.uuid, type=edge.from_node.node_type
                        ),
                        toEntity=EntityReference(
                            id=edge.to_node.uuid, type=edge.to_node.node_type
                        ),
                        lineageDetails=LineageDetails(
                            pipeline=EntityReference(
                                id=pipeline_entity.id.root,
                                type="pipeline",
                            ),
                            description=f"Lineage extracted from OpenLineage job: {pipeline_details.job['name']}",
                            source=Source.OpenLineage,
                            columnsLineage=column_lineage.get(
                                edge.to_node.fqn.value, {}
                            ).get(edge.from_node.fqn.value, []),
                        ),
                    ),
                )
            )

    def get_pipelines_list(self) -> Optional[List[OpenLineageEvent]]:
        """
        Get a list of all pipelines by processing OpenLineage events.

        :return: A list of processed OpenLineage events.
        :raises InvalidSourceException: If there is an error reading OpenLineage events.
        """
        try:
            events = self.client.get_events(self.metadata)
            for event in events:
                yield self._enrich_event(event)
        except Exception as e:
            logger.error(f"Failed to read OpenLineage event: {e}", exc_info=True)
            raise InvalidSourceException(
                f"Failed to read OpenLineage event: {e}"
            ) from e

        finally:
            self.client.close(self.metadata)

    def get_pipeline_name(self, pipeline_details: OpenLineageEvent) -> str:
        return OpenlineageSource._render_pipeline_name(pipeline_details)

    def yield_pipeline_status(
        self, pipeline_details: OpenLineageEvent
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        pass

    def mark_pipelines_as_deleted(self):
        """
        OpenLineage pipelines are coming from streaming data and hence subsequent executions of ingestion processes
        can cause deletion of a pipeline. Because of this we turn off pipeline deletion by overwriting this method
        and leaving it blank. Setting 'Mark Deleted Pipelines' in ingestion process will have no effect!
        """
