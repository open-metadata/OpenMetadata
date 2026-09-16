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
Salesforce Data 360 pipeline lineage ingestion
"""

import json
import traceback
from collections.abc import Iterable
from functools import cached_property
from typing import Any, cast

from collate_sqllineage.core.models import SubQuery

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.basic import (
    FullyQualifiedEntityName,
    Markdown,
    SqlQuery,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import (
    Source as LineageSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import InvalidWorkflowException
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import get_column_fqn, search_table_entities
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.database.data360.client import get_dmo_mappings
from metadata.ingestion.source.database.data360.constant import Constant
from metadata.ingestion.source.database.data360.utils import (
    add_column_suffix,
    decode_html_entities,
    get_schema_name,
)
from metadata.ingestion.source.pipeline.data360pipeline.constant import (
    ConnectionTypesConstant,
    ResponseConstant,
)
from metadata.ingestion.source.pipeline.data360pipeline.exceptions import (
    QueryParseException,
    ResourceNotFoundException,
)
from metadata.ingestion.source.pipeline.data360pipeline.metadata import (
    Data360PipelineSource,
)
from metadata.ingestion.source.pipeline.data360pipeline.models import (
    CalculatedInsightDetails,
    DataCloudPipelineDetails,
    DataStreamDetails,
    DataTransformDetails,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineUsage
from metadata.utils import fqn
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class Data360PipelineLineageSource(Data360PipelineSource):
    """
    Extracts lineage from Salesforce Data 360 pipeline objects:
    - DataStream → DLO (source to lake object)
    - DLO → DMO (lake to model object, via DMO mappings)
    - DMO → CIO (model to calculated insight, via SQL expression parsing)
    - DataTransform → source/target DMOs
    """

    @classmethod
    def create(
        cls,
        config_dict,
        metadata,
        pipeline_name: str | None = None,
    ) -> "Data360PipelineLineageSource":
        source = cast(
            "Data360PipelineLineageSource",
            super().create(config_dict, metadata, pipeline_name),
        )
        if not source.service_connection.data360DbServiceName:
            raise InvalidWorkflowException(
                "Please provide the Data360 database service name in the service connection to extract lineage."
            )
        return source

    @cached_property
    def service_mapping(self) -> dict:
        """Maps a Data 360 connector or data source name to the OpenMetadata service
        holding it, as configured on the service connection."""
        try:
            return json.loads(self.service_connection.serviceMapping or "{}")
        except json.JSONDecodeError as exc:
            self.status.failed(
                error=StackTraceError(
                    name="Pipeline Lineage",
                    error=f"Invalid service mapping JSON: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
            return {}

    def _create_add_lineage_request(
        self,
        from_entity: Any,
        to_entity: Any,
        lineage_details: LineageDetails | None = None,
        description: str | None = None,
    ) -> AddLineageRequest:
        return AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(
                    id=from_entity.id,
                    type=ENTITY_REFERENCE_TYPE_MAP[from_entity.__class__.__name__],
                ),
                toEntity=EntityReference(
                    id=to_entity.id,
                    type=ENTITY_REFERENCE_TYPE_MAP[to_entity.__class__.__name__],
                ),
                lineageDetails=lineage_details,
                description=Markdown(description) if description else None,
            )
        )

    @property
    def _db_service_name(self) -> str:
        """`create` refuses to build the source without it, so it is never empty here."""
        return str(self.service_connection.data360DbServiceName)

    def _get_dc_object_table_entity(self, dc_obj_name: str, dataspace_name: str) -> Table:
        object_type = get_schema_name(dc_obj_name)
        table_entity = search_table_entities(
            metadata=self.metadata,
            service_names=self._db_service_name,
            database=dataspace_name,
            database_schema=object_type,
            table=dc_obj_name,
        )
        if not table_entity:
            raise ResourceNotFoundException(f"Could not find {object_type} {dc_obj_name} Table Entity in OpenMetadata")
        return table_entity[0]

    def _get_pipeline_entity(self, pipeline_details: DataCloudPipelineDetails) -> Pipeline:
        fqn_string = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.config.serviceName,
            pipeline_name=pipeline_details.get_name(),
        )
        pipeline_entity = self.metadata.es_search_from_fqn(entity_type=Pipeline, fqn_search_string=str(fqn_string))
        if not pipeline_entity:
            raise ResourceNotFoundException(
                f"Could not find {pipeline_details.get_metadata_type()} pipeline entity for {pipeline_details.get_name()}"
            )
        return pipeline_entity[0]

    def _get_source_entity(self, pipeline_details: DataStreamDetails):
        source_entity = None
        if not pipeline_details.connectorInfo:
            raise ResourceNotFoundException(f"Missing 'connectorInfo' for datastream '{pipeline_details.get_name()}'.")
        connector_details = pipeline_details.connectorInfo.connectorDetails
        advanced_attributes = pipeline_details.advancedAttributes
        connector_type = pipeline_details.connectorInfo.connectorType
        source_details = {ResponseConstant.CONNECTOR_TYPE: connector_type}

        if connector_type in (
            ConnectionTypesConstant.UPLOADED_FILES,
            ConnectionTypesConstant.AWS_S3,
            ConnectionTypesConstant.SFTP,
        ):
            connector_name = connector_details.name if connector_details else None
            storage_service_name = self.service_mapping.get(connector_name)
            if not storage_service_name:
                raise ResourceNotFoundException(
                    f"No service mapping found for connector '{connector_name}' in datastream "
                    f"{pipeline_details.get_name()}. Add it to serviceMapping."
                )
            file_name = advanced_attributes.fileName if advanced_attributes else None
            source_details[ResponseConstant.FILE_NAME] = file_name
            fqn_string = fqn.build(
                metadata=self.metadata,
                entity_type=Container,
                service_name=storage_service_name,
                parent_container="*",
                container_name=file_name,
            )
            source_entity = self.metadata.es_search_from_fqn(entity_type=Container, fqn_search_string=str(fqn_string))
        elif connector_type == ConnectionTypesConstant.SALESFORCE_DOT_COM:
            connector_name = connector_details.name if connector_details else None
            sfdc_service_name = self.service_mapping.get(connector_name)
            source_object = connector_details.sourceObject if connector_details else None
            if sfdc_service_name and source_object:
                source_entity = search_table_entities(
                    metadata=self.metadata,
                    service_names=sfdc_service_name,
                    database=None,
                    database_schema="salesforce",
                    table=source_object,
                )
        elif connector_type in (
            ConnectionTypesConstant.SNOWFLAKE,
            ConnectionTypesConstant.ICEBERG,
        ):
            service_name = self.service_mapping.get(pipeline_details.dataSource)
            if not service_name:
                raise ResourceNotFoundException(
                    f"No service mapping found for data source '{pipeline_details.dataSource}' "
                    f"in datastream {pipeline_details.get_name()}. Add it to serviceMapping."
                )
            source_object = advanced_attributes.object if advanced_attributes else None
            if source_object:
                source_entity = search_table_entities(
                    metadata=self.metadata,
                    service_names=service_name,
                    database=(advanced_attributes.database or None) if advanced_attributes else None,
                    database_schema=(advanced_attributes.source_schema or None) if advanced_attributes else None,
                    table=source_object,
                )

        if source_entity and len(source_entity) == 1:
            return source_entity[0]
        raise ResourceNotFoundException(
            f"Could not find source entity for datastream {pipeline_details.get_name()}. Details: {source_details}"
        )

    def _get_column_lineage(self, pipeline_details: DataStreamDetails, from_entity: Table, to_entity: Table) -> list:
        column_lineages = []
        for mapping in pipeline_details.mappings or []:
            if mapping.sourceFieldName and mapping.targetFieldName:
                from_col_fqn = get_column_fqn(from_entity, mapping.sourceFieldName)
                to_col_fqn = get_column_fqn(to_entity, add_column_suffix(mapping.targetFieldName))
                if from_col_fqn and to_col_fqn:
                    column_lineages.append(
                        ColumnLineage(
                            fromColumns=[FullyQualifiedEntityName(root=from_col_fqn)],
                            toColumn=FullyQualifiedEntityName(root=to_col_fqn),
                        )
                    )
                else:
                    missing = []
                    if not from_col_fqn:
                        missing.append(f"source field {mapping.sourceFieldName}")
                    if not to_col_fqn:
                        missing.append(f"DLO field {mapping.targetFieldName}")
                    self.log_warning(
                        f"Could not get column FQN for {' and '.join(missing)} in datastream {pipeline_details.get_name()}"
                    )
        return column_lineages

    def _get_lineage_parser(self, query: str, name: str) -> LineageParser:
        updated_query = decode_html_entities(query)
        updated_query = f"INSERT INTO {name} {updated_query}"
        parser = LineageParser(query=updated_query)
        if not parser.parser or not parser.source_tables:
            reason = parser.query_parsing_failure_reason or f"Tables not present in query: {query}"
            raise QueryParseException(f"LineageParser failed to parse query for {name}: {reason}")
        return parser

    def _extract_column_lineage(self, parser: LineageParser, name: str) -> list | None:
        column_lineage = parser.parser.get_column_lineage(exclude_subquery=False)  # pyright: ignore[reportOptionalMemberAccess]
        if column_lineage:
            return column_lineage
        self.log_warning(f"Column lineage not extracted from query for {name}")
        return None

    def _create_column_lineage_map(self, raw_column_lineage: list) -> dict:
        column_lineage_map: dict = {}
        if not raw_column_lineage:
            return column_lineage_map
        for col_lineage in raw_column_lineage:
            try:
                source_col = col_lineage[0]
                target_col = col_lineage[-1]
                if source_col.parent is None or isinstance(source_col.parent, SubQuery):
                    self.log_warning(f"Source column {source_col.raw_name} has no parent table — skipping.")
                    continue
                source_table = source_col.parent.raw_name
                entry = column_lineage_map.setdefault(source_table, [])
                entry.append((source_col.raw_name, target_col.raw_name))
            except Exception as exc:
                self.log_warning(f"Error processing column lineage entry: {exc} — skipping.")
        return column_lineage_map

    def _create_column_lineage(self, raw_column_lineage: list, source_table: Table, target_table: Table) -> list:
        result = []
        for src_col, tgt_col in raw_column_lineage or []:
            src_fqn = get_column_fqn(source_table, src_col)
            tgt_fqn = get_column_fqn(target_table, tgt_col)
            if src_fqn and tgt_fqn:
                result.append(
                    ColumnLineage(
                        fromColumns=[FullyQualifiedEntityName(root=src_fqn)],
                        toColumn=FullyQualifiedEntityName(root=tgt_fqn),
                    )
                )
        return result

    def parse_query(self, pipeline_name: str, query: str) -> tuple[list, dict]:
        parser = self._get_lineage_parser(query=query, name=pipeline_name)
        raw_col_lineage = self._extract_column_lineage(parser=parser, name=pipeline_name)
        column_lineage_map = self._create_column_lineage_map(raw_col_lineage or [])
        # `LineageParser.source_tables` is exposed through the third-party
        # `cached_property`, which type checkers do not read as a descriptor.
        return cast("list", parser.source_tables), column_lineage_map

    def _yield_ci_lineage(self, pipeline_details: CalculatedInsightDetails):
        if not pipeline_details.dataSpace:
            raise ResourceNotFoundException(
                f"Missing 'dataSpace' in response for {pipeline_details.get_metadata_type()} '{pipeline_details.get_name()}'."
            )
        if not pipeline_details.expression:
            raise ResourceNotFoundException(
                f"Missing 'expression' for {pipeline_details.get_metadata_type()} '{pipeline_details.get_name()}'."
            )
        ci_table_entity = self._get_dc_object_table_entity(
            dc_obj_name=pipeline_details.get_name(),
            dataspace_name=pipeline_details.dataSpace,
        )
        pipeline = self._get_pipeline_entity(pipeline_details)
        dmo_tables, column_lineage_map = self.parse_query(
            pipeline_name=pipeline_details.get_name(),
            query=pipeline_details.expression,
        )
        for dmo_table in dmo_tables or []:
            try:
                dmo_table_entity = self._get_dc_object_table_entity(
                    dc_obj_name=dmo_table.raw_name,
                    dataspace_name=pipeline_details.dataSpace,
                )
                column_lineage = self._create_column_lineage(
                    raw_column_lineage=column_lineage_map.get(dmo_table_entity.name.root, []),
                    source_table=dmo_table_entity,
                    target_table=ci_table_entity,
                )
                yield Either(  # pyright: ignore[reportCallIssue]
                    right=self._create_add_lineage_request(
                        from_entity=dmo_table_entity,
                        to_entity=ci_table_entity,
                        lineage_details=LineageDetails(
                            pipeline=EntityReference(
                                id=pipeline.id,
                                type=ENTITY_REFERENCE_TYPE_MAP[Pipeline.__name__],
                            ),
                            source=LineageSource.PipelineLineage,
                            sqlQuery=SqlQuery(pipeline_details.expression),
                            columnsLineage=column_lineage,
                        ),
                    )
                )
            except ResourceNotFoundException as exc:
                self.log_warning(str(exc))

    def _yield_datastream_lineage(self, pipeline_details: DataStreamDetails):
        source_entity = self._get_source_entity(pipeline_details)
        pipeline = self._get_pipeline_entity(pipeline_details)

        if not pipeline_details.dataLakeObjectInfo:
            raise ResourceNotFoundException(
                f"Missing 'dataLakeObjectInfo' for datastream '{pipeline_details.get_name()}'."
            )
        if not pipeline_details.dataLakeObjectInfo.dataSpaceInfo:
            raise ResourceNotFoundException(f"Missing 'dataSpace' for datastream '{pipeline_details.get_name()}'.")
        for dataspace in pipeline_details.dataLakeObjectInfo.dataSpaceInfo:
            if not pipeline_details.dataLakeObjectInfo.name or not dataspace.name:
                self.log_warning(
                    f"Skipping a data space of datastream '{pipeline_details.get_name()}': "
                    "the Data Lake Object or data space has no name."
                )
                continue
            try:
                dlo_entity = self._get_dc_object_table_entity(
                    dc_obj_name=pipeline_details.dataLakeObjectInfo.name,
                    dataspace_name=dataspace.name,
                )
                col_lineages = self._get_column_lineage(pipeline_details, source_entity, dlo_entity)
                yield Either(  # pyright: ignore[reportCallIssue]
                    right=self._create_add_lineage_request(
                        from_entity=source_entity,
                        to_entity=dlo_entity,
                        lineage_details=LineageDetails(
                            pipeline=EntityReference(
                                id=pipeline.id,
                                type=ENTITY_REFERENCE_TYPE_MAP[Pipeline.__name__],
                            ),
                            source=LineageSource.PipelineLineage,
                            columnsLineage=col_lineages,
                        ),
                        description=f"Datasource: {pipeline_details.dataSource}",
                    )
                )
            except ResourceNotFoundException as exc:
                self.log_warning(msg=str(exc))

    def build_batch_data_transform_lineage(self, nodes: dict) -> dict:
        """
        Builds {output_dataset: {source_dataset: [(src_col, tgt_col)]}} from batch transform node graph.
        """
        load_datasets = {}
        for node_name, node in nodes.items():
            if node.get("action") == "load":
                info = node["parameters"]["dataset"]
                load_datasets[node_name] = {
                    "dataset": info["name"],
                    "fields": set(node["parameters"].get("fields", [])),
                }

        output_nodes = {k: v for k, v in nodes.items() if v.get("action", "").startswith("output")}

        lineage: dict = {}
        for output_node, output_data in output_nodes.items():
            output_name = output_data["parameters"].get("name", output_node)
            lineage[output_name] = {}
            for mapping in output_data["parameters"].get("fieldsMappings", []):
                src_field = mapping.get("sourceField", "")
                tgt_field = mapping.get("targetField", "")
                if not src_field or not tgt_field:
                    continue
                src_col = src_field.split(".", 1)[1] if "." in src_field else src_field
                dataset_name = None
                for info in load_datasets.values():
                    if src_col in info["fields"]:
                        dataset_name = info["dataset"]
                        break
                if dataset_name is None:
                    continue
                lineage[output_name].setdefault(dataset_name, []).append((src_col, tgt_field))

        return lineage

    def _get_data_transform_dataspace_name(self, pipeline_details: DataTransformDetails) -> str:
        if pipeline_details.dataSpaceName:
            return pipeline_details.dataSpaceName
        if pipeline_details.definition and pipeline_details.definition.ui:
            for node_name, node in pipeline_details.definition.ui.get("nodes", {}).items():
                if node_name.startswith("LOAD_DATASET"):
                    name = node.get("parameters", {}).get("sampleDetails", {}).get("dataspace")
                    if name is not None:
                        return name
        raise ResourceNotFoundException(f"Missing 'dataSpace' for DataTransform '{pipeline_details.get_name()}'.")

    def _process_batch_data_transform(self, pipeline_details: DataTransformDetails):
        if not pipeline_details.definition:
            return
        pipeline = self._get_pipeline_entity(pipeline_details)
        try:
            lineage = self.build_batch_data_transform_lineage(nodes=pipeline_details.definition.nodes or {})
        except (KeyError, AttributeError, TypeError) as exc:
            self.log_warning(f"Error building lineage for batch transform {pipeline_details.get_name()}: {exc}")
            return
        dataspace_name = self._get_data_transform_dataspace_name(pipeline_details)
        for target_name, source_names in lineage.items():
            try:
                target_table = self._get_dc_object_table_entity(dc_obj_name=target_name, dataspace_name=dataspace_name)
                for source_name, col_lineage_map in source_names.items():
                    try:
                        source_table = self._get_dc_object_table_entity(
                            dc_obj_name=source_name, dataspace_name=dataspace_name
                        )
                        column_lineages = self._create_column_lineage(
                            raw_column_lineage=col_lineage_map,
                            source_table=source_table,
                            target_table=target_table,
                        )
                        yield Either(  # pyright: ignore[reportCallIssue]
                            right=self._create_add_lineage_request(
                                from_entity=source_table,
                                to_entity=target_table,
                                lineage_details=LineageDetails(
                                    pipeline=EntityReference(
                                        id=pipeline.id,
                                        type=ENTITY_REFERENCE_TYPE_MAP[Pipeline.__name__],
                                    ),
                                    source=LineageSource.PipelineLineage,
                                    columnsLineage=column_lineages,
                                ),
                            )
                        )
                    except ResourceNotFoundException as exc:
                        self.log_warning(str(exc))
            except ResourceNotFoundException as exc:
                self.log_warning(str(exc))

    def _process_streaming_data_transform(self, pipeline_details: DataTransformDetails):
        definition = pipeline_details.definition
        if not definition or not definition.expression:
            raise ResourceNotFoundException(
                f"Missing streaming 'definition.expression' for DataTransform '{pipeline_details.get_name()}'."
            )
        pipeline = self._get_pipeline_entity(pipeline_details)
        dataspace_name = self._get_data_transform_dataspace_name(pipeline_details)
        source_objects, column_lineage_map = self.parse_query(
            pipeline_name=pipeline_details.get_name(),
            query=definition.expression,
        )
        target_objects = definition.outputDataObjects or []
        source_tables, target_tables = self._process_objects(source_objects, target_objects, dataspace_name)
        for source_table in source_tables:
            for target_table in target_tables:
                col_lineage = self._create_column_lineage(
                    raw_column_lineage=column_lineage_map.get(source_table.name.root, []),
                    source_table=source_table,
                    target_table=target_table,
                )
                yield Either(  # pyright: ignore[reportCallIssue]
                    right=self._create_add_lineage_request(
                        from_entity=source_table,
                        to_entity=target_table,
                        lineage_details=LineageDetails(
                            pipeline=EntityReference(
                                id=pipeline.id,
                                type=ENTITY_REFERENCE_TYPE_MAP[Pipeline.__name__],
                            ),
                            source=LineageSource.PipelineLineage,
                            sqlQuery=SqlQuery(definition.expression),
                            columnsLineage=col_lineage,
                        ),
                    )
                )

    def _process_objects(self, source_objects, target_objects, dataspace_name):
        source_tables, target_tables = [], []
        for obj in source_objects:
            try:
                source_tables.append(
                    self._get_dc_object_table_entity(dc_obj_name=obj.raw_name, dataspace_name=dataspace_name)
                )
            except ResourceNotFoundException as exc:
                self.log_warning(str(exc))
        for obj in target_objects:
            try:
                target_tables.append(
                    self._get_dc_object_table_entity(dc_obj_name=obj.name, dataspace_name=dataspace_name)
                )
            except ResourceNotFoundException as exc:
                self.log_warning(str(exc))
        return source_tables, target_tables

    def _yield_data_transform_lineage(self, pipeline_details: DataTransformDetails):
        dispatch = {
            "BATCH": self._process_batch_data_transform,
            "STREAMING": self._process_streaming_data_transform,
        }
        process_fn = dispatch.get(pipeline_details.type or "")
        if process_fn:
            yield from process_fn(pipeline_details=pipeline_details)

    def get_column_lineage(self, from_entity: Table, to_entity: Table, field_mappings: list) -> list:
        result = []
        for mapping in field_mappings:
            from_col = mapping.get("sourceFieldDeveloperName", "")
            to_col = mapping.get("targetFieldDeveloperName", "")
            from_fqn = get_column_fqn(from_entity, from_col)
            to_fqn = get_column_fqn(to_entity, to_col)
            if from_fqn and to_fqn:
                result.append(
                    ColumnLineage(
                        fromColumns=[FullyQualifiedEntityName(root=from_fqn)],
                        toColumn=FullyQualifiedEntityName(root=to_fqn),
                    )
                )
        return result

    def get_dlo_dmo_lineage(self, dmo_table: Table, dataspace_name: str):
        dmo_name = dmo_table.name.root
        dmo_fqn = dmo_table.fullyQualifiedName.root if dmo_table.fullyQualifiedName else dmo_name
        dmo_mappings = get_dmo_mappings(
            client=self.client,
            dataspace_name=dataspace_name,
            dmo_name=dmo_name,
            log_warning=self.log_warning,
        )
        if not dmo_mappings:
            return
        for dmo_mapping in dmo_mappings.get("objectSourceTargetMaps", []):
            try:
                dlo_name = dmo_mapping.get("sourceEntityDeveloperName")
                edge_status = dmo_mapping.get("status", "")
                if not dlo_name:
                    self.log_warning(f"Skipping a DMO mapping of {dmo_fqn}: no source entity name.")
                    continue
                if edge_status != "ACTIVE":
                    self.log_warning(f"Lineage between DLO {dlo_name} and DMO {dmo_fqn} is not ACTIVE ({edge_status})")
                    continue
                dlo_table = self._get_dc_object_table_entity(dc_obj_name=dlo_name, dataspace_name=dataspace_name)
                col_lineages = self.get_column_lineage(dlo_table, dmo_table, dmo_mapping.get("fieldMappings", []))
                lineage_details = LineageDetails(source=LineageSource.PipelineLineage)
                if col_lineages:
                    lineage_details.columnsLineage = col_lineages
                yield Either(  # pyright: ignore[reportCallIssue]
                    right=self._create_add_lineage_request(
                        from_entity=dlo_table,
                        to_entity=dmo_table,
                        lineage_details=lineage_details,
                    )
                )
            except ResourceNotFoundException as exc:
                self.log_warning(msg=str(exc))

    def _yield_dlo_to_dmo_lineage(self):
        service_name = self._db_service_name
        params = {"service": service_name}
        for database in self.metadata.list_all_entities(entity=Database, params=params):
            database_fqn = f"{service_name}.{database.name.root}"
            schema_fqn = f"{database_fqn}.{Constant.DATA_MODEL_OBJECTS}"
            for dmo_table in self.metadata.list_all_entities(
                entity=Table,
                params={"database": database_fqn, "databaseSchema": schema_fqn},
            ):
                yield from self.get_dlo_dmo_lineage(dmo_table=dmo_table, dataspace_name=database.name.root)

    def yield_pipeline_lineage_details(
        self, pipeline_details: DataCloudPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """Dispatches to the correct lineage extractor per pipeline type."""
        try:
            dispatch = {
                CalculatedInsightDetails: self._yield_ci_lineage,
                DataTransformDetails: self._yield_data_transform_lineage,
                DataStreamDetails: self._yield_datastream_lineage,
            }
            yield_fn = dispatch.get(type(pipeline_details))
            if yield_fn:
                yield from yield_fn(pipeline_details)
        except ResourceNotFoundException as exc:
            self.log_warning(str(exc))
        except QueryParseException as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{pipeline_details.get_name()} Pipeline Lineage",
                    error=f"Error parsing SQL query for {pipeline_details.get_name()}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{pipeline_details.get_name()} Pipeline Lineage",
                    error=f"Unexpected error while yielding lineage: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_bulk_lineage_details(self) -> Iterable[Either[AddLineageRequest]]:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Yields DLO → DMO lineage for all dataspaces when includeBulkLineage is enabled."""
        if self.service_connection.includeBulkLineage:
            try:
                yield from self._yield_dlo_to_dmo_lineage()
            except Exception as exc:
                yield Either(  # pyright: ignore[reportCallIssue]
                    left=StackTraceError(
                        name="Bulk Pipeline Lineage",
                        error=f"Unexpected error while yielding bulk lineage: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_pipeline(self, pipeline_details: DataCloudPipelineDetails) -> Iterable[Either[CreatePipelineRequest]]:
        """Implemented in metadata ingestion."""
        return iter([])

    def yield_pipeline_status(
        self, pipeline_details: DataCloudPipelineDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """Implemented in operational ingestion."""
        return iter([])

    def yield_tag(
        self, pipeline_details: DataCloudPipelineDetails, **__
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Implemented in metadata ingestion."""
        return iter([])

    def yield_pipeline_usage(self, pipeline_details: Any) -> Iterable[Either[PipelineUsage]]:
        """Not implemented."""
        return iter([])
