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
        self._key_metadata_cache: LRUCache[Optional[TableKeyMetadata]] = LRUCache(
            capacity=KEY_METADATA_CACHE_SIZE
        )

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

    def _get_key_metadata(self, table_name: str) -> Optional[TableKeyMetadata]:
        """
        Read the declared key schema of a table. Unlike the column sampling done in
        `get_table_columns_dict`, DescribeTable reads no table data. The result is memoised
        because `yield_table` asks for both the columns and the constraints of the same table.
        """
        try:
            # Read once rather than checking for membership first: the topology runs stages in
            # worker threads and an eviction between the two calls would raise here. A cached
            # None means we already tried and failed, so it must not trigger another describe.
            return self._key_metadata_cache.get(table_name)
        except KeyError:
            pass

        key_metadata = None
        try:
            table = self.dynamodb.Table(table_name)
            key_metadata = TableKeyMetadata(
                KeySchema=table.key_schema,
                AttributeDefinitions=table.attribute_definitions,
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                "Failed to describe DynamoDB table [%s]: %s", table_name, err
            )

        self._key_metadata_cache.put(table_name, key_metadata)
        return key_metadata

    def get_table_constraints(
        self,
        db_name: str,
        schema_name: str,
        table_name: str,
    ) -> Optional[List[TableConstraint]]:
        """
        Map the DynamoDB key schema onto table constraints. The sort key is reported on its own
        as well, since the primary key alone does not say which of its columns is the sort key.
        """
        key_metadata = self._get_key_metadata(table_name)
        if key_metadata is None or not key_metadata.primary_key:
            return None

        constraints = []
        # A partition key on its own is carried by the column instead: DatabaseUtil.validateConstraints
        # rejects a table constraint that repeats a primary key already tagged on a column. Same split
        # the SQL sources make in SqlColumnHandlerMixin.
        if len(key_metadata.primary_key) > 1:
            constraints.append(
                TableConstraint(
                    constraintType=ConstraintType.PRIMARY_KEY,
                    columns=[
                        truncate_column_name(key) for key in key_metadata.primary_key
                    ],
                )
            )
        if key_metadata.sort_key:
            constraints.append(
                TableConstraint(
                    constraintType=ConstraintType.SORT_KEY,
                    columns=[truncate_column_name(key_metadata.sort_key)],
                )
            )
        return constraints or None

    def get_table_columns(self, schema_name: str, table_name: str) -> List[Column]:
        """
        Sampled columns, reconciled against the declared key schema.
        """
        columns = super().get_table_columns(schema_name, table_name)
        key_metadata = self._get_key_metadata(table_name)
        if key_metadata is None:
            return columns
        return self._apply_key_metadata(columns, key_metadata)

    @staticmethod
    def _apply_key_metadata(
        columns: List[Column], key_metadata: TableKeyMetadata
    ) -> List[Column]:
        """
        Key attributes are typed from the table definition rather than from the sampled values.
        Keys missing from the sample - which is every key of an empty table - are added, because
        the server rejects a constraint over a column the table lacks.

        Only a partition key standing alone is tagged on the column: the server refuses a table
        with more than one column marked as a primary key, so a composite key is carried by the
        table constraint that `get_table_constraints` emits instead.
        """
        columns_by_name = {model_str(column.name): column for column in columns}
        key_constraint = (
            Constraint.PRIMARY_KEY if len(key_metadata.primary_key) == 1 else None
        )
        unsampled_keys = []
        for key in key_metadata.primary_key:
            column_name = truncate_column_name(key)
            attribute_type = key_metadata.attribute_type(key)
            data_type = (
                DYNAMODB_KEY_TYPE_MAP.get(attribute_type) if attribute_type else None
            )
            column = columns_by_name.get(column_name)
            if column is None:
                data_type = data_type or DataType.UNKNOWN
                unsampled_keys.append(
                    Column(
                        name=ColumnName(column_name),
                        displayName=key,
                        dataType=data_type,
                        dataTypeDisplay=data_type.value,
                        constraint=key_constraint,
                    )
                )
                continue
            column.constraint = key_constraint
            if data_type:
                column.dataType = data_type
                column.dataTypeDisplay = data_type.value
        return unsampled_keys + columns

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
