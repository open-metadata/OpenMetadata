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
import shutil
import traceback
from datetime import datetime

from pydantic import ValidationError

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceRequest,
)
from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.bulk_sink import BulkSink, BulkSinkStatus
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import EmptyPayloadException, OpenMetadata
from metadata.utils import fqn

logger = logging.getLogger(__name__)


class MetadataMigrateSinkConfig(ConfigModel):
    dirPath: str


class MigrateBulkSink(BulkSink):
    config: MetadataMigrateSinkConfig
    DESCRIPTION_PATH = "/description"

    def __init__(
        self,
        config: MetadataMigrateSinkConfig,
        metadata_config: OpenMetadataConnection,
    ):

        self.config = config
        self.metadata_config = metadata_config
        self.service_name = None
        self.wrote_something = False
        self.metadata = OpenMetadata(self.metadata_config)
        self.status = BulkSinkStatus()
        self.table_join_dict = {}
        self.role_entities = {}
        self.team_entities = {}
        self.today = datetime.today().strftime("%Y-%m-%d")
        self.database_service_map = {
            service.value.lower(): service.value for service in DatabaseServiceType
        }

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = MetadataMigrateSinkConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def write_records(self) -> None:

        with open(f"{self.config.dirPath}/user.json") as file:
            self.write_users(file)

        with open(f"{self.config.dirPath}/glossary.json") as file:
            self.write_glossary(file)

        with open(f"{self.config.dirPath}/glossary_term.json") as file:
            self.write_glossary_term(file)

        with open(f"{self.config.dirPath}/tag.json") as file:
            self.write_tag(file)

        with open(f"{self.config.dirPath}/messaging_service.json") as file:
            self.write_messaging_services(file)

        with open(f"{self.config.dirPath}/pipeline_service.json") as file:
            self.write_pipeline_services(file)

        with open(f"{self.config.dirPath}/database_service.json") as file:
            self.write_database_services(file)

        with open(f"{self.config.dirPath}/table.json") as file:
            self.write_tables(file)

        with open(f"{self.config.dirPath}/topic.json") as file:
            self.write_topics(file)

        with open(f"{self.config.dirPath}/pipeline.json") as file:
            self.write_pipelines(file)

    def _separate_fqn(self, fqn):
        database_schema, table = fqn.split(".")[-2:]
        if not database_schema:
            database_schema = None
        return {"database": None, "database_schema": database_schema, "name": table}

    def update_through_patch(self, entity, id, value, path, op):
        """
        Update the Entity Through Patch API
        """
        data = [{"op": op, "path": path, "value": value}]
        resp = self.metadata.client.patch(
            "{}/{}".format(self.metadata.get_suffix(entity), id), data=json.dumps(data)
        )
        if not resp:
            raise EmptyPayloadException(
                f"Got an empty response when trying to PATCH to {self.metadata.get_suffix(entity)}, {data.json()}"
            )

    def write_columns(self, columns, table_id):
        for i in range(len(columns)):
            if columns[i].get("description"):
                self.update_through_patch(
                    Table,
                    table_id,
                    columns[i].get("description"),
                    f"/columns/{i}/description",
                    "add",
                )
            if columns[i].get("tags"):
                tags_list = columns[i].get("tags", [])
                self._add_tags_by_patch(
                    tags_list=tags_list,
                    entity=Table,
                    entity_id=table_id,
                    path=f"/columns/{i}/tags",
                )

    def write_tables(self, file):
        for table in file.readlines():
            table = json.loads(table)
            try:

                filters = self._separate_fqn(table.get("fullyQualifiedName"))

                fqn_search_string = fqn._build(
                    table.get("service").get("name"),
                    filters.get("database", "*"),
                    filters.get("database_schema", "*"),
                    filters.get("name"),
                )

                table_entities = self.metadata.es_search_from_fqn(
                    entity_type=Table,
                    fqn_search_string=fqn_search_string,
                )
                if len(table_entities) < 1:
                    continue
                table_entity: Table = table_entities[0]
                self.update_through_patch(
                    DatabaseSchema,
                    table_entity.databaseSchema.id.__root__,
                    table.get("database").get("description"),
                    self.DESCRIPTION_PATH,
                    "add",
                )
                self._add_entity_owner_by_patch(
                    owner_dict=table.get("database").get("owner"),
                    entity=DatabaseSchema,
                    entity_id=table_entity.databaseSchema.id.__root__,
                )
                self.update_through_patch(
                    Table,
                    table_entity.id.__root__,
                    table.get("description"),
                    self.DESCRIPTION_PATH,
                    "add",
                )
                self._add_entity_owner_by_patch(
                    owner_dict=table.get("owner"),
                    entity=Table,
                    entity_id=table_entity.id.__root__,
                )
                columns = table.get("columns")
                self.write_columns(columns, table_entity.id.__root__)
                logger.info(
                    "Successfully ingested table {}.{}".format(
                        table_entity.database.name,
                        table_entity.name.__root__,
                    )
                )

            except (APIError, ValidationError) as err:
                logger.error(
                    "Failed to ingest table {} in database {} ".format(
                        table.get("name"),
                        table.get("database").get("name"),
                    )
                )
                logger.debug(traceback.format_exc())
                logger.error(err)
                self.status.failure("Table: {}".format(table.get("name")))

    def _create_role(self, create_role) -> Role:
        try:
            create_req = CreateRoleRequest(
                name=create_role.name, displayName=create_role.displayName, policies=[]
            )
            role = self.metadata.create_or_update(create_req)
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

    def _get_role_ids(self, user_obj: User):
        if user_obj.roles:  # Roles can be optional
            role_ids = []
            for role in user_obj.roles.__root__:
                role_entity = self.metadata.get_by_name(entity=Role, fqn=str(role.name))
                if role_entity:
                    role_ids.append(role_entity.id)
                else:
                    role_entity = self._create_role(role)
        else:
            role_ids = None

    def _get_team_ids(self, user_obj):
        if user_obj.teams:  # Teams can be optional
            team_ids = []
            for team in user_obj.teams.__root__:
                try:
                    team_entity = self.metadata.get_by_name(entity=Team, fqn=team.name)
                    if not team_entity:
                        raise APIError(
                            error={
                                "message": "Creating a new team {}".format(team.name)
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
            return team_ids

    def write_users(self, file):
        """
        Given a User profile (User + Teams + Roles create requests):
        1. Check if role & team exist, otherwise create
        2. Add ids of role & team to the User
        3. Create or update User
        """
        try:
            for user in file.readlines():
                user_obj = User(**json.loads(user))
                # Create roles if they don't exist
                role_ids = self._get_role_ids(user_obj=user_obj)

                # Create teams if they don't exist
                team_ids = self._get_team_ids(user_obj=user_obj)

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

    def _add_entity_owner_by_patch(self, owner_dict, entity, entity_id):
        if owner_dict:
            owner = self.metadata.get_by_name(
                Team if owner_dict.get("type") == "team" else User,
                owner_dict.get("name"),
            )
            if owner:
                self.update_through_patch(
                    entity,
                    entity_id,
                    {"id": str(owner.id.__root__), "type": owner_dict.get("type")},
                    "/owner",
                    "add",
                )

    def _add_tags_by_patch(self, tags_list, entity, entity_id, path="/tags"):
        for i in range(len(tags_list)):
            value = {
                "tagFQN": tags_list[i].get("tagFQN"),
                "labelType": tags_list[i].get("labelType"),
                "state": tags_list[i].get("state"),
                "source": tags_list[i].get("source"),
            }
            self.update_through_patch(
                entity,
                entity_id,
                value,
                f"{path}/{i}",
                "add",
            )

    def write_topics(self, file) -> None:
        for topic in file.readlines():
            topic = json.loads(topic)
            try:
                topic_obj: Topic = self.metadata.get_by_name(
                    Topic, topic.get("fullyQualifiedName")
                )
                self.update_through_patch(
                    Topic,
                    topic_obj.id.__root__,
                    topic.get("description"),
                    self.DESCRIPTION_PATH,
                    "add",
                )
                tags_list = topic.get("tags", [])
                self._add_tags_by_patch(
                    tags_list=tags_list, entity=Topic, entity_id=topic_obj.id.__root__
                )
                self._add_entity_owner_by_patch(
                    owner_dict=topic.get("owner"),
                    entity=Topic,
                    entity_id=topic_obj.id.__root__,
                )
                logger.info(f"Successfully ingested topic {topic.get('name')}")
                self.status.records_written(f"Topic: {topic.get('name')}")
            except (APIError, ValidationError) as err:
                logger.error(f"Failed to ingest topic {topic.get('name')}")
                logger.error(err)
                self.status.failure(f"Topic: {topic.get('name')}")

    def write_pipelines(self, file):
        for pipeline in file.readlines():
            pipeline = json.loads(pipeline)
            try:
                pipelines_obj: Pipeline = self.metadata.get_by_name(
                    Pipeline, pipeline.get("fullyQualifiedName")
                )
                if pipelines_obj:
                    self.update_through_patch(
                        Pipeline,
                        pipelines_obj.id.__root__,
                        pipeline.get("description"),
                        self.DESCRIPTION_PATH,
                        "add",
                    )
                    self._add_entity_owner_by_patch(
                        owner_dict=pipeline.get("owner"),
                        entity=Pipeline,
                        entity_id=pipelines_obj.id.__root__,
                    )
                    tags_list = pipeline.get("tags", [])
                    self._add_tags_by_patch(
                        tags_list=tags_list,
                        entity=Pipeline,
                        entity_id=pipelines_obj.id.__root__,
                    )
                    logger.info(f"Successfully ingested topic {pipeline.get('name')}")
                    self.status.records_written(f"Topic: {pipeline.get('name')}")

            except (APIError, ValidationError) as err:
                logger.error(f"Failed to ingest pipeline {pipeline.get('name')}")
                logger.error(err)
                self.status.failure(f"Pipeline: {pipeline.get('name')}")

    def _get_glossary_reviewers_entities(self, reviewers):
        users = []
        for reviewer in reviewers:
            user = self.metadata.get_by_name(entity=User, fqn=reviewer.name)
            users.append(
                EntityReference(
                    id=user.id.__root__, name=user.name.__root__, type=reviewer.type
                )
            )
        return users

    def _get_glossary_owner_entity(self, owner):
        user = self.metadata.get_by_name(entity=User, fqn=owner.name)
        return EntityReference(
            id=user.id.__root__, name=user.name.__root__, type=owner.type
        )

    def write_glossary(self, file):
        for glossary in file.readlines():
            try:
                glossary_obj = Glossary(**json.dumps(glossary))
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
        glossary_obj = self.metadata.get_by_name(entity=Glossary, fqn=glossary.name)
        return EntityReference(
            id=glossary_obj.id.__root__, name=glossary.name, type=glossary.type
        )

    def _get_glossary_term_entity(self, glossary_term):
        if glossary_term:
            try:
                parent = self.metadata.get_by_name(
                    entity=GlossaryTerm, fqn=glossary_term.name
                )
                return EntityReference(
                    id=parent.id.__root__,
                    name=glossary_term.name,
                    type=glossary_term.type,
                )
            except Exception:
                logger.error(f"Failed to fetch glossary term: {glossary_term.name}")

    def write_glossary_term(self, file):
        for glossary_term in file.readlines():
            try:
                glossary_term_obj = GlossaryTerm(**json.loads(glossary_term))
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

    def _create_tag_category(self, tag_category: CreateTagCategoryRequest):
        resp = self.metadata.client.post(
            self.metadata.get_suffix(CreateTagCategoryRequest), data=tag_category.json()
        )
        if not resp:
            raise EmptyPayloadException(
                f"Got an empty response when trying to POST to {self.metadata.get_suffix(CreateTagCategoryRequest)}, {tag_category.json()}"
            )

    def _add_tag_to_category(self, tag_category_name, tag: CreateTagRequest):
        resp = self.metadata.client.post(
            self.metadata.get_suffix(CreateTagRequest) + "/" + tag_category_name,
            data=tag.json(),
        )
        if not resp:
            raise EmptyPayloadException(
                f"Got an empty response when trying to POST to {self.metadata.get_suffix(CreateTagRequest)}, {tag.json()}"
            )

    def write_tag(self, file):
        for tag_category in file.readlines():
            tag_category = json.loads(tag_category)
            try:
                tag_category_request = CreateTagCategoryRequest(
                    name=tag_category.get("name"),
                    description=tag_category.get("description"),
                    categoryType=tag_category.get("categoryType"),
                )
                self._create_tag_category(tag_category_request)
            except (APIError, ValidationError) as err:
                logger.error(f"Failed to ingest TagCategory {tag_category.get('name')}")
                logger.error(err)
                self.status.failure(f"TagCategory: {tag_category.get('name')}")

            try:
                for tag in tag_category.get("children", []):
                    tag_request = CreateTagRequest(
                        name=tag.get("name"), description=tag.get("description")
                    )

                    self._add_tag_to_category(tag_category.get("name"), tag_request)

                logger.info(f"Successfully ingested Tag {tag_category_request.name}")
                self.status.records_written(f"Tag: {tag_category_request.name}")

            except (APIError, ValidationError) as err:
                logger.error(f"Failed to ingest tag {tag_category.get('name')}")
                logger.error(err)
                self.status.failure(f"Tag: {tag_category.get('name')}")

    def write_messaging_services(self, file):
        for messaging_service in file.readlines():
            messaging_service = json.loads(messaging_service)
            try:
                service_obj: MessagingService = self.metadata.get_by_name(
                    MessagingService, messaging_service.get("name")
                )
                if not service_obj:
                    continue
                owner_dict = messaging_service.get("owner")
                owner_ref = None
                if owner_dict:
                    owner = self.metadata.get_by_name(
                        Team if owner_dict.get("type") == "team" else User,
                        owner_dict.get("name"),
                    )
                    owner_ref = EntityReference(
                        id=owner.id,
                        name=owner_dict.get("name"),
                        type=owner_dict.get("type"),
                    )

                service_request = CreateMessagingServiceRequest(
                    name=messaging_service.get("name"),
                    description=messaging_service.get("description"),
                    serviceType=messaging_service.get("serviceType"),
                    connection=service_obj.connection,
                    owner=owner_ref,
                )
                self.metadata.create_or_update(service_request)
                logger.info(
                    f"Successfully ingested messaging service {messaging_service.get('name')}"
                )
                self.status.records_written(f"Tag: {messaging_service.get('name')}")
            except (APIError, ValidationError) as err:
                logger.error(f"Failed to ingest tag {messaging_service.get('name')}")
                logger.error(err)
                self.status.failure(f"Tag: {messaging_service.get('name')}")

    def write_pipeline_services(self, file):
        for pipeline_service in file.readlines():
            pipeline_service = json.loads(pipeline_service)
            try:
                owner_dict = pipeline_service.get("owner")
                owner_ref = None
                if owner_dict:
                    owner = self.metadata.get_by_name(
                        Team if owner_dict.get("type") == "team" else User,
                        owner_dict.get("name"),
                    )
                    owner_ref = EntityReference(
                        id=owner.id,
                        name=owner_dict.get("name"),
                        type=owner_dict.get("type"),
                    )

                service_request = CreatePipelineServiceRequest(
                    name=pipeline_service.get("name"),
                    description=pipeline_service.get("description"),
                    serviceType=pipeline_service.get("serviceType"),
                    pipelineUrl=pipeline_service.get("pipelineUrl"),
                    owner=owner_ref,
                )
                self.metadata.create_or_update(service_request)
                logger.info(
                    f"Successfully ingested messaging service {pipeline_service.get('name')}"
                )
                self.status.records_written(f"Tag: {pipeline_service.get('name')}")
            except (APIError, ValidationError) as err:
                logger.error(f"Failed to ingest tag {pipeline_service.get('name')}")
                logger.error(err)
                self.status.failure(f"Tag: {pipeline_service.get('name')}")

    def write_database_services(self, file):
        for databas_services in file.readlines():
            databas_services = json.loads(databas_services)
            try:
                service_obj: DatabaseService = self.metadata.get_by_name(
                    DatabaseService, databas_services.get("name")
                )
                if not service_obj:
                    continue
                owner_dict = databas_services.get("owner")
                owner_ref = None
                if owner_dict:
                    owner = self.metadata.get_by_name(
                        Team if owner_dict.get("type") == "team" else User,
                        owner_dict.get("name"),
                    )
                    owner_ref = EntityReference(
                        id=owner.id,
                        name=owner_dict.get("name"),
                        type=owner_dict.get("type"),
                    )

                database_service = CreateDatabaseServiceRequest(
                    name=databas_services.get("name"),
                    description=databas_services.get("description"),
                    serviceType=self.database_service_map.get(
                        databas_services.get("serviceType").lower(), "Mysql"
                    ),
                    connection=service_obj.connection,
                    owner=owner_ref,
                )

                self.metadata.create_or_update(database_service)
                logger.info(
                    f"Successfully ingested messaging service {databas_services.get('name')}"
                )
                self.status.records_written(f"Tag: {databas_services.get('name')}")
            except (APIError, ValidationError) as err:
                logger.error(f"Failed to ingest tag {databas_services.get('name')}")
                logger.error(err)
                self.status.failure(f"Tag: {databas_services.get('name')}")

    def get_status(self):
        return self.status

    def close(self):
        shutil.rmtree(self.config.dirPath)
        self.metadata.close()
