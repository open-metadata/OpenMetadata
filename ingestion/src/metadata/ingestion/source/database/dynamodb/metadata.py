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
Dynamo source methods.
"""

import traceback
from typing import Dict, Iterable, List, Optional, Union

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.dynamoDBConnection import (
    DynamoDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_nosql_source import (
    SAMPLE_SIZE,
    CommonNoSQLSource,
    TableNameAndType,
)
from metadata.ingestion.source.database.dynamodb.models import TableResponse
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DynamodbSource(CommonNoSQLSource):
    """
    Implements the necessary methods to extract
    Database metadata from DynamoDB Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.dynamodb = self.connection_obj

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DynamoDBConnection = config.serviceConnection.root.config
        if not isinstance(connection, DynamoDBConnection):
            raise InvalidSourceException(
                f"Expected DynamoDBConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_schema_name_list(self) -> List[str]:
        """
        Method to get list of schema names available within NoSQL db
        need to be overridden by sources
        """
        return [DEFAULT_DATABASE]

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Method to get list of table names available within schema db
        need to be overridden by sources
        """
        try:
            tables = self.dynamodb.tables.all()
            return [TableNameAndType(name=table.name) for table in tables]
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to list DynamoDB table names: {err}")
        return []

    def get_table_columns_dict(
        self, schema_name: str, table_name: str
    ) -> Union[List[Dict], Dict]:
        """
        Method to get actual data available within table
        need to be overridden by sources
        """
        attributes = []
        try:
            scan_kwargs = {}
            done = False
            start_key = None
            table = self.dynamodb.Table(table_name)
            while not done:
                if start_key:
                    scan_kwargs["ExclusiveStartKey"] = start_key
                response = TableResponse.model_validate(table.scan(**scan_kwargs))
                attributes.extend(response.Items)
                start_key = response.LastEvaluatedKey
                done = start_key is None or len(attributes) >= SAMPLE_SIZE
            return attributes
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to read DynamoDB attributes for [{table_name}]: {err}"
            )
        return attributes

    def get_source_url(
        self,
        database_name: Optional[str] = None,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
        table_type: Optional[TableType] = None,
    ) -> Optional[str]:
        """
        Method to get the source url for dynamodb
        """
        try:
            if table_name:
                return (
                    f"https://{self.service_connection.awsConfig.awsRegion}."
                    f"console.aws.amazon.com/dynamodbv2/home?region="
                    f"{self.service_connection.awsConfig.awsRegion}#table?name={table_name}"
                )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get source url: {exc}")
        return None
