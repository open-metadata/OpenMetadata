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

import csv
import json
import uuid
import os
import pandas as pd
import random
import string
import logging

from faker import Faker
from collections import namedtuple
from typing import Iterable, Dict, Any, List, Union
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceEntity
from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import TableEntity
from metadata.generated.schema.entity.data.database import DatabaseEntity
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import Source, SourceStatus
from dataclasses import dataclass, field
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import DatabaseMetadata
from metadata.ingestion.models.user import User
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.ometa.client import REST

COLUMN_NAME = 'Column'
KEY_TYPE = 'Key type'
DATA_TYPE = 'Data type'
FAKER_METHOD = 'Faker method'
COL_DESCRIPTION = 'Description'

logger = logging.getLogger(__name__)

TableKey = namedtuple('TableKey', ['schema', 'table_name'])


class SampleTableSourceConfig(ConfigModel):
    sample_schema_folder: str
    service_name: str
    database: str = "warehouse"
    service_type: str = "BigQuery"
    scheme = "bigquery+pymysql"

    def get_sample_schema_folder(self):
        return self.sample_schema_folder


class SampleUserSourceConfig(ConfigModel):
    no_of_users: int


def get_table_key(row: Dict[str, Any]) -> Union[TableKey, None]:
    """
    Table key consists of schema and table name
    :param row:
    :return:
    """
    return TableKey(schema=row['schema'], table_name=row['table_name'])


@dataclass
class SampleTableSourceStatus(SourceStatus):
    tables_scanned: List[str] = field(default_factory=list)

    def report_table_scanned(self, table_name: str) -> None:
        self.tables_scanned.append(table_name)


@dataclass
class SampleUserSourceStatus(SourceStatus):
    users_scanned: List[str] = field(default_factory=list)

    def report_table_scanned(self, user_name: str) -> None:
        self.users_scanned.append(user_name)


class TableSchema:
    def __init__(self, filename):
        # error if the file is not csv file
        if not filename.endswith('.csv'):
            raise Exception('Input file should be a csv file')

        # file name is assumed to be the table name
        basename = os.path.basename(filename)
        self.table_name = os.path.splitext(basename)[0]

        with open(filename, 'r') as fin:
            self.columns = [dict(i) for i in csv.DictReader(fin)]

    def primary_keys(self):
        return [c[COLUMN_NAME] for c in self.columns if c[KEY_TYPE] == 'PK']

    def foreign_keys(self):
        return [c[COLUMN_NAME] for c in self.columns if c[KEY_TYPE] == 'FK']

    def get_name(self):
        return self.table_name

    def get_schema(self):
        return self.columns

    def get_column_names(self):
        return [c[COLUMN_NAME] for c in self.columns]


class DataGenerator:
    def __init__(self, schemas):
        if not schemas:
            raise Exception('Input schemas should be an array of one or more TableSchemas')

        self.schemas = schemas

        # validate that each FK is a PK in one of the input schemas
        # TODO

        self.table_to_schema = dict((s.get_name(), s) for s in schemas)

    def generate_data(self, table_name, number_of_rows):
        fake = Faker()
        schema = self.table_to_schema[table_name]
        data = {}
        for c in schema.get_schema():
            if not c[FAKER_METHOD]:
                logging.debug('{} has no faker method input'.format(c))
                continue
            fn = getattr(fake, c[FAKER_METHOD])
            data[c[COLUMN_NAME]] = [fn() for _ in range(number_of_rows)]
        return pd.DataFrame(data)


class SampleTableMetadataGenerator:
    def __init__(self, table_to_df_dict, table_to_schema_map):
        self.table_to_df_dict = table_to_df_dict
        self.table_to_schema_map = table_to_schema_map
        self.sample_user = None
        self.sample_table = None
        self.sample_table_owner = None
        self.sample_table_last_updated = None

    def get_empty_dict_with_cols(self, columns):
        data = {}
        for c in columns:
            data[c] = []
        return data

    def generate_sample_table(self):
        keys = ['database', 'cluster', 'schema', 'name', 'description', 'tags', 'is_view', 'description_source']
        data = self.get_empty_dict_with_cols(keys)

        for tname in self.table_to_df_dict.keys():
            data['database'].append('hive')
            data['cluster'].append('gold')
            data['schema'].append('gdw')
            data['name'].append(tname)
            data['description'].append('this is the table to hold data on ' + tname)
            data['tags'].append('pii')
            data['is_view'].append('false')
            data['description_source'].append('')
        sample_table = pd.DataFrame(data)
        table_dict = {}
        for index, row in sample_table.iterrows():
            table_dict[row['name']] = row
        return table_dict

    def generate_sample_col(self):
        # name, description, col_type, sort_order, database, cluster, schema, table_name
        # col1, "col1 description", "string", 1, hive, gold, test_schema, test_table1
        keys = ['name', 'description', 'col_type', 'sort_order', 'database', 'cluster', 'schema', 'table_name']

        data = self.get_empty_dict_with_cols(keys)

        for (tname, df) in self.table_to_df_dict.items():
            tschema = self.table_to_schema_map[tname].get_schema()
            for col in df.columns:
                data['name'].append(col)
                for c in tschema:
                    if c[COLUMN_NAME] is col:
                        data['description'].append(c[COL_DESCRIPTION])
                        data['col_type'].append(c[DATA_TYPE])
                        break
                data['sort_order'].append(1)
                data['cluster'].append('gold')
                data['database'].append('hive')
                data['schema'].append('dwh')
                data['table_name'].append(tname)
        pd_rows = pd.DataFrame(data)
        row_dict = []
        for index, row in pd_rows.iterrows():
            row_dict.append(row)
        sorted_row_dict = sorted(row_dict, key=get_table_key)
        return sorted_row_dict


