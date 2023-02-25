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
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.ometa_topic_data import OMetaTopicSampleData
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
        self.write_record.register(AddLineageRequest, self.write_lineage)
        self.write_record.register(OMetaUserProfile, self.write_users)
        self.write_record.register(OMetaTagAndClassification, self.write_classification)
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
        self.write_record.register(OMetaTopicSampleData, self.write_topic_sample_data)

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
                logger.debug(f"Successfully ingested {log}")
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
            logger.debug(
                f"Successfully ingested DataModel for {table.fullyQualifiedName.__root__}"
            )
        else:
            logger.warning(
                f"The table [{datamodel_link.fqn.__root__}] from the manifest file is not found in OM. "
                f"Please, check if the table has been ingested previously."
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
            logger.debug(
                f"Successfully ingested usage for {dashboard_usage.dashboard.fullyQualifiedName.__root__}"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to write dashboard usage [{dashboard_usage}]: {exc}")

    def write_classification(self, record: OMetaTagAndClassification) -> None:
        """PUT Classification and Tag to OM API

        Args:
            record (OMetaTagAndClassification): Tag information

        Return:
            None

        """
        try:
            self.metadata.create_or_update(record.classification_request)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected error writing classification [{record.classification_request}]: {exc}"
            )
        try:
            self.metadata.create_or_update(record.tag_request)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected error writing classification [{record.tag_request}]: {exc}"
            )

    def write_lineage(self, add_lineage: AddLineageRequest):
        try:
            created_lineage = self.metadata.add_lineage(add_lineage)
            created_lineage_info = created_lineage["entity"]["fullyQualifiedName"]

            logger.debug(f"Successfully added Lineage from {created_lineage_info}")
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
            logger.debug(f"User: {user.displayName}")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unexpected error writing user [{metadata_user}]: {exc}")

    def delete_table(self, record: DeleteTable):
        try:
            self.metadata.delete(entity=Table, entity_id=record.table.id)
            logger.debug(
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

            logger.debug(
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
            logger.debug(
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
            logger.debug(
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
            logger.debug(
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

    def write_topic_sample_data(self, record: OMetaTopicSampleData):
        """
        Use the /testCase endpoint to ingest sample test suite
        """
        try:
            if record.sample_data.messages:
                self.metadata.ingest_topic_sample_data(
                    record.topic,
                    record.sample_data,
                )
                logger.debug(
                    f"Successfully ingested sample data for {record.topic.name.__root__}"
                )
                self.status.records_written(
                    f"topicSampleData: {record.topic.name.__root__}"
                )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unexpected error while ingesting sample data for topic [{record.topic.name.__root__}]: {exc}"
            )

    def get_status(self):
        return self.status

    def close(self):
        pass
