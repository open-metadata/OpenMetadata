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
from typing import Any, Optional, TypeVar, Union

from pydantic import BaseModel
from requests.exceptions import HTTPError

from metadata.config.common import ConfigModel
from metadata.data_quality.api.models import TestCaseResultResponse, TestCaseResults
from metadata.generated.schema.analytics.reportData import ReportData
from metadata.generated.schema.api.ai.createMcpServer import CreateMcpServerRequest
from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.data.createDataContract import (
    CreateDataContractRequest,
)
from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.domains.createDataProduct import (
    CreateDataProductRequest,
)
from metadata.generated.schema.api.domains.createDomain import CreateDomainRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.api.tests.createLogicalTestCases import (
    CreateLogicalTestCases,
)
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.dataInsight.kpi.basic import KpiResult
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dataContract import DataContract
from metadata.generated.schema.entity.data.pipeline import Pipeline, PipelineStatus
from metadata.generated.schema.entity.data.searchIndex import (
    SearchIndex,
    SearchIndexSampleData,
)
from metadata.generated.schema.entity.data.table import DataModel, Table, TableData
from metadata.generated.schema.entity.data.topic import Topic as TopicEntity
from metadata.generated.schema.entity.data.topic import TopicSampleData
from metadata.generated.schema.entity.datacontract.dataContractResult import (
    DataContractResult,
)
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testCaseResolutionStatus import (
    TestCaseResolutionStatus,
)
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.bulkOperationResult import BulkOperationResult
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.schema import Topic
from metadata.ingestion.api.models import Either, Entity, StackTraceError
from metadata.ingestion.api.steps import Sink
from metadata.ingestion.models.barrier import Barrier
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
from metadata.ingestion.models.pipeline_status import (
    OMetaBulkPipelineStatus,
    OMetaPipelineStatus,
)
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
from metadata.ingestion.ometa.client import APIError, LimitsException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.dashboard_service import DashboardUsage
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.source.pipeline.pipeline_service import (
    PipelineUsage,
    TablePipelineObservability,
)
from metadata.pii.types import ClassifiableEntityType
from metadata.profiler.api.models import ProfilerResponse
from metadata.sampler.models import SamplerResponse
from metadata.utils.fqn import get_query_checksum
from metadata.utils.logger import get_log_name, ingestion_logger

logger = ingestion_logger()

# Allow types from the generated pydantic models
T = TypeVar("T", bound=BaseModel)

# TODO: remove the duplicate-conflict-to-warning downgrade below once #25890 (the server-side
# bulk-query idempotency fix, shipped in 1.13.0) has rolled out to all deployments. The
# checksum dedup in write_query is permanent and stays - only this downgrade is temporary.
# Until then, re-ingesting a query whose checksum already exists (same SQL across services or
# runs) comes back as a unique-constraint violation that loses no metadata, so a lineage run
# must not be marked failed over it. These are the query_entity unique constraints (checksum +
# nameHash, both engines) that identify such an already-present query on the bulk response.
DUPLICATE_QUERY_CONSTRAINTS = (
    "unique_query_checksum",
    "query_entity_namehash_key",
    "query_entity.namehash",
)


def is_duplicate_query_conflict(message: Optional[str]) -> bool:  # noqa: UP045
    """Whether a failed bulk-query response is an already-present (duplicate) query."""
    lowered = (message or "").lower()
    return any(constraint in lowered for constraint in DUPLICATE_QUERY_CONSTRAINTS)