class SampleUserMetadataGenerator:

    def __init__(self, number_of_users):
        self.number_of_users = number_of_users

    def generate_sample_user(self):
        schema = dict()
        fake = Faker()
        # columns that use faker
        schema['email'] = lambda: None
        schema['first_name'] = lambda: fake.first_name()
        schema['last_name'] = lambda: fake.last_name()
        schema['full_name'] = lambda: None
        schema['github_username'] = lambda: None
        schema['team_name'] = lambda: random.choice(
            ['Data_Infra', 'Infra', 'Payments', 'Legal', 'Dev_Platform', 'Trust', 'Marketplace'])
        schema['employee_type'] = lambda: None
        schema['manager_email'] = lambda: fake.email()
        schema['slack_id'] = lambda: None
        schema['role_name'] = lambda: random.choices(
            ['ROLE_ENGINEER', 'ROLE_DATA_SCIENTIST', 'ROLE_ADMIN'], weights=[40, 40, 10])[0]
        data = {}

        for k in schema.keys():
            data[k] = [schema[k]() for _ in range(self.number_of_users)]

        # fill in the columns that can be derived from the random data above
        for i in range(self.number_of_users):
            data['full_name'][i] = data['first_name'][i] + ' ' + data['last_name'][i]
            username = data['first_name'][i].lower() + '_' + data['last_name'][i].lower() + random.choice(
                string.digits)
            data['slack_id'][i] = username
            data['github_username'][i] = username
            data['email'][i] = username + '@gmail.com'
            data['employee_type'] = data['role_name']

        pd_rows = pd.DataFrame(data)
        row_dict = []
        for index, row in pd_rows.iterrows():
            row_dict.append(row)

        return row_dict


def get_service_or_create(service_json, metadata_config) -> DatabaseServiceEntity:
    client = REST(metadata_config)
    service = client.get_database_service(service_json['name'])
    print(service)
    if service is not None:
        return service
    else:
        created_service = client.create_database_service(CreateDatabaseServiceEntityRequest(**service_json))
        return created_service


class SampleTableSource(Source):

    def __init__(self, config: SampleTableSourceConfig, metadata_config: MetadataServerConfig, ctx):
        super().__init__(ctx)
        self.status = SampleTableSourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.client = REST(metadata_config)
        self.service_json = json.load(open(config.sample_schema_folder + "/service.json", 'r'))
        self.database = json.load(open(config.sample_schema_folder + "/database.json", 'r'))
        self.tables = json.load(open(config.sample_schema_folder + "/tables.json", 'r'))
        self.service = get_service_or_create(self.service_json, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SampleTableSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:

        db = DatabaseEntity(id=uuid.uuid4(),
                            name=self.database['name'],
                            description=self.database['description'],
                            service=EntityReference(id=self.service.id, type=self.config.service_type))
        for table in self.tables['tables']:
            table_metadata = TableEntity(**table)
            table_and_db = OMetaDatabaseAndTable(table=table_metadata, database=db)
            self.status.report_table_scanned(table_metadata.name.__root__)
            self.status.records_produced(table_metadata.name.__root__)
            yield table_and_db

    def close(self):
        pass

    def get_status(self):
        return self.status


class SampleUserSource(Source):

    def __init__(self, config: SampleUserSourceConfig, metadata_config: MetadataServerConfig, ctx):
        super().__init__(ctx)
        self.status = SampleUserSourceStatus()
        metadata_gen = SampleUserMetadataGenerator(config.no_of_users)
        self.sample_columns = metadata_gen.generate_sample_user()

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SampleUserSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[DatabaseMetadata]:
        for user in self.sample_columns:
            user_metadata = User(user['email'],
                                 user['first_name'],
                                 user['last_name'],
                                 user['full_name'],
                                 user['github_username'],
                                 user['team_name'],
                                 user['employee_type'],
                                 user['manager_email'],
                                 user['slack_id'],
                                 True,
                                 0)
            self.status.report_table_scanned(user['github_username'])
            yield user_metadata

    def close(self):
        pass

    def get_status(self):
        return self.status
