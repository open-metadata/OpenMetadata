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
from collections.abc import Iterable

from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    Constraint,
    ConstraintType,
    DataType,
    TableConstraint,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.dynamoDBConnection import (
    DynamoDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.ingestion.source.database.common_nosql_source import (
    SAMPLE_SIZE,
    CommonNoSQLSource,
    TableNameAndType,
)
from metadata.ingestion.source.database.dynamodb.models import (
    TableKeyMetadata,
    TableResponse,
)
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache

logger = ingestion_logger()

# A key schema is a handful of small dicts, but the cache is bounded so that a catalog
# with thousands of tables cannot grow it without limit.
KEY_METADATA_CACHE_SIZE = 128

# DynamoDB only accepts scalar attributes as keys: string, number and binary.
DYNAMODB_KEY_TYPE_MAP = {
    "S": DataType.STRING,
    "N": DataType.NUMBER,
    "B": DataType.BYTES,
}


class DynamodbSource(CommonNoSQLSource):
    """
    Implements the necessary methods to extract
    Database metadata from DynamoDB Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.dynamodb = self.connection_obj
        self._key_metadata_cache: LRUCache[TableKeyMetadata | None] = LRUCache(capacity=KEY_METADATA_CACHE_SIZE)

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DynamoDBConnection = config.serviceConnection.root.config
        if not isinstance(connection, DynamoDBConnection):
            raise InvalidSourceException(f"Expected DynamoDBConnection, but got {connection}")
        return cls(config, metadata)

    def get_schema_name_list(self) -> list[str]:
        """
        Method to get list of schema names available within NoSQL db
        need to be overridden by sources
        """
        return [DEFAULT_DATABASE]

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
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

    def get_table_columns_dict(self, schema_name: str, table_name: str) -> list[dict] | dict:
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
            return attributes  # noqa: TRY300
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to read DynamoDB attributes for [{table_name}]: {err}")
        return attributes

    def _get_key_metadata(self, table_name: str) -> TableKeyMetadata | None:
        """
        Read the declared key schema of a table. Unlike the column sampling done in
        `get_table_columns_dict`, DescribeTable reads no table data. The result is memoised
        because `yield_table` asks for both the columns and the constraints of the same table.
        """
        if table_name in self._key_metadata_cache:
            return self._key_metadata_cache.get(table_name)

        key_metadata = None
        try:
            table = self.dynamodb.Table(table_name)
            key_metadata = TableKeyMetadata(
                KeySchema=table.key_schema,
                AttributeDefinitions=table.attribute_definitions,
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to describe DynamoDB table [%s]: %s", table_name, err)

        self._key_metadata_cache.put(table_name, key_metadata)
        return key_metadata

    def get_table_constraints(
        self,
        db_name: str,
        schema_name: str,
        table_name: str,
    ) -> list[TableConstraint] | None:
        """
        Map the DynamoDB key schema onto table constraints. The sort key is reported on its own
        as well, since the primary key alone does not say which of its columns is the sort key.
        """
        key_metadata = self._get_key_metadata(table_name)
        if key_metadata is None or not key_metadata.primary_key:
            return None

        constraints = [
            TableConstraint(
                constraintType=ConstraintType.PRIMARY_KEY,
                columns=[truncate_column_name(key) for key in key_metadata.primary_key],
            )
        ]
        if key_metadata.sort_key:
            constraints.append(
                TableConstraint(
                    constraintType=ConstraintType.SORT_KEY,
                    columns=[truncate_column_name(key_metadata.sort_key)],
                )
            )
        return constraints

    def get_table_columns(self, schema_name: str, table_name: str) -> list[Column]:
        """
        Sampled columns, reconciled against the declared key schema.
        """
        columns = super().get_table_columns(schema_name, table_name)
        key_metadata = self._get_key_metadata(table_name)
        if key_metadata is None:
            return columns
        return self._apply_key_metadata(columns, key_metadata)

    @staticmethod
    def _apply_key_metadata(columns: list[Column], key_metadata: TableKeyMetadata) -> list[Column]:
        """
        Key attributes are typed from the table definition rather than from the sampled values,
        and flagged as primary key. Keys missing from the sample - which is every key of an empty
        table - are added, because the server rejects a constraint over a column the table lacks.
        """
        columns_by_name = {model_str(column.name): column for column in columns}
        unsampled_keys = []
        for key in key_metadata.primary_key:
            column_name = truncate_column_name(key)
            attribute_type = key_metadata.attribute_type(key)
            data_type = DYNAMODB_KEY_TYPE_MAP.get(attribute_type) if attribute_type else None
            column = columns_by_name.get(column_name)
            if column is None:
                data_type = data_type or DataType.UNKNOWN
                unsampled_keys.append(
                    Column(
                        name=ColumnName(column_name),
                        displayName=key,
                        dataType=data_type,
                        dataTypeDisplay=data_type.value,
                        constraint=Constraint.PRIMARY_KEY,
                    )
                )
                continue
            column.constraint = Constraint.PRIMARY_KEY
            if data_type:
                column.dataType = data_type
                column.dataTypeDisplay = data_type.value
        return unsampled_keys + columns

    def get_source_url(
        self,
        database_name: str | None = None,
        schema_name: str | None = None,
        table_name: str | None = None,
        table_type: TableType | None = None,
    ) -> str | None:
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
