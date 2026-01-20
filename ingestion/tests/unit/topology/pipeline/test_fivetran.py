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
Test fivetran using the topology
"""
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import Mock, patch
from uuid import uuid4

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SourceUrl
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.fivetran.metadata import (
    FivetranPipelineDetails,
    FivetranSource,
)

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/fivetran_dataset.json"
)
with open(mock_file_path) as file:
    mock_data: dict = json.load(file)

mock_fivetran_config = {
    "source": {
        "type": "fivetran",
        "serviceName": "fivetran_source",
        "serviceConnection": {
            "config": {
                "type": "Fivetran",
                "apiKey": "sample_api_key",
                "apiSecret": "sample_api_secret",
            }
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}


EXPECTED_FIVETRAN_DETAILS = FivetranPipelineDetails(
    source=mock_data.get("source"),
    destination=mock_data.get("destination"),
    group=mock_data.get("group"),
    connector_id=mock_data.get("source").get("id"),
)


EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name="wackiness_remote_aiding_pointless",
    displayName="test <> postgres_rds",
    tasks=[
        Task(
            name="wackiness_remote_aiding_pointless",
            displayName="test <> postgres_rds",
            sourceUrl=SourceUrl(
                "https://fivetran.com/dashboard/connectors/aiding_pointless/status?groupId=wackiness_remote&service=postgres_rds"
            ),
        )
    ],
    service=FullyQualifiedEntityName("fivetran_source"),
    sourceUrl=SourceUrl(
        "https://fivetran.com/dashboard/connectors/aiding_pointless/status?groupId=wackiness_remote&service=postgres_rds"
    ),
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="fivetran_source",
    fullyQualifiedName=FullyQualifiedEntityName("fivetran_source"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Fivetran,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="wackiness_remote_aiding_pointless",
    fullyQualifiedName="fivetran_source.wackiness_remote_aiding_pointless",
    displayName="test <> postgres_rds",
    tasks=[
        Task(
            name="wackiness_remote_aiding_pointless",
            displayName="test <> postgres_rds",
        )
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)


class FivetranUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.pipeline.fivetran.connection.get_connection")
    def __init__(self, methodName, fivetran_client, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        config = OpenMetadataWorkflowConfig.model_validate(mock_fivetran_config)
        self.fivetran = FivetranSource.create(
            mock_fivetran_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.fivetran.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.fivetran.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root
        self.client = fivetran_client.return_value
        self.client.list_groups.return_value = [mock_data.get("group")]
        self.client.list_group_connectors.return_value = [mock_data.get("source")]
        self.client.get_destination_details.return_value = mock_data.get("destination")
        self.client.get_connector_details.return_value = mock_data.get("source")

    def test_pipeline_list(self):
        assert list(self.fivetran.get_pipelines_list())[0] == EXPECTED_FIVETRAN_DETAILS

    def test_pipeline_name(self):
        assert (
            self.fivetran.get_pipeline_name(EXPECTED_FIVETRAN_DETAILS)
            == f'{mock_data.get("group").get("name")} <> {mock_data.get("source").get("schema")}'
        )

    def test_pipelines(self):
        pipeline = list(self.fivetran.yield_pipeline(EXPECTED_FIVETRAN_DETAILS))[
            0
        ].right
        assert pipeline == EXPECTED_CREATED_PIPELINES

    def test_get_pipeline_name_returns_display_name(self):
        result = self.fivetran.get_pipeline_name(EXPECTED_FIVETRAN_DETAILS)
        assert result == "test <> postgres_rds"

    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_db_service_names"
    )
    def test_yield_lineage_skips_disabled_schemas(self, mock_get_services):
        mock_get_services.return_value = ["postgres_service"]

        self.client.get_connector_schema_details.return_value = {
            "disabled_schema": {
                "enabled": False,
                "name_in_destination": "disabled_schema",
                "tables": {"table1": {"enabled": True}},
            }
        }

        result = list(
            self.fivetran.yield_pipeline_lineage_details(EXPECTED_FIVETRAN_DETAILS)
        )

        assert len(result) == 0

    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_db_service_names"
    )
    def test_yield_lineage_skips_disabled_tables(self, mock_get_services):
        mock_get_services.return_value = ["postgres_service"]

        self.client.get_connector_schema_details.return_value = {
            "public": {
                "enabled": True,
                "name_in_destination": "public",
                "tables": {
                    "disabled_table": {
                        "enabled": False,
                        "name_in_destination": "disabled_table",
                    }
                },
            }
        }

        result = list(
            self.fivetran.yield_pipeline_lineage_details(EXPECTED_FIVETRAN_DETAILS)
        )

        assert len(result) == 0

    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_db_service_names"
    )
    @patch("metadata.utils.fqn.build")
    def test_yield_lineage_finds_tables_in_different_services(
        self, mock_build, mock_get_services
    ):
        mock_get_services.return_value = ["postgres_service", "snowflake_service"]

        mock_source_table = Mock()
        mock_source_table.id = str(uuid4())
        mock_dest_table = Mock()
        mock_dest_table.id = str(uuid4())
        mock_pipeline = Mock()
        mock_pipeline.id.root = str(uuid4())

        def build_side_effect(metadata, entity_type, **kwargs):
            service = kwargs.get("service_name", "")
            database = kwargs.get("database_name", "")
            schema = kwargs.get("schema_name", "")
            table = kwargs.get("table_name", "")
            return ".".join(
                str(part) for part in [service, database, schema, table] if part
            )

        mock_build.side_effect = build_side_effect

        def get_by_name_side_effect(entity, fqn):
            fqn_str = str(fqn)
            if (
                "snowflake_service" in fqn_str
                and "users" in fqn_str
                and "users_dest" not in fqn_str
            ):
                return mock_source_table
            elif "postgres_service" in fqn_str and "users_dest" in fqn_str:
                return mock_dest_table
            elif "pipeline" in fqn_str or "fivetran" in fqn_str:
                return mock_pipeline
            return None

        original_metadata = self.fivetran.metadata
        mock_metadata = Mock()
        mock_metadata.get_by_name = Mock(side_effect=get_by_name_side_effect)
        self.fivetran.metadata = mock_metadata

        try:
            self.client.get_connector_schema_details.return_value = {
                "public": {
                    "enabled": True,
                    "name_in_destination": "public_dest",
                    "tables": {
                        "users": {
                            "enabled": True,
                            "name_in_destination": "users_dest",
                        }
                    },
                }
            }

            self.client.get_connector_column_lineage.return_value = {}

            result = list(
                self.fivetran.yield_pipeline_lineage_details(EXPECTED_FIVETRAN_DETAILS)
            )

            assert len(result) == 1
            assert result[0].right is not None

            lineage = result[0].right
            assert str(lineage.edge.fromEntity.id.root) == mock_source_table.id
            assert str(lineage.edge.toEntity.id.root) == mock_dest_table.id
            assert lineage.edge.fromEntity.type == "table"
            assert lineage.edge.toEntity.type == "table"

            assert (
                str(lineage.edge.lineageDetails.pipeline.id.root)
                == mock_pipeline.id.root
            )
            assert lineage.edge.lineageDetails.pipeline.type == "pipeline"
        finally:
            self.fivetran.metadata = original_metadata

    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_db_service_names"
    )
    @patch("metadata.utils.fqn.build")
    def test_yield_lineage_skips_self_referencing_tables(
        self, mock_build, mock_get_services
    ):
        """
        Test that lineage is NOT created when source and destination
        are the same table (self-referencing loop).

        Scenario: Fivetran copies a table in-place (e.g., backup/versioning)
        Expected: No lineage entry created (empty result)
        """
        mock_get_services.return_value = ["postgres_service"]

        # Create mock table with SAME entity ID for both source and destination
        same_table_id = str(uuid4())
        mock_same_table = Mock()
        mock_same_table.id = same_table_id

        mock_pipeline = Mock()
        mock_pipeline.id.root = str(uuid4())

        # FQN builder returns different FQNs (simulating table rename)
        def build_side_effect(metadata, entity_type, **kwargs):
            service = kwargs.get("service_name", "")
            database = kwargs.get("database_name", "")
            schema = kwargs.get("schema_name", "")
            table = kwargs.get("table_name", "")
            return ".".join(
                str(part) for part in [service, database, schema, table] if part
            )

        mock_build.side_effect = build_side_effect

        # get_by_name returns SAME entity for both source and destination lookups
        def get_by_name_side_effect(entity, fqn):
            fqn_str = str(fqn)
            if "orders" in fqn_str:  # Both source and dest resolve to same entity
                return mock_same_table
            elif "pipeline" in fqn_str or "fivetran" in fqn_str:
                return mock_pipeline
            return None

        original_metadata = self.fivetran.metadata
        mock_metadata = Mock()
        mock_metadata.get_by_name = Mock(side_effect=get_by_name_side_effect)
        self.fivetran.metadata = mock_metadata

        try:
            # Mock Fivetran schema details: source "orders" → destination "orders"
            self.client.get_connector_schema_details.return_value = {
                "public": {
                    "enabled": True,
                    "name_in_destination": "public",
                    "tables": {
                        "orders": {
                            "enabled": True,
                            "name_in_destination": "orders",  # Same table name
                        }
                    },
                }
            }

            self.client.get_connector_column_lineage.return_value = {}

            # Execute lineage generation
            result = list(
                self.fivetran.yield_pipeline_lineage_details(EXPECTED_FIVETRAN_DETAILS)
            )

            # ASSERTION: No lineage should be created for self-referencing tables
            assert len(result) == 0, (
                f"Expected no lineage for self-referencing table, but got {len(result)} entries. "
                f"Self-lineage loops (table → same table) should be prevented."
            )

        finally:
            self.fivetran.metadata = original_metadata
