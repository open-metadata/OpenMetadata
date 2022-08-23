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

import logging
import traceback
from logging.config import DictConfigurator
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createLocation import CreateLocationRequest
from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.policies.createPolicy import CreatePolicyRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.models.ometa_policy import OMetaPolicy
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.models.table_metadata import DeleteTable
from metadata.ingestion.models.table_tests import OMetaTableTest
from metadata.ingestion.models.user import OMetaUserProfile
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardUsage
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.sql_lineage import (
    _create_lineage_by_table_name,
    get_lineage_by_query,
)

# Prevent sqllineage from modifying the logger config
# Disable the DictConfigurator.configure method while importing LineageRunner
configure = DictConfigurator.configure
DictConfigurator.configure = lambda _: None
from sqllineage.runner import LineageRunner

# Reverting changes after import is done
DictConfigurator.configure = configure

logger = ingestion_logger()

# Allow types from the generated pydantic models
T = TypeVar("T", bound=BaseModel)


class MetadataRestSinkConfig(ConfigModel):
    api_endpoint: str = None


class MetadataRestSink(Sink[Entity]):
    config: MetadataRestSinkConfig
    status: SinkStatus

    # We want to catch any errors that might happen during the sink
    # pylint: disable=broad-except

    def __init__(
        self,
        config: MetadataRestSinkConfig,
        metadata_config: OpenMetadataConnection,
    ):

        self.config = config
        self.metadata_config = metadata_config
        self.status = SinkStatus()
        self.wrote_something = False
        self.charts_dict = {}
        self.metadata = OpenMetadata(self.metadata_config)
        self.role_entities = {}
        self.team_entities = {}

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = MetadataRestSinkConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def write_record(self, record: Entity) -> None:
        if isinstance(record, OMetaDatabaseAndTable):
            self.write_tables(record)
        elif isinstance(record, Topic):
            self.write_topics(record)
        elif isinstance(record, CreateChartRequest):
            self.write_charts(record)
        elif isinstance(record, CreateDashboardRequest):
            self.write_dashboards(record)
        elif isinstance(record, Location):
            self.write_locations(record)
        elif isinstance(record, OMetaPolicy):
            self.write_policies(record)
        elif isinstance(record, Pipeline):
            self.write_pipelines(record)
        elif isinstance(record, CreatePipelineRequest):
            self.write_pipelines_create(record)
        elif isinstance(record, AddLineageRequest):
            self.write_lineage(record)
        elif isinstance(record, OMetaUserProfile):
            self.write_users(record)
        elif isinstance(record, CreateMlModelRequest):
            self.write_ml_model(record)
        elif isinstance(record, OMetaTagAndCategory):
            self.write_tag_category(record)
        elif isinstance(record, DeleteTable):
            self.delete_table(record)
        elif isinstance(record, OMetaTableTest):
            self.write_table_tests(record)
        elif isinstance(record, OMetaPipelineStatus):
            self.write_pipeline_status(record)
        elif isinstance(record, DataModelLink):
            self.write_datamodel(record)
        elif isinstance(record, DashboardUsage):
            self.write_dashboard_usage(record)
        else:
            logging.debug(f"Processing Create request {type(record)}")
            self.write_create_request(record)

    def write_create_request(self, entity_request) -> None:
        """
        Send to OM the request creation received as is.
        :param entity_request: Create Entity request
        """
        log = f"{type(entity_request).__name__} [{entity_request.name.__root__}]"
        try:
            created = self.metadata.create_or_update(entity_request)
            if created:
                self.status.records_written(
                    f"{type(created).__name__}: {created.fullyQualifiedName.__root__}"
                )
                logger.info(f"Successfully ingested {log}")
            else:
                self.status.failure(log)
                logger.error(f"Failed to ingest {log}")

        except APIError as err:
            logger.error(f"Failed to ingest {log}")
            logger.error(err)
            self.status.failure(log)

    def write_datamodel(self, datamodel_link: DataModelLink) -> None:
        """
        Send to OM the DataModel based on a table ID
        :param datamodel_link: Table ID + Data Model
        """

        table: Table = self.metadata.get_by_name(entity=Table, fqn=datamodel_link.fqn)

        if table:
            self.metadata.ingest_table_data_model(
                table=table, data_model=datamodel_link.datamodel
            )
        else:
            logger.warning(
                f"Could not find any entity by Table FQN [{datamodel_link.fqn}] when adding DBT models."
            )

    def write_dashboard_usage(self, dashboard_usage: DashboardUsage) -> None:
        """
        Send a UsageRequest update to a dashboard entity
        :param dashboard_usage: dashboard entity and usage request
        """

        self.metadata.publish_dashboard_usage(
            dashboard=dashboard_usage.dashboard,
            dashboard_usage_request=dashboard_usage.usage,
        )
        logger.info(
            f"Successfully ingested usage for {dashboard_usage.dashboard.fullyQualifiedName.__root__}"
        )

    def write_tables(self, db_schema_and_table: OMetaDatabaseAndTable):
        try:
            db_request = CreateDatabaseRequest(
                name=db_schema_and_table.database.name,
                description=db_schema_and_table.database.description,
                service=EntityReference(
                    id=db_schema_and_table.database.service.id,
                    type="databaseService",
                ),
            )
            db = self.metadata.create_or_update(db_request)
            db_ref = EntityReference(
                id=db.id.__root__, name=db.name.__root__, type="database"
            )
            db_schema_request = CreateDatabaseSchemaRequest(
                name=db_schema_and_table.database_schema.name,
                description=db_schema_and_table.database_schema.description,
                database=db_ref,
            )
            db_schema = self.metadata.create_or_update(db_schema_request)
            db_schema_ref = EntityReference(
                id=db_schema.id.__root__,
                name=db_schema.name.__root__,
                type="databaseSchema",
            )
            if db_schema_and_table.table.description is not None:
                db_schema_and_table.table.description = (
                    db_schema_and_table.table.description.__root__.strip()
                )

            table_request = CreateTableRequest(
                name=db_schema_and_table.table.name.__root__,
                tableType=db_schema_and_table.table.tableType,
                columns=db_schema_and_table.table.columns,
                description=db_schema_and_table.table.description,
                databaseSchema=db_schema_ref,
                tableConstraints=db_schema_and_table.table.tableConstraints,
                tags=db_schema_and_table.table.tags,
            )
            if db_schema_and_table.table.viewDefinition:
                table_request.viewDefinition = (
                    db_schema_and_table.table.viewDefinition.__root__
                )

            created_table = self.metadata.create_or_update(table_request)
            if db_schema_and_table.location is not None:
                if db_schema_and_table.location.description is not None:
                    db_schema_and_table.location.description = (
                        db_schema_and_table.location.description.__root__.strip()
                    )
                location_request = CreateLocationRequest(
                    name=db_schema_and_table.location.name,
                    description=db_schema_and_table.location.description,
                    locationType=db_schema_and_table.location.locationType,
                    owner=db_schema_and_table.location.owner,
                    service=EntityReference(
                        id=db_schema_and_table.location.service.id,
                        type="storageService",
                    ),
                )
                location = self.metadata.create_or_update(location_request)
                self.metadata.add_location(table=created_table, location=location)
            if db_schema_and_table.table.sampleData is not None:
                try:
                    self.metadata.ingest_table_sample_data(
                        table=created_table,
                        sample_data=db_schema_and_table.table.sampleData,
                    )
                except Exception as e:
                    logging.error(
                        f"Failed to ingest sample data for table {db_schema_and_table.table.name}"
                    )

            if db_schema_and_table.table.tableProfile is not None:
                self.metadata.ingest_table_profile_data(
                    table=created_table,
                    table_profile=db_schema_and_table.table.tableProfile,
                )

            if db_schema_and_table.table.dataModel is not None:
                self.metadata.ingest_table_data_model(
                    table=created_table, data_model=db_schema_and_table.table.dataModel
                )

            if db_schema_and_table.table.tableQueries is not None:
                self.metadata.ingest_table_queries_data(
                    table=created_table,
                    table_queries=db_schema_and_table.table.tableQueries,
                )

            if (
                db_schema_and_table.table.viewDefinition is not None
                and db_schema_and_table.table.viewDefinition.__root__
            ):
                lineage_status = get_lineage_by_query(
                    self.metadata,
                    query=db_schema_and_table.table.viewDefinition.__root__,
                    service_name=db.service.name,
                    database_name=db_schema_and_table.database.name.__root__,
                    schema_name=db_schema_and_table.database_schema.name.__root__,
                )
                if not lineage_status:
                    self.create_lineage_via_es(db_schema_and_table, db_schema, db)

            logger.info(
                "Successfully ingested table {}.{}".format(
                    db_schema_and_table.database.name.__root__,
                    created_table.name.__root__,
                )
            )
            self.status.records_written(
                f"Table: {db_schema_and_table.database.name.__root__}.{created_table.name.__root__}"
            )
        except (APIError, ValidationError) as err:
            logger.error(
                "Failed to ingest table {} in database {}".format(
                    db_schema_and_table.table.name.__root__,
                    db_schema_and_table.database.name.__root__,
                )
            )
            logger.debug(traceback.format_exc())
            logger.error(err)
            self.status.failure(f"Table: {db_schema_and_table.table.name.__root__}")

    def write_topics(self, topic: Topic) -> None:
        try:
            topic_request = CreateTopicRequest(
                name=topic.name,
                displayName=topic.displayName,
                description=topic.description,
                service=topic.service,
                partitions=topic.partitions,
                replicationFactor=topic.replicationFactor,
                maximumMessageSize=topic.maximumMessageSize,
                retentionTime=topic.retentionTime,
                cleanupPolicies=topic.cleanupPolicies,
                topicConfig=topic.topicConfig,
            )
            if topic.schemaType:
                topic_request.schemaType = topic.schemaType
                topic_request.schemaText = topic.schemaText
            created_topic = self.metadata.create_or_update(topic_request)

            if topic.sampleData:
                self.metadata.ingest_topic_sample_data(created_topic, topic.sampleData)

            logger.info(f"Successfully ingested topic {created_topic.name.__root__}")
            self.status.records_written(f"Topic: {created_topic.name.__root__}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest topic {topic.name.__root__}")
            logger.error(err)
            self.status.failure(f"Topic: {topic.name}")

    def write_charts(self, chart: CreateChartRequest):
        try:
            created_chart = self.metadata.create_or_update(chart)
            logger.info(f"Successfully ingested chart {created_chart.displayName}")
            self.status.records_written(f"Chart: {created_chart.displayName}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest chart {chart.displayName}")
            logger.error(err)
            self.status.failure(f"Chart: {chart.displayName}")

    def write_dashboards(self, dashboard: CreateDashboardRequest):
        try:
            created_dashboard = self.metadata.create_or_update(dashboard)
            logger.info(
                f"Successfully ingested dashboard {created_dashboard.displayName}"
            )
            self.status.records_written(f"Dashboard: {created_dashboard.displayName}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest dashboard {dashboard.name}")
            logger.error(err)
            self.status.failure(f"Dashboard {dashboard.name}")

    def write_locations(self, location: Location):
        try:
            created_location = self._create_location(location)
            logger.info(f"Successfully ingested Location {created_location.name}")
            self.status.records_written(f"Location: {created_location.name}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest Location {location.name}")
            logger.error(err)
            self.status.failure(f"Location: {location.name}")

    def write_pipelines_create(self, pipeline: CreatePipelineRequest) -> None:
        """
        Proper implementation of write_pipelines.
        Send the CreatePipelineRequest to the OM API
        :param pipeline: Create Pipeline Entity
        """
        try:
            created_pipeline = self.metadata.create_or_update(pipeline)
            logger.info(
                f"Successfully ingested Pipeline {created_pipeline.displayName or created_pipeline.name.__root__}"
            )
            self.status.records_written(
                f"Pipeline: {created_pipeline.displayName or created_pipeline.name.__root__}"
            )
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest pipeline {pipeline.name}")
            logger.error(err)
            self.status.failure(f"Pipeline: {pipeline.name}")

    def write_pipelines(self, pipeline: Pipeline):
        try:
            pipeline_request = CreatePipelineRequest(
                name=pipeline.name,
                displayName=pipeline.displayName,
                description=pipeline.description,
                pipelineUrl=pipeline.pipelineUrl,
                tasks=pipeline.tasks,
                service=pipeline.service,
            )
            created_pipeline = self.metadata.create_or_update(pipeline_request)
            logger.info(
                f"Successfully ingested Pipeline {created_pipeline.displayName}"
            )
            self.status.records_written(f"Pipeline: {created_pipeline.displayName}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest pipeline {pipeline.name}")
            logger.error(err)
            self.status.failure(f"Pipeline: {pipeline.name}")

    def write_policies(self, ometa_policy: OMetaPolicy) -> None:
        try:
            created_location = None
            if ometa_policy.location is not None:
                created_location = self._create_location(ometa_policy.location)
                logger.info(f"Successfully ingested Location {created_location.name}")
                self.status.records_written(f"Location: {created_location.name}")

            policy_request = CreatePolicyRequest(
                name=ometa_policy.policy.name,
                displayName=ometa_policy.policy.displayName,
                description=ometa_policy.policy.description,
                owner=ometa_policy.policy.owner,
                policyUrl=ometa_policy.policy.policyUrl,
                policyType=ometa_policy.policy.policyType,
                rules=ometa_policy.policy.rules,
                location=created_location.id if created_location else None,
            )
            created_policy = self.metadata.create_or_update(policy_request)
            logger.info(f"Successfully ingested Policy {created_policy.name}")
            self.status.records_written(f"Policy: {created_policy.name}")

        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest Policy {ometa_policy.policy.name}")
            logger.error(err)
            logger.debug(traceback.format_exc())
            self.status.failure(f"Policy: {ometa_policy.policy.name}")

    def _create_location(self, location: Location) -> Location:
        location_request = CreateLocationRequest(
            name=location.name,
            path=location.path,
            description=location.description,
            locationType=location.locationType,
            tags=location.tags,
            owner=location.owner,
            service=location.service,
        )
        return self.metadata.create_or_update(location_request)

    def write_tag_category(self, record: OMetaTagAndCategory):
        try:
            self.metadata.create_or_update_tag_category(
                tag_category_body=record.category_name,
                category_name=record.category_name.name.__root__,
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)
        try:
            self.metadata.create_or_update_primary_tag(
                category_name=record.category_name.name.__root__,
                primary_tag_body=record.category_details,
                primary_tag_fqn=fqn.build(
                    metadata=self.metadata,
                    entity_type=Tag,
                    tag_category_name=record.category_name.name.__root__,
                    tag_name=record.category_details.name.__root__,
                ),
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def write_lineage(self, add_lineage: AddLineageRequest):
        try:
            created_lineage = self.metadata.add_lineage(add_lineage)
            logger.info(f"Successfully added Lineage {created_lineage}")
            self.status.records_written(f"Lineage: {created_lineage}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest lineage {add_lineage}")
            logger.error(err)
            self.status.failure(f"Lineage: {add_lineage}")

    def write_ml_model(self, model: CreateMlModelRequest):
        try:
            created_model = self.metadata.create_or_update(model)
            logger.info(f"Successfully added Model {created_model.name}")
            self.status.records_written(f"Model: {created_model.name}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest Model {model.name}")
            logger.error(err)
            self.status.failure(f"Model: {model.name}")

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

    def write_users(self, record: OMetaUserProfile):
        """
        Given a User profile (User + Teams + Roles create requests):
        1. Check if role & team exist, otherwise create
        2. Add ids of role & team to the User
        3. Create or update User
        """

        # Create roles if they don't exist
        if record.roles:  # Roles can be optional
            role_ids = []
            for role in record.roles:
                try:
                    role_entity = self.metadata.get_by_name(
                        entity=Role, fqn=str(role.name.__root__)
                    )
                except APIError:
                    role_entity = self._create_role(role)
                if role_entity:
                    role_ids.append(role_entity.id)
        else:
            role_ids = None

        # Create teams if they don't exist
        if record.teams:  # Teams can be optional
            team_ids = []
            for team in record.teams:
                try:
                    team_entity = self.metadata.get_by_name(
                        entity=Team, fqn=str(team.name.__root__)
                    )
                    if not team_entity:
                        raise APIError(
                            error={
                                "message": "Creating a new team {}".format(
                                    team.name.__root__
                                )
                            }
                        )
                    team_ids.append(team_entity.id.__root__)
                except APIError:
                    team_entity = self._create_team(team)
                    team_ids.append(team_entity.id.__root__)
                except Exception as err:
                    logger.error(err)
        else:
            team_ids = None

        # Update user data with the new Role and Team IDs
        user_profile = record.user.dict(exclude_unset=True)
        user_profile["roles"] = role_ids
        user_profile["teams"] = team_ids
        metadata_user = CreateUserRequest(**user_profile)

        # Create user
        try:
            user = self.metadata.create_or_update(metadata_user)
            self.status.records_written(user.displayName)
            logger.info("User: {}".format(user.displayName))
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def delete_table(self, record: DeleteTable):
        try:
            self.metadata.delete(entity=Table, entity_id=record.table.id)
            logger.info(
                f"{record.table.name} doesn't exist in source state, marking it as deleted"
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def write_table_tests(self, record: OMetaTableTest) -> None:
        """
        Iterate over all table_tests and column_tests
        for the given table and add them to the backend.

        :param record: Sample data record
        """
        try:
            # Fetch the table that we have already ingested
            table = self.metadata.get_by_name(entity=Table, fqn=record.table_name)

            test = None
            if record.table_test:
                self.metadata.add_table_test(table=table, table_test=record.table_test)
                test = record.table_test.testCase.tableTestType.value

            if record.column_test:
                self.metadata.add_column_test(table=table, col_test=record.column_test)
                test = record.column_test.testCase.columnTestType.value

            logger.info(f"Table Tests: {record.table_name}.{test}")
            self.status.records_written(f"Table Tests: {record.table_name}.{test}")
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def create_lineage_via_es(self, db_schema_and_table, db_schema, db):
        try:
            parser = LineageRunner(db_schema_and_table.table.viewDefinition.__root__)
            to_table_name = db_schema_and_table.table.name.__root__

            for from_table_name in parser.source_tables:

                _create_lineage_by_table_name(
                    metadata=self.metadata,
                    from_table=str(from_table_name),
                    to_table=f"{db_schema.name.__root__}.{to_table_name}",
                    service_name=db.service.name,
                    database_name=db_schema_and_table.database.name.__root__,
                    schema_name=db_schema_and_table.table.viewDefinition.__root__,
                    query=db_schema_and_table.table.viewDefinition.__root__,
                )

        except Exception as e:
            logger.error("Failed to create view lineage")
            logger.debug(f"Query : {db_schema_and_table.table.viewDefinition.__root__}")
            logger.debug(traceback.format_exc())

    def write_pipeline_status(self, record: OMetaPipelineStatus) -> None:
        """
        Use the /status endpoint to add PipelineStatus
        data to a Pipeline Entity
        """
        try:
            pipeline = self.metadata.get_by_name(
                entity=Pipeline, fqn=record.pipeline_fqn
            )
            self.metadata.add_pipeline_status(
                pipeline=pipeline, status=record.pipeline_status
            )
            self.status.records_written(f"Pipeline Status: {record.pipeline_fqn}")

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def get_status(self):
        return self.status

    def close(self):
        pass
