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
Check incremental extraction
"""
from datetime import datetime
from unittest import TestCase
from unittest.mock import create_autospec, patch

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
    PipelineStatus,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    Incremental,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.incremental_metadata_extraction import (
    MILLISECONDS_IN_ONE_DAY,
    IncrementalConfig,
    IncrementalConfigCreator,
)

INCREMENTAL_CONFIG_DISABLED = IncrementalConfig(enabled=False)

INCREMENTAL_CONFIG_ENABLED = {
    "input": {
        "incremental_config": Incremental(enabled=True, safetyMarginDays=1),
        "pipeline_runs": [
            PipelineStatus(runId="1", pipelineState=PipelineState.failed),
            PipelineStatus(
                runId="2",
                startDate=Timestamp(
                    int(datetime.timestamp(datetime(2024, 1, 1)) * 1000)
                ),
                pipelineState=PipelineState.success,
            ),
        ],
    },
    "output": IncrementalConfig(
        enabled=True,
        start_timestamp=int(datetime.timestamp(datetime(2024, 1, 1)) * 1000)
        - MILLISECONDS_IN_ONE_DAY,
    ),
}


class IncrementalConfigCreatorTest(TestCase):
    """Validate incremental config creator"""

    def test_create_returns_incremental_config_disabled_when_no_incremental_config_exists(
        self,
    ):
        """Returns IncrementalConfig(enabled=False) when no incremental configuration is provided."""
        incremental_config_creator = IncrementalConfigCreator(
            incremental=None,
            pipeline_name="noop",
            metadata=create_autospec(OpenMetadata),
        )

        self.assertEqual(
            incremental_config_creator.create(), INCREMENTAL_CONFIG_DISABLED
        )

    def test_create_returns_incremental_config_disabled_when_no_pipeline_exists(self):
        """Returns IncrementalConfig(enabled=False) when no pipeline_name is provided."""
        incremental_config_creator = IncrementalConfigCreator(
            incremental=Incremental(enabled=True),
            pipeline_name=None,
            metadata=create_autospec(OpenMetadata),
        )

        self.assertEqual(
            incremental_config_creator.create(), INCREMENTAL_CONFIG_DISABLED
        )

    def test_create_returns_incremental_config_disabled_when_incremental_is_set_disabled(
        self,
    ):
        """Returns IncrementalConfig(enabled=False) when Incremental(enabled=False) is passed."""
        incremental_config_creator = IncrementalConfigCreator(
            incremental=Incremental(enabled=False),
            pipeline_name="noop",
            metadata=create_autospec(OpenMetadata),
        )

        self.assertEqual(
            incremental_config_creator.create(), INCREMENTAL_CONFIG_DISABLED
        )

    def test_create_returns_incremental_config_disabled_when_no_pipeline_status_is_found(
        self,
    ):
        """Returns IncrementalConfig(enabled=False) when self._get_pipeline_statuses() returns None."""
        with patch.object(
            IncrementalConfigCreator, "_get_pipeline_statuses", return_value=None
        ):
            incremental_config_creator = IncrementalConfigCreator(
                incremental=Incremental(enabled=True),
                pipeline_name="noop",
                metadata=create_autospec(OpenMetadata),
            )

            self.assertEqual(
                incremental_config_creator.create(), INCREMENTAL_CONFIG_DISABLED
            )

    def test_create_returns_incremental_config_disabled_when_no_pipeline_status_success_is_found(
        self,
    ):
        """Returns IncrementalConfig(enabled=False) when self._get_last_success_timestamp() returns None."""

        pipeline_runs = [
            PipelineStatus(runId="1", pipelineState=PipelineState.failed),
            PipelineStatus(runId="2", pipelineState=PipelineState.failed),
        ]

        with patch.object(
            IncrementalConfigCreator,
            "_get_pipeline_statuses",
            return_value=pipeline_runs,
        ):
            incremental_config_creator = IncrementalConfigCreator(
                incremental=Incremental(enabled=True),
                pipeline_name="noop",
                metadata=create_autospec(OpenMetadata),
            )

            self.assertEqual(
                incremental_config_creator.create(), INCREMENTAL_CONFIG_DISABLED
            )

    def test_create_returns_proper_incremental_configuration_when_enabled(self):
        """Returns the proper incremental configuration when enabled."""

        with patch.object(
            IncrementalConfigCreator,
            "_get_pipeline_statuses",
            return_value=INCREMENTAL_CONFIG_ENABLED["input"]["pipeline_runs"],
        ):
            incremental_config_creator = IncrementalConfigCreator(
                incremental=INCREMENTAL_CONFIG_ENABLED["input"]["incremental_config"],
                pipeline_name="noop",
                metadata=create_autospec(OpenMetadata),
            )

            self.assertEqual(
                incremental_config_creator.create(),
                INCREMENTAL_CONFIG_ENABLED["output"],
            )
