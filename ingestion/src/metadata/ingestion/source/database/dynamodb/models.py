#  Copyright 2023 Collate
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
DynamoDB Models
"""

from typing import Any

from pydantic import BaseModel

PARTITION_KEY_TYPE = "HASH"
SORT_KEY_TYPE = "RANGE"


class TableResponse(BaseModel):
    """
    DynamoDB table response model
    """

    Items: list[dict] | None = []
    LastEvaluatedKey: Any | None = None


class KeySchemaElement(BaseModel):
    """
    One entry of a DynamoDB table key schema
    """

    AttributeName: str
    KeyType: str


class AttributeDefinition(BaseModel):
    """
    Declared type of a DynamoDB key attribute
    """

    AttributeName: str
    AttributeType: str


class TableKeyMetadata(BaseModel):
    """
    Key schema of a DynamoDB table, as returned by DescribeTable
    """

    KeySchema: list[KeySchemaElement] = []
    AttributeDefinitions: list[AttributeDefinition] = []

    def _key_of_type(self, key_type: str) -> str | None:
        return next(
            (element.AttributeName for element in self.KeySchema if element.KeyType == key_type),
            None,
        )

    @property
    def partition_key(self) -> str | None:
        return self._key_of_type(PARTITION_KEY_TYPE)

    @property
    def sort_key(self) -> str | None:
        return self._key_of_type(SORT_KEY_TYPE)

    @property
    def primary_key(self) -> list[str]:
        """
        A DynamoDB primary key is the partition key on its own, or the partition key
        together with the sort key when the table defines one.
        """
        return [key for key in (self.partition_key, self.sort_key) if key]

    def attribute_type(self, attribute_name: str) -> str | None:
        return next(
            (
                definition.AttributeType
                for definition in self.AttributeDefinitions
                if definition.AttributeName == attribute_name
            ),
            None,
        )
