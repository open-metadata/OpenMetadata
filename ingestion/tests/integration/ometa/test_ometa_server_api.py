#  Copyright 2021 Schlameel
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
OpenMetadata high-level API Server test
"""
import pytest

from metadata.generated.schema.configuration.profilerConfiguration import (
    MetricConfigurationDefinition,
    MetricType,
    ProfilerConfiguration,
)
from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.settings.settings import Settings, SettingType


@pytest.fixture
def profiler_configuration():
    """Create test profiler configuration."""
    return ProfilerConfiguration(
        metricConfiguration=[
            MetricConfigurationDefinition(
                dataType=DataType.INT,
                disabled=False,
                metrics=[MetricType.valuesCount, MetricType.distinctCount],
            ),
            MetricConfigurationDefinition(
                dataType=DataType.DATETIME, disabled=True, metrics=None
            ),
        ]
    )


@pytest.fixture
def settings_cleanup(metadata, request):
    """Clean up profiler settings after test."""

    def cleanup():
        """Reset profiler settings to empty."""
        profiler_configuration = ProfilerConfiguration(metricConfiguration=[])
        settings = Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=profiler_configuration,
        )
        metadata.create_or_update_settings(settings)

    request.addfinalizer(cleanup)


class TestOMetaServerAPI:
    """
    Server API integration tests.
    Tests server settings and configuration operations.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_profiler_configuration(
        self, metadata, profiler_configuration, settings_cleanup
    ):
        """
        Test get_profiler_configuration
        """
        settings = Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=profiler_configuration,
        )
        created_profiler_settings = metadata.create_or_update_settings(settings)
        assert settings.model_dump_json() == created_profiler_settings.model_dump_json()

        profiler_configuration.metricConfiguration.append(
            MetricConfigurationDefinition(
                dataType=DataType.STRING,
                disabled=False,
                metrics=[MetricType.histogram],
            )
        )

        updated_profiler_settings = metadata.create_or_update_settings(settings)
        assert settings.model_dump_json() == updated_profiler_settings.model_dump_json()
