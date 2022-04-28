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

import json
import logging
import traceback
from datetime import datetime

from pydantic import ValidationError

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import ColumnJoins, Table, TableJoins
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.bulk_sink import BulkSink, BulkSinkStatus
from metadata.ingestion.api.common import Entity
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata

logger = logging.getLogger(__name__)


class MetadataMigrateSinkConfig(ConfigModel):
    filename: str


class MigrateBulkSink(BulkSink):
    config: MetadataMigrateSinkConfig

    def __init__(
        self,
        config: MetadataMigrateSinkConfig,
        metadata_config: OpenMetadataConnection,
    ):

        self.config = config
        self.metadata_config = metadata_config
        self.service_name = None
        self.wrote_something = False
        # self.file_handler = open(self.config.filename, "r")

        self.metadata = OpenMetadata(self.metadata_config)
        self.status = BulkSinkStatus()
        self.table_join_dict = {}
        self.role_entities = {}
        self.team_entities = {}
        self.today = datetime.today().strftime("%Y-%m-%d")

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = MetadataMigrateSinkConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def write_records(self) -> None:
        # with open(f"{self.config.filename}/table.json") as file:
        #     self.write_tables(file)

        with open(f"{self.config.filename}/user.json") as file:
            self.write_users(file)

        # with open(f"{self.config.filename}/topic.json") as file:
        #     self.write_topics(file)

        # with open(f"{self.config.filename}/pipeline.json") as file:
        #     self.write_pipelines(file)

        with open(f"{self.config.filename}/glossary.json") as file:
            self.write_glossary(file)

        with open(f"{self.config.filename}/glossary_term.json") as file:
            self.write_glossary_term(file)

        with open(f"{self.config.filename}/glossary_term.json") as file:
            self.write_glossary_term(file)

    def _create_role(self, create_role: CreateRoleRequest) -> Role:
        try:
            role = self.metadata.create_or_update(create_role)
            self.role_entities[role.name] = str(role.id.__root__)
            return role
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def _create_team(self, create_team: CreateTeamRequest) -> Team:
        try:
            team = self.metadata.create_or_update(create_team)
            self.team_entities[team.name.__root__] = str(team.id.__root__)
            return team
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def write_users(self, file):
        """
        Given a User profile (User + Teams + Roles create requests):
        1. Check if role & team exist, otherwise create
        2. Add ids of role & team to the User
        3. Create or update User
        """
        try:
            users = json.load(file)
            for user in users:
                user_obj = User(**user)
                # Create roles if they don't exist
                if user_obj.roles:  # Roles can be optional
                    role_ids = []
                    for role in user_obj.roles.__root__:
                        try:
                            role_entity = self.metadata.get_by_name(
                                entity=Role, fqdn=str(role.name)
                            )
                        except APIError:
                            role_entity = self._create_role(role)
                        if role_entity:
                            role_ids.append(role_entity.id)
                else:
                    role_ids = None

                # Create teams if they don't exist
                if user_obj.teams:  # Teams can be optional
                    team_ids = []
                    for team in user_obj.teams.__root__:
                        try:
                            team_entity = self.metadata.get_by_name(
                                entity=Team, fqdn=team.name
                            )
                            if not team_entity:
                                raise APIError(
                                    error={
                                        "message": "Creating a new team {}".format(
                                            team.name
                                        )
                                    }
                                )
                            team_ids.append(team_entity.id.__root__)
                        except APIError:
                            team_request = CreateTeamRequest(
                                name=team.name,
                                displayName=team.displayName,
                                description=team.description,
                            )
                            team_entity = self._create_team(team_request)
                            team_ids.append(team_entity.id.__root__)
                        except Exception as err:
                            logger.error(err)
                else:
                    team_ids = None

                # Update user data with the new Role and Team IDs
                metadata_user = CreateUserRequest(
                    roles=role_ids,
                    teams=team_ids,
                    name=user_obj.name,
                    description=user_obj.description,
                    email=user_obj.email,
                    timezone=user_obj.timezone,
                    isBot=user_obj.isBot,
                    isAdmin=user_obj.isAdmin,
                    profile=user_obj.profile,
                )

                # Create user
                try:
                    user = self.metadata.create_or_update(metadata_user)
                    self.status.records_written(user_obj.displayName)
                    logger.info("User: {}".format(user_obj.displayName))
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(err)

        except Exception as err:
            self.status.failure(f"User:")

    def write_topics(self, file) -> None:
        try:
            topics = json.load(file)
            for topic in topics:
                topic_obj = Topic(**topic)
                topic_request = CreateTopicRequest(
                    name=topic_obj.name,
                    description=topic_obj.description,
                    schemaText=topic_obj.schemaText,
                    schemaType=topic_obj.schemaType,
                    cleanupPolicies=topic_obj.cleanupPolicies,
                    replicationFactor=topic_obj.replicationFactor,
                    maximumMessageSize=topic_obj.maximumMessageSize,
                    retentionSize=topic_obj.retentionSize,
                    retentionTime=topic_obj.retentionTime,
                    topicConfig=topic_obj.topicConfig,
                    owner=topic_obj.owner,
                    tags=topic_obj.tags,
                    service=EntityReference(
                        name=topic_obj.service.name, type=topic_obj.service.type
                    ),
                    partitions=topic_obj.partitions,
                )
                created_topic = self.metadata.create_or_update(topic_request)
                logger.info(
                    f"Successfully ingested topic {created_topic.name.__root__}"
                )
                self.status.records_written(f"Topic: {created_topic.name.__root__}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest topic {topic.name.__root__}")
            logger.error(err)
            self.status.failure(f"Topic: {topic.name}")

    def write_pipelines(self, file):
        pipelines = json.load(file)
        for pipeline in pipelines:
            try:
                pipeline_obj = Pipeline(**pipeline)
                pipeline_service = self.metadata.get_by_name(
                    entity=PipelineService, fqdn=pipeline_obj.service.name
                )
                pipeline_request = CreatePipelineRequest(
                    name=pipeline_obj.name,
                    displayName=pipeline_obj.displayName,
                    description=pipeline_obj.description,
                    pipelineUrl=pipeline_obj.pipelineUrl,
                    tasks=pipeline_obj.tasks,
                    service=pipeline_service,
                )
                created_pipeline = self.metadata.create_or_update(pipeline_request)
                logger.info(
                    f"Successfully ingested Pipeline {created_pipeline.displayName}"
                )
                self.status.records_written(f"Pipeline: {created_pipeline.displayName}")
            except (APIError, ValidationError) as err:
                logger.error(f"Failed to ingest pipeline {pipeline_obj.name}")
                logger.error(err)
                self.status.failure(f"Pipeline: {pipeline_obj.name}")

    def _get_glossary_reviewers_entities(self, reviewers):
        users = []
        for reviewer in reviewers:
            user = self.metadata.get_by_name(entity=User, fqdn=reviewer.name)
            print(user.id.__root__)
            users.append(
                EntityReference(
                    id=user.id.__root__, name=user.name.__root__, type=reviewer.type
                )
            )
        return users

    def _get_glossary_owner_entity(self, owner):
        user = self.metadata.get_by_name(entity=User, fqdn=owner.name)
        return EntityReference(
            id=user.id.__root__, name=user.name.__root__, type=owner.type
        )

    def write_glossary(self, file):
        glossaries = json.load(file)
        for glossary in glossaries:
            try:

                glossary_obj = Glossary(**glossary)
                glossary_request = CreateGlossaryRequest(
                    name=glossary_obj.name.__root__,
                    displayName=glossary_obj.displayName,
                    reviewers=self._get_glossary_reviewers_entities(
                        glossary_obj.reviewers
                    ),
                    owner=self._get_glossary_owner_entity(glossary_obj.owner),
                    tags=glossary_obj.tags,
                    description=glossary_obj.description,
                )
                self.metadata.create_or_update(glossary_request)
                logger.info(
                    f"Successfully ingested Pipeline {glossary_request.displayName}"
                )
                self.status.records_written(f"Pipeline: {glossary_request.displayName}")
            except (APIError, ValidationError) as err:
                logger.error(f"Failed to ingest pipeline {glossary_obj.name}")
                logger.error(err)
                self.status.failure(f"Pipeline: {glossary_obj.name}")

    def _get_glossary_entity(self, glossary):
        glossary_obj = self.metadata.get_by_name(entity=Glossary, fqdn=glossary.name)
        return EntityReference(
            id=glossary_obj.id.__root__, name=glossary.name, type=glossary.type
        )

    def _get_glossary_term_entity(self, glossary_term):
        if glossary_term:
            try:
                print(glossary_term.name)
                parent = self.metadata.get_by_name(
                    entity=GlossaryTerm, fqdn=glossary_term.name
                )
                return EntityReference(
                    id=parent.id.__root__,
                    name=glossary_term.name,
                    type=glossary_term.type,
                )
            except:
                logger.error(f"Failed to fetch glossary term: {glossary_term.name}")

    def write_glossary_term(self, file):
        glossary_terms = json.load(file)
        for glossary_term in glossary_terms:
            try:
                glossary_term_obj = GlossaryTerm(**glossary_term)
                glossary_request = CreateGlossaryTermRequest(
                    name=glossary_term_obj.name,
                    glossary=self._get_glossary_entity(glossary_term_obj.glossary),
                    displayName=glossary_term_obj.displayName,
                    parent=self._get_glossary_term_entity(glossary_term_obj.parent),
                    synonyms=glossary_term_obj.synonyms,
                    relatedTerms=glossary_term_obj.relatedTerms,
                    references=glossary_term_obj.references,
                    reviewers=glossary_term_obj.reviewers,
                    tags=glossary_term_obj.tags,
                    description=glossary_term_obj.description,
                )
                self.metadata.create_or_update(glossary_request)
                logger.info(
                    f"Successfully ingested Pipeline {glossary_request.displayName}"
                )
                self.status.records_written(f"Pipeline: {glossary_request.displayName}")
            except (APIError, ValidationError) as err:
                logger.error(f"Failed to ingest pipeline {glossary_term_obj.name}")
                logger.error(err)
                self.status.failure(f"Pipeline: {glossary_term_obj.name}")

    def get_status(self):
        return self.status

    def close(self):
        self.metadata.close()
