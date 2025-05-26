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
OpenLineage source to extract metadata from Kafka events
"""
import json
import traceback
from collections import defaultdict
from itertools import groupby, product
from typing import Any, Dict, Iterable, List, Optional, Tuple

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
    EventType,
    LineageEdge,
    LineageNode,
    OpenLineageEvent,
    TableDetails,
    TableFQN,
)
from metadata.ingestion.source.pipeline.openlineage.utils import (
    FQNNotFoundException,
    message_to_open_lineage_event,
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
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: OpenLineageConnection = config.serviceConnection.root.config
        if not isinstance(connection, OpenLineageConnection):
            raise InvalidSourceException(
                f"Expected OpenLineageConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def close(self) -> None:
        self.metadata.compute_percentile(Pipeline, self.today)
        self.metadata.close()

    @classmethod
    def _get_table_details(cls, data: Dict) -> TableDetails:
        """
        extracts table entity schema and name from input/output entry collected from Open Lineage.

        :param data: single entry from inputs/outputs objects
        :return: TableDetails object with schema and name
        """
        symlinks = data.get("facets", {}).get("symlinks", {}).get("identifiers", [])

        # for some OL events name can be extracted from dataset facet but symlinks is preferred so - if present - we
        # use it instead
        if len(symlinks) > 0:
            try:
                # @todo verify if table can have multiple identifiers pointing at it
                name = symlinks[0]["name"]
            except (KeyError, IndexError):
                raise ValueError(
                    "input table name cannot be retrieved from symlinks.identifiers facet."
                )
        else:
            try:
                name = data["name"]
            except KeyError:
                raise ValueError(
                    "input table name cannot be retrieved from name attribute."
                )

        name_parts = name.split(".")

        if len(name_parts) < 2:
            raise ValueError(
                f"input table name should be of 'schema.table' format! Received: {name}"
            )

        # we take last two elements to explicitly collect schema and table names
        # in BigQuery Open Lineage events name_parts would be list of 3 elements as first one is GCP Project ID
        # however, concept of GCP Project ID is not represented in Open Metadata and hence - we need to skip this part
        return TableDetails(name=name_parts[-1], schema=name_parts[-2])

    def _get_table_fqn(self, table_details: TableDetails) -> Optional[str]:
        try:
            return self._get_table_fqn_from_om(table_details)
        except FQNNotFoundException:
            try:
                schema_fqn = self._get_schema_fqn_from_om(table_details.schema)

                return f"{schema_fqn}.{table_details.name}"
            except FQNNotFoundException:
                return None

    def _get_schema_fqn_from_om(self, schema: str) -> Optional[str]:
        """
        Based on partial schema name look for any matching DatabaseSchema object in open metadata.

        :param schema: schema name
        :return: fully qualified name of a DatabaseSchema in Open Metadata
        """
        result = None
        services = self.get_db_service_names()

        for db_service in services:
            result = fqn.build(
                metadata=self.metadata,
                entity_type=DatabaseSchema,
                service_name=db_service,
                database_name=None,
                schema_name=schema,
                skip_es_search=False,
            )

            if result:
                return result

        if not result:
            raise FQNNotFoundException(
                f"Schema FQN not found within services: {services}"
            )

        return result

    @classmethod
    def _render_pipeline_name(cls, pipeline_details: OpenLineageEvent) -> str:
        """
        Renders pipeline name from parent facet of run facet. It is our expectation that every OL event contains parent
        run facet so we can always create pipeline entities and link them to lineage events.

        :param run_facet: Open Lineage run facet
        :return: pipeline name (not fully qualified name)
        """
        run_facet = pipeline_details.run_facet

        namespace = run_facet["facets"]["parent"]["job"]["namespace"]
        name = run_facet["facets"]["parent"]["job"]["name"]

        return f"{namespace}-{name}"

    @classmethod
    def _filter_event_by_type(
        cls, event: OpenLineageEvent, event_type: EventType
    ) -> Optional[Dict]:
        """
        returns event if it's of particular event_type.
        for example - for lineage events we will be only looking for EventType.COMPLETE event type.

        :param event: Open Lineage raw event.
        :param event_type: type of event we are looking for.
        :return: Open Lineage event if matches event_type, otherwise None
        """
        return event if event.event_type == event_type else {}

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
                Column(name=f.get("name"), dataType=f.get("type").upper())
                for f in fields
            ]
            return columns
        except KeyError:
            return None

    def get_create_table_request(self, table: Dict) -> Optional[Either]:
        """
        If certain table from Open Lineage events doesn't already exist in Open Metadata, register appropriate entity.
        This makes sense especially for output facet of OpenLineage event - as database service ingestion is a scheduled
        process we might fall into situation where we received Open Lineage event about creation of a table that is yet
        to be ingested by database service ingestion process. To avoid missing on such lineage scenarios, we will create
        table entity beforehand.

        :param table: single object from inputs/outputs facet
        :return: request to create the entity (if needed)
        """
        om_table_fqn = None

        try:
            table_details = OpenlineageSource._get_table_details(table)
        except ValueError as e:
            return Either(
                left=StackTraceError(
                    name="",
                    error=f"Failed to get partial table name: {e}",
                    stackTrace=traceback.format_exc(),
                )
            )
        try:
            om_table_fqn = self._get_table_fqn_from_om(table_details)

            # if fqn found then it means table is already registered and we don't need to render create table request
            return None
        except FQNNotFoundException:
            pass

        # If OM Table FQN was not found based on OL Partial Name - we need to register it.
        if not om_table_fqn:
            try:
                om_schema_fqn = self._get_schema_fqn_from_om(table_details.schema)
            except FQNNotFoundException as e:
                return Either(
                    left=StackTraceError(
                        name="",
                        error=f"Failed to get fully qualified schema name: {e}",
                        stackTrace=traceback.format_exc(),
                    )
                )

            # After finding schema fqn (based on partial schema name) we know where we can create table
            # and we move forward with creating request.
            if om_schema_fqn:
                columns = OpenlineageSource._get_om_table_columns(table) or []

                request = CreateTableRequest(
                    name=table_details.name,
                    columns=columns,
                    databaseSchema=om_schema_fqn,
                )

                return Either(right=request)

        return None

    @classmethod
    def _get_ol_table_name(cls, table: Dict) -> str:
        return "/".join(table.get(f) for f in ["namespace", "name"]).replace("//", "/")

    def _build_ol_name_to_fqn_map(self, tables: List):
        result = {}

        for table in tables:
            table_fqn = self._get_table_fqn(OpenlineageSource._get_table_details(table))

            if table_fqn:
                result[OpenlineageSource._get_ol_table_name(table)] = table_fqn

        return result

    @classmethod
    def _create_output_lineage_dict(
        cls, lineage_info: List[Tuple[str, str, str, str]]
    ) -> Dict[str, Dict[str, List[ColumnLineage]]]:
        result = defaultdict(lambda: defaultdict(list))
        for (output_table, input_table, output_column), group in groupby(
            lineage_info, lambda x: x[:3]
        ):
            input_columns = [input_col for _, _, _, input_col in group]

            result[output_table][input_table] += [
                ColumnLineage(toColumn=output_column, fromColumns=input_columns)
            ]

        return result

    def _get_column_lineage(
        self, inputs: List, outputs: List
    ) -> Dict[str, Dict[str, List[ColumnLineage]]]:
        _result: List = []

        ol_name_to_fqn_map = self._build_ol_name_to_fqn_map(inputs + outputs)

        for table in outputs:
            output_table_fqn = self._get_table_fqn(
                OpenlineageSource._get_table_details(table)
            )
            for field_name, field_spec in (
                table.get("facets", {})
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

    def yield_pipeline(
        self, pipeline_details: OpenLineageEvent
    ) -> Iterable[Either[CreatePipelineRequest]]:
        pipeline_name = self.get_pipeline_name(pipeline_details)
        try:
            description = f"""```json
            {json.dumps(pipeline_details.run_facet, indent=4).strip()}```"""
            request = CreatePipelineRequest(
                name=pipeline_name,
                service=self.context.get().pipeline_service,
                description=description,
            )

            yield Either(right=request)
            self.register_record(pipeline_request=request)
        except ValueError:
            yield Either(
                left=StackTraceError(
                    name=pipeline_name,
                    message="Failed to collect metadata required for pipeline creation.",
                ),
                stackTrace=traceback.format_exc(),
            )

    def yield_pipeline_lineage_details(
        self, pipeline_details: OpenLineageEvent
    ) -> Iterable[Either[AddLineageRequest]]:
        inputs, outputs = pipeline_details.inputs, pipeline_details.outputs

        input_edges: List[LineageNode] = []
        output_edges: List[LineageNode] = []

        for spec in [(inputs, input_edges), (outputs, output_edges)]:
            tables, tables_list = spec

            for table in tables:
                create_table_request = self.get_create_table_request(table)

                if create_table_request:
                    yield create_table_request

                table_fqn = self._get_table_fqn(
                    OpenlineageSource._get_table_details(table)
                )

                if table_fqn:
                    tables_list.append(
                        LineageNode(
                            fqn=TableFQN(value=table_fqn),
                            uuid=self.metadata.get_by_name(Table, table_fqn).id,
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

    def get_pipelines_list(self) -> Optional[List[Any]]:
        """Get List of all pipelines"""
        try:
            consumer = self.client
            session_active = True
            empty_msg_cnt = 0
            pool_timeout = self.service_connection.poolTimeout
            while session_active:
                message = consumer.poll(timeout=pool_timeout)
                if message is None:
                    logger.debug("no new messages")
                    empty_msg_cnt += 1
                    if (
                        empty_msg_cnt * pool_timeout
                        > self.service_connection.sessionTimeout
                    ):
                        # There is no new messages, timeout is passed
                        session_active = False
                else:
                    logger.debug(f"new message {message.value()}")
                    empty_msg_cnt = 0
                    try:
                        _result = message_to_open_lineage_event(
                            json.loads(message.value())
                        )
                        result = self._filter_event_by_type(_result, EventType.COMPLETE)
                        if result:
                            yield result
                    except Exception as e:
                        logger.debug(e)

        except Exception as e:
            traceback.print_exc()

            raise InvalidSourceException(f"Failed to read from Kafka: {str(e)}")

        finally:
            # Close down consumer to commit final offsets.
            # @todo address this
            consumer.close()

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
