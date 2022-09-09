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

import uuid
from dataclasses import dataclass, field
from typing import Iterable, List

from pydantic import ValidationError
from simple_salesforce import Salesforce

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    Table,
    TableData,
)
from metadata.generated.schema.entity.services.connections.database.salesforceConnection import (
    SalesforceConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@dataclass
class SalesforceSourceStatus(SourceStatus):
    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    filtered: List[str] = field(default_factory=list)

    def scanned(self, table_name: str) -> None:
        self.success.append(table_name)
        logger.info("Table Scanned: {}".format(table_name))

    def filter(
        self, table_name: str, err: str, dataset_name: str = None, col_type: str = None
    ) -> None:
        self.filtered.append(table_name)
        logger.warning("Filtered Table {} due to {}".format(table_name, err))


class SalesforceSource(Source[OMetaDatabaseAndTable]):
    def __init__(self, config, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.config = config
        self.metadata = OpenMetadata(metadata_config)
        self.service = self.metadata.get_service_or_create(
            entity=DatabaseService, config=config
        )
        self.service_connection = self.config.serviceConnection.__root__.config
        self.status = SalesforceSourceStatus()
        self.salesforce_connection = get_connection(self.service_connection)
        self.sf = self.salesforce_connection.client

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SalesforceConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SalesforceConnection):
            raise InvalidSourceException(
                f"Expected SalesforceConnection, but got {connection}"
            )

        return cls(config, metadata_config)

    def column_type(self, column_type: str):
        if column_type in {"ID", "PHONE", "CURRENCY"}:
            return "INT"
        return "VARCHAR"

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        yield from self.salesforce_client()

    def salesforce_client(self) -> Iterable[OMetaDatabaseAndTable]:
        try:
            object_names = []
            if self.service_connection.sobjectName:
                object_names.append(self.service_connection.sobjectName)
            else:
                for obj in self.sf.describe()["sobjects"]:
                    table_name = obj.get("name")
                    if not table_name:
                        continue
                    if filter_by_table(
                        self.config.sourceConfig.config.tableFilterPattern, table_name
                    ):
                        self.status.filter(
                            "{}".format(table_name),
                            "Table pattern not allowed",
                        )
                        continue
                    object_names.append(table_name)
            for object_name in object_names:
                md = self.sf.restful(
                    f"sobjects/{object_name}/describe/",
                    params=None,
                )
                row_order = 1
                table_columns = []
                for column in md["fields"]:
                    col_constraint = None
                    if column["nillable"]:
                        col_constraint = Constraint.NULL
                    elif not column["nillable"]:
                        col_constraint = Constraint.NOT_NULL
                    if column["unique"]:
                        col_constraint = Constraint.UNIQUE

                    table_columns.append(
                        Column(
                            name=column["name"],
                            description=column["label"],
                            dataType=self.column_type(column["type"].upper()),
                            constraint=col_constraint,
                            ordinalPosition=row_order,
                            dataLength=column["length"],
                        )
                    )
                    row_order += 1
                logger.info("Successfully Ingested the sample data")
                table_entity = Table(
                    id=uuid.uuid4(),
                    name=object_name,
                    tableType="Regular",
                    description=" ",
                    columns=table_columns,
                )
                self.status.scanned(f"{self.service_connection.scheme}.{object_name}")

                database_entity = Database(
                    id=uuid.uuid4(),
                    name="default",
                    service=EntityReference(id=self.service.id, type="databaseService"),
                )
                schema_entity = DatabaseSchema(
                    id=uuid.uuid4(),
                    name=self.service_connection.scheme.name,
                    database=EntityReference(
                        id=database_entity.id, type="databaseSchema"
                    ),
                    service=EntityReference(id=self.service.id, type="databaseService"),
                )
                table_and_db = OMetaDatabaseAndTable(
                    table=table_entity,
                    database=database_entity,
                    database_schema=schema_entity,
                )

                yield table_and_db

        except ValidationError as err:
            logger.error(err)
            self.status.failure(
                "{}".format(self.service_connection.sobjectName),
                err,
            )

    def prepare(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    def test_connection(self) -> None:
        pass
