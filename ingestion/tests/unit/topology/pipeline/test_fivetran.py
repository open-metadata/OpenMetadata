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
from datetime import datetime
from pathlib import Path
from unittest import TestCase
from unittest.mock import Mock, patch
from uuid import uuid4

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineState,
    StatusType,
    Task,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SourceUrl
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.fivetran.metadata import (
    FIVETRAN_TASK_EXTRACT,
    FIVETRAN_TASK_LOAD,
    FIVETRAN_TASK_PROCESS,
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

SOURCE_URL = SourceUrl(
    "https://fivetran.com/dashboard/connectors/aiding_pointless/status?groupId=wackiness_remote&service=postgres_rds"
)

EXPECTED_FIVETRAN_DETAILS = FivetranPipelineDetails(
    source=mock_data.get("source"),
    destination=mock_data.get("destination"),
    group=mock_data.get("group"),
    connector_id=mock_data.get("source").get("id"),
)


EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name="wackiness_remote_aiding_pointless",
    displayName="postgres_rds <> test",
    tasks=[
        Task(
            name=FIVETRAN_TASK_EXTRACT,
            displayName="Extract",
            taskType="Extract",
            downstreamTasks=[FIVETRAN_TASK_PROCESS],
        ),
        Task(
            name=FIVETRAN_TASK_PROCESS,
            displayName="Process",
            taskType="Process",
            downstreamTasks=[FIVETRAN_TASK_LOAD],
        ),
        Task(
            name=FIVETRAN_TASK_LOAD,
            displayName="Load",
            taskType="Load",
            downstreamTasks=[],
        ),
    ],
    service=FullyQualifiedEntityName("fivetran_source"),
    sourceUrl=SOURCE_URL,
    scheduleInterval="0 */6 * * *",
    state=PipelineState.Active,
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
    displayName="postgres_rds <> test",
    tasks=[
        Task(
            name=FIVETRAN_TASK_EXTRACT,
            displayName="Extract",
        ),
        Task(
            name=FIVETRAN_TASK_PROCESS,
            displayName="Process",
        ),
        Task(
            name=FIVETRAN_TASK_LOAD,
            displayName="Load",
        ),
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
            == f'{mock_data.get("source").get("schema")} <> {mock_data.get("group").get("name")}'
        )

    def test_pipelines(self):
        pipeline = list(self.fivetran.yield_pipeline(EXPECTED_FIVETRAN_DETAILS))[
            0
        ].right
        assert pipeline == EXPECTED_CREATED_PIPELINES

    def test_get_pipeline_name_returns_display_name(self):
        result = self.fivetran.get_pipeline_name(EXPECTED_FIVETRAN_DETAILS)
        assert result == "postgres_rds <> test"

    def test_pipeline_has_three_tasks(self):
        pipeline = list(self.fivetran.yield_pipeline(EXPECTED_FIVETRAN_DETAILS))[
            0
        ].right
        assert len(pipeline.tasks) == 3
        assert pipeline.tasks[0].name == FIVETRAN_TASK_EXTRACT
        assert pipeline.tasks[0].taskType == "Extract"
        assert pipeline.tasks[0].downstreamTasks == [FIVETRAN_TASK_PROCESS]
        assert pipeline.tasks[1].name == FIVETRAN_TASK_PROCESS
        assert pipeline.tasks[1].taskType == "Process"
        assert pipeline.tasks[1].downstreamTasks == [FIVETRAN_TASK_LOAD]
        assert pipeline.tasks[2].name == FIVETRAN_TASK_LOAD
        assert pipeline.tasks[2].taskType == "Load"
        assert pipeline.tasks[2].downstreamTasks == []

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
        mock_get_services.return_value = ["postgres_service"]

        same_table_id = str(uuid4())
        mock_same_table = Mock()
        mock_same_table.id = same_table_id

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
            if "orders" in fqn_str:
                return mock_same_table
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
                    "name_in_destination": "public",
                    "tables": {
                        "orders": {
                            "enabled": True,
                            "name_in_destination": "orders",
                        }
                    },
                }
            }

            self.client.get_connector_column_lineage.return_value = {}

            result = list(
                self.fivetran.yield_pipeline_lineage_details(EXPECTED_FIVETRAN_DETAILS)
            )

            assert len(result) == 0, (
                f"Expected no lineage for self-referencing table, but got {len(result)} entries. "
                f"Self-lineage loops (table → same table) should be prevented."
            )

        finally:
            self.fivetran.metadata = original_metadata

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_fetch_column_lineage_skips_none_column_name(self, mock_get_col_fqn):
        mock_from_table = Mock()
        mock_to_table = Mock()
        self.client.get_connector_column_lineage.return_value = {
            None: {"enabled": True, "name_in_destination": "dest_col"}
        }

        result = self.fivetran.fetch_column_lineage(
            pipeline_details=EXPECTED_FIVETRAN_DETAILS,
            schema_name="public",
            schema_data={},
            table_name="users",
            from_table_entity=mock_from_table,
            to_table_entity=mock_to_table,
        )

        assert result == []
        mock_get_col_fqn.assert_not_called()

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_fetch_column_lineage_skips_none_destination_name(self, mock_get_col_fqn):
        mock_from_table = Mock()
        mock_to_table = Mock()
        self.client.get_connector_column_lineage.return_value = {
            "src_col": {"enabled": True, "name_in_destination": None}
        }

        result = self.fivetran.fetch_column_lineage(
            pipeline_details=EXPECTED_FIVETRAN_DETAILS,
            schema_name="public",
            schema_data={},
            table_name="users",
            from_table_entity=mock_from_table,
            to_table_entity=mock_to_table,
        )

        assert result == []
        mock_get_col_fqn.assert_not_called()

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_fetch_column_lineage_skips_unresolved_fqn(self, mock_get_col_fqn):
        mock_from_table = Mock()
        mock_to_table = Mock()
        self.client.get_connector_column_lineage.return_value = {
            "src_col": {"enabled": True, "name_in_destination": "dest_col"}
        }
        mock_get_col_fqn.side_effect = [
            "service.db.schema.table.src_col",
            None,
        ]

        result = self.fivetran.fetch_column_lineage(
            pipeline_details=EXPECTED_FIVETRAN_DETAILS,
            schema_name="public",
            schema_data={},
            table_name="users",
            from_table_entity=mock_from_table,
            to_table_entity=mock_to_table,
        )

        assert result == []

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_fetch_column_lineage_happy_path(self, mock_get_col_fqn):
        mock_from_table = Mock()
        mock_to_table = Mock()
        self.client.get_connector_column_lineage.return_value = {
            "src_col": {"enabled": True, "name_in_destination": "dest_col"}
        }
        mock_get_col_fqn.side_effect = [
            "service.db.schema.table.src_col",
            "service.db.schema.table.dest_col",
        ]

        result = self.fivetran.fetch_column_lineage(
            pipeline_details=EXPECTED_FIVETRAN_DETAILS,
            schema_name="public",
            schema_data={},
            table_name="users",
            from_table_entity=mock_from_table,
            to_table_entity=mock_to_table,
        )

        assert len(result) == 1
        assert isinstance(result[0], ColumnLineage)
        assert result[0].fromColumns[0].root == "service.db.schema.table.src_col"
        assert result[0].toColumn.root == "service.db.schema.table.dest_col"

    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_messaging_service_names"
    )
    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_db_service_names"
    )
    @patch("metadata.utils.fqn.build")
    def test_yield_lineage_messaging_source_resolves_topic(
        self, mock_build, mock_get_db_services, mock_get_msg_services
    ):
        mock_get_db_services.return_value = ["snowflake_service"]
        mock_get_msg_services.return_value = ["kafka_service"]

        mock_topic = Mock()
        mock_topic.id = str(uuid4())
        mock_dest_table = Mock()
        mock_dest_table.id = str(uuid4())
        mock_pipeline = Mock()
        mock_pipeline.id.root = str(uuid4())

        messaging_details = FivetranPipelineDetails(
            source={
                "id": "confluent_connector",
                "service": "confluent_cloud",
                "schema": "confluent_cloud",
                "config": {},
            },
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="confluent_connector",
        )

        def build_side_effect(metadata=None, entity_type=None, **kwargs):
            service = kwargs.get("service_name", "")
            if kwargs.get("topic_name"):
                return f"{service}.{kwargs['topic_name']}"
            parts = [
                service,
                kwargs.get("database_name", ""),
                kwargs.get("schema_name", ""),
                kwargs.get("table_name", ""),
            ]
            return ".".join(str(p) for p in parts if p)

        mock_build.side_effect = build_side_effect

        def get_by_name_side_effect(entity, fqn):
            fqn_str = str(fqn)
            if "kafka_service" in fqn_str:
                return mock_topic
            elif "snowflake_service" in fqn_str and "STOCK_TRADES" in fqn_str:
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
                "topics": {
                    "enabled": True,
                    "name_in_destination": "confluent_cloud",
                    "tables": {
                        "STOCK_TRADES": {
                            "enabled": True,
                            "name_in_destination": "STOCK_TRADES",
                        }
                    },
                }
            }

            result = list(
                self.fivetran.yield_pipeline_lineage_details(messaging_details)
            )

            assert len(result) == 1
            assert result[0].right is not None
            lineage = result[0].right
            assert lineage.edge.fromEntity.type == "topic"
            assert lineage.edge.toEntity.type == "table"
            assert str(lineage.edge.fromEntity.id.root) == mock_topic.id
            assert str(lineage.edge.toEntity.id.root) == mock_dest_table.id
        finally:
            self.fivetran.metadata = original_metadata

    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.fetch_column_lineage"
    )
    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_messaging_service_names"
    )
    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_db_service_names"
    )
    @patch("metadata.utils.fqn.build")
    def test_yield_lineage_messaging_source_skips_column_lineage(
        self,
        mock_build,
        mock_get_db_services,
        mock_get_msg_services,
        mock_fetch_col_lineage,
    ):
        mock_get_db_services.return_value = ["snowflake_service"]
        mock_get_msg_services.return_value = ["kafka_service"]

        mock_topic = Mock()
        mock_topic.id = str(uuid4())
        mock_dest_table = Mock()
        mock_dest_table.id = str(uuid4())
        mock_pipeline = Mock()
        mock_pipeline.id.root = str(uuid4())

        messaging_details = FivetranPipelineDetails(
            source={
                "id": "kafka_connector",
                "service": "kafka",
                "schema": "kafka",
                "config": {},
            },
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="kafka_connector",
        )

        def build_side_effect(metadata=None, entity_type=None, **kwargs):
            service = kwargs.get("service_name", "")
            if kwargs.get("topic_name"):
                return f"{service}.{kwargs['topic_name']}"
            parts = [
                service,
                kwargs.get("database_name", ""),
                kwargs.get("schema_name", ""),
                kwargs.get("table_name", ""),
            ]
            return ".".join(str(p) for p in parts if p)

        mock_build.side_effect = build_side_effect

        def get_by_name_side_effect(entity, fqn):
            fqn_str = str(fqn)
            if "kafka_service" in fqn_str:
                return mock_topic
            elif "snowflake_service" in fqn_str:
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
                "topics": {
                    "enabled": True,
                    "name_in_destination": "kafka_dest",
                    "tables": {
                        "events": {
                            "enabled": True,
                            "name_in_destination": "events",
                        }
                    },
                }
            }

            result = list(
                self.fivetran.yield_pipeline_lineage_details(messaging_details)
            )

            assert len(result) == 1
            mock_fetch_col_lineage.assert_not_called()
        finally:
            self.fivetran.metadata = original_metadata

    def test_pipeline_status_from_sync_history(self):
        self.client.get_connector_sync_history.return_value = [
            {
                "start": "2026-03-20T08:18:56.823Z",
                "end": "2026-03-20T08:19:12.094Z",
                "status": "COMPLETED",
            },
            {
                "start": "2026-03-19T08:00:00.000Z",
                "end": "2026-03-19T08:01:30.000Z",
                "status": "FAILURE_WITH_TASK",
            },
        ]
        statuses = list(self.fivetran.yield_pipeline_status(EXPECTED_FIVETRAN_DETAILS))
        # 2 from sync history + 2 from historical fields (succeeded_at, failed_at)
        assert len(statuses) == 4
        assert (
            statuses[0].right.pipeline_status.executionStatus == StatusType.Successful
        )
        assert statuses[1].right.pipeline_status.executionStatus == StatusType.Failed

        # Each status entry should have 3 task statuses (load, process, extract)
        task_statuses = statuses[0].right.pipeline_status.taskStatus
        assert len(task_statuses) == 3
        assert task_statuses[0].name == FIVETRAN_TASK_LOAD
        assert task_statuses[1].name == FIVETRAN_TASK_PROCESS
        assert task_statuses[2].name == FIVETRAN_TASK_EXTRACT

        assert (
            statuses[2].right.pipeline_status.executionStatus == StatusType.Successful
        )
        assert statuses[3].right.pipeline_status.executionStatus == StatusType.Failed

    def test_pipeline_status_no_sync_history(self):
        self.client.get_connector_sync_history.return_value = []
        statuses = list(self.fivetran.yield_pipeline_status(EXPECTED_FIVETRAN_DETAILS))
        assert len(statuses) == 2
        assert (
            statuses[0].right.pipeline_status.executionStatus == StatusType.Successful
        )
        assert statuses[1].right.pipeline_status.executionStatus == StatusType.Failed
        # Fallback still uses 3 tasks
        assert len(statuses[0].right.pipeline_status.taskStatus) == 3

    def test_pipeline_status_pending_sync(self):
        self.client.get_connector_sync_history.return_value = [
            {
                "start": "2026-03-20T10:00:00.000Z",
                "end": None,
                "status": "SYNCING",
            },
        ]
        statuses = list(self.fivetran.yield_pipeline_status(EXPECTED_FIVETRAN_DETAILS))
        assert len(statuses) == 3
        assert statuses[0].right.pipeline_status.executionStatus == StatusType.Pending
        task_statuses = statuses[0].right.pipeline_status.taskStatus
        assert len(task_statuses) == 3
        assert task_statuses[2].startTime is not None
        assert task_statuses[2].endTime is None

    def test_pipeline_status_deduplicates_historical(self):
        self.client.get_connector_sync_history.return_value = [
            {
                "start": "2022-07-25T08:34:31.425131Z",
                "end": "2022-07-25T08:35:00.000Z",
                "status": "COMPLETED",
            },
        ]
        statuses = list(self.fivetran.yield_pipeline_status(EXPECTED_FIVETRAN_DETAILS))
        assert len(statuses) == 2
        assert (
            statuses[0].right.pipeline_status.executionStatus == StatusType.Successful
        )
        assert statuses[0].right.pipeline_status.taskStatus[0].endTime is not None
        assert statuses[1].right.pipeline_status.executionStatus == StatusType.Failed

    def test_schedule_interval_hours(self):
        details = FivetranPipelineDetails(
            source={"sync_frequency": 360, "schema": "test", "service": "postgres"},
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="test_connector",
        )
        assert self.fivetran._get_schedule_interval(details) == "0 */6 * * *"

    def test_schedule_interval_minutes(self):
        details = FivetranPipelineDetails(
            source={"sync_frequency": 30, "schema": "test", "service": "postgres"},
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="test_connector",
        )
        assert self.fivetran._get_schedule_interval(details) == "*/30 * * * *"

    def test_schedule_interval_daily(self):
        details = FivetranPipelineDetails(
            source={"sync_frequency": 1440, "schema": "test", "service": "postgres"},
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="test_connector",
        )
        assert self.fivetran._get_schedule_interval(details) == "0 0 * * *"

    def test_pipeline_state_active(self):
        details = FivetranPipelineDetails(
            source={"paused": False, "schema": "test", "service": "postgres"},
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="test_connector",
        )
        assert self.fivetran.get_pipeline_state(details) == PipelineState.Active

    def test_pipeline_state_inactive(self):
        details = FivetranPipelineDetails(
            source={"paused": True, "schema": "test", "service": "postgres"},
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="test_connector",
        )
        assert self.fivetran.get_pipeline_state(details) == PipelineState.Inactive

    def test_pipeline_status_from_db_happy_path(self):
        ts_start = datetime(2026, 3, 20, 8, 0, 0)
        ts_extract = datetime(2026, 3, 20, 8, 0, 10)
        ts_write_start = datetime(2026, 3, 20, 8, 0, 16)
        ts_write_end = datetime(2026, 3, 20, 8, 0, 21)
        ts_sync_end = datetime(2026, 3, 20, 8, 0, 22)

        rows = [
            ("sync-1", "sync_start", None, ts_start),
            (
                "sync-1",
                "extract_summary",
                '{"status":"SUCCESS","total_rows":100}',
                ts_extract,
            ),
            ("sync-1", "write_to_table_start", '{"table":"Album"}', ts_write_start),
            ("sync-1", "write_to_table_end", '{"table":"Album"}', ts_write_end),
            ("sync-1", "sync_end", '{"status":"SUCCESSFUL"}', ts_sync_end),
            (
                "sync-1",
                "sync_stats",
                '{"extract_time_s":10,"process_time_s":6,"load_time_s":5,"total_time_s":21}',
                ts_sync_end,
            ),
        ]
        syncs = FivetranSource._parse_sync_events(rows)
        sync = syncs["sync-1"]
        task_statuses = FivetranSource._build_task_statuses_for_sync(sync)

        assert len(task_statuses) == 3
        assert task_statuses[0].name == FIVETRAN_TASK_LOAD
        assert task_statuses[0].executionStatus == StatusType.Successful
        assert task_statuses[0].startTime is not None
        assert task_statuses[0].endTime is not None
        assert task_statuses[1].name == FIVETRAN_TASK_PROCESS
        assert task_statuses[1].executionStatus == StatusType.Successful
        assert task_statuses[2].name == FIVETRAN_TASK_EXTRACT
        assert task_statuses[2].executionStatus == StatusType.Successful
        assert task_statuses[2].startTime is not None
        assert task_statuses[2].endTime is not None

    def test_pipeline_status_from_db_extract_failure(self):
        ts_start = datetime(2026, 3, 20, 8, 0, 0)
        ts_extract = datetime(2026, 3, 20, 8, 0, 10)
        ts_sync_end = datetime(2026, 3, 20, 8, 0, 11)

        rows = [
            ("sync-1", "sync_start", None, ts_start),
            ("sync-1", "extract_summary", '{"status":"FAILURE"}', ts_extract),
            ("sync-1", "sync_end", '{"status":"FAILURE_WITH_TASK"}', ts_sync_end),
        ]
        syncs = FivetranSource._parse_sync_events(rows)
        sync = syncs["sync-1"]
        task_statuses = FivetranSource._build_task_statuses_for_sync(sync)

        assert task_statuses[0].name == FIVETRAN_TASK_LOAD
        assert task_statuses[0].executionStatus == StatusType.Failed
        assert task_statuses[1].name == FIVETRAN_TASK_PROCESS
        assert task_statuses[1].executionStatus == StatusType.Failed
        assert task_statuses[2].name == FIVETRAN_TASK_EXTRACT
        assert task_statuses[2].executionStatus == StatusType.Failed

    def test_pipeline_status_from_db_uses_sync_stats_fallback(self):
        ts_start = datetime(2026, 3, 20, 8, 0, 0)
        ts_sync_end = datetime(2026, 3, 20, 8, 0, 27)

        rows = [
            ("sync-1", "sync_start", None, ts_start),
            ("sync-1", "sync_end", '{"status":"SUCCESSFUL"}', ts_sync_end),
            (
                "sync-1",
                "sync_stats",
                '{"extract_time_s":10,"process_time_s":6,"load_time_s":5,"total_time_s":21}',
                ts_sync_end,
            ),
        ]
        syncs = FivetranSource._parse_sync_events(rows)
        sync = syncs["sync-1"]
        task_statuses = FivetranSource._build_task_statuses_for_sync(sync)

        # sync_stats should fill in the missing extract_end, write_start, write_end
        # Order is [load, process, extract]
        assert task_statuses[2].endTime is not None  # extract endTime
        assert task_statuses[1].startTime is not None  # process startTime
        assert task_statuses[1].endTime is not None  # process endTime
        assert task_statuses[0].startTime is not None  # load startTime
        assert task_statuses[0].endTime is not None  # load endTime

    def test_pipeline_status_from_db_fallback_no_database(self):
        details = FivetranPipelineDetails(
            source=mock_data.get("source"),
            destination={"service": "snowflake", "config": {}},
            group=mock_data.get("group"),
            connector_id="bargraph_kingly",
        )
        self.client.get_connector_sync_history.return_value = [
            {
                "start": "2026-03-20T08:18:56.823Z",
                "end": "2026-03-20T08:19:12.094Z",
                "status": "COMPLETED",
            },
        ]
        statuses = list(self.fivetran.yield_pipeline_status(details))
        # 1 from sync history + 2 from historical fields (succeeded_at, failed_at)
        assert len(statuses) == 3
        assert (
            statuses[0].right.pipeline_status.executionStatus == StatusType.Successful
        )

    def test_pipeline_status_from_db_fallback_no_service(self):
        self.fivetran._resolve_destination_service = Mock(return_value=None)
        details = FivetranPipelineDetails(
            source=mock_data.get("source"),
            destination={
                "service": "snowflake",
                "config": {"database": "FIVETRAN_DEMO"},
            },
            group=mock_data.get("group"),
            connector_id="bargraph_kingly",
        )
        self.client.get_connector_sync_history.return_value = [
            {
                "start": "2026-03-20T08:18:56.823Z",
                "end": "2026-03-20T08:19:12.094Z",
                "status": "COMPLETED",
            },
        ]
        statuses = list(self.fivetran.yield_pipeline_status(details))
        # 1 from sync history + 2 from historical fields (succeeded_at, failed_at)
        assert len(statuses) == 3
        assert (
            statuses[0].right.pipeline_status.executionStatus == StatusType.Successful
        )

    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.get_db_connection",
    )
    def test_pipeline_status_from_db_fallback_on_exception(self, mock_get_conn):
        mock_service = Mock()
        mock_service.connection.config = Mock()
        mock_service.connection.config.model_copy.return_value = Mock()
        mock_service.serviceType.value = "Snowflake"
        mock_get_conn.side_effect = Exception("Connection failed")

        self.fivetran._resolve_destination_service = Mock(return_value=mock_service)
        details = FivetranPipelineDetails(
            source=mock_data.get("source"),
            destination={
                "service": "snowflake",
                "config": {"database": "FIVETRAN_DEMO"},
            },
            group=mock_data.get("group"),
            connector_id="bargraph_kingly",
        )
        self.client.get_connector_sync_history.return_value = [
            {
                "start": "2026-03-20T08:18:56.823Z",
                "end": "2026-03-20T08:19:12.094Z",
                "status": "COMPLETED",
            },
        ]
        statuses = list(self.fivetran.yield_pipeline_status(details))
        assert len(statuses) >= 1
        assert (
            statuses[0].right.pipeline_status.executionStatus == StatusType.Successful
        )

    def test_pipeline_status_from_db_attempts_databricks(self):
        self.fivetran._resolve_destination_service = Mock(return_value=None)
        details = FivetranPipelineDetails(
            source=mock_data.get("source"),
            destination={
                "service": "databricks",
                "config": {"database": "some_db"},
            },
            group=mock_data.get("group"),
            connector_id="bargraph_kingly",
        )
        self.client.get_connector_sync_history.return_value = []
        list(self.fivetran.yield_pipeline_status(details))
        self.fivetran._resolve_destination_service.assert_called_once_with("databricks")

    def test_parse_sync_events(self):
        ts1 = datetime(2026, 3, 20, 8, 0, 0)
        ts2 = datetime(2026, 3, 20, 8, 0, 10)
        ts3 = datetime(2026, 3, 20, 8, 0, 16)
        ts4 = datetime(2026, 3, 20, 8, 0, 21)
        ts5 = datetime(2026, 3, 20, 8, 0, 22)

        rows = [
            ("sync-1", "sync_start", None, ts1),
            ("sync-1", "extract_summary", '{"status":"SUCCESS"}', ts2),
            ("sync-1", "write_to_table_start", '{"table":"Album"}', ts3),
            ("sync-1", "write_to_table_end", '{"table":"Album"}', ts4),
            ("sync-1", "sync_end", '{"status":"SUCCESSFUL"}', ts5),
        ]

        result = FivetranSource._parse_sync_events(rows)
        assert "sync-1" in result
        sync = result["sync-1"]
        assert sync["sync_start_ts"] == ts1
        assert sync["extract_end_ts"] == ts2
        assert sync["extract_data"]["status"] == "SUCCESS"
        assert sync["write_start_min"] == ts3
        assert sync["write_end_max"] == ts4
        assert sync["sync_end_ts"] == ts5
        assert sync["sync_end_data"]["status"] == "SUCCESSFUL"

    def test_build_task_statuses_successful_sync(self):
        ts_start = datetime(2026, 3, 20, 8, 0, 0)
        ts_extract = datetime(2026, 3, 20, 8, 0, 10)
        ts_write_start = datetime(2026, 3, 20, 8, 0, 16)
        ts_write_end = datetime(2026, 3, 20, 8, 0, 21)

        sync = {
            "sync_start_ts": ts_start,
            "extract_end_ts": ts_extract,
            "extract_data": {"status": "SUCCESS"},
            "write_start_min": ts_write_start,
            "write_end_max": ts_write_end,
            "sync_end_ts": datetime(2026, 3, 20, 8, 0, 22),
            "sync_end_data": {"status": "SUCCESSFUL"},
        }

        tasks = FivetranSource._build_task_statuses_for_sync(sync)
        assert len(tasks) == 3

        assert tasks[0].name == FIVETRAN_TASK_LOAD
        assert tasks[0].executionStatus == StatusType.Successful
        assert tasks[1].name == FIVETRAN_TASK_PROCESS
        assert tasks[1].executionStatus == StatusType.Successful
        assert tasks[2].name == FIVETRAN_TASK_EXTRACT
        assert tasks[2].executionStatus == StatusType.Successful

    def test_build_task_statuses_failed_extract(self):
        ts_start = datetime(2026, 3, 20, 8, 0, 0)
        ts_extract = datetime(2026, 3, 20, 8, 0, 10)

        sync = {
            "sync_start_ts": ts_start,
            "extract_end_ts": ts_extract,
            "extract_data": {"status": "FAILURE"},
            "sync_end_ts": datetime(2026, 3, 20, 8, 0, 11),
            "sync_end_data": {"status": "FAILURE_WITH_TASK"},
        }

        tasks = FivetranSource._build_task_statuses_for_sync(sync)
        assert tasks[0].executionStatus == StatusType.Failed  # load
        assert tasks[1].executionStatus == StatusType.Failed  # process
        assert tasks[2].executionStatus == StatusType.Failed  # extract

    def test_build_task_statuses_failed_extract_cascades_despite_write_events(self):
        """Extract failure cascades to process/load even if write events exist (partial sync)."""
        ts_start = datetime(2026, 3, 20, 8, 0, 0)
        ts_extract = datetime(2026, 3, 20, 8, 0, 10)
        ts_write_start = datetime(2026, 3, 20, 8, 0, 12)
        ts_write_end = datetime(2026, 3, 20, 8, 0, 15)

        sync = {
            "sync_start_ts": ts_start,
            "extract_end_ts": ts_extract,
            "extract_data": {"status": "FAILURE"},
            "write_start_min": ts_write_start,
            "write_end_max": ts_write_end,
            "sync_end_ts": datetime(2026, 3, 20, 8, 0, 16),
            "sync_end_data": {"status": "FAILURE_WITH_TASK"},
        }

        tasks = FivetranSource._build_task_statuses_for_sync(sync)
        assert tasks[2].executionStatus == StatusType.Failed  # extract
        assert tasks[1].executionStatus == StatusType.Failed  # process cascades
        assert tasks[0].executionStatus == StatusType.Failed  # load cascades

    def test_build_task_statuses_failed_extract_cascades_despite_sync_stats(self):
        """Extract failure cascades even when sync_stats would synthesize timestamps."""
        ts_start = datetime(2026, 3, 20, 8, 0, 0)
        ts_extract = datetime(2026, 3, 20, 8, 0, 10)

        sync = {
            "sync_start_ts": ts_start,
            "extract_end_ts": ts_extract,
            "extract_data": {"status": "FAILURE"},
            "sync_end_ts": datetime(2026, 3, 20, 8, 0, 30),
            "sync_end_data": {"status": "FAILURE_WITH_TASK"},
            "sync_stats": {
                "extract_time_s": 10,
                "process_time_s": 6,
                "load_time_s": 5,
            },
        }

        tasks = FivetranSource._build_task_statuses_for_sync(sync)
        assert tasks[2].executionStatus == StatusType.Failed  # extract
        assert tasks[1].executionStatus == StatusType.Failed  # process cascades
        assert tasks[0].executionStatus == StatusType.Failed  # load cascades

    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_db_service_names"
    )
    @patch("metadata.utils.fqn.build")
    def test_yield_lineage_returns_early_when_pipeline_entity_not_found(
        self, mock_build, mock_get_services
    ):
        mock_get_services.return_value = ["postgres_service"]

        mock_source_table = Mock()
        mock_source_table.id = str(uuid4())
        mock_dest_table = Mock()
        mock_dest_table.id = str(uuid4())

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
            if "table1" in fqn_str:
                return mock_source_table
            elif "table1_dest" in fqn_str:
                return mock_dest_table
            return None

        original_metadata = self.fivetran.metadata
        mock_metadata = Mock()
        mock_metadata.get_by_name = Mock(side_effect=get_by_name_side_effect)
        self.fivetran.metadata = mock_metadata

        try:
            self.client.get_connector_schema_details.return_value = {
                "public": {
                    "enabled": True,
                    "name_in_destination": "public",
                    "tables": {
                        "table1": {
                            "enabled": True,
                            "name_in_destination": "table1_dest",
                        },
                        "table2": {
                            "enabled": True,
                            "name_in_destination": "table2_dest",
                        },
                    },
                }
            }
            self.client.get_connector_column_lineage.return_value = {}

            result = list(
                self.fivetran.yield_pipeline_lineage_details(EXPECTED_FIVETRAN_DETAILS)
            )
            assert len(result) == 0
        finally:
            self.fivetran.metadata = original_metadata

    def test_schedule_interval_non_hour_divisible(self):
        details = FivetranPipelineDetails(
            source={"sync_frequency": 90, "schema": "test", "service": "postgres"},
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="test_connector",
        )
        assert self.fivetran._get_schedule_interval(details) == "*/90 * * * *"

    def test_schedule_interval_over_24_hours(self):
        details = FivetranPipelineDetails(
            source={"sync_frequency": 2880, "schema": "test", "service": "postgres"},
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="test_connector",
        )
        assert self.fivetran._get_schedule_interval(details) == "0 0 * * *"

    def test_schedule_interval_none(self):
        details = FivetranPipelineDetails(
            source={"sync_frequency": None, "schema": "test", "service": "postgres"},
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="test_connector",
        )
        assert self.fivetran._get_schedule_interval(details) is None

    def test_schedule_interval_missing_key(self):
        details = FivetranPipelineDetails(
            source={"schema": "test", "service": "postgres"},
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="test_connector",
        )
        assert self.fivetran._get_schedule_interval(details) is None

    def test_schedule_interval_exactly_24_hours(self):
        details = FivetranPipelineDetails(
            source={"sync_frequency": 1440, "schema": "test", "service": "postgres"},
            destination=mock_data.get("destination"),
            group=mock_data.get("group"),
            connector_id="test_connector",
        )
        assert self.fivetran._get_schedule_interval(details) == "0 0 * * *"

    def test_parse_sync_events_malformed_json(self):
        rows = [
            ("s1", "sync_start", None, datetime(2026, 3, 20, 8, 0)),
            ("s1", "extract_summary", "not valid json", datetime(2026, 3, 20, 8, 1)),
            ("s1", "sync_end", "{broken", datetime(2026, 3, 20, 8, 2)),
        ]
        syncs = FivetranSource._parse_sync_events(rows)
        assert "s1" in syncs
        assert syncs["s1"]["sync_start_ts"] == datetime(2026, 3, 20, 8, 0)
        assert syncs["s1"]["extract_end_ts"] == datetime(2026, 3, 20, 8, 1)
        assert "extract_data" not in syncs["s1"]
        assert "sync_end_data" not in syncs["s1"]

    def test_parse_sync_events_multiple_syncs(self):
        rows = [
            ("s1", "sync_start", None, datetime(2026, 3, 20, 8, 0)),
            ("s2", "sync_start", None, datetime(2026, 3, 20, 9, 0)),
            ("s1", "sync_end", '{"status": "SUCCESSFUL"}', datetime(2026, 3, 20, 8, 5)),
            ("s2", "sync_end", '{"status": "FAILED"}', datetime(2026, 3, 20, 9, 5)),
        ]
        syncs = FivetranSource._parse_sync_events(rows)
        assert len(syncs) == 2
        assert syncs["s1"]["sync_end_data"]["status"] == "SUCCESSFUL"
        assert syncs["s2"]["sync_end_data"]["status"] == "FAILED"

    def test_parse_sync_events_write_min_max(self):
        rows = [
            ("s1", "write_to_table_start", None, datetime(2026, 3, 20, 8, 10)),
            ("s1", "write_to_table_start", None, datetime(2026, 3, 20, 8, 5)),
            ("s1", "write_to_table_end", None, datetime(2026, 3, 20, 8, 12)),
            ("s1", "write_to_table_end", None, datetime(2026, 3, 20, 8, 15)),
        ]
        syncs = FivetranSource._parse_sync_events(rows)
        assert syncs["s1"]["write_start_min"] == datetime(2026, 3, 20, 8, 5)
        assert syncs["s1"]["write_end_max"] == datetime(2026, 3, 20, 8, 15)

    def test_build_task_statuses_no_events_with_successful_sync_end(self):
        sync = {
            "sync_start_ts": datetime(2026, 3, 20, 8, 0),
            "sync_end_ts": datetime(2026, 3, 20, 8, 5),
            "sync_end_data": {"status": "SUCCESSFUL"},
        }
        statuses = FivetranSource._build_task_statuses_for_sync(sync)
        extract_status = next(s for s in statuses if s.name == FIVETRAN_TASK_EXTRACT)
        process_status = next(s for s in statuses if s.name == FIVETRAN_TASK_PROCESS)
        load_status = next(s for s in statuses if s.name == FIVETRAN_TASK_LOAD)
        assert extract_status.executionStatus == StatusType.Failed
        assert process_status.executionStatus == StatusType.Failed
        assert load_status.executionStatus == StatusType.Failed

    def test_build_fallback_task_statuses(self):
        statuses = FivetranSource._build_fallback_task_statuses(
            StatusType.Successful, 1000, 2000
        )
        assert len(statuses) == 3
        for s in statuses:
            assert s.executionStatus == StatusType.Successful
            assert s.startTime.root == 1000
            assert s.endTime.root == 2000

    def test_build_fallback_task_statuses_no_end(self):
        statuses = FivetranSource._build_fallback_task_statuses(
            StatusType.Failed, 1000, None
        )
        assert len(statuses) == 3
        for s in statuses:
            assert s.executionStatus == StatusType.Failed
            assert s.endTime is None
