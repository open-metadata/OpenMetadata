#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import logging
import uuid
from dataclasses import field
from typing import Iterable, Optional, List

from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from simple_salesforce import Salesforce

from .sql_source import SQLConnectionConfig
from ..ometa.openmetadata_rest import MetadataServerConfig
from ...generated.schema.entity.data.database import Database
from ...generated.schema.entity.data.table import Column, ColumnConstraint, Table
from ...generated.schema.type.entityReference import EntityReference
from metadata.utils.helpers import get_database_service_or_create

logger: logging.Logger = logging.getLogger(__name__)


class SalesforceSourceStatus(SourceStatus):
    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    filtered: List[str] = field(default_factory=list)

    def scanned(self, table_name: str) -> None:
        self.success.append(table_name)
        logger.info('Table Scanned: {}'.format(table_name))

    def filter(self, table_name: str, err: str, dataset_name: str = None, col_type: str = None) -> None:
        self.filtered.append(table_name)
        logger.warning("Dropped Table {} due to {}".format(table_name, err))


class SalesforceConfig(SQLConnectionConfig):
    username: str
    password: str
    security_token: str
    host_port: Optional[str]
    scheme: str
    service_type = "MySQL"
    query: str
    table_name: str

    def get_connection_url(self):
        return super().get_connection_url()


class SalesforceSource(Source):
    def __init__(self, config: SalesforceConfig, metadata_config: MetadataServerConfig, ctx):
        self.config = config
        self.service = get_database_service_or_create(config, metadata_config)
        self.status = SalesforceSourceStatus()
        super().__init__(ctx)

    @classmethod
    def create(cls, config: dict, metadata_config: dict, ctx: WorkflowContext):
        config = SalesforceConfig.parse_obj(config)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config)
        return cls(config, metadata_config, ctx)

    def get_status(self) -> SourceStatus:
        return self.status

    def prepare(self):
        pass

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        yield from self.salesforce_client()

    def salesforce_client(self) -> Iterable[OMetaDatabaseAndTable]:
        sf = Salesforce(username=self.config.username, password=self.config.password,
                        security_token=self.config.security_token)
        row_order = 1
        table_columns = []
        md = sf.restful("sobjects/{}/describe/".format(self.config.table_name), params=None)
        for column in md['fields']:
            table_columns.append(Column(name=column['name'],
                                        description=column['label'],
                                        columnDataType=self.column_type(column['type'].upper()),
                                        columnConstraint=ColumnConstraint.UNIQUE if column['unique'] else None,
                                        ordinalPosition=row_order))
            row_order += 1
        description = None
        table_entity = Table(id=uuid.uuid4(),
                             name=self.config.table_name,
                             tableType='Regular',
                             description=description if description is not None else ' ',
                             columns=table_columns)

        database_entity = Database(name=self.config.scheme,
                                   service=EntityReference(id=self.service.id, type=self.config.service_type))

        table_and_db = OMetaDatabaseAndTable(table=table_entity, database=database_entity)
        yield table_and_db

    def column_type(self, column_type: str):
        if column_type in ["ID", "PHONE", "CURRENCY"]:
            type = "INT"
        elif column_type in ["REFERENCE", "PICKLIST", "TEXTAREA", "ADDRESS", "URL"]:
            type = "VARCHAR"
        else:
            type = column_type
        return type

