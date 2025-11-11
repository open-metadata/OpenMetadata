#  Copyright 2024 Collate
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
DyanmoDB adaptor for the NoSQL profiler.
"""
from typing import TYPE_CHECKING, Dict, List

from metadata.generated.schema.entity.data.table import Column, Table
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor

if TYPE_CHECKING:
    from mypy_boto3_dynamodb.service_resource import DynamoDBServiceResource
else:
    DynamoDBServiceResource = None  # pylint: disable=invalid-name


class DynamoDB(NoSQLAdaptor):
    """A MongoDB client that serves as an adaptor for profiling data assets on MongoDB"""

    def __init__(self, client: DynamoDBServiceResource):
        self.client = client

    def item_count(self, table: Table) -> int:
        table = self.client.Table(table.name.root)
        return table.item_count

    def scan(
        self, table: Table, columns: List[Column], limit: int
    ) -> List[Dict[str, any]]:
        table = self.client.Table(table.name.root)
        response = table.scan(Limit=limit)
        return response["Items"]
