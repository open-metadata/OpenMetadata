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

import random
import string
import pandas as pd
from faker import Faker
from typing import Iterable, List
from dataclasses import dataclass, field
from metadata.config.common import ConfigModel
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.models.table_metadata import DatabaseMetadata
from metadata.ingestion.models.user import User


class SampleUserSourceConfig(ConfigModel):
    no_of_users: int


@dataclass
class SampleUserSourceStatus(SourceStatus):
    users_scanned: List[str] = field(default_factory=list)

    def report_table_scanned(self, user_name: str) -> None:
        self.users_scanned.append(user_name)


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
            ['Data Platform', 'Cloud Infra', 'Payments', 'Legal', 'Customer Support', 'Finance', 'Marketplace'])
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


class SampleUsersSource(Source):

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
