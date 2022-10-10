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
"""Metadata source module"""

import logging
from typing import Iterable

from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.source.metadata import MetadataSource

logger = logging.getLogger(__name__)


class PolicyWrapper:
    data_dict: dict

    def __init__(self, policy_dict) -> None:
        self.data_dict = policy_dict


class TableWrapper:
    data_dict: dict

    def __init__(self, table_dict) -> None:
        self.data_dict = table_dict


class TagWrapper:
    data_dict: dict

    def __init__(self, tag_dict) -> None:
        self.data_dict = tag_dict


class MessagingServiceWrapper:
    data_dict: dict

    def __init__(self, messaging_service_dict) -> None:
        self.data_dict = messaging_service_dict


class DatabaseServiceWrapper:
    data_dict: dict

    def __init__(self, database_service_dict) -> None:
        self.data_dict = database_service_dict


class MigrateSource(MetadataSource):
    """
    Metadata Migrate source module
    to migrate from 0.9 from 0.10
    """

    config: WorkflowSource
    report: SourceStatus

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: OpenMetadataConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, OpenMetadataConnection):
            raise InvalidSourceException(
                f"Expected OpenMetadataConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def next_record(self) -> Iterable[Entity]:
        """
        Fetch all relebvent entities
        """
        if self.service_connection.includeTables:
            yield from self.fetch_tables(
                fields=[
                    "columns",
                    "tableConstraints",
                    "usageSummary",
                    "owner",
                    "tags",
                    "followers",
                ],
            )
        if self.service_connection.includeTopics:
            yield from self.fetch_entities(
                entity_class=Topic,
                fields=["owner", "tags", "followers"],
            )
        if self.service_connection.includeDashboards:
            yield from self.fetch_entities(
                entity_class=Dashboard,
                fields=[
                    "owner",
                    "tags",
                    "followers",
                    "charts",
                    "usageSummary",
                ],
            )

        if self.service_connection.includePipelines:
            yield from self.fetch_entities(
                entity_class=Pipeline,
                fields=["owner", "tags", "followers", "tasks"],
            )
        if self.service_connection.includeUsers:
            yield from self.fetch_entities(
                entity_class=User,
                fields=["teams", "roles"],
            )

        if self.service_connection.includeTeams:
            yield from self.fetch_entities(
                entity_class=Team,
                fields=["users", "owns"],
            )

        if self.service_connection.includeGlossaryTerms:
            yield from self.fetch_entities(
                entity_class=GlossaryTerm,
                fields=[],
            )
            yield from self.fetch_entities(
                entity_class=Glossary,
                fields=["owner", "tags", "reviewers", "usageCount"],
            )

        if self.service_connection.includePolicy:
            yield from self.fetch_policy()

        if self.service_connection.includeTags:
            yield from self.fetch_tags()

        if self.service_connection.includeMessagingServices:
            yield from self.fetch_messaging_services()

        if self.service_connection.includeDatabaseServices:
            yield from self.fetch_database_services()

        if self.service_connection.includePipelineServices:
            yield from self.fetch_entities(
                entity_class=PipelineService,
                fields=["owner"],
            )

    def fetch_policy(self):
        policy_entities = self.metadata.client.get("/policies")
        for policy in policy_entities.get("data"):
            yield PolicyWrapper(policy)

    def fetch_tables(self, fields):
        table_entities = self.metadata.client.get(
            f"/tables?fields={','.join(fields)}&limit=1000000"
        )
        for table in table_entities.get("data"):
            yield TableWrapper(table)

    def fetch_tags(self):
        tag_entities = self.metadata.client.get("/tags")
        for tag in tag_entities.get("data"):
            tag_detailed_entity = self.metadata.client.get(f"/tags/{tag.get('name')}")
            yield TagWrapper(tag_detailed_entity)

    def fetch_messaging_services(self):
        service_entities = self.metadata.client.get(
            "/services/messagingServices?fields=owner"
        )
        for service in service_entities.get("data"):
            yield MessagingServiceWrapper(service)

    def fetch_database_services(self):
        service_entities = self.metadata.client.get(
            "/services/databaseServices?fields=owner"
        )
        for service in service_entities.get("data"):
            yield DatabaseServiceWrapper(service)
