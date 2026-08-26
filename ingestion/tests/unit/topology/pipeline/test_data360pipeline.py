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
Test Salesforce Data 360 pipeline source using the topology
"""

from unittest.mock import patch

import pytest

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.parser import InvalidWorkflowException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.data360pipeline.lineage import (
    Data360PipelineLineageSource,
)
from metadata.ingestion.source.pipeline.data360pipeline.metadata import (
    Data360PipelineSource,
)
from metadata.ingestion.source.pipeline.data360pipeline.models import (
    DataStreamDetails,
    DataTransformDetails,
)

MOCK_DATA360PIPELINE_CONFIG = {
    "source": {
        "type": "data360pipeline",
        "serviceName": "local_data360pipeline",
        "serviceConnection": {
            "config": {
                "type": "Data360Pipeline",
                "consumerKey": "consumer_key",
                "consumerSecret": "consumer_secret",
                "salesforceDomain": "mycompany.my",
                "salesforceApiVersion": "63.0",
                "paginationLimit": 50,
                "data360DbServiceName": "local_data360",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "PipelineMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "data360pipeline"},
        }
    },
}


def _build_source() -> Data360PipelineSource:
    with (
        patch("metadata.ingestion.source.pipeline.data360pipeline.metadata.Data360PipelineSource.test_connection"),
        patch("metadata.ingestion.source.pipeline.data360pipeline.connection.Salesforce"),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_DATA360PIPELINE_CONFIG)
        return Data360PipelineSource.create(
            MOCK_DATA360PIPELINE_CONFIG["source"],
            OpenMetadata(config=config.workflowConfig.openMetadataServerConfig),
        )


class TestData360PipelineSourceCreate:
    def test_create_succeeds_with_db_service_name(self):
        source = _build_source()
        assert source.service_connection.data360DbServiceName == "local_data360"

    def test_create_succeeds_without_db_service_name(self):
        config_without_db_service = {
            **MOCK_DATA360PIPELINE_CONFIG,
            "source": {
                **MOCK_DATA360PIPELINE_CONFIG["source"],
                "serviceConnection": {
                    "config": {
                        "type": "Data360Pipeline",
                        "consumerKey": "consumer_key",
                        "consumerSecret": "consumer_secret",
                    }
                },
            },
        }
        with (
            patch("metadata.ingestion.source.pipeline.data360pipeline.metadata.Data360PipelineSource.test_connection"),
            patch("metadata.ingestion.source.pipeline.data360pipeline.connection.Salesforce"),
        ):
            config = OpenMetadataWorkflowConfig.model_validate(config_without_db_service)
            source = Data360PipelineSource.create(
                config_without_db_service["source"],
                OpenMetadata(config=config.workflowConfig.openMetadataServerConfig),
            )
        assert source.service_connection.data360DbServiceName is None

    def test_lineage_create_raises_without_db_service_name(self):
        config_without_db_service = {
            **MOCK_DATA360PIPELINE_CONFIG,
            "source": {
                **MOCK_DATA360PIPELINE_CONFIG["source"],
                "serviceConnection": {
                    "config": {
                        "type": "Data360Pipeline",
                        "consumerKey": "consumer_key",
                        "consumerSecret": "consumer_secret",
                    }
                },
            },
        }
        with (
            patch("metadata.ingestion.source.pipeline.data360pipeline.metadata.Data360PipelineSource.test_connection"),
            patch("metadata.ingestion.source.pipeline.data360pipeline.connection.Salesforce"),
            pytest.raises(InvalidWorkflowException),
        ):
            config = OpenMetadataWorkflowConfig.model_validate(config_without_db_service)
            Data360PipelineLineageSource.create(
                config_without_db_service["source"],
                OpenMetadata(config=config.workflowConfig.openMetadataServerConfig),
            )

    def test_lineage_create_succeeds_with_db_service_name(self):
        with (
            patch("metadata.ingestion.source.pipeline.data360pipeline.metadata.Data360PipelineSource.test_connection"),
            patch("metadata.ingestion.source.pipeline.data360pipeline.connection.Salesforce"),
        ):
            config = OpenMetadataWorkflowConfig.model_validate(MOCK_DATA360PIPELINE_CONFIG)
            source = Data360PipelineLineageSource.create(
                MOCK_DATA360PIPELINE_CONFIG["source"],
                OpenMetadata(config=config.workflowConfig.openMetadataServerConfig),
            )
        assert source.service_connection.data360DbServiceName == "local_data360"


class TestData360PipelineSourceMetadata:
    def test_get_datastreams_yields_active_and_filters_inactive(self):
        source = _build_source()
        source.pagination_limit = 50
        raw_items = [
            {"name": "active_stream", "status": "ACTIVE", "label": "Active Stream"},
            {"name": "inactive_stream", "status": "INACTIVE", "label": "Inactive Stream"},
        ]
        with patch(
            "metadata.ingestion.source.pipeline.data360pipeline.metadata.get_datastreams",
            return_value=raw_items,
        ):
            results = list(source._get_datastreams())
        assert len(results) == 1
        assert results[0].name == "active_stream"

    def test_get_calculated_insights_yields_active_and_filters_inactive(self):
        source = _build_source()
        source.pagination_limit = 50
        raw_items = [
            {"apiName": "active_ci", "calculatedInsightStatus": "ACTIVE"},
            {"apiName": "inactive_ci", "calculatedInsightStatus": "INACTIVE"},
        ]
        with patch(
            "metadata.ingestion.source.pipeline.data360pipeline.metadata.get_calculated_insights",
            return_value=raw_items,
        ):
            results = list(source._get_calculated_insights())
        assert len(results) == 1
        assert results[0].apiName == "active_ci"

    def test_get_datatransforms_yields_active_and_filters_inactive(self):
        source = _build_source()
        source.pagination_limit = 50
        raw_items = [
            {"name": "active_dt", "status": "ACTIVE"},
            {"name": "inactive_dt", "status": "INACTIVE"},
        ]
        with patch(
            "metadata.ingestion.source.pipeline.data360pipeline.metadata.get_datatransforms",
            return_value=raw_items,
        ):
            results = list(source._get_datatransforms())
        assert len(results) == 1
        assert results[0].name == "active_dt"

    def test_get_pipelines_list_combines_all_three_object_types(self):
        source = _build_source()
        with (
            patch(
                "metadata.ingestion.source.pipeline.data360pipeline.metadata.get_datastreams",
                return_value=[{"name": "ds1", "status": "ACTIVE"}],
            ),
            patch(
                "metadata.ingestion.source.pipeline.data360pipeline.metadata.get_calculated_insights",
                return_value=[{"apiName": "ci1", "calculatedInsightStatus": "ACTIVE"}],
            ),
            patch(
                "metadata.ingestion.source.pipeline.data360pipeline.metadata.get_datatransforms",
                return_value=[{"name": "dt1", "status": "ACTIVE"}],
            ),
        ):
            pipelines = list(source.get_pipelines_list())
        assert [p.get_name() for p in pipelines] == ["ds1", "ci1", "dt1"]

    def test_get_pipeline_name_delegates_to_details_object(self):
        source = _build_source()
        details = DataStreamDetails(name="ds1", label="DS1")
        assert source.get_pipeline_name(details) == "ds1"

    def test_create_pipeline_request_for_datastream_sets_source_url(self):
        source = _build_source()
        details = DataStreamDetails(name="ds1", label="DS1", recordId="0Ma000000000001")
        request = source._get_create_pipeline_request(details)
        assert isinstance(request, CreatePipelineRequest)
        assert str(request.name.root) == "ds1"
        assert request.sourceUrl is not None
        assert "0Ma000000000001" in str(request.sourceUrl.root)

    def test_create_pipeline_request_for_datatransform_sets_life_cycle(self):
        source = _build_source()
        details = DataTransformDetails(
            name="dt1",
            label="DT1",
            createdDate="2024-01-01T00:00:00Z",
            lastModifiedDate="2024-01-02T00:00:00Z",
        )
        request = source._get_create_pipeline_request(details)
        assert str(request.name.root) == "dt1"
        assert request.lifeCycle is not None
        assert request.lifeCycle.created.timestamp.root == 1704067200000
        assert request.lifeCycle.updated.timestamp.root == 1704153600000

    def test_yield_pipeline_returns_create_request(self):
        source = _build_source()
        details = DataStreamDetails(name="ds1", label="DS1")
        results = list(source.yield_pipeline(details))
        assert len(results) == 1
        assert results[0].left is None
        assert results[0].right is not None

    def test_yield_tag_collects_status_based_tags(self):
        source = _build_source()
        details = DataTransformDetails(name="dt1", label="DT1", status="ACTIVE", creationType="Standard")
        results = list(source.yield_tag(details))
        assert len(results) >= 1

    def test_get_source_url_handles_my_domain(self):
        source = _build_source()
        url = source.get_source_url("acme.my", "0Ma000000000001")
        assert url == "https://acme.lightning.force.com/lightning/r/DataLakeObjectInstance/0Ma000000000001/view"

    def test_get_source_url_handles_plain_domain(self):
        source = _build_source()
        url = source.get_source_url("acme", "0Ma000000000001")
        assert url == "https://acme.lightning.force.com/lightning/r/DataLakeObjectInstance/0Ma000000000001/view"

    def test_get_source_url_returns_none_without_datastream_id(self):
        source = _build_source()
        assert source.get_source_url("mycompany.my", None) is None

    def test_get_timestamp_converts_iso_string_to_millis(self):
        source = _build_source()
        assert source.get_timestamp("2024-01-01T00:00:00Z") == 1704067200000

    def test_get_timestamp_returns_none_for_null_string(self):
        source = _build_source()
        assert source.get_timestamp("null") is None

    def test_log_warning_records_status(self):
        source = _build_source()
        source.log_warning("something went wrong")
        assert len(source.status.warnings) == 1
