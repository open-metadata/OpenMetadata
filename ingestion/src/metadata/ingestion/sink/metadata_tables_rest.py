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

from pydantic import ValidationError

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseEntityRequest
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.client import REST, APIError, MetadataServerConfig

logger = logging.getLogger(__name__)


class MetadataTablesSinkConfig(ConfigModel):
    api_endpoint: str = None


class MetadataTablesRestSink(Sink):
    config: MetadataTablesSinkConfig
    status: SinkStatus

    def __init__(self, ctx: WorkflowContext, config: MetadataTablesSinkConfig, metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SinkStatus()
        self.wrote_something = False
        self.rest = REST(self.metadata_config)

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = MetadataTablesSinkConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def write_record(self, table_and_db: OMetaDatabaseAndTable) -> None:
        try:
            db_request = CreateDatabaseEntityRequest(name=table_and_db.database.name,
                                                     description=table_and_db.database.description,
                                                     service=EntityReference(id=table_and_db.database.service.id,
                                                                             type="databaseService"))
            db = self.rest.create_database(db_request)
            table_request = CreateTableEntityRequest(name=table_and_db.table.name,
                                                     columns=table_and_db.table.columns,
                                                     description=table_and_db.table.description,
                                                     database=db.id)
            created_table = self.rest.create_or_update_table(table_request)
            logger.info(
                'Successfully ingested {}.{}'.format(table_and_db.database.name.__root__, created_table.name.__root__))
            self.status.records_written(
                '{}.{}'.format(table_and_db.database.name.__root__, created_table.name.__root__))
        except (APIError, ValidationError) as err:
            logger.error(
                "Failed to ingest table {} in database {} ".format(table_and_db.table.name, table_and_db.database.name))
            logger.error(err)
            self.status.failures(table_and_db.table.name)

    def get_status(self):
        return self.status

    def close(self):
        pass
