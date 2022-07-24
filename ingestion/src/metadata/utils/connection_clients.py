#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from dataclasses import dataclass

"""
Creating client for non-sqlalchemy package is neccessary, 
Importing a Class directly in connection.py will break the ingestion,
if non-sqlalchemy package is not installed
"""


@dataclass
class GlueDBClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class GluePipelineClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class DynamoClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class SalesforceClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class DeltaLakeClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class KafkaClient:
    def __init__(self, admin_client, schema_registry_client, consumer_client) -> None:
        self.admin_client = admin_client
        self.schema_registry_client = schema_registry_client  # Optional
        self.consumer_client = consumer_client


@dataclass
class MetabaseClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class RedashClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class SupersetClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class TableauClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class PowerBiClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class LookerClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class DatalakeClient:
    def __init__(self, client, config) -> None:
        self.client = client
        self.config = config


@dataclass
class AirByteClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class ModeClient:
    def __init__(self, client) -> None:
        self.client = client


@dataclass
class MlflowClientWrapper:
    def __init__(self, client) -> None:
        self.client = client
