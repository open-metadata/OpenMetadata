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
Tests for global sample data configuration override in messaging sources.
Validates that _is_sample_data_storing_globally_disabled() correctly reads the
profiler configuration and overrides source-level generateSampleData.
"""
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.configuration.profilerConfiguration import (
    ProfilerConfiguration,
    SampleDataIngestionConfig,
)
from metadata.generated.schema.settings.settings import Settings, SettingType
from metadata.ingestion.source.messaging.messaging_service import MessagingServiceSource


@pytest.fixture
def mock_messaging_source():
    """Create a mock MessagingServiceSource with the real _is_sample_data_storing_globally_disabled method."""
    source = MagicMock()
    source._is_sample_data_storing_globally_disabled = (
        MessagingServiceSource._is_sample_data_storing_globally_disabled.__get__(
            source, MessagingServiceSource
        )
    )
    return source


class TestIsSampleDataGloballyDisabled:
    def test_returns_false_when_no_settings(self, mock_messaging_source):
        mock_messaging_source.metadata.get_profiler_config_settings.return_value = None

        assert (
            mock_messaging_source._is_sample_data_storing_globally_disabled() is False
        )

    def test_returns_false_when_settings_has_no_config_value(
        self, mock_messaging_source
    ):
        settings = MagicMock(spec=Settings)
        settings.config_value = None
        mock_messaging_source.metadata.get_profiler_config_settings.return_value = (
            settings
        )

        assert (
            mock_messaging_source._is_sample_data_storing_globally_disabled() is False
        )

    def test_returns_false_when_no_sample_data_config(self, mock_messaging_source):
        profiler_config = ProfilerConfiguration(
            metricConfiguration=[], sampleDataConfig=None
        )
        settings = Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=profiler_config,
        )
        mock_messaging_source.metadata.get_profiler_config_settings.return_value = (
            settings
        )

        assert (
            mock_messaging_source._is_sample_data_storing_globally_disabled() is False
        )

    def test_returns_true_when_store_disabled(self, mock_messaging_source):
        sample_config = SampleDataIngestionConfig(
            storeSampleData=False, readSampleData=True
        )
        profiler_config = ProfilerConfiguration(sampleDataConfig=sample_config)
        settings = Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=profiler_config,
        )
        mock_messaging_source.metadata.get_profiler_config_settings.return_value = (
            settings
        )

        assert mock_messaging_source._is_sample_data_storing_globally_disabled() is True

    def test_returns_false_when_store_enabled(self, mock_messaging_source):
        sample_config = SampleDataIngestionConfig(
            storeSampleData=True, readSampleData=True
        )
        profiler_config = ProfilerConfiguration(sampleDataConfig=sample_config)
        settings = Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=profiler_config,
        )
        mock_messaging_source.metadata.get_profiler_config_settings.return_value = (
            settings
        )

        assert (
            mock_messaging_source._is_sample_data_storing_globally_disabled() is False
        )

    def test_returns_false_when_store_enabled_read_disabled(
        self, mock_messaging_source
    ):
        sample_config = SampleDataIngestionConfig(
            storeSampleData=True, readSampleData=False
        )
        profiler_config = ProfilerConfiguration(sampleDataConfig=sample_config)
        settings = Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=profiler_config,
        )
        mock_messaging_source.metadata.get_profiler_config_settings.return_value = (
            settings
        )

        assert (
            mock_messaging_source._is_sample_data_storing_globally_disabled() is False
        )

    def test_returns_false_on_api_exception(self, mock_messaging_source):
        mock_messaging_source.metadata.get_profiler_config_settings.side_effect = (
            Exception("API error")
        )

        assert (
            mock_messaging_source._is_sample_data_storing_globally_disabled() is False
        )

    def test_defaults_are_both_enabled(self, mock_messaging_source):
        sample_config = SampleDataIngestionConfig()
        profiler_config = ProfilerConfiguration(sampleDataConfig=sample_config)
        settings = Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=profiler_config,
        )
        mock_messaging_source.metadata.get_profiler_config_settings.return_value = (
            settings
        )

        assert (
            mock_messaging_source._is_sample_data_storing_globally_disabled() is False
        )
