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

import logging
import uuid
from dataclasses import dataclass, field
from typing import Iterable, List

from pydantic import SecretStr, ValidationError
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

logger: logging.Logger = logging.getLogger(__name__)


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
        logger.warning("Dropped Table {} due to {}".format(table_name, err))


class SalesforceSource(Source[OMetaDatabaseAndTable]):
    def __init__(self, config, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.config = config
        self.metadata = OpenMetadata(metadata_config)
        self.service = self.metadata.get_service_or_create(
            entity=DatabaseService, config=config
        )
        self.status = SalesforceSourceStatus()
        self.sf = Salesforce(
            username=self.config.serviceConnection.__root__.config.username,
            password=self.config.serviceConnection.__root__.config.password.get_secret_value(),
            security_token=self.config.serviceConnection.__root__.config.securityToken,
        )

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
        if column_type in {
            "REFERENCE",
            "PICKLIST",
            "TEXTAREA",
            "ADDRESS",
            "URL",
            "EMAIL",
        }:
            return "VARCHAR"

        return column_type

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        yield from self.salesforce_client()

    def fetch_sample_data(self, sobjectName):
        md = self.sf.restful("sobjects/{}/describe/".format(sobjectName), params=None)
        columns = []
        rows = []
        for column in md["fields"]:
            columns.append(column["name"])
        query = "select {} from {}".format(
            str(columns)[1:-1].replace("'", ""), sobjectName
        )
        logger.info("Ingesting data using {}".format(query))
        resp = self.sf.query(query)
        for record in resp["records"]:
            row = []
            for column in columns:
                row.append(record[f"{column}"])
            rows.append(row)
        return TableData(columns=columns, rows=rows)

    def salesforce_client(self) -> Iterable[OMetaDatabaseAndTable]:
        try:

            row_order = 1
            table_columns = []
            md = self.sf.restful(
                "sobjects/{}/describe/".format(
                    self.config.serviceConnection.__root__.config.sobjectName
                ),
                params=None,
            )

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
            table_data = self.fetch_sample_data(
                self.config.serviceConnection.__root__.config.sobjectName
            )
            logger.info("Successfully Ingested the sample data")
            table_entity = Table(
                id=uuid.uuid4(),
                name=self.config.serviceConnection.__root__.config.sobjectName,
                tableType="Regular",
                description=" ",
                columns=table_columns,
                sampleData=table_data,
            )
            self.status.scanned(
                f"{self.config.serviceConnection.__root__.config.scheme}.{self.config.serviceConnection.__root__.config.sobjectName}"
            )

            database_entity = Database(
                id=uuid.uuid4(),
                name="default",
                service=EntityReference(id=self.service.id, type="databaseService"),
            )
            schema_entity = DatabaseSchema(
                id=uuid.uuid4(),
                name=self.config.serviceConnection.__root__.config.scheme.name,
                database=EntityReference(id=database_entity.id, type="databaseSchema"),
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
                "{}".format(self.config.serviceConnection.__root__.config.sobjectName),
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
