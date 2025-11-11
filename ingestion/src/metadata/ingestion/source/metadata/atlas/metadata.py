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
Atlas source to extract metadata
"""

import traceback
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.atlasConnection import (
    AtlasConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either, Entity, StackTraceError
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, test_connection_common
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.metadata.atlas.client import AtlasClient
from metadata.utils import fqn
from metadata.utils.helpers import get_database_name_for_lineage, retry_with_docker_host
from metadata.utils.logger import ingestion_logger
from metadata.utils.metadata_service_helper import SERVICE_TYPE_MAPPER
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

ATLAS_TAG_CATEGORY = "AtlasMetadata"
ATLAS_TABLE_TAG = "atlas_table"


@dataclass
class AtlasSource(Source):
    """Atlas source class"""

    config: WorkflowSource
    atlas_client: AtlasClient
    tables: Dict[str, Any]
    topics: Dict[str, Any]

    @retry_with_docker_host()
    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config

        self.atlas_client = get_connection(self.service_connection)
        self.connection_obj = self.atlas_client
        self.tables: Dict[str, Any] = {}
        self.topics: Dict[str, Any] = {}

        self.service = None
        self.message_service = None
        self.entity_types = {
            "Table": {
                self.service_connection.entity_type: {"db": "db", "column": "columns"}
            },
            "Topic": {"Topic": {"schema": "schema"}},
        }
        self.test_connection()

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: AtlasConnection = config.serviceConnection.root.config
        if not isinstance(connection, AtlasConnection):
            raise InvalidSourceException(
                f"Expected AtlasConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """Not required to implement"""

    def _iter(self, *_, **__) -> Iterable[Either[Entity]]:
        for service in self.service_connection.databaseServiceName or []:
            check_service = self.metadata.get_by_name(
                entity=DatabaseService, fqn=service
            )
            if check_service:
                for key in self.entity_types["Table"]:
                    self.service = check_service
                    self.tables[key] = self.atlas_client.list_entities()
                    if self.tables.get(key, None):
                        for key in self.tables:
                            yield from self._parse_table_entity(key, self.tables[key])
            else:
                yield Either(
                    left=StackTraceError(
                        name=service,
                        error=f"Cannot find service for {service} - type DatabaseService",
                        stackTrace=traceback.format_exc(),
                    )
                )

        for service in self.service_connection.messagingServiceName or []:
            check_service = self.metadata.get_by_name(
                entity=MessagingService, fqn=service
            )
            if check_service:
                for key in self.entity_types["Topic"]:
                    self.message_service = check_service
                    self.topics[key] = self.atlas_client.list_entities()
                    if self.topics.get(key, None):
                        for topic in self.topics:
                            yield from self._parse_topic_entity(topic)
            else:
                yield Either(
                    left=StackTraceError(
                        name=service,
                        error=f"Cannot find service for {service} - type MessagingService",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def close(self):
        """Not required to implement"""

    def _parse_topic_entity(self, name):
        for key in self.topics:
            topic_entity = self.atlas_client.get_entity(self.topics[key])
            tpc_entities = topic_entity["entities"]
            for tpc_entity in tpc_entities:
                try:
                    tpc_attrs = tpc_entity["attributes"]
                    topic_name = tpc_attrs["name"]

                    topic_fqn = fqn.build(
                        self.metadata,
                        entity_type=Topic,
                        service_name=self.message_service.id,
                        topic_name=topic_name,
                    )

                    topic_object = self.metadata.get_by_name(
                        entity=Topic, fqn=topic_fqn
                    )

                    if tpc_attrs.get("description") and topic_object:
                        self.metadata.patch_description(
                            entity=Topic,
                            source=topic_object,
                            description=tpc_attrs["description"],
                            force=True,
                        )

                    yield from self.ingest_lineage(tpc_entity["guid"], name)

                except Exception as exc:
                    yield Either(
                        left=StackTraceError(
                            name="Topic",
                            error=f"Failed to parse topi entry [{topic_entity}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def _parse_table_entity(self, name, entity):  # pylint: disable=too-many-locals
        for table in entity:
            table_entity = self.atlas_client.get_entity(table)
            tbl_entities = table_entity["entities"]
            db_entity = None
            for tbl_entity in tbl_entities:
                try:
                    tbl_attrs = tbl_entity["attributes"]
                    db_entity = tbl_entity["relationshipAttributes"][
                        self.entity_types["Table"][name]["db"]
                    ]
                    database_name = get_database_name_for_lineage(
                        db_service_entity=self.service,
                        default_db_name=db_entity["displayText"],
                    )

                    database_fqn = fqn.build(
                        self.metadata,
                        entity_type=Database,
                        service_name=self.service.name.root,
                        database_name=database_name,
                    )
                    database_object = self.metadata.get_by_name(
                        entity=Database, fqn=database_fqn
                    )
                    if db_entity.get("description", None) and database_object:
                        self.metadata.patch_description(
                            entity=Database,
                            source=database_object,
                            description=db_entity["description"],
                            force=True,
                        )

                    database_schema_fqn = fqn.build(
                        self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.service.name.root,
                        database_name=database_name,
                        schema_name=db_entity["displayText"],
                    )
                    database_schema_object = self.metadata.get_by_name(
                        entity=DatabaseSchema, fqn=database_schema_fqn
                    )

                    if db_entity.get("description", None) and database_schema_object:
                        self.metadata.patch_description(
                            entity=DatabaseSchema,
                            source=database_schema_object,
                            description=db_entity["description"],
                            force=True,
                        )

                    yield from get_ometa_tag_and_classification(
                        tags=[ATLAS_TABLE_TAG],
                        classification_name=ATLAS_TAG_CATEGORY,
                        tag_description="Atlas Cluster Tag",
                        classification_description="Tags associated with atlas entities",
                    )

                    table_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=Table,
                        service_name=self.service.name.root,
                        database_name=database_name,
                        schema_name=db_entity["displayText"],
                        table_name=tbl_attrs["name"],
                    )

                    table_object = self.metadata.get_by_name(
                        entity=Table, fqn=table_fqn
                    )

                    if table_object:
                        if tbl_attrs.get("description", None):
                            self.metadata.patch_description(
                                source=table_object,
                                entity=Table,
                                description=tbl_attrs["description"],
                                force=True,
                            )
                        yield from self.apply_table_tags(
                            table_object=table_object, table_entity=tbl_entity
                        )

                    yield from self.ingest_lineage(tbl_entity["guid"], name)

                except Exception as exc:
                    yield Either(
                        left=StackTraceError(
                            name="Database",
                            error=f"Failed to parse for database : {db_entity} - table {table}: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def apply_table_tags(
        self, table_object: Table, table_entity: dict
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        apply default atlas table tag
        """
        tag_labels = []
        table_tags = get_tag_labels(
            metadata=self.metadata,
            tags=[ATLAS_TABLE_TAG],
            classification_name=ATLAS_TAG_CATEGORY,
        )
        if table_tags:
            tag_labels.extend(table_tags)

        # apply classification tags
        for tag in table_entity.get("classifications", []):
            if tag and tag.get("typeName"):
                yield from get_ometa_tag_and_classification(
                    tags=[tag.get("typeName", ATLAS_TABLE_TAG)],
                    classification_name=ATLAS_TAG_CATEGORY,
                    tag_description="Atlas Cluster Tag",
                    classification_description="Tags associated with atlas entities",
                )
                classification_tags = get_tag_labels(
                    metadata=self.metadata,
                    tags=[tag.get("typeName", ATLAS_TABLE_TAG)],
                    classification_name=ATLAS_TAG_CATEGORY,
                )
                if classification_tags:
                    tag_labels.extend(classification_tags)

        self.metadata.patch_tags(
            entity=Table,
            source=table_object,
            tag_labels=tag_labels,
        )

    def _parse_table_columns(self, table_response, tbl_entity, name) -> List[Column]:
        om_cols = []
        col_entities = tbl_entity["relationshipAttributes"][
            self.entity_types["Table"][name]["column"]
        ]
        referred_entities = table_response["referredEntities"]
        ordinal_pos = 1
        for col in col_entities:
            try:
                col_guid = col["guid"]
                col_ref_entity = referred_entities[col_guid]
                column = col_ref_entity["attributes"]
                om_column = Column(
                    name=column["name"],
                    description=column.get("comment", None),
                    dataType=ColumnTypeParser.get_column_type(
                        column["dataType"].upper()
                    ),
                    dataTypeDisplay=column["dataType"],
                    dataLength=1,
                    ordinalPosition=ordinal_pos,
                )
                om_cols.append(om_column)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error parsing column [{col}]: {exc}")
                continue
        return om_cols

    def ingest_lineage(self, source_guid, name) -> Iterable[Either[AddLineageRequest]]:
        """Fetch and ingest lineage"""
        try:
            lineage_response = self.atlas_client.get_lineage(source_guid)
            lineage_relations = lineage_response["relations"]
            tbl_entity = self.atlas_client.get_entity(
                lineage_response["baseEntityGuid"]
            )
            for key in tbl_entity["referredEntities"].keys():
                if not tbl_entity["entities"][0]["relationshipAttributes"].get(
                    self.entity_types["Table"][name]["db"]
                ):
                    continue
                db_entity = tbl_entity["entities"][0]["relationshipAttributes"][
                    self.entity_types["Table"][name]["db"]
                ]
                if not tbl_entity["referredEntities"].get(key):
                    continue
                table_name = tbl_entity["referredEntities"][key][
                    "relationshipAttributes"
                ]["table"]["displayText"]
                from_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.service.name.root,
                    database_name=get_database_name_for_lineage(
                        self.service, db_entity["displayText"]
                    ),
                    schema_name=db_entity["displayText"],
                    table_name=table_name,
                )
                from_entity_ref = self.get_lineage_entity_ref(from_fqn, "table")
                for edge in lineage_relations:
                    if (
                        lineage_response["guidEntityMap"][edge["toEntityId"]][
                            "typeName"
                        ]
                        == "processor"
                    ):
                        continue

                    tbl_entity = self.atlas_client.get_entity(edge["toEntityId"])
                    for key in tbl_entity["referredEntities"]:
                        db_entity = tbl_entity["entities"][0]["relationshipAttributes"][
                            self.entity_types["Table"][name]["db"]
                        ]

                        table_name = tbl_entity["referredEntities"][key][
                            "relationshipAttributes"
                        ]["table"]["displayText"]
                        to_fqn = fqn.build(
                            self.metadata,
                            entity_type=Table,
                            service_name=self.service.name.root,
                            database_name=get_database_name_for_lineage(
                                self.service, db_entity["displayText"]
                            ),
                            schema_name=db_entity["displayText"],
                            table_name=table_name,
                        )
                        to_entity_ref = self.get_lineage_entity_ref(to_fqn, "table")
                        yield from self.yield_lineage(from_entity_ref, to_entity_ref)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(f"failed to parse lineage due to {exc}")
            yield Either(
                left=StackTraceError(
                    name="Lineage",
                    error=f"failed to parse lineage due to {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_database_service(self) -> Optional[DatabaseService]:
        service = self.metadata.create_or_update(
            CreateDatabaseServiceRequest(
                name=SERVICE_TYPE_MAPPER.get("hive")["service_name"],
                displayName=f"{self.config.serviceName}_database",
                serviceType=SERVICE_TYPE_MAPPER.get("hive")["service_name"],
                connection=SERVICE_TYPE_MAPPER["hive"]["connection"],
            )
        )
        if service is not None:
            return service
        logger.error("Failed to create a service with name detlaLake")
        return None

    def get_message_service(self) -> Optional[MessagingService]:
        service = self.metadata.create_or_update(
            CreateMessagingServiceRequest(
                name=SERVICE_TYPE_MAPPER.get("kafka")["service_name"],
                displayName=f"{self.config.serviceName}_messaging",
                serviceType=SERVICE_TYPE_MAPPER.get("kafka")["service_name"],
                connection=SERVICE_TYPE_MAPPER.get("kafka")["connection"],
            )
        )
        if service is not None:
            return service
        logger.error("Failed to create a service with name kafka")
        return None

    def yield_lineage(
        self, from_entity_ref, to_entity_ref
    ) -> Iterable[Either[AddLineageRequest]]:
        if from_entity_ref and to_entity_ref and from_entity_ref != to_entity_ref:
            lineage = AddLineageRequest(
                edge=EntitiesEdge(fromEntity=from_entity_ref, toEntity=to_entity_ref)
            )
            yield Either(right=lineage)

    def get_lineage_entity_ref(
        self, to_fqn: str, entity_type: str
    ) -> Optional[EntityReference]:
        if entity_type == "table":
            table: Table = self.metadata.get_by_name(entity=Table, fqn=to_fqn)
            if table:
                return EntityReference(id=table.id.root, type="table")
        if entity_type == "pipeline":
            pipeline: Pipeline = self.metadata.get_by_name(entity=Pipeline, fqn=to_fqn)
            if pipeline:
                return EntityReference(id=pipeline.id.root, type="pipeline")
        return None

    def test_connection(self) -> None:
        test_connection_common(
            self.metadata, self.connection_obj, self.service_connection
        )
