from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass
from typing import List

import pytest

from _openmetadata_testutils.dict import merge
from _openmetadata_testutils.pydantic.test_utils import assert_equal_pydantic_objects
from metadata.generated.schema.entity.data.table import (
    ColumnProfile,
    Table,
    TableProfile,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow


@dataclass
class ProfilerTestParameters:
    """Parameters for profiler test cases."""

    table_fqn: str
    expected_table_profile: TableProfile
    expected_column_profiles: List[ColumnProfile] = None
    config_predicate: Callable[[DatabaseServiceProfilerPipeline], bool] = lambda x: True


@pytest.mark.xdist_group("trino-integration")
class TestTrinoProfilerIntegration:
    """Test suite for Trino profiler integration tests."""

    @pytest.fixture(
        scope="class",
        params=[
            pytest.param({}, id="no_changes"),
            pytest.param(
                {"source": {"sourceConfig": {"config": {"useStatistics": True}}}},
                id="useStatistics=True",
            ),
        ],
    )
    def setup(
        self,
        patch_passwords_for_db_services,
        run_workflow,
        ingestion_config,
        profiler_config,
        create_test_data,
        request,
    ):
        """Set up the test environment by running the profiler workflow."""
        search_cache.clear()
        profiler_config = deepcopy(profiler_config)
        merge(request.param, profiler_config)
        run_workflow(MetadataWorkflow, ingestion_config)
        run_workflow(ProfilerWorkflow, profiler_config)
        return profiler_config

    @pytest.mark.parametrize(
        "parameters",
        [
            ProfilerTestParameters(
                "{database_service}.minio.my_schema.table",
                TableProfile(timestamp=Timestamp(0), rowCount=3),
                [
                    ColumnProfile(
                        name="three",
                        timestamp=Timestamp(0),
                        valuesCount=2,
                        nullCount=1,
                    )
                ],
            ),
            ProfilerTestParameters(
                "{database_service}.minio.my_schema.titanic",
                TableProfile(timestamp=Timestamp(0), rowCount=891),
                [
                    ColumnProfile(
                        name="name",
                        timestamp=Timestamp(0),
                        valuesCount=891,
                        nullCount=0,
                    )
                ],
            ),
            ProfilerTestParameters(
                "{database_service}.minio.my_schema.iris",
                TableProfile(timestamp=Timestamp(0), rowCount=150),
                [
                    ColumnProfile(
                        name="petal.length",
                        timestamp=Timestamp(0),
                        valuesCount=150,
                        nullCount=0,
                    )
                ],
            ),
            ProfilerTestParameters(
                "{database_service}.minio.my_schema.userdata",
                TableProfile(timestamp=Timestamp(0), rowCount=1000),
                [
                    ColumnProfile(
                        name="gender",
                        timestamp=Timestamp(0),
                        valuesCount=1000,
                        nullCount=0,
                    )
                ],
            ),
            ProfilerTestParameters(
                "{database_service}.minio.my_schema.empty",
                TableProfile(timestamp=Timestamp(0), rowCount=0),
                [
                    ColumnProfile(
                        name="a",
                        timestamp=Timestamp(0),
                        valuesCount=0,
                        nullCount=0,
                    )
                ],
                lambda x: x.useStatistics == False,
            ),
            ProfilerTestParameters(
                "{database_service}.minio.my_schema.empty",
                TableProfile(timestamp=Timestamp(0), rowCount=None),
                [
                    ColumnProfile(
                        name="a",
                        timestamp=Timestamp(0),
                        valuesCount=0,
                        nullCount=0,
                    )
                ],
                lambda x: x.useStatistics == True,
            ),
        ],
        ids=lambda x: x.table_fqn.split(".")[-1],
    )
    def test_profiler(
        self,
        setup,
        metadata,
        db_service,
        parameters: ProfilerTestParameters,
    ):
        """
        Test profiler functionality with various table configurations.

        Args:
            setup: Fixture that sets up the test environment
            metadata: OpenMetadata API instance
            db_service: Database service fixture
            parameters: Test parameters containing table and expected profile information
        """
        if not parameters.config_predicate(
            DatabaseServiceProfilerPipeline.model_validate(
                setup["source"]["sourceConfig"]["config"]
            )
        ):
            pytest.skip(
                "Skipping test because it's not supported for this profiler configuration"
            )
        table: Table = metadata.get_latest_table_profile(
            parameters.table_fqn.format(
                database_service=db_service.fullyQualifiedName.root
            )
        )
        assert_equal_pydantic_objects(
            parameters.expected_table_profile,
            # we don't want to validate the timestamp because it will be different for each run
            table.profile.model_copy(
                update={"timestamp": parameters.expected_table_profile.timestamp}
            ),
        )
        for profile in parameters.expected_column_profiles:
            column = next(
                (col for col in table.columns if col.profile.name == profile.name), None
            )
            if column is None:
                raise AssertionError(
                    f"Column [{profile.name}] not found in table [{table.fullyQualifiedName.root}]"
                )
            assert_equal_pydantic_objects(
                profile,
                column.profile.model_copy(update={"timestamp": profile.timestamp}),
            )

    @pytest.mark.parametrize(
        "parameters",
        [
            ProfilerTestParameters(
                "{database_service}.minio.my_schema.empty",
                TableProfile(timestamp=Timestamp(0), rowCount=None),
                [],
                lambda x: x.useStatistics == True,
            ),
        ],
        ids=lambda x: x.table_fqn.split(".")[-1],
    )
    def test_no_statistics(
        self,
        setup,
        metadata,
        db_service,
        parameters: ProfilerTestParameters,
    ):
        """
        Test profiler behavior when statistics are not available.

        Args:
            setup: Fixture that sets up the test environment
            metadata: OpenMetadata API instance
            db_service: Database service fixture
            parameters: Test parameters containing table and expected profile information
        """
        if not parameters.config_predicate(
            DatabaseServiceProfilerPipeline.model_validate(
                setup["source"]["sourceConfig"]["config"]
            )
        ):
            pytest.skip(
                "Skipping test because it's not supported for this profiler configuration"
            )
        table: Table = metadata.get_latest_table_profile(
            parameters.table_fqn.format(
                database_service=db_service.fullyQualifiedName.root
            )
        )
        assert (
            table.profile.rowCount is None
        ), "expected empty row count for a table with no collected statistics"