class MetadataRestSinkConfig(ConfigModel):
    api_endpoint: Optional[str] = None  # noqa: UP045
    bulk_sink_batch_size: int = 100
    enable_async_pipeline: bool = True
    async_pipeline_workers: int = 2
    override_metadata: bool = False


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
        self.limit_reached = set()
        self.buffer: list[BaseModel] = []
        self.deferred_lifecycle_records: list[OMetaLifeCycleData] = []
        self.deferred_lifecycle_processed = False
        # Track entity names in buffer for O(1) duplicate checking
        # Key: (entity_type, name), Value: True
        self.buffered_entity_names: dict[tuple, bool] = {}
        # Queries are bulk-created on a dedicated buffer (see write_query) keyed on the
        # SQL checksum, so query-specific dedup and duplicate-checksum handling stay out
        # of the generic entity bulk path.
        self.query_buffer: list[CreateQueryRequest] = []
        self.buffered_query_checksums: set[str] = set()

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,  # noqa: UP045
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

    def _run(self, record: Entity, *_, **__) -> Either[Any]:
        """
        Default implementation for the single dispatch
        """
        log = get_log_name(record)
        try:
            return self._run_dispatch(record)
        except (APIError, HTTPError) as err:
            error = f"Failed to ingest {log} due to api request failure: {err}"
            return Either(left=StackTraceError(name=log, error=error, stackTrace=traceback.format_exc()))
        except Exception as exc:
            error = f"Failed to ingest {log}: {exc}"
            return Either(left=StackTraceError(name=log, error=error, stackTrace=traceback.format_exc()))

    def write_create_request(self, entity_request) -> Either[Entity]:
        """
        Send to OM the request creation received as is.
        :param entity_request: Create Entity request
        """
        if type(entity_request).__name__ in self.limit_reached:
            # If the limit has been reached, we don't need to try to ingest the entity
            # Note: We use PatchRequest to update the entity, so updating is not affected by the limit
            return Either(right=None)

        if (
            "ServiceRequest" in entity_request.__class__.__name__
            # These are CreateRequest that either do not have a `/bulk`
            # endpoint or are processed sequentially within the topology itself
            or isinstance(
                entity_request,
                (
                    CreateDomainRequest,
                    CreateDataProductRequest,
                    CreateDataContractRequest,
                    CreateTeamRequest,
                    CreateContainerRequest,
                    CreatePipelineRequest,
                    CreateTestCaseRequest,
                    CreateTestSuiteRequest,
                    CreateTestDefinitionRequest,
                    CreateMcpServerRequest,
                    CreateGlossaryRequest,
                ),
            )
        ):
            return self.write_create_single_request(entity_request)

        # Deduplicate entities by name to avoid duplicate FQN hash errors
        # These are CreateRequest types that may have duplicate names from source systems
        if isinstance(
            entity_request,
            (
                CreateDashboardDataModelRequest,  # QuickSight: multiple tables with same DataSourceId
            ),
        ):
            if self._is_duplicate_in_buffer(entity_request):
                logger.debug(
                    f"Skipping duplicate {type(entity_request).__name__} with name: {entity_request.name.root}"
                )
                return Either(right=None)

            # Track this entity for future duplicate checks (only for types that need deduplication)
            self._track_entity_in_buffer(entity_request)

        self.buffer.append(entity_request)
        try:
            if len(self.buffer) >= self.config.bulk_sink_batch_size:
                return self._flush_buffer()
            return Either(right=None)
        except LimitsException as _:
            self.limit_reached.add(type(entity_request).__name__)
            return Either(
                left=StackTraceError(
                    name=type(entity_request).__name__,
                    error=f"Limit reached for {type(entity_request).__name__}",
                    stackTrace=None,
                )
            )

    def _track_entity_in_buffer(self, entity_request) -> None:
        """
        Track an entity name in the buffer for O(1) duplicate detection.
        Only called for entity types that require deduplication.
        """
        if not hasattr(entity_request, "name"):
            return

        entity_type = type(entity_request).__name__
        current_name = entity_request.name.root if hasattr(entity_request.name, "root") else entity_request.name

        self.buffered_entity_names[(entity_type, current_name)] = True

    def _is_duplicate_in_buffer(self, entity_request) -> bool:
        """
        Check if an entity with the same name already exists in the buffer.
        Uses O(1) lookup via buffered_entity_names dict.
        """
        if not hasattr(entity_request, "name"):
            return False

        entity_type = type(entity_request).__name__
        current_name = entity_request.name.root if hasattr(entity_request.name, "root") else entity_request.name

        # O(1) lookup
        return (entity_type, current_name) in self.buffered_entity_names

    def write_create_single_request(self, entity_request) -> Either[Entity]:
        try:
            created = self.metadata.create_or_update(entity_request)
            if created:
                self.status.scanned(created)
                return Either(right=created)

            error = f"Failed to ingest {type(entity_request).__name__}"
            self.status.scanned(entity_request)
            stacktrace = StackTraceError(name=type(entity_request).__name__, error=error, stackTrace=None)
            self.status.failed(stacktrace)
            return Either(left=stacktrace)
        except LimitsException as _:
            self.limit_reached.add(type(entity_request).__name__)
            return Either(
                left=StackTraceError(
                    name=type(entity_request).__name__,
                    error=f"Limit reached for {type(entity_request).__name__}",
                    stackTrace=None,
                )
            )

    def _flush_buffer(self) -> Either[Entity]:
        """Flush buffered to the bulk API worker queue, caller must hold the buffer lock"""
        if not self.buffer:
            return Either(
                right=None,
                left=StackTraceError(
                    name="Entity  Buffer",
                    error="No entities to flush, yet _flush_buffer was called",
                    stackTrace=None,
                ),
            )

        try:
            result = self.metadata.bulk_create_or_update(
                entities=self.buffer,  # pyright: ignore[reportArgumentType]
                use_async=False,
                override_metadata=self.config.override_metadata,
            )
        except Exception as exc:
            logger.error(f"Failed to flush entities to bulk API: {exc}")
            logger.debug(traceback.format_exc())
            return Either(
                left=StackTraceError(
                    name="Entity Buffer",
                    error=f"Failed to flush entities to bulk API: {exc}",
                    stackTrace=traceback.format_exc(),
                ),
                right=None,
            )
        finally:
            self.buffer = []
            self.buffered_entity_names.clear()

        if result and result.status == basic.Status.success:
            self.status.scanned_all(result.successRequest)
            return Either(right=result, left=None)

        self.status.scanned_all(result.successRequest)
        for err in result.failedRequest:
            self.status.failed(
                StackTraceError(
                    name="Entity Buffer",
                    error=f"Failed to flush entities to bulk API: {err}",
                    stackTrace=None,
                )
            )
        return Either(
            right=None,
            left=StackTraceError(
                name="Entity Buffer",
                error=f"Failed to flush entities to bulk API: {result.failedRequest}",
                stackTrace=None,
            ),
        )

    @_run_dispatch.register
    def write_query(self, record: CreateQueryRequest) -> Either[Entity]:
        """Buffer queries on a dedicated bulk path.

        A query create request carries no name, so the server derives it from the SQL
        checksum. Identical SQL (e.g. a scheduled stored procedure running the same
        statement) therefore produces the same checksum and would collide in the bulk
        API. Keeping queries on their own buffer and flush isolates that checksum dedup,
        and the already-present-query handling in _flush_query_buffer, from the generic
        entity bulk path.
        """
        checksum = get_query_checksum(model_str(record.query))
        result = Either(right=None)  # pyright: ignore[reportCallIssue]
        if checksum in self.buffered_query_checksums:
            logger.debug(f"Skipping duplicate query with checksum {checksum}")
        else:
            self.buffered_query_checksums.add(checksum)
            self.query_buffer.append(record)
            if len(self.query_buffer) >= self.config.bulk_sink_batch_size:
                result = self._flush_query_buffer()
        return result

    def _flush_query_buffer(self) -> Either[Entity]:
        """Bulk-create buffered queries, then classify the response."""
        if not self.query_buffer:
            return Either(right=None)  # pyright: ignore[reportCallIssue]

        try:
            result = self.metadata.bulk_create_or_update(
                entities=self.query_buffer,  # pyright: ignore[reportArgumentType]
                use_async=False,
                override_metadata=self.config.override_metadata,
            )
        except Exception as exc:
            logger.error(f"Failed to flush queries to bulk API: {exc}")
            logger.debug(traceback.format_exc())
            return Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name="Query Buffer",
                    error=f"Failed to flush queries to bulk API: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
        finally:
            self.query_buffer = []
            self.buffered_query_checksums.clear()

        return self._record_query_flush_result(result)

    def _record_query_flush_result(self, result: Optional[BulkOperationResult]) -> Either[Entity]:  # noqa: UP045
        """Record a query bulk response. Already-present queries are reported as warnings
        (not failures) so a lineage run is not marked failed over queries that lost no
        metadata. Any other failure is still recorded as a failure."""
        if not result:
            return Either(right=None)  # pyright: ignore[reportCallIssue]

        self.status.scanned_all(result.successRequest or [])
        if result.status == basic.Status.success:
            return Either(right=result)  # pyright: ignore[reportCallIssue]

        first_failure = None
        for failed in result.failedRequest or []:
            query_ref = failed.request or "unknown"
            if is_duplicate_query_conflict(failed.message):
                self.status.warning("Query", f"Skipped already-present query [{query_ref}]: {failed.message}")
            else:
                failure = StackTraceError(
                    name="Query Buffer",
                    error=f"Failed to flush query [{query_ref}] to bulk API: {failed.message}",
                    stackTrace=None,
                )
                self.status.failed(failure)
                first_failure = first_failure or failure

        return Either(left=first_failure) if first_failure else Either(right=result)  # pyright: ignore[reportCallIssue]

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
    def write_custom_properties(self, record: OMetaCustomProperties) -> Either[dict]:
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
            data_model = self.metadata.ingest_table_data_model(table=table, data_model=datamodel_link.datamodel)
            return Either(right=data_model)

        return Either(
            left=StackTraceError(
                name="Data Model",
                error="Sink did not receive a table. We cannot ingest the data model.",
                stackTrace=None,
            )
        )

    @_run_dispatch.register
    def write_dashboard_usage(self, dashboard_usage: DashboardUsage) -> Either[Dashboard]:
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
    def write_classification_and_tag(self, record: OMetaTagAndClassification) -> Either[Tag]:
        """PUT Classification and Tag to OM API"""
        tag_name = (
            record.tag_request.name.root if hasattr(record.tag_request.name, "root") else str(record.tag_request.name)
        )
        if not tag_name or not tag_name.strip():
            logger.warning(f"Skipping tag with empty name for classification '{record.classification_request.name}'")
            return Either(right=None)

        self.metadata.create_or_update(record.classification_request)
        tag = self.metadata.create_or_update(record.tag_request)
        return Either(right=tag)

    @_run_dispatch.register
    def write_lineage(self, add_lineage: AddLineageRequest) -> Either[dict[str, Any]]:
        created_lineage = self.metadata.add_lineage(add_lineage, check_patch=True)
        if created_lineage.get("error"):
            return Either(left=StackTraceError(name="AddLineageRequestError", error=created_lineage["error"]))

        return Either(right=created_lineage["entity"]["fullyQualifiedName"])

    @_run_dispatch.register
    def write_override_lineage(self, add_lineage: OMetaLineageRequest) -> Either[dict[str, Any]]:
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
                in (LineageSource.PipelineLineage, LineageSource.OpenLineage)
            ):
                self.metadata.delete_lineage_by_source(
                    entity_type="pipeline",
                    entity_id=str(add_lineage.lineage_request.edge.lineageDetails.pipeline.id.root),
                    source=add_lineage.lineage_request.edge.lineageDetails.source.value,
                )
            else:
                self.metadata.delete_lineage_by_source(
                    entity_type=add_lineage.lineage_request.edge.toEntity.type,
                    entity_id=str(add_lineage.lineage_request.edge.toEntity.id.root),
                    source=add_lineage.lineage_request.edge.lineageDetails.source.value,
                )
        lineage_response = self._run_dispatch(add_lineage.lineage_request)
        if lineage_response and lineage_response.right is not None and add_lineage.entity_fqn and add_lineage.entity:
            self.metadata.patch_lineage_processed_flag(entity=add_lineage.entity, fqn=add_lineage.entity_fqn)

    @_run_dispatch.register
    def write_barrier(self, record: Barrier) -> Either[Entity]:
        """Flush the buffers synchronously so subsequent records in the same
        stream see committed entities."""
        result = Either(right=None)  # pyright: ignore[reportCallIssue]
        if self.buffer:
            logger.debug(
                "Barrier flush: %d entities, reason=%s",
                len(self.buffer),
                record.reason,
            )
            result = self._flush_buffer()
        if self.query_buffer:
            logger.debug(
                "Barrier flush: %d queries, reason=%s",
                len(self.query_buffer),
                record.reason,
            )
            query_result = self._flush_query_buffer()
            # Surface a genuine query failure even when the entity flush succeeded.
            if result.left is None and query_result.left is not None:
                result = query_result
        return result  # pyright: ignore[reportCallIssue]

    def _create_role(self, create_role: CreateRoleRequest) -> Optional[Role]:  # noqa: UP045
        """
        Internal helper method for write_user
        """
        try:
            role = self.metadata.create_or_update(create_role)
            self.role_entities[role.name] = str(role.id.root)
            return role  # noqa: TRY300
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unexpected error creating role [{create_role}]: {exc}")

        return None

    def _create_team(self, create_team: CreateTeamRequest) -> Optional[Team]:  # noqa: UP045
        """
        Internal helper method for write_user
        """
        try:
            team = self.metadata.create_or_update(create_team)
            self.team_entities[team.name.root] = str(team.id.root)
            return team  # noqa: TRY300
        except LimitsException as _:
            if type(create_team).__name__ in self.limit_reached:
                # Note: We do not have a way to patch the team,
                # so we try to put and handle exception
                return None
            self.limit_reached.add(type(create_team).__name__)
            return Either(
                left=StackTraceError(
                    name=type(create_team).__name__,
                    error=f"Limit reached for {type(create_team).__name__}",
                    stackTrace=None,
                )
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unexpected error creating team [{create_team}]: {exc}")

        return None

    # pylint: disable=too-many-branches
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
                    role_entity = self.metadata.get_by_name(entity=Role, fqn=str(role.name.root))
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
                    team_entity = self.metadata.get_by_name(entity=Team, fqn=str(team.name.root))
                    if not team_entity:
                        raise APIError(error={"message": f"Creating a new team {team.name.root}"})  # noqa: TRY301
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
        try:
            user = self.metadata.create_or_update(metadata_user)
            return Either(right=user)
        except LimitsException as _:
            if type(metadata_user).__name__ in self.limit_reached:
                # Note: We do not have a way to patch the user,
                # so we try to put and handle exception
                return None
            self.limit_reached.add(type(metadata_user).__name__)
            return Either(
                left=StackTraceError(
                    name=type(metadata_user).__name__,
                    error=f"Limit reached for {type(metadata_user).__name__}",
                    stackTrace=None,
                )
            )

    @_run_dispatch.register
    def delete_entity(self, record: DeleteEntity) -> Either[Entity]:
        # record.entity is declared as a bare pydantic BaseModel; the runtime value is a
        # generated entity that exposes `id` and `fullyQualifiedName`, but basedpyright can't
        # see those attributes through the BaseModel alias. Pull them via getattr so the type
        # checker stays quiet without changing the runtime behavior.
        entity_obj: Any = record.entity
        entity_id = entity_obj.id
        fqn = entity_obj.fullyQualifiedName.root
        recursive = bool(record.recursive)
        if record.dispatch_async:
            # Server-side async cascade — returns 202 + jobId immediately so ingestion
            # doesn't block on large subtrees (issue #4003). The actual work runs on the
            # server's executor; we surface the jobId in the log for operator correlation.
            response = self.metadata.delete_async(
                entity=type(record.entity),
                entity_id=entity_id,
                recursive=recursive,
            )
            job_id = (response or {}).get("jobId")
            logger.debug(
                "Dispatched async delete for %s (jobId=%s)",
                fqn,
                job_id,
            )
        else:
            self.metadata.delete(
                entity=type(record.entity),
                entity_id=entity_id,
                recursive=recursive,
            )
        return Either(left=None, right=record)

    @_run_dispatch.register
    def write_pipeline_status(self, record: OMetaPipelineStatus) -> Either[PipelineStatus]:
        """
        Use the /status endpoint to add PipelineStatus
        data to a Pipeline Entity
        """
        pipeline = self.metadata.add_pipeline_status(fqn=record.pipeline_fqn, status=record.pipeline_status)
        return Either(right=pipeline)

    @_run_dispatch.register
    def write_bulk_pipeline_status(self, record: OMetaBulkPipelineStatus) -> Either[Pipeline]:
        pipeline = self.metadata.add_bulk_pipeline_status(fqn=record.pipeline_fqn, statuses=record.pipeline_statuses)
        return Either(right=pipeline)

    @_run_dispatch.register
    def write_profile_sample_data(self, record: OMetaTableProfileSampleData) -> Either[Table]:
        """
        Use the /tableProfile endpoint to ingest sample profile data
        """
        table = self.metadata.ingest_profile_data(table=record.table, profile_request=record.profile)
        return Either(right=table)

    @_run_dispatch.register
    def write_test_suite_sample(self, record: OMetaTestSuiteSample) -> Either[TestSuite]:
        """
        Use the /testSuites endpoint to ingest sample test suite
        """
        test_suite = self.metadata.create_or_update_executable_test_suite(record.test_suite)
        return Either(right=test_suite)

    @_run_dispatch.register
    def write_logical_test_suite_sample(self, record: OMetaLogicalTestSuiteSample) -> Either[TestSuite]:
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
    def write_test_case_results_sample(self, record: OMetaTestCaseResultsSample) -> Either[TestCaseResult]:
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
        logger.debug(f"Successfully ingested test case results for test case {record.testCase.name.root}")
        self._ingest_failed_rows_sample(record)
        return Either(right=res)

    def _ingest_failed_rows_sample(self, record: TestCaseResultResponse):
        """Ingest failed row sample and inspection query if present on the record."""
        if record.failedRowsSample is not None:
            try:
                self.metadata.ingest_failed_rows_sample(
                    record.testCase,
                    record.failedRowsSample,
                    validate=record.validateColumns,
                )
                logger.debug(f"Successfully ingested failed rows sample for {record.testCase.name.root}")
            except Exception:
                logger.debug(traceback.format_exc())
                logger.error(f"Failed to ingest failed rows sample for {record.testCase.name.root}")

        if record.inspectionQuery is not None:
            try:
                self.metadata.ingest_inspection_query(
                    record.testCase,
                    record.inspectionQuery,
                )
                logger.debug(f"Successfully ingested inspection query for {record.testCase.name.root}")
            except Exception:
                logger.debug(traceback.format_exc())
                logger.error(f"Failed to ingest inspection query for {record.testCase.name.root}")

    @_run_dispatch.register
    def write_test_case_resolution_status(self, record: OMetaTestCaseResolutionStatus) -> TestCaseResolutionStatus:
        """For sample data"""
        res = self.metadata.create_test_case_resolution(record.test_case_resolution)

        return Either(right=res)

    @_run_dispatch.register
    def write_data_insight_sample(self, record: OMetaDataInsightSample) -> Either[ReportData]:
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
    def write_topic_sample_data(self, record: OMetaTopicSampleData) -> Either[Union[TopicSampleData, Topic]]:  # noqa: UP007
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
    ) -> Either[Union[SearchIndexSampleData, SearchIndex]]:  # noqa: UP007
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
        self.deferred_lifecycle_records.append(record)
        return Either(right=None)

    @singledispatchmethod
    def _ingest_entity_sample_data(self, entity, sample_data):
        """
        Generic dispatcher for ingesting sample data for any classifiable entity.
        Uses singledispatchmethod for polymorphic dispatch based on entity type.

        Args:
            entity: The classifiable entity
            sample_data: Sample data to ingest

        Returns:
            bool: Success status

        Raises:
            NotImplementedError: If entity type is not supported
        """
        raise NotImplementedError(f"Sample data ingestion not implemented for entity type {type(entity).__name__}")

    @_ingest_entity_sample_data.register
    def _(self, entity: Table, sample_data: TableData) -> bool:
        """Table-specific sample data ingestion implementation"""
        table_data = self.metadata.ingest_table_sample_data(table=entity, sample_data=sample_data)
        if table_data:
            logger.debug(f"Successfully ingested sample data for {entity.fullyQualifiedName.root}")
            return True
        return False

    @_ingest_entity_sample_data.register
    def _(self, entity: Container, sample_data: TableData) -> bool:
        """Container-specific sample data ingestion implementation"""
        container_data = self.metadata.ingest_container_sample_data(container=entity, sample_data=sample_data)
        if container_data:
            logger.debug(f"Successfully ingested sample data for {entity.fullyQualifiedName.root}")
            return True
        return False

    @_ingest_entity_sample_data.register
    def _(self, entity: TopicEntity, sample_data: TableData) -> bool:
        """Topic-specific sample data ingestion — converts TableData to TopicSampleData."""
        import json as _json  # noqa: PLC0415

        column_names = sample_data.columns or []
        messages = [_json.dumps(dict(zip(column_names, row, strict=False))) for row in (sample_data.rows or [])]
        topic_sample_data = TopicSampleData(messages=messages)
        result = self.metadata.ingest_topic_sample_data(topic=entity, sample_data=topic_sample_data)
        if result:
            fqn = entity.fullyQualifiedName
            logger.debug(
                "Successfully ingested sample data for %s",
                fqn.root if fqn else type(entity).__name__,
            )
            return True
        return False

    @_run_dispatch.register
    def write_sampler_response(self, record: SamplerResponse) -> Either[ClassifiableEntityType]:
        """Ingest the sample data - if needed - and the PII tags"""
        entity = record.entity

        if record.sample_data and record.sample_data.store:
            try:
                success = self._ingest_entity_sample_data(entity, sample_data=record.sample_data.data)
                if not success:
                    self.status.failed(
                        StackTraceError(
                            name=entity.fullyQualifiedName.root,
                            error="Error trying to ingest sample data for entity",
                        )
                    )
            except NotImplementedError as exc:
                self.status.failed(
                    StackTraceError(
                        name=entity.fullyQualifiedName.root,
                        error=str(exc),
                    )
                )

        if record.column_tags:
            patched = self.metadata.patch_column_tags(entity=entity, column_tags=record.column_tags)
            entity_fqn = entity.fullyQualifiedName.root if entity.fullyQualifiedName else type(entity).__name__
            if patched:
                logger.debug("Successfully patched tags for %s", entity_fqn)
            else:
                self.status.warning(key=entity_fqn, reason="Error patching tags for entity")

        return Either(right=record.entity)

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
        logger.debug(f"Successfully ingested profile metrics for {record.table.fullyQualifiedName.root}")
        return Either(right=table)

    @_run_dispatch.register
    def write_executable_test_suite(self, record: CreateTestSuiteRequest) -> Either[TestSuite]:
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
            self._ingest_failed_rows_sample(result)
            self.status.scanned(result)

        return Either(right=record)

    @_run_dispatch.register
    def write_data_contract_result(self, record: DataContractResult) -> Either[DataContractResult]:
        """
        Send a DataContractResult to OM API
        :param record: DataContractResult to be created/updated
        """
        try:
            # Find the data contract by FQN to get its ID
            data_contract = self.metadata.get_by_name(entity=DataContract, fqn=record.dataContractFQN)

            if not data_contract:
                error = f"Data contract not found: {record.dataContractFQN}"
                return Either(left=StackTraceError(name="DataContractResult", error=error, stackTrace=None))

            # Create or update the result using the mixin method
            result = self.metadata.put_data_contract_result(data_contract_id=data_contract.id, result=record)

            if result:
                return Either(right=result)
            else:  # noqa: RET505
                error = f"Failed to create data contract result for {record.dataContractFQN}"
                return Either(left=StackTraceError(name="DataContractResult", error=error, stackTrace=None))

        except Exception as exc:
            error = f"Error processing data contract result: {exc}"
            return Either(
                left=StackTraceError(
                    name="DataContractResult",
                    error=error,
                    stackTrace=traceback.format_exc(),
                )
            )

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

    @_run_dispatch.register
    def write_table_pipeline_observability(self, record: TablePipelineObservability) -> Either[Table]:
        """
        Send pipeline observability metrics to a table entity.

        This handler processes observability data for tables that are processed by pipelines,
        tracking metrics like last run status, execution times, and schedule intervals.

        :param record: TablePipelineObservability with table and observability data
        :return: Either with updated Table or error
        """
        try:
            if not record.observability_data:
                logger.debug(f"No pipeline observability data for {record.table.fullyQualifiedName.root}")
                return Either(right=record.table)

            updated_table = self.metadata.add_pipeline_observability(
                table_id=record.table.id,
                pipeline_observability=record.observability_data,
            )

            if updated_table:
                logger.debug(
                    f"Successfully added {len(record.observability_data)} pipeline "
                    f"observability records for {record.table.fullyQualifiedName.root}"
                )
                return Either(right=updated_table)
            else:  # noqa: RET505
                error = (
                    f"Failed to add pipeline observability for "
                    f"{record.table.fullyQualifiedName.root} - API returned None"
                )
                return Either(
                    left=StackTraceError(
                        name=record.table.fullyQualifiedName.root,
                        error=error,
                        stackTrace=None,
                    )
                )

        except Exception as exc:
            error = f"Error adding pipeline observability for {record.table.fullyQualifiedName.root}: {exc}"
            return Either(
                left=StackTraceError(
                    name=record.table.fullyQualifiedName.root,
                    error=error,
                    stackTrace=traceback.format_exc(),
                )
            )

    def _process_deferred_lifecycle_data(self):
        """Process all deferred lifecycle records - called after all tables exist"""
        if self.deferred_lifecycle_processed:
            logger.debug("Deferred lifecycle processing already completed, skipping")
            return

        if not self.deferred_lifecycle_records:
            return

        logger.info(f"Processing {len(self.deferred_lifecycle_records)} deferred lifecycle records")

        success_count = 0
        error_count = 0

        for record in self.deferred_lifecycle_records:
            try:
                entity = self.metadata.get_by_name(entity=record.entity, fqn=record.entity_fqn)
                if entity:
                    self.metadata.patch_life_cycle(entity=entity, life_cycle=record.life_cycle)
                    success_count += 1
                else:
                    logger.warning(f"Table {record.entity_fqn} not found even after bulk processing")
                    error_count += 1
                    self.status.failed(
                        StackTraceError(
                            name=record.entity_fqn,
                            error=f"Entity not found: {record.entity_fqn}",
                            stackTrace=None,
                        )
                    )
            except Exception as exc:
                logger.error(f"Error processing lifecycle for {record.entity_fqn}: {exc}")
                logger.debug(traceback.format_exc())
                error_count += 1
                self.status.failed(
                    StackTraceError(
                        name=record.entity_fqn,
                        error=f"Lifecycle processing error: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

        logger.info(f"Deferred lifecycle processing complete: {success_count} successful, {error_count} failed")

        self.deferred_lifecycle_processed = True

    def close(self):
        """
        Flush any remaining buffered tables and stop worker threads
        """
        # Flush all thread-local buffers
        if self.buffer:
            logger.info(f"Flushing {len(self.buffer)} remaining entities on close")
            self._flush_buffer()

        if self.query_buffer:
            logger.info(f"Flushing {len(self.query_buffer)} remaining queries on close")
            self._flush_query_buffer()

        # Process deferred lifecycle data now that all tables exist
        self._process_deferred_lifecycle_data()
