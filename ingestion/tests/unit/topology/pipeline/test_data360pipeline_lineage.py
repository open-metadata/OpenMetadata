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
Test the Salesforce Data 360 pipeline lineage source
"""

import copy
from unittest.mock import patch

import pytest

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.data360pipeline.exceptions import (
    ResourceNotFoundException,
)
from metadata.ingestion.source.pipeline.data360pipeline.lineage import (
    Data360PipelineLineageSource,
)
from metadata.ingestion.source.pipeline.data360pipeline.models import (
    AdvancedAttributes,
    ConnectorDetails,
    ConnectorInfo,
    DataStreamDetails,
)

MOCK_CONFIG = {
    "source": {
        "type": "data360pipeline",
        "serviceName": "local_data360pipeline",
        "serviceConnection": {
            "config": {
                "type": "Data360Pipeline",
                "consumerKey": "consumer_key",
                "consumerSecret": "consumer_secret",
                "salesforceDomain": "mycompany.my",
                "data360DbServiceName": "local_data360",
                "serviceMapping": '{"S3_Connector": "local_s3"}',
                "includeBulkLineage": True,
            }
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "data360pipeline"},
        }
    },
}


def _build_source(**connection_overrides) -> Data360PipelineLineageSource:
    config_dict = copy.deepcopy(MOCK_CONFIG)
    config_dict["source"]["serviceConnection"]["config"].update(connection_overrides)
    with (
        patch("metadata.ingestion.source.pipeline.data360pipeline.metadata.Data360PipelineSource.test_connection"),
        patch("metadata.ingestion.source.pipeline.data360pipeline.connection.Salesforce"),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(config_dict)
        return Data360PipelineLineageSource.create(
            config_dict["source"],
            OpenMetadata(config=config.workflowConfig.openMetadataServerConfig),
        )


class TestLineageConfiguration:
    def test_service_mapping_is_read_from_the_service_connection(self):
        # It used to be read off `source_config`, which has no such field, so every
        # DataStream lineage attempt raised AttributeError.
        source = _build_source()
        assert source.service_mapping == {"S3_Connector": "local_s3"}

    def test_service_mapping_defaults_to_empty_when_unset(self):
        source = _build_source(serviceMapping=None)
        assert source.service_mapping == {}

    def test_invalid_service_mapping_json_is_reported_not_raised(self):
        source = _build_source(serviceMapping="{not json")
        assert source.service_mapping == {}
        assert len(source.status.failures) == 1

    def test_bulk_lineage_is_skipped_when_the_connection_disables_it(self):
        source = _build_source(includeBulkLineage=False)
        with patch.object(source, "_yield_dlo_to_dmo_lineage") as mock_bulk:
            assert list(source.yield_pipeline_bulk_lineage_details()) == []
        mock_bulk.assert_not_called()

    def test_bulk_lineage_runs_when_the_connection_enables_it(self):
        source = _build_source(includeBulkLineage=True)
        with patch.object(source, "_yield_dlo_to_dmo_lineage", return_value=iter([])) as mock_bulk:
            list(source.yield_pipeline_bulk_lineage_details())
        mock_bulk.assert_called_once()

    def test_the_sql_parser_needs_no_source_config_knobs(self):
        # `parsingTimeoutLimit` / `parsingDialect` are not fields of
        # PipelineServiceMetadataPipeline; the parser's own defaults are used.
        source = _build_source()
        parser = source._get_lineage_parser(query="SELECT a FROM account_dlm", name="revenue_cio")
        assert parser.source_tables


class TestAdvancedAttributes:
    def test_the_api_schema_field_populates_source_schema(self):
        # `schema` shadows BaseModel.schema, so the field is aliased. The alias has
        # to keep working or Snowflake/Iceberg DataStream lineage loses its schema.
        attributes = AdvancedAttributes(schema="PUBLIC", database="ANALYTICS", object="ORDERS")
        assert attributes.source_schema == "PUBLIC"
        assert attributes.database == "ANALYTICS"


class TestSourceEntityResolution:
    def test_a_datastream_without_connector_info_is_reported(self):
        source = _build_source()
        with pytest.raises(ResourceNotFoundException, match="connectorInfo"):
            source._get_source_entity(DataStreamDetails(name="ds1"))

    def test_an_unmapped_file_connector_names_the_missing_mapping(self):
        source = _build_source(serviceMapping="{}")
        details = DataStreamDetails(
            name="ds1",
            connectorInfo=ConnectorInfo(
                connectorType="AwsS3",
                connectorDetails=ConnectorDetails(name="S3_Connector"),
            ),
            advancedAttributes=AdvancedAttributes(fileName="orders.csv"),
        )
        with pytest.raises(ResourceNotFoundException, match="serviceMapping"):
            source._get_source_entity(details)

    def test_an_unknown_connector_type_reports_the_details_it_had(self):
        source = _build_source()
        details = DataStreamDetails(
            name="ds1",
            connectorInfo=ConnectorInfo(connectorType="SomethingNew"),
        )
        with pytest.raises(ResourceNotFoundException, match="SomethingNew"):
            source._get_source_entity(details)
