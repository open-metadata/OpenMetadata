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
import pandas as pd
import uuid
import os
import json
from faker import Faker
from collections import namedtuple
from dataclasses import dataclass, field
from typing import Iterable, List, Dict, Any, Union
from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import SourceStatus, Source
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.ometa.client import REST
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest
from metadata.generated.schema.entity.services.databaseService import DatabaseService

COLUMN_NAME = 'Column'
KEY_TYPE = 'Key type'
DATA_TYPE = 'Data type'
COL_DESCRIPTION = 'Description'
TableKey = namedtuple('TableKey', ['schema', 'table_name'])


def get_service_or_create(service_json, metadata_config) -> DatabaseService:
    client = REST(metadata_config)
    service = client.get_database_service(service_json['name'])
    if service is not None:
        return service
    else:
        created_service = client.create_database_service(CreateDatabaseServiceEntityRequest(**service_json))
        return created_service


def get_table_key(row: Dict[str, Any]) -> Union[TableKey, None]:
    """
    Table key consists of schema and table name
    :param row:
    :return:
    """
    return TableKey(schema=row['schema'], table_name=row['table_name'])


class SampleTableSourceConfig(ConfigModel):
    sample_schema_folder: str
    service_name: str
    database: str = "warehouse"
    service_type: str = "BigQuery"
    scheme = "bigquery+pymysql"

    def get_sample_schema_folder(self):
        return self.sample_schema_folder


@dataclass
class SampleTableSourceStatus(SourceStatus):
    tables_scanned: List[str] = field(default_factory=list)

    def report_table_scanned(self, table_name: str) -> None:
        self.tables_scanned.append(table_name)


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


class GenerateFakeSampleData:
    def __init__(self) -> None:
        pass

    @classmethod
    def check_columns(self, columns):
        fake = Faker()
        colData = []
        colList = [column['name'] for column in columns]
        for i in range(5):
            row = []
            for column in columns:
                col_name = column['name']
                value = None
                if "id" in col_name:
                    value = uuid.uuid4()
                elif "price" in col_name:
                    value = fake.pricetag()
                elif "barcode" in col_name:
                    value = fake.ean(length=13)
                elif "phone" in col_name:
                    value = fake.phone_number()
                elif "zip" in col_name:
                    value = fake.postcode()
                elif "address" in col_name:
                    value = fake.street_address()
                elif "company" in col_name:
                    value = fake.company()
                elif "region" in col_name:
                    value = fake.street_address()
                elif "name" in col_name:
                    value = fake.first_name()
                elif "city" in col_name:
                    value = fake.city()
                elif "country" in col_name:
                    value = fake.country()
                if value is None:
                    if "TIMESTAMP" in column['columnDataType'] or "date" in col_name:
                        value = fake.unix_time()
                    elif "BOOLEAN" in column['columnDataType']:
                        value = fake.pybool()
                    elif "NUMERIC" in column['columnDataType']:
                        value = fake.pyint()
                    elif "VARCHAR" in column['columnDataType']:
                        value = fake.text(max_nb_chars=20)
                    else:
                        value = None
                row.append(value)
            colData.append(row)
        return {"columns": colList, "rows": colData}


class SampleTablesSource(Source):

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
        db = Database(id=uuid.uuid4(),
                      name=self.database['name'],
                      description=self.database['description'],
                      service=EntityReference(id=self.service.id, type=self.config.service_type))
        for table in self.tables['tables']:
            if not table.get('sampleData'):
                table['sampleData'] = GenerateFakeSampleData.check_columns(table['columns'])
            table_metadata = Table(**table)
            table_and_db = OMetaDatabaseAndTable(table=table_metadata, database=db)
            self.status.scanned(table_metadata.name.__root__)
            yield table_and_db

    def close(self):
        pass

    def get_status(self):
        return self.status
