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
from typing import Iterable, List, Optional

from pydantic import SecretStr, ValidationError
from simple_salesforce import Salesforce

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    Table,
    TableData,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLConnectionConfig
from metadata.utils.helpers import get_database_service_or_create

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


class SalesforceConfig(SQLConnectionConfig):
    username: str
    password: SecretStr
    security_token: str
    host_port: Optional[str]
    scheme: str
    service_type = "MySQL"
    sobject_name: str

    def get_connection_url(self):
        return super().get_connection_url()


class SalesforceSource(Source[OMetaDatabaseAndTable]):
    def __init__(
        self, config: SalesforceConfig, metadata_config: MetadataServerConfig, ctx
    ):
        super().__init__(ctx)
        self.config = config
        self.service = get_database_service_or_create(config, metadata_config)
        self.status = SalesforceSourceStatus()
        self.sf = Salesforce(
            username=self.config.username,
            password=self.config.password.get_secret_value(),
            security_token=self.config.security_token,
        )

    @classmethod
    def create(cls, config: dict, metadata_config: dict, ctx: WorkflowContext):
        config = SalesforceConfig.parse_obj(config)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config)
        return cls(config, metadata_config, ctx)

    def column_type(self, column_type: str):
        if column_type in ["ID", "PHONE", "CURRENCY"]:
            type = "INT"
        elif column_type in ["REFERENCE", "PICKLIST", "TEXTAREA", "ADDRESS", "URL"]:
            type = "VARCHAR"
        else:
            type = column_type
        return type

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        yield from self.salesforce_client()

    def fetch_sample_data(self, sobject_name):
        md = self.sf.restful("sobjects/{}/describe/".format(sobject_name), params=None)
        columns = []
        rows = []
        for column in md["fields"]:
            columns.append(column["name"])
        query = "select {} from {}".format(
            str(columns)[1:-1].replace("'", ""), sobject_name
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
                "sobjects/{}/describe/".format(self.config.sobject_name), params=None
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
                        columnDataType=self.column_type(column["type"].upper()),
                        columnConstraint=col_constraint,
                        ordinalPosition=row_order,
                    )
                )
                row_order += 1
            table_data = self.fetch_sample_data(self.config.sobject_name)
            logger.info("Successfully Ingested the sample data")
            table_entity = Table(
                id=uuid.uuid4(),
                name=self.config.sobject_name,
                tableType="Regular",
                description=" ",
                columns=table_columns,
                sampleData=table_data,
            )
            self.status.scanned(f"{self.config.scheme}.{self.config.sobject_name}")
            database_entity = Database(
                name=self.config.scheme,
                service=EntityReference(
                    id=self.service.id, type=self.config.service_type
                ),
            )
            table_and_db = OMetaDatabaseAndTable(
                table=table_entity, database=database_entity
            )
            yield table_and_db
        except ValidationError as err:
            logger.error(err)
            self.status.failure("{}".format(self.config.sobject_name), err)

    def prepare(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass
