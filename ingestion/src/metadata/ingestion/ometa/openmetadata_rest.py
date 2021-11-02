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

import http.client
import json
import logging
import time
import uuid
from typing import List, Optional
from urllib.error import HTTPError

import google.auth
import google.auth.transport.requests
from google.oauth2 import service_account
from jose import jwt
from pydantic import BaseModel

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createChart import CreateChartEntityRequest
from metadata.generated.schema.api.data.createDashboard import (
    CreateDashboardEntityRequest,
)
from metadata.generated.schema.api.data.createDatabase import (
    CreateDatabaseEntityRequest,
)
from metadata.generated.schema.api.data.createPipeline import (
    CreatePipelineEntityRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.data.createTask import CreateTaskEntityRequest
from metadata.generated.schema.api.data.createTopic import CreateTopicEntityRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceEntityRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceEntityRequest,
)
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceEntityRequest,
)
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceEntityRequest,
)
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.model import Model
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import (
    Table,
    TableData,
    TableJoins,
    TableProfile,
)
from metadata.generated.schema.entity.data.task import Task
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.ingestion.models.table_queries import TableUsageRequest
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from metadata.ingestion.ometa.client import REST, APIError, ClientConfig

logger = logging.getLogger(__name__)

DatabaseServiceEntities = List[DatabaseService]
DatabaseEntities = List[Database]
Tags = List[Tag]
TableProfiles = List[TableProfile]
Tasks = List[Task]


class TableEntities(BaseModel):
    tables: List[Table]
    total: int
    after: str = None


class TopicEntities(BaseModel):
    topics: List[Topic]
    total: int
    after: str = None


class DashboardEntities(BaseModel):
    dashboards: List[Dashboard]
    total: int
    after: str = None


class PipelineEntities(BaseModel):
    pipelines: List[Pipeline]
    total: int
    after: str = None


class MetadataServerConfig(ConfigModel):
    api_endpoint: str
    api_version: str = "v1"
    retry: int = 3
    retry_wait: int = 3
    auth_provider_type: str = None
    secret_key: str = None
    org_url: str = None
    client_id: str = None
    private_key: str = None
    domain: str = None
    email: str = None
    audience: str = "https://www.googleapis.com/oauth2/v4/token"
    auth_header: str = "X-Catalog-Source"


class NoOpAuthenticationProvider(AuthenticationProvider):
    def __init__(self, config: MetadataServerConfig):
        self.config = config

    @classmethod
    def create(cls, config: MetadataServerConfig):
        return cls(config)

    def auth_token(self) -> str:
        return "no_token"


class GoogleAuthenticationProvider(AuthenticationProvider):
    def __init__(self, config: MetadataServerConfig):
        self.config = config

    @classmethod
    def create(cls, config: MetadataServerConfig):
        return cls(config)

    def auth_token(self) -> str:
        credentials = service_account.IDTokenCredentials.from_service_account_file(
            self.config.secret_key, target_audience=self.config.audience
        )
        request = google.auth.transport.requests.Request()
        credentials.refresh(request)
        return credentials.token


class OktaAuthenticationProvider(AuthenticationProvider):
    def __init__(self, config: MetadataServerConfig):
        self.config = config

    @classmethod
    def create(cls, config: MetadataServerConfig):
        return cls(config)

    def auth_token(self) -> str:
        my_pem, my_jwk = JWT.get_PEM_JWK(self.config.private_key)
        claims = {
            "sub": self.config.client_id,
            "iat": time.time(),
            "exp": time.time() + JWT.ONE_HOUR,
            "iss": self.config.client_id,
            "aud": self.config.org_url + JWT.OAUTH_ENDPOINT,
            "jti": uuid.uuid4(),
            "email": self.config.email,
        }
        token = jwt.encode(claims, my_jwk.to_dict(), JWT.HASH_ALGORITHM)
        return token


class Auth0AuthenticationProvider(AuthenticationProvider):
    def __init__(self, config: MetadataServerConfig):
        self.config = config

    @classmethod
    def create(cls, config: MetadataServerConfig):
        return cls(config)

    def auth_token(self) -> str:
        conn = http.client.HTTPSConnection(self.config.domain)
        payload = (
            f"grant_type=client_credentials&client_id={self.config.client_id}"
            f"&client_secret={self.config.secret_key}&audience=https://{self.config.domain}/api/v2/"
        )
        headers = {"content-type": "application/x-www-form-urlencoded"}
        conn.request("POST", f"/{self.config.domain}/oauth/token", payload, headers)
        res = conn.getresponse()
        data = res.read()
        token = json.loads(data.decode("utf-8"))
        return token["access_token"]


class OpenMetadataAPIClient(object):
    client: REST
    _auth_provider: AuthenticationProvider

    def __init__(self, config: MetadataServerConfig, raw_data: bool = False):
        self.config = config
        if self.config.auth_provider_type == "google":
            self._auth_provider: AuthenticationProvider = (
                GoogleAuthenticationProvider.create(self.config)
            )
        elif self.config.auth_provider_type == "okta":
            self._auth_provider: AuthenticationProvider = (
                OktaAuthenticationProvider.create(self.config)
            )
        elif self.config.auth_provider_type == "auth0":
            self._auth_provider: AuthenticationProvider = (
                Auth0AuthenticationProvider.create(self.config)
            )
        else:
            self._auth_provider: AuthenticationProvider = (
                NoOpAuthenticationProvider.create(self.config)
            )
        client_config: ClientConfig = ClientConfig(
            base_url=self.config.api_endpoint,
            api_version=self.config.api_version,
            auth_header="X-Catalog-Source",
            auth_token=self._auth_provider.auth_token(),
        )
        self.client = REST(client_config)
        self._use_raw_data = raw_data

    def get_database_service(self, service_name: str) -> Optional[DatabaseService]:
        """Get the Database service"""
        try:
            resp = self.client.get(
                "/services/databaseServices/name/{}".format(service_name)
            )
            return DatabaseService(**resp)
        except APIError as err:
            logger.error(f"Error trying to GET the database service {service_name}")
            return None

    def get_database_service_by_id(self, service_id: str) -> DatabaseService:
        """Get the Database Service by ID"""
        resp = self.client.get("/services/databaseServices/{}".format(service_id))
        return DatabaseService(**resp)

    def list_database_services(self) -> DatabaseServiceEntities:
        """Get a list of mysql services"""
        resp = self.client.get("/services/databaseServices")
        if self._use_raw_data:
            return resp
        else:
            return [DatabaseService(**p) for p in resp["data"]]

    def create_database_service(
        self, database_service: CreateDatabaseServiceEntityRequest
    ) -> DatabaseService:
        """Create a new Database Service"""
        resp = self.client.post(
            "/services/databaseServices", data=database_service.json()
        )
        return DatabaseService(**resp)

    def delete_database_service(self, service_id: str) -> None:
        """Delete a Database service"""
        self.client.delete("/services/databaseServices/{}".format(service_id))

    def get_database_by_name(
        self, database_name: str, fields: [] = ["service"]
    ) -> Database:
        """Get the Database"""
        params = {"fields": ",".join(fields)}
        resp = self.client.get("/databases/name/{}".format(database_name), data=params)
        return Database(**resp)

    def list_databases(self, fields: [] = ["service"]) -> DatabaseEntities:
        """List all databases"""
        params = {"fields": ",".join(fields)}
        resp = self.client.get("/databases", data=params)
        if self._use_raw_data:
            return resp
        else:
            return [Database(**d) for d in resp["data"]]

    def get_database_by_id(
        self, database_id: str, fields: [] = ["owner,service,tables,usageSummary"]
    ) -> Database:
        """Get Database By ID"""
        params = {"fields": ",".join(fields)}
        resp = self.client.get("/databases/{}".format(database_id), data=params)
        return Database(**resp)

    def create_database(
        self, create_database_request: CreateDatabaseEntityRequest
    ) -> Database:
        """Create a Database"""
        resp = self.client.put("/databases", data=create_database_request.json())
        return Database(**resp)

    def delete_database(self, database_id: str):
        """Delete Database using ID"""
        self.client.delete("/databases/{}".format(database_id))

    def list_tables(
        self, fields: str = None, after: str = None, limit: int = 1000
    ) -> TableEntities:
        """List all tables"""

        if fields is None:
            resp = self.client.get("/tables")
        else:
            if after is not None:
                resp = self.client.get(
                    "/tables?fields={}&after={}&limit={}".format(fields, after, limit)
                )
            else:
                resp = self.client.get(
                    "/tables?fields={}&limit={}".format(fields, limit)
                )

        if self._use_raw_data:
            return resp
        else:
            tables = [Table(**t) for t in resp["data"]]
            total = resp["paging"]["total"]
            after = resp["paging"]["after"] if "after" in resp["paging"] else None
            return TableEntities(tables=tables, total=total, after=after)

    def get_table_by_id(self, table_id: str, fields: [] = ["columns"]) -> Table:
        """Get Table By ID"""
        params = {"fields": ",".join(fields)}
        resp = self.client.get("/tables/{}".format(table_id), data=params)
        return Table(**resp)

    def create_or_update_table(
        self, create_table_request: CreateTableEntityRequest
    ) -> Table:
        """Create or Update a Table"""
        resp = self.client.put("/tables", data=create_table_request.json())
        resp.pop("database", None)
        return Table(**resp)

    def get_table_by_name(self, table_name: str, fields: [] = ["columns"]) -> Table:
        """Get Table By Name"""
        params = {"fields": ",".join(fields)}
        resp = self.client.get("/tables/name/{}".format(table_name), data=params)
        return Table(**resp)

    def list_tags_by_category(self, category: str) -> {}:
        """List all tags"""
        resp = self.client.get("/tags/{}".format(category))
        return [Tag(**d) for d in resp["children"]]

    def get_messaging_service(self, service_name: str) -> Optional[MessagingService]:
        """Get the Messaging service"""
        try:
            resp = self.client.get(
                "/services/messagingServices/name/{}".format(service_name)
            )
            return MessagingService(**resp)
        except APIError as err:
            logger.error(f"Error trying to GET the messaging service {service_name}")
            return None

    def get_messaging_service_by_id(self, service_id: str) -> MessagingService:
        """Get the Messaging Service by ID"""
        resp = self.client.get("/services/messagingServices/{}".format(service_id))
        return MessagingService(**resp)

    def create_messaging_service(
        self, messaging_service: CreateMessagingServiceEntityRequest
    ) -> MessagingService:
        """Create a new Database Service"""
        resp = self.client.post(
            "/services/messagingServices", data=messaging_service.json()
        )
        return MessagingService(**resp)

    def create_or_update_topic(
        self, create_topic_request: CreateTopicEntityRequest
    ) -> Topic:
        """Create or Update a Table"""
        resp = self.client.put("/topics", data=create_topic_request.json())
        return Topic(**resp)

    def list_topics(
        self, fields: str = None, after: str = None, limit: int = 1000
    ) -> TopicEntities:
        """List all topics"""
        if fields is None:
            resp = self.client.get("/tables")
        else:
            if after is not None:
                resp = self.client.get(
                    "/topics?fields={}&after={}&limit={}".format(fields, after, limit)
                )
            else:
                resp = self.client.get(
                    "/topics?fields={}&limit={}".format(fields, limit)
                )

        if self._use_raw_data:
            return resp
        else:
            topics = [Topic(**t) for t in resp["data"]]
            total = resp["paging"]["total"]
            after = resp["paging"]["after"] if "after" in resp["paging"] else None
            return TopicEntities(topics=topics, total=total, after=after)

    def get_dashboard_service(self, service_name: str) -> Optional[DashboardService]:
        """Get the Dashboard service"""
        try:
            resp = self.client.get(
                "/services/dashboardServices/name/{}".format(service_name)
            )
            return DashboardService(**resp)
        except APIError as err:
            logger.error(f"Error trying to GET the dashboard service {service_name}")
            return None

    def get_dashboard_service_by_id(self, service_id: str) -> DashboardService:
        """Get the Dashboard Service by ID"""
        resp = self.client.get("/services/dashboardServices/{}".format(service_id))
        return DashboardService(**resp)

    def create_dashboard_service(
        self, dashboard_service: CreateDashboardServiceEntityRequest
    ) -> Optional[DashboardService]:
        """Create a new Database Service"""
        try:
            resp = self.client.post(
                "/services/dashboardServices", data=dashboard_service.json()
            )
            return DashboardService(**resp)
        except APIError as err:
            logger.error(
                f"Error trying to POST the dashboard service {dashboard_service}"
            )
            return None

    def create_or_update_chart(
        self, create_chart_request: CreateChartEntityRequest
    ) -> Chart:
        """Create or Update a Chart"""
        resp = self.client.put("/charts", data=create_chart_request.json())
        return Chart(**resp)

    def get_chart_by_id(self, chart_id: str, fields: [] = ["tags,service"]) -> Chart:
        """Get Chart By ID"""
        params = {"fields": ",".join(fields)}
        resp = self.client.get("/charts/{}".format(chart_id), data=params)
        return Chart(**resp)

    def create_or_update_dashboard(
        self, create_dashboard_request: CreateDashboardEntityRequest
    ) -> Dashboard:
        """Create or Update a Dashboard"""
        resp = self.client.put("/dashboards", data=create_dashboard_request.json())
        return Dashboard(**resp)

    def get_dashboard_by_name(
        self, dashboard_name: str, fields: [] = ["charts", "service"]
    ) -> Dashboard:
        """Get Dashboard By Name"""
        params = {"fields": ",".join(fields)}
        resp = self.client.get(
            "/dashboards/name/{}".format(dashboard_name), data=params
        )
        return Dashboard(**resp)

    def list_dashboards(
        self, fields: str = None, after: str = None, limit: int = 1000
    ) -> DashboardEntities:
        """List all dashboards"""

        if fields is None:
            resp = self.client.get("/dashboards")
        else:
            if after is not None:
                resp = self.client.get(
                    "/dashboards?fields={}&after={}&limit={}".format(
                        fields, after, limit
                    )
                )
            else:
                resp = self.client.get(
                    "/dashboards?fields={}&limit={}".format(fields, limit)
                )

        if self._use_raw_data:
            return resp
        else:
            dashboards = [Dashboard(**t) for t in resp["data"]]
            total = resp["paging"]["total"]
            after = resp["paging"]["after"] if "after" in resp["paging"] else None
            return DashboardEntities(dashboards=dashboards, total=total, after=after)

    def get_pipeline_service(self, service_name: str) -> Optional[PipelineService]:
        """Get the Pipeline service"""
        try:
            resp = self.client.get(
                "/services/pipelineServices/name/{}".format(service_name)
            )
            return PipelineService(**resp)
        except APIError as err:
            logger.error(f"Error trying to GET the pipeline service {service_name}")
            return None

    def get_pipeline_service_by_id(self, service_id: str) -> PipelineService:
        """Get the Pipeline Service by ID"""
        resp = self.client.get("/services/pipelineServices/{}".format(service_id))
        return PipelineService(**resp)

    def create_pipeline_service(
        self, pipeline_service: CreatePipelineServiceEntityRequest
    ) -> Optional[PipelineService]:
        """Create a new Pipeline Service"""
        try:
            resp = self.client.post(
                "/services/pipelineServices", data=pipeline_service.json()
            )
            return PipelineService(**resp)
        except APIError as err:
            logger.error(
                f"Error trying to POST the pipeline service {pipeline_service}"
            )
            return None

    def create_or_update_task(
        self, create_task_request: CreateTaskEntityRequest
    ) -> Task:
        """Create or Update a Task"""
        resp = self.client.put("/tasks", data=create_task_request.json())
        return Task(**resp)

    def get_task_by_id(self, task_id: str, fields: [] = ["tags, service"]) -> Task:
        """Get Task By ID"""
        params = {"fields": ",".join(fields)}
        resp = self.client.get("/tasks/{}".format(task_id), data=params)
        return Task(**resp)

    def list_tasks(
        self, fields: str = None, offset: int = 0, limit: int = 1000
    ) -> Tasks:
        """List all tasks"""
        if fields is None:
            resp = self.client.get("/tasks?offset={}&limit={}".format(offset, limit))
        else:
            resp = self.client.get(
                "/tasks?fields={}&offset={}&limit={}".format(fields, offset, limit)
            )
        if self._use_raw_data:
            return resp
        else:
            return [Task(**t) for t in resp["data"]]

    def create_or_update_pipeline(
        self, create_pipeline_request: CreatePipelineEntityRequest
    ) -> Pipeline:
        """Create or Update a Pipeline"""
        resp = self.client.put("/pipelines", data=create_pipeline_request.json())
        return Pipeline(**resp)

    def list_pipelines(
        self, fields: str = None, after: str = None, limit: int = 1000
    ) -> PipelineEntities:
        """List all pipelines"""
        if fields is None:
            resp = self.client.get("/pipelines")
        else:
            if after is not None:
                resp = self.client.get(
                    "/pipelines?fields={}&after={}&limit={}".format(
                        fields, after, limit
                    )
                )
            else:
                resp = self.client.get(
                    "/pipelines?fields={}&limit={}".format(fields, limit)
                )

        if self._use_raw_data:
            return resp
        else:
            pipelines = [Pipeline(**t) for t in resp["data"]]
            total = resp["paging"]["total"]
            after = resp["paging"]["after"] if "after" in resp["paging"] else None
            return PipelineEntities(pipelines=pipelines, total=total, after=after)

    def get_pipeline_by_name(
        self, pipeline_name: str, fields: [] = ["tasks", "service"]
    ) -> Pipeline:
        """Get Pipeline By Name"""
        params = {"fields": ",".join(fields)}
        resp = self.client.get("/pipelines/name/{}".format(pipeline_name), data=params)
        return Pipeline(**resp)

    def create_or_update_model(self, model: Model):
        resp = self.client.put("/models", data=model.json())
        return Model(**resp)

    def close(self):
        self.client.close()
