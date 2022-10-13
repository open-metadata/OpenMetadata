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
"""
This is the main used sink for all OM Workflows.
It picks up the generated Entities and send them
to the OM API.
"""
import traceback
from functools import singledispatch
from typing import Optional, TypeVar

from pydantic import BaseModel, ValidationError
from requests.exceptions import HTTPError

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createLocation import CreateLocationRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.models.profile_data import OMetaTableProfileSampleData
from metadata.ingestion.models.table_metadata import DeleteTable
from metadata.ingestion.models.tests_data import (
    OMetaTestCaseResultsSample,
    OMetaTestCaseSample,
    OMetaTestSuiteSample,
)
from metadata.ingestion.models.user import OMetaUserProfile
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardUsage
from metadata.ingestion.source.database.database_service import (
    DataModelLink,
    TableLocationLink,
)
from metadata.utils import fqn
from metadata.utils.helpers import calculate_execution_time
from metadata.utils.logger import get_add_lineage_log_str, ingestion_logger

logger = ingestion_logger()

# Allow types from the generated pydantic models
T = TypeVar("T", bound=BaseModel)


class MetadataRestSinkConfig(ConfigModel):
    api_endpoint: str = None


class MetadataRestSink(Sink[Entity]):
    """
    Sink implementation that sends OM Entities
    to the OM server API
    """

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

        # Prepare write record dispatching
        self.write_record = singledispatch(self.write_record)
        self.write_record.register(OMetaDatabaseAndTable, self.write_tables)
        self.write_record.register(AddLineageRequest, self.write_lineage)
        self.write_record.register(OMetaUserProfile, self.write_users)
        self.write_record.register(OMetaTagAndCategory, self.write_tag_category)
        self.write_record.register(DeleteTable, self.delete_table)
        self.write_record.register(OMetaPipelineStatus, self.write_pipeline_status)
        self.write_record.register(DataModelLink, self.write_datamodel)
        self.write_record.register(TableLocationLink, self.write_table_location_link)
        self.write_record.register(DashboardUsage, self.write_dashboard_usage)
        self.write_record.register(
            OMetaTableProfileSampleData, self.write_profile_sample_data
        )
        self.write_record.register(OMetaTestSuiteSample, self.write_test_suite_sample)
        self.write_record.register(OMetaTestCaseSample, self.write_test_case_sample)
        self.write_record.register(
            OMetaTestCaseResultsSample, self.write_test_case_results_sample
        )

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = MetadataRestSinkConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    @calculate_execution_time
    def write_record(self, record: Entity) -> None:
        """
        Default implementation for the single dispatch
        """

        logger.debug(f"Processing Create request {type(record)}")
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

        except (APIError, HTTPError) as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to ingest {log} due to api request failure: {err}")
            self.status.failure(log)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to ingest {log}: {exc}")
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

    def write_table_location_link(self, table_location_link: TableLocationLink) -> None:
        """
        Send to OM the Table and Location Link based on FQNs
        :param table_location_link: Table FQN + Location FQN
        """
        try:
            table = self.metadata.get_by_name(
                entity=Table, fqn=table_location_link.table_fqn
            )
            location = self.metadata.get_by_name(
                entity=Location, fqn=table_location_link.location_fqn
            )
            self.metadata.add_location(table=table, location=location)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to write table location link [{table_location_link}]: {exc}"
            )
            self.status.failure(
                f"{table_location_link.table_fqn} <-> {table_location_link.location_fqn}"
            )

    def write_dashboard_usage(self, dashboard_usage: DashboardUsage) -> None:
        """
        Send a UsageRequest update to a dashboard entity
        :param dashboard_usage: dashboard entity and usage request
        """
        try:

            self.metadata.publish_dashboard_usage(
                dashboard=dashboard_usage.dashboard,
                dashboard_usage_request=dashboard_usage.usage,
            )
            logger.info(
                f"Successfully ingested usage for {dashboard_usage.dashboard.fullyQualifiedName.__root__}"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to write dashboard usage [{dashboard_usage}]: {exc}")

    def write_tables(self, db_schema_and_table: OMetaDatabaseAndTable) -> None:
        """Based on all the table information, send that to OM API

        This method is only used for testing and should be deprecated.
        """
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
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Failed to ingest sample data for table {db_schema_and_table.table.name}: {exc}"
                    )

            if db_schema_and_table.table.profile is not None:
                self.metadata.ingest_profile_data(
                    table=db_schema_and_table.table,
                    profile_request=CreateTableProfileRequest(
                        tableProfile=db_schema_and_table.table.profile
                    ),
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

            logger.info(
                "Successfully ingested table"
                f" {db_schema_and_table.database.name.__root__}.{created_table.name.__root__}"
            )
            self.status.records_written(
                f"Table: {db_schema_and_table.database.name.__root__}.{created_table.name.__root__}"
            )
        except (APIError, HTTPError, ValidationError) as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to ingest table {db_schema_and_table.table.name.__root__}"
                f" in database {db_schema_and_table.database.name.__root__}: {err}"
            )
            logger.error(err)
            self.status.failure(f"Table: {db_schema_and_table.table.name.__root__}")

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected error writing db schema and table [{db_schema_and_table}]: {exc}"
            )

    def write_tag_category(self, record: OMetaTagAndCategory) -> None:
        """PUT Tag Category and Primary Tag to OM API

        Args:
            record (OMetaTagAndCategory): Tag information

        Return:
            None

        """
        try:
            self.metadata.create_or_update_tag_category(
                tag_category_body=record.category_name,
                category_name=record.category_name.name.__root__,
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected error writing tag category [{record.category_name}]: {exc}"
            )
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
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected error writing tag category [{record.category_name}]: {exc}"
            )

    def write_lineage(self, add_lineage: AddLineageRequest):
        try:
            created_lineage = self.metadata.add_lineage(add_lineage)
            created_lineage_info = created_lineage["entity"]["fullyQualifiedName"]

            logger.info(f"Successfully added Lineage from {created_lineage_info}")
            self.status.records_written(f"Lineage from: {created_lineage_info}")
        except (APIError, ValidationError) as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to ingest lineage [{get_add_lineage_log_str(add_lineage)}]: {err}"
            )
            self.status.failure(f"Lineage: {get_add_lineage_log_str(add_lineage)}")
        except (KeyError, ValueError) as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to extract lineage information after sink - {err}")

    def _create_role(self, create_role: CreateRoleRequest) -> Optional[Role]:
        try:
            role = self.metadata.create_or_update(create_role)
            self.role_entities[role.name] = str(role.id.__root__)
            return role
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unexpected error creating role [{create_role}]: {exc}")

        return None

    def _create_team(self, create_team: CreateTeamRequest) -> Optional[Team]:
        try:
            team = self.metadata.create_or_update(create_team)
            self.team_entities[team.name.__root__] = str(team.id.__root__)
            return team
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unexpected error creating team [{create_team}]: {exc}")

        return None

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
                        entity=Role, fqn=str(role.name.__root__.__root__)
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
                                "message": f"Creating a new team {team.name.__root__}"
                            }
                        )
                    team_ids.append(team_entity.id.__root__)
                except APIError:
                    team_entity = self._create_team(team)
                    team_ids.append(team_entity.id.__root__)
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Unexpected error writing team [{team}]: {exc}")
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
            logger.info(f"User: {user.displayName}")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unexpected error writing user [{metadata_user}]: {exc}")

    def delete_table(self, record: DeleteTable):
        try:
            self.metadata.delete(entity=Table, entity_id=record.table.id)
            logger.info(
                f"{record.table.name} doesn't exist in source state, marking it as deleted"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unexpected error deleting table [{record.table.name}]: {exc}"
            )

    def write_pipeline_status(self, record: OMetaPipelineStatus) -> None:
        """
        Use the /status endpoint to add PipelineStatus
        data to a Pipeline Entity
        """
        try:
            self.metadata.add_pipeline_status(
                fqn=record.pipeline_fqn, status=record.pipeline_status
            )
            self.status.records_written(f"Pipeline Status: {record.pipeline_fqn}")

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unexpected error writing pipeline status [{record}]: {exc}")

    def write_profile_sample_data(self, record: OMetaTableProfileSampleData):
        """
        Use the /tableProfile endpoint to ingest sample profile data
        """
        try:
            self.metadata.ingest_profile_data(
                table=record.table, profile_request=record.profile
            )

            logger.info(
                f"Successfully ingested profile for table {record.table.name.__root__}"
            )
            self.status.records_written(f"Profile: {record.table.name.__root__}")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unexpected error writing profile sample data [{record}]: {exc}"
            )

    def write_test_suite_sample(self, record: OMetaTestSuiteSample):
        """
        Use the /testSuite endpoint to ingest sample test suite
        """
        try:
            self.metadata.create_or_update(record.test_suite)
            logger.info(
                f"Successfully created test Suite {record.test_suite.name.__root__}"
            )
            self.status.records_written(f"testSuite: {record.test_suite.name.__root__}")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unexpected error writing test suite sample [{record}]: {exc}"
            )

    def write_test_case_sample(self, record: OMetaTestCaseSample):
        """
        Use the /testCase endpoint to ingest sample test suite
        """
        try:
            self.metadata.create_or_update(record.test_case)
            logger.info(
                f"Successfully created test case {record.test_case.name.__root__}"
            )
            self.status.records_written(f"testCase: {record.test_case.name.__root__}")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unexpected error writing test case sample [{record}]: {exc}")

    def write_test_case_results_sample(self, record: OMetaTestCaseResultsSample):
        """
        Use the /testCase endpoint to ingest sample test suite
        """
        try:
            self.metadata.add_test_case_results(
                record.test_case_results,
                record.test_case_name,
            )
            logger.info(
                f"Successfully ingested test case results for test case {record.test_case_name}"
            )
            self.status.records_written(
                f"testCaseResults: {record.test_case_name} - {record.test_case_results.timestamp.__root__}"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unexpected error writing test case result sample [{record}]: {exc}"
            )

    def get_status(self):
        return self.status

    def close(self):
        pass
