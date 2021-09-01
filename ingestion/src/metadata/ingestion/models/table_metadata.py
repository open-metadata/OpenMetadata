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

import copy
import json

from typing import Any, Dict, Iterable, List, Optional, Union

from pydantic import BaseModel

from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.json_serializable import JsonSerializable

DESCRIPTION_NODE_LABEL_VAL = 'Description'
DESCRIPTION_NODE_LABEL = DESCRIPTION_NODE_LABEL_VAL


class ColumnMetadata:

    def __init__(self,
                 name: str,
                 documentation: Union[str, None],
                 column_data_type: str,
                 ordinal_position: int,
                 pii_tags: List[str] = None
                 ) -> None:
        """
        TODO: Add stats
        :param name:
        :param documentation:
        :param column_data_type:
        :param ordinal_position:
        :param pii_tags:
        """
        self.name = name
        self.documentation = documentation
        self.column_data_type = column_data_type
        self.ordinal_position = ordinal_position
        self.pii_tags = pii_tags if pii_tags else []

    def __repr__(self) -> str:
        return 'ColumnMetadata({!r}, {!r}, {!r}, {!r}, {!r})'.format(self.name,
                                                                     self.documentation,
                                                                     self.column_data_type,
                                                                     self.ordinal_position,
                                                                     self.pii_tags)


class TableMetadata:
    """
    Table metadata that contains columns.
    This class can be used for both table and view metadata. If it is a View, is_view=True should be passed in.
    """

    def __init__(self,
                 name: str,
                 documentation: Union[str, None],
                 columns: Iterable[ColumnMetadata] = None
                 ) -> None:
        """
        :param name:
        :param documentation:
        :param columns:
        """
        self.name = name
        self.documentation = documentation
        self.columns = columns if columns else []

    def add_column(self, column: ColumnMetadata):
        self.columns.append(column)

    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__)

    def __repr__(self) -> str:
        return 'TableMetadata({!r}, {!r}, {!r} '.format(self.name,
                                                        self.documentation,
                                                        self.columns)


class DatabaseMetadata(JsonSerializable):
    """
    Database metadata that contains Tables.
    This class can be used to generate catalog batch REST api representation
    All connectors should use this to build JSON representation of catalog REST API.
    """
    DATABASE_NODE_LABEL = 'database'
    CLUSTER_NODE_LABEL = 'Cluster'

    @classmethod
    def create(cls, record: Dict[str, Any], service: Dict[str, Any]):
        name = record.name
        documentation = record.documentation
        service = service
        tables = []
        for table in record.tables:
            table_metadata: TableMetadata = TableMetadata(table.name, table.documentation)
            for column in table.columns:
                column: ColumnMetadata = ColumnMetadata(column.name, column.documentation,
                                                        column.column_data_type, column.ordinal_position,
                                                        column.pii_tags)
                table_metadata.add_column(column)
            tables.append(table_metadata)
        return cls(name, documentation, tables, service)

    def __init__(self,
                 name: str,
                 documentation: Union[str, None],
                 tables: Iterable[TableMetadata] = None,
                 service: Dict[str, Any] = None,
                 **kwargs: Any
                 ) -> None:
        """
        :param name:
        :param service:
        :param documentation:
        :param tables:
        :param kwargs: Put additional attributes to the table model if there is any.
        """
        self.name = name
        self.documentation = documentation
        self.tables = tables if tables else []
        self.service = service
        if kwargs:
            self.attrs = copy.deepcopy(kwargs)

    def __repr__(self) -> str:
        return 'DatabaseMetadata({!r}, {!r}, {!r})'.format(self.name,
                                                           self.documentation,
                                                           self.tables)

    def add_table(self, table: TableMetadata) -> None:
        self.tables.append(table)


class JDBCMetadata(JsonSerializable):
    def __init__(self,
                 connection_url: str,
                 driver_class: str):
        self.connection_url = connection_url
        self.driver_class = driver_class


class ServiceMetadata(JsonSerializable):
    """
    Service Metadata contains the configuration to connect to a database
    """

    def __init__(self,
                 name: str,
                 jdbc: JDBCMetadata):
        self.name = name
        self.jdbc = jdbc


class TableESDocument(BaseModel):
    """ Elastic Search Mapping doc """
    table_id: str
    database: str
    service: str
    service_type: str
    table_name: str
    suggest: List[dict]
    description: Optional[str] = None
    table_type: Optional[str] = None
    last_updated_timestamp: Optional[int]
    column_names: List[str]
    column_descriptions: List[str]
    monthly_stats: int
    monthly_percentile_rank: int
    weekly_stats: int
    weekly_percentile_rank: int
    daily_stats: int
    daily_percentile_rank: int
    tags: List[str]
    fqdn: str
    tier: Optional[str] = None
    schema_description: Optional[str] = None
    owner: str
    followers: List[str]


class TopicESDocument(BaseModel):
    """ Topic Elastic Search Mapping doc """
    topic_id: str
    service: str
    service_type: str
    topic_name: str
    suggest: List[dict]
    description: Optional[str] = None
    last_updated_timestamp: Optional[int]
    tags: List[str]
    fqdn: str
    tier: Optional[str] = None
    schema_description: Optional[str] = None
    owner: str
    followers: List[str]


class DashboardOwner(BaseModel):
    """Dashboard owner"""
    username: str
    first_name: str
    last_name: str


class Chart(BaseModel):
    """Chart"""
    name: str
    displayName:str
    description: str
    chart_type: str
    url: str
    owners: List[DashboardOwner] = None
    lastModified: int = None
    datasource_fqn: str = None
    service: EntityReference
    custom_props: Dict[Any, Any] = None


class Dashboard(BaseModel):
    """Dashboard"""
    name: str
    displayName: str
    description: str
    url: str
    owners: List[DashboardOwner] = None
    charts: List[str]
    service: EntityReference
    lastModified: int = None
