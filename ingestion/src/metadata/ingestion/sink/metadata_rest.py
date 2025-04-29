#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
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
from functools import singledispatchmethod
from typing import Any, Dict, Optional, TypeVar, Union

from pydantic import BaseModel
from requests.exceptions import HTTPError

from metadata.config.common import ConfigModel
from metadata.data_quality.api.models import TestCaseResultResponse, TestCaseResults
from metadata.generated.schema.analytics.reportData import ReportData
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.api.tests.createLogicalTestCases import (
    CreateLogicalTestCases,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.dataInsight.kpi.basic import KpiResult
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.pipeline import Pipeline, PipelineStatus
from metadata.generated.schema.entity.data.searchIndex import (
    SearchIndex,
    SearchIndexSampleData,
)
from metadata.generated.schema.entity.data.table import DataModel, Table
from metadata.generated.schema.entity.data.topic import TopicSampleData
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testCaseResolutionStatus import (
    TestCaseResolutionStatus,
)
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.schema import Topic
from metadata.ingestion.api.models import Either, Entity, StackTraceError
from metadata.ingestion.api.steps import Sink
from metadata.ingestion.models.custom_properties import OMetaCustomProperties
from metadata.ingestion.models.data_insight import OMetaDataInsightSample
from metadata.ingestion.models.delete_entity import DeleteEntity
from metadata.ingestion.models.life_cycle import OMetaLifeCycleData
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.models.ometa_topic_data import OMetaTopicSampleData
from metadata.ingestion.models.patch_request import (
    ALLOWED_COMMON_PATCH_FIELDS,
    ARRAY_ENTITY_FIELDS,
    RESTRICT_UPDATE_LIST,
    PatchedEntity,
    PatchRequest,
)
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.models.profile_data import OMetaTableProfileSampleData
from metadata.ingestion.models.search_index_data import OMetaIndexSampleData
from metadata.ingestion.models.tests_data import (
    OMetaLogicalTestSuiteSample,
    OMetaTestCaseResolutionStatus,
    OMetaTestCaseResultsSample,
    OMetaTestCaseSample,
    OMetaTestSuiteSample,
)
from metadata.ingestion.models.user import OMetaUserProfile
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardUsage
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.source.pipeline.pipeline_service import PipelineUsage
from metadata.profiler.api.models import ProfilerResponse
from metadata.sampler.models import SamplerResponse
from metadata.utils.execution_time_tracker import calculate_execution_time
from metadata.utils.logger import get_log_name, ingestion_logger

logger = ingestion_logger()

# Allow types from the generated pydantic models
T = TypeVar("T", bound=BaseModel)


class MetadataRestSinkConfig(ConfigModel):
    api_endpoint: Optional[str] = None


class MetadataRestSink(Sink):  # pylint: disable=too-many-public-methods
    """
    Sink implementation that sends OM Entities
    to the OM server API
    """

    config: MetadataRestSinkConfig

    # We want to catch any errors that might happen during the sink
    # pylint: disable=broad-except

    def __init__(self, config: MetadataRestSinkConfig, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.wrote_something = False
        self.charts_dict = {}
        self.metadata = metadata
        self.role_entities = {}
        self.team_entities = {}

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config = MetadataRestSinkConfig.model_validate(config_dict)
        return cls(config, metadata)

    @property
    def name(self) -> str:
        return "OpenMetadata"

    @singledispatchmethod
    def _run_dispatch(self, record: Entity) -> Either[Any]:
        logger.debug(f"Processing Create request {type(record)}")
        return self.write_create_request(record)

    @calculate_execution_time(store=False)
    def _run(self, record: Entity, *_, **__) -> Either[Any]:
        """
        Default implementation for the single dispatch
        """
        log = get_log_name(record)
        try:
            return self._run_dispatch(record)
        except (APIError, HTTPError) as err:
            error = f"Failed to ingest {log} due to api request failure: {err}"
            return Either(
                left=StackTraceError(
                    name=log, error=error, stackTrace=traceback.format_exc()
                )
            )
        except Exception as exc:
            error = f"Failed to ingest {log}: {exc}"
            return Either(
                left=StackTraceError(
                    name=log, error=error, stackTrace=traceback.format_exc()
                )
            )

    def write_create_request(self, entity_request) -> Either[Entity]:
        """
        Send to OM the request creation received as is.
        :param entity_request: Create Entity request
        """
        created = self.metadata.create_or_update(entity_request)
        if created:
            return Either(right=created)

        error = f"Failed to ingest {type(entity_request).__name__}"
        return Either(
            left=StackTraceError(
                name=type(entity_request).__name__, error=error, stackTrace=None
            )
        )

    @_run_dispatch.register
    def patch_entity(self, record: PatchRequest) -> Either[Entity]:
        """
        Patch the records
        """
        entity = self.metadata.patch(
            entity=type(record.original_entity),
            source=record.original_entity,
            destination=record.new_entity,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
            override_metadata=record.override_metadata,
        )
        patched_entity = PatchedEntity(new_entity=entity) if entity else None
        return Either(right=patched_entity)

    @_run_dispatch.register
    def write_custom_properties(self, record: OMetaCustomProperties) -> Either[Dict]:
        """
        Create or update the custom properties
        """
        custom_property = self.metadata.create_or_update_custom_property(record)
        return Either(right=custom_property)

    @_run_dispatch.register
    def write_datamodel(self, datamodel_link: DataModelLink) -> Either[DataModel]:
        """
        Send to OM the DataModel based on a table ID
        :param datamodel_link: Table ID + Data Model
        """

        table: Table = datamodel_link.table_entity

        if table:
            data_model = self.metadata.ingest_table_data_model(
                table=table, data_model=datamodel_link.datamodel
            )
            return Either(right=data_model)

        return Either(
            left=StackTraceError(
                name="Data Model",
                error="Sink did not receive a table. We cannot ingest the data model.",
                stackTrace=None,
            )
        )

    @_run_dispatch.register
    def write_dashboard_usage(
        self, dashboard_usage: DashboardUsage
    ) -> Either[Dashboard]:
        """
        Send a UsageRequest update to a dashboard entity
        :param dashboard_usage: dashboard entity and usage request
        """
        self.metadata.publish_dashboard_usage(
            dashboard=dashboard_usage.dashboard,
            dashboard_usage_request=dashboard_usage.usage,
        )
        return Either(right=dashboard_usage.dashboard)

    @_run_dispatch.register
    def write_classification_and_tag(
        self, record: OMetaTagAndClassification
    ) -> Either[Tag]:
        """PUT Classification and Tag to OM API"""
        self.metadata.create_or_update(record.classification_request)
        tag = self.metadata.create_or_update(record.tag_request)
        return Either(right=tag)

    @_run_dispatch.register
    def write_lineage(self, add_lineage: AddLineageRequest) -> Either[Dict[str, Any]]:
        created_lineage = self.metadata.add_lineage(add_lineage, check_patch=True)
        if created_lineage.get("error"):
            return Either(
                left=StackTraceError(
                    name="AddLineageRequestError", error=created_lineage["error"]
                )
            )

        return Either(right=created_lineage["entity"]["fullyQualifiedName"])

    @_run_dispatch.register
    def write_override_lineage(
        self, add_lineage: OMetaLineageRequest
    ) -> Either[Dict[str, Any]]:
        """
        Writes the override lineage for the given lineage request.

        Args:
            add_lineage (OMetaLineageRequest): The lineage request containing the override lineage information.

        Returns:
            Either[Dict[str, Any]]: The result of the dispatch operation.
        """
        if (
            add_lineage.override_lineage is True
            and add_lineage.lineage_request.edge.lineageDetails
            and add_lineage.lineage_request.edge.lineageDetails.source
        ):
            if (
                add_lineage.lineage_request.edge.lineageDetails.pipeline
                and add_lineage.lineage_request.edge.lineageDetails.source
                == LineageSource.PipelineLineage
            ):
                self.metadata.delete_lineage_by_source(
                    entity_type="pipeline",
                    entity_id=str(
                        add_lineage.lineage_request.edge.lineageDetails.pipeline.id.root
                    ),
                    source=add_lineage.lineage_request.edge.lineageDetails.source.value,
                )
            else:
                self.metadata.delete_lineage_by_source(
                    entity_type=add_lineage.lineage_request.edge.toEntity.type,
                    entity_id=str(add_lineage.lineage_request.edge.toEntity.id.root),
                    source=add_lineage.lineage_request.edge.lineageDetails.source.value,
                )
        lineage_response = self._run_dispatch(add_lineage.lineage_request)
        if (
            lineage_response
            and lineage_response.right is not None
            and add_lineage.entity_fqn
            and add_lineage.entity
        ):
            self.metadata.patch_lineage_processed_flag(
                entity=add_lineage.entity, fqn=add_lineage.entity_fqn
            )

    def _create_role(self, create_role: CreateRoleRequest) -> Optional[Role]:
        """
        Internal helper method for write_user
        """
        try:
            role = self.metadata.create_or_update(create_role)
            self.role_entities[role.name] = str(role.id.root)
            return role
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unexpected error creating role [{create_role}]: {exc}")

        return None

    def _create_team(self, create_team: CreateTeamRequest) -> Optional[Team]:
        """
        Internal helper method for write_user
        """
        try:
            team = self.metadata.create_or_update(create_team)
            self.team_entities[team.name.root] = str(team.id.root)
            return team
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unexpected error creating team [{create_team}]: {exc}")

        return None

    @_run_dispatch.register
    def write_users(self, record: OMetaUserProfile) -> Either[User]:
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
                        entity=Role, fqn=str(role.name.root)
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
                        entity=Team, fqn=str(team.name.root)
                    )
                    if not team_entity:
                        raise APIError(
                            error={"message": f"Creating a new team {team.name.root}"}
                        )
                    team_ids.append(team_entity.id.root)
                except APIError:
                    team_entity = self._create_team(team)
                    team_ids.append(team_entity.id.root)
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Unexpected error writing team [{team}]: {exc}")
        else:
            team_ids = None

        # Update user data with the new Role and Team IDs
        user_profile = record.user.model_dump(exclude_unset=True)
        user_profile["roles"] = role_ids
        user_profile["teams"] = team_ids
        metadata_user = CreateUserRequest(**user_profile)

        # Create user
        user = self.metadata.create_or_update(metadata_user)
        return Either(right=user)

    @_run_dispatch.register
    def delete_entity(self, record: DeleteEntity) -> Either[Entity]:
        self.metadata.delete(
            entity=type(record.entity),
            entity_id=record.entity.id,
            recursive=record.mark_deleted_entities,
        )
        return Either(right=record)

    @_run_dispatch.register
    def write_pipeline_status(
        self, record: OMetaPipelineStatus
    ) -> Either[PipelineStatus]:
        """
        Use the /status endpoint to add PipelineStatus
        data to a Pipeline Entity
        """
        pipeline = self.metadata.add_pipeline_status(
            fqn=record.pipeline_fqn, status=record.pipeline_status
        )
        return Either(right=pipeline)

    @_run_dispatch.register
    def write_profile_sample_data(
        self, record: OMetaTableProfileSampleData
    ) -> Either[Table]:
        """
        Use the /tableProfile endpoint to ingest sample profile data
        """
        table = self.metadata.ingest_profile_data(
            table=record.table, profile_request=record.profile
        )
        return Either(right=table)

    @_run_dispatch.register
    def write_test_suite_sample(
        self, record: OMetaTestSuiteSample
    ) -> Either[TestSuite]:
        """
        Use the /testSuites endpoint to ingest sample test suite
        """
        test_suite = self.metadata.create_or_update_executable_test_suite(
            record.test_suite
        )
        return Either(right=test_suite)

    @_run_dispatch.register
    def write_logical_test_suite_sample(
        self, record: OMetaLogicalTestSuiteSample
    ) -> Either[TestSuite]:
        """Create logical test suite and add tests cases to it"""
        test_suite = self.metadata.create_or_update(record.test_suite)
        self.metadata.add_logical_test_cases(
            CreateLogicalTestCases(
                testSuiteId=test_suite.id,
                testCaseIds=[test_case.id for test_case in record.test_cases],  # type: ignore
            )
        )
        return Either(right=test_suite)

    @_run_dispatch.register
    def write_test_case_sample(self, record: OMetaTestCaseSample) -> Either[TestCase]:
        """
        Use the /dataQuality/testCases endpoint to ingest sample test suite
        """
        test_case = self.metadata.create_or_update(record.test_case)
        return Either(right=test_case)

    @_run_dispatch.register
    def write_test_case_results_sample(
        self, record: OMetaTestCaseResultsSample
    ) -> Either[TestCaseResult]:
        """
        Use the /dataQuality/testCases endpoint to ingest sample test suite
        """
        self.metadata.add_test_case_results(
            record.test_case_results,
            record.test_case_name,
        )
        return Either(right=record.test_case_results)

    @_run_dispatch.register
    def write_test_case_results(self, record: TestCaseResultResponse):
        """Write the test case result"""
        res = self.metadata.add_test_case_results(
            test_results=record.testCaseResult,
            test_case_fqn=record.testCase.fullyQualifiedName.root,
        )
        logger.debug(
            f"Successfully ingested test case results for test case {record.testCase.name.root}"
        )
        return Either(right=res)

    @_run_dispatch.register
    def write_test_case_resolution_status(
        self, record: OMetaTestCaseResolutionStatus
    ) -> TestCaseResolutionStatus:
        """For sample data"""
        res = self.metadata.create_test_case_resolution(record.test_case_resolution)

        return Either(right=res)

    @_run_dispatch.register
    def write_data_insight_sample(
        self, record: OMetaDataInsightSample
    ) -> Either[ReportData]:
        """
        Use the /dataQuality/testCases endpoint to ingest sample test suite
        """
        self.metadata.add_data_insight_report_data(
            record.record,
        )
        return Either(right=record.record)

    @_run_dispatch.register
    def write_data_insight_kpi(self, record: KpiResult) -> Either[KpiResult]:
        """
        Use the /dataQuality/testCases endpoint to ingest sample test suite
        """
        self.metadata.add_kpi_result(fqn=record.kpiFqn.root, record=record)
        return Either(left=None, right=record)

    @_run_dispatch.register
    def write_topic_sample_data(
        self, record: OMetaTopicSampleData
    ) -> Either[Union[TopicSampleData, Topic]]:
        """
        Use the /dataQuality/testCases endpoint to ingest sample test suite
        """
        if record.sample_data.messages:
            sample_data = self.metadata.ingest_topic_sample_data(
                record.topic,
                record.sample_data,
            )
            return Either(right=sample_data)

        logger.debug(f"No sample data to PUT for {get_log_name(record.topic)}")
        return Either(right=record.topic)

    @_run_dispatch.register
    def write_search_index_sample_data(
        self, record: OMetaIndexSampleData
    ) -> Either[Union[SearchIndexSampleData, SearchIndex]]:
        """
        Ingest Search Index Sample Data
        """
        if record.data.messages:
            sample_data = self.metadata.ingest_search_index_sample_data(
                record.entity,
                record.data,
            )
            return Either(right=sample_data)

        logger.debug(f"No sample data to PUT for {get_log_name(record.entity)}")
        return Either(right=record.entity)

    @_run_dispatch.register
    def write_life_cycle_data(self, record: OMetaLifeCycleData) -> Either[Entity]:
        """
        Ingest the life cycle data
        """

        entity = self.metadata.get_by_name(entity=record.entity, fqn=record.entity_fqn)

        if entity:
            self.metadata.patch_life_cycle(entity=entity, life_cycle=record.life_cycle)
            return Either(right=entity)

        return Either(
            left=StackTraceError(
                name=record.entity_fqn,
                error=f"Entity of type '{record.entity}' with name '{record.entity_fqn}' not found.",
            )
        )

    @_run_dispatch.register
    def write_sampler_response(self, record: SamplerResponse) -> Either[Table]:
        """Ingest the sample data - if needed - and the PII tags"""
        if record.sample_data and record.sample_data.store:
            table_data = self.metadata.ingest_table_sample_data(
                table=record.table, sample_data=record.sample_data.data
            )
            if not table_data:
                self.status.failed(
                    StackTraceError(
                        name=record.table.fullyQualifiedName.root,
                        error="Error trying to ingest sample data for table",
                    )
                )
            else:
                logger.debug(
                    f"Successfully ingested sample data for {record.table.fullyQualifiedName.root}"
                )

        if record.column_tags:
            patched = self.metadata.patch_column_tags(
                table=record.table, column_tags=record.column_tags
            )
            if not patched:
                self.status.warning(
                    key=record.table.fullyQualifiedName.root,
                    reason="Error patching tags for table",
                )
            else:
                logger.debug(
                    f"Successfully patched tag {record.column_tags} for {record.table.fullyQualifiedName.root}"
                )

        return Either(right=record.table)

    @_run_dispatch.register
    def write_profiler_response(self, record: ProfilerResponse) -> Either[Table]:
        """Cleanup "`" character in columns and ingest"""
        column_profile = record.profile.columnProfile
        for column in column_profile:
            column.name = column.name.replace("`", "")

        record.profile.columnProfile = column_profile

        table = self.metadata.ingest_profile_data(
            table=record.table,
            profile_request=record.profile,
        )
        logger.debug(
            f"Successfully ingested profile metrics for {record.table.fullyQualifiedName.root}"
        )
        return Either(right=table)

    @_run_dispatch.register
    def write_executable_test_suite(
        self, record: CreateTestSuiteRequest
    ) -> Either[TestSuite]:
        """
        From the test suite workflow we might need to create executable test suites
        """
        test_suite = self.metadata.create_or_update_executable_test_suite(record)
        return Either(right=test_suite)

    @_run_dispatch.register
    def write_test_case_result_list(self, record: TestCaseResults):
        """Record the list of test case result responses"""

        for result in record.test_results or []:
            self.metadata.add_test_case_results(
                test_results=result.testCaseResult,
                test_case_fqn=result.testCase.fullyQualifiedName.root,
            )
            self.status.scanned(result)

        return Either(right=record)

    @_run_dispatch.register
    def write_pipeline_usage(self, pipeline_usage: PipelineUsage) -> Either[Pipeline]:
        """
        Send a UsageRequest update to a pipeline entity
        :param pipeline_usage: pipeline entity and usage request
        """
        self.metadata.publish_pipeline_usage(
            pipeline=pipeline_usage.pipeline,
            pipeline_usage_request=pipeline_usage.usage,
        )
        return Either(right=pipeline_usage.pipeline)

    def close(self):
        """
        We don't have anything to close since we are using the given metadata client
        """
