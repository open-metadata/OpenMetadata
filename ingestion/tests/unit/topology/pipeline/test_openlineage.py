import contextlib
import copy
import json
import unittest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch
from uuid import UUID

from cachetools import LRUCache

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    ConsumerOffsets,
    ConsumerOffsets1,
    SecurityProtocol,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.pipelineServiceMetadataPipeline import (
    LineageInformation,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.pipeline.openlineage.metadata import OpenlineageSource
from metadata.ingestion.source.pipeline.openlineage.models import (
    EntityDetails,
    OpenLineageEvent,
    TableDetails,
)
from metadata.ingestion.source.pipeline.openlineage.utils import (
    FQNNotFoundException,
    message_to_open_lineage_event,
)

MOCK_WORKFLOW_CONFIG = {
    "openMetadataServerConfig": {
        "hostPort": "http://localhost:8585/api",
        "authProvider": "openmetadata",
        "securityConfig": {
            "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        },
    }
}

# Global constants
MOCK_OL_CONFIG = {
    "source": {
        "type": "openlineage",
        "serviceName": "openlineage_source",
        "serviceConnection": {
            "config": {
                "type": "OpenLineage",
                "brokerConfig": {
                    "brokersUrl": "testbroker:9092",
                    "topicName": "test-topic",
                    "consumerGroupName": "test-consumergroup",
                    "consumerOffsets": ConsumerOffsets.earliest,
                    "securityProtocol": SecurityProtocol.PLAINTEXT,
                    "sslConfig": {
                        "caCertificate": "",
                        "sslCertificate": "",
                        "sslKey": "",
                    },
                    "poolTimeout": 0.3,
                    "sessionTimeout": 1,
                },
            }
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": MOCK_WORKFLOW_CONFIG,
}

MOCK_OL_KINESIS_CONFIG = {
    "source": {
        "type": "openlineage",
        "serviceName": "openlineage_kinesis_source",
        "serviceConnection": {
            "config": {
                "type": "OpenLineage",
                "brokerConfig": {
                    "streamName": "test-openlineage-stream",
                    "awsConfig": {
                        "awsRegion": "us-east-1",
                        "awsAccessKeyId": "test-access-key",
                        "awsSecretAccessKey": "test-secret-key",
                    },
                    "consumerOffsets": ConsumerOffsets1.TRIM_HORIZON,
                    "poolTimeout": 0.5,
                    "sessionTimeout": 2,
                },
            }
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": MOCK_WORKFLOW_CONFIG,
}
MOCK_SPLINE_UI_URL = "http://localhost:9090"
PIPELINE_ID = "3f784e72-5bf7-5704-8828-ae8464fe915b:lhq160w0"
MOCK_PIPELINE_URL = f"{MOCK_SPLINE_UI_URL}/app/events/overview/{PIPELINE_ID}"
MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="openlineage_source",
    fullyQualifiedName=FullyQualifiedEntityName("openlineage_source"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Airflow,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name=PIPELINE_ID,
    fullyQualifiedName=f"openlineage_source.{PIPELINE_ID}",
    displayName="MSSQL <> Postgres",
    sourceUrl=MOCK_PIPELINE_URL,
    tasks=[
        Task(
            name=PIPELINE_ID,
            displayName="jdbc postgres ssl app",
            sourceUrl=MOCK_PIPELINE_URL,
        )
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)

VALID_EVENT = {
    "run": {
        "facets": {
            "parent": {"job": {"name": "test-job", "namespace": "test-namespace"}}
        }
    },
    "inputs": [],
    "outputs": [],
    "eventType": "START",
    "job": {"name": "test-job", "namespace": "test-namespace"},
}

MISSING_RUN_FACETS_PARENT_JOB_NAME_EVENT = copy.deepcopy(VALID_EVENT)
del MISSING_RUN_FACETS_PARENT_JOB_NAME_EVENT["run"]["facets"]["parent"]["job"]["name"]

MALFORMED_NESTED_STRUCTURE_EVENT = copy.deepcopy(VALID_EVENT)
MALFORMED_NESTED_STRUCTURE_EVENT["run"]["facets"]["parent"]["job"] = "Not a dict"

EVENT_WITHOUT_PARENT_FACET = {
    "run": {"facets": {}},
    "inputs": [],
    "outputs": [],
    "eventType": "COMPLETE",
    "job": {"name": "standalone-job", "namespace": "standalone-namespace"},
}

with open(
    f"{Path(__file__).parent}/../../resources/datasets/openlineage_event.json"
) as ol_file:
    FULL_OL_KAFKA_EVENT = json.load(ol_file)

EXPECTED_OL_EVENT = OpenLineageEvent(
    run_facet=FULL_OL_KAFKA_EVENT["run"],
    job=FULL_OL_KAFKA_EVENT["job"],
    event_type=FULL_OL_KAFKA_EVENT["eventType"],
    inputs=FULL_OL_KAFKA_EVENT["inputs"],
    outputs=FULL_OL_KAFKA_EVENT["outputs"],
)


class OpenLineageUnitTest(unittest.TestCase):
    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False

        # Kafka source
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_OL_CONFIG)
        self.open_lineage_source = OpenlineageSource.create(
            MOCK_OL_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.open_lineage_source.context.get().pipeline = MOCK_PIPELINE.name.root
        self.open_lineage_source.context.get().pipeline_service = (
            MOCK_PIPELINE_SERVICE.name.root
        )
        self.open_lineage_source.source_config.lineageInformation = LineageInformation(
            dbServiceNames=["skun"]
        )

        # Kinesis source
        kinesis_config = OpenMetadataWorkflowConfig.model_validate(
            MOCK_OL_KINESIS_CONFIG
        )
        self.open_lineage_kinesis_source = OpenlineageSource.create(
            MOCK_OL_KINESIS_CONFIG["source"],
            kinesis_config.workflowConfig.openMetadataServerConfig,
        )
        self.open_lineage_kinesis_source.context.get().pipeline = (
            MOCK_PIPELINE.name.root
        )
        self.open_lineage_kinesis_source.context.get().pipeline_service = (
            MOCK_PIPELINE_SERVICE.name.root
        )
        self.open_lineage_kinesis_source.source_config.lineageInformation = (
            LineageInformation(dbServiceNames=["skun"])
        )

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch("confluent_kafka.Consumer")
    def setUp(self, mock_consumer, mock_test_connection):
        mock_test_connection.return_value = False
        self.mock_consumer = mock_consumer

    def setup_mock_consumer_with_kafka_event(self, event):
        mock_msg = MagicMock()
        mock_msg.error.return_value = None
        mock_msg.value.return_value = json.dumps(event).encode()
        self.mock_consumer.poll.side_effect = [
            mock_msg,
            None,
            None,
            None,
            None,
            None,
            None,
        ]
        self.open_lineage_source.client = self.mock_consumer

    def test_message_to_ol_event_valid_event(self):
        """Test conversion with a valid event."""
        result = message_to_open_lineage_event(VALID_EVENT)
        self.assertIsInstance(result, OpenLineageEvent)

    def test_message_to_ol_event_missing_run_facets_parent_job_name(self):
        """Test that parent facet is optional - missing parent job name is allowed."""
        result = message_to_open_lineage_event(MISSING_RUN_FACETS_PARENT_JOB_NAME_EVENT)
        self.assertIsInstance(result, OpenLineageEvent)

    def test_message_to_ol_event_malformed_nested_structure(self):
        """Test that parent facet is optional - malformed parent structure is allowed."""
        result = message_to_open_lineage_event(MALFORMED_NESTED_STRUCTURE_EVENT)
        self.assertIsInstance(result, OpenLineageEvent)

    def test_render_pipeline_name_falls_back_to_job_when_no_parent_facet(self):
        """Test that pipeline name uses job namespace/name when parent facet is absent."""
        event = message_to_open_lineage_event(EVENT_WITHOUT_PARENT_FACET)
        result = OpenlineageSource._render_pipeline_name(event)
        self.assertEqual(result, "standalone-namespace-standalone-job")

    def test_render_pipeline_name_falls_back_to_job_when_parent_job_name_missing(self):
        """Test that pipeline name falls back to job fields when parent.job.name is missing."""
        event = message_to_open_lineage_event(MISSING_RUN_FACETS_PARENT_JOB_NAME_EVENT)
        result = OpenlineageSource._render_pipeline_name(event)
        self.assertEqual(result, "test-namespace-test-job")

    def test_render_pipeline_name_falls_back_to_job_when_parent_job_malformed(self):
        """Test that pipeline name falls back to job fields when parent.job is not a dict."""
        event = message_to_open_lineage_event(MALFORMED_NESTED_STRUCTURE_EVENT)
        result = OpenlineageSource._render_pipeline_name(event)
        self.assertEqual(result, "test-namespace-test-job")

    @patch("confluent_kafka.Consumer")
    def test_get_pipelines_list_event_without_parent_facet(self, mock_consumer_class):
        """Test that events without a parent facet are processed successfully."""
        self.setup_mock_consumer_with_kafka_event(EVENT_WITHOUT_PARENT_FACET)

        result_generator = self.open_lineage_source.get_pipelines_list()
        results = list(result_generator)

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], OpenLineageEvent)
        self.assertEqual(results[0].event_type, "COMPLETE")

    def test_poll_message_receives_message(self):
        """Test if poll_message receives a kafka  message."""
        self.setup_mock_consumer_with_kafka_event(VALID_EVENT)
        result = self.open_lineage_source.client.poll(timeout=1)
        self.assertIsNotNone(result)
        self.assertEqual(json.loads(result.value().decode()), VALID_EVENT)

    def read_openlineage_event_from_kafka(self, kafka_event):
        self.setup_mock_consumer_with_kafka_event(kafka_event)
        result_generator = self.open_lineage_source.get_pipelines_list()
        results = []
        try:
            while True:
                results.append(next(result_generator))
        except StopIteration:
            pass
        return results[0]

    def test_create_output_lineage_dict_empty_input(self):
        """Test with an empty input list."""
        result = self.open_lineage_source._create_output_lineage_dict([])
        self.assertEqual(result, {})

    def test_create_output_lineage_dict_single_lineage_entry(self):
        """Test with a single lineage entry."""
        lineage_info = [
            ("output_table", "input_table", "output_column", "input_column")
        ]
        result = self.open_lineage_source._create_output_lineage_dict(lineage_info)
        expected = {
            "output_table": {
                "input_table": [
                    ColumnLineage(
                        toColumn="output_column", fromColumns=["input_column"]
                    )
                ]
            }
        }
        self.assertEqual(result, expected)

    def test_create_output_lineage_dict_multiple_entries_different_outputs(self):
        """Test with multiple entries having different output tables."""
        lineage_info = [
            ("output_table1", "input_table", "output_column1", "input_column"),
            ("output_table2", "input_table", "output_column2", "input_column"),
        ]
        result = self.open_lineage_source._create_output_lineage_dict(lineage_info)
        expected = {
            "output_table1": {
                "input_table": [
                    ColumnLineage(
                        toColumn="output_column1", fromColumns=["input_column"]
                    )
                ]
            },
            "output_table2": {
                "input_table": [
                    ColumnLineage(
                        toColumn="output_column2", fromColumns=["input_column"]
                    )
                ]
            },
        }
        self.assertEqual(result, expected)

    def test_create_output_lineage_dict_multiple_entries_same_output(self):
        """Test with multiple entries sharing the same output table."""
        lineage_info = [
            ("output_table", "input_table1", "output_column", "input_column1"),
            ("output_table", "input_table2", "output_column", "input_column2"),
        ]
        result = self.open_lineage_source._create_output_lineage_dict(lineage_info)
        expected = {
            "output_table": {
                "input_table1": [
                    ColumnLineage(
                        toColumn="output_column", fromColumns=["input_column1"]
                    )
                ],
                "input_table2": [
                    ColumnLineage(
                        toColumn="output_column", fromColumns=["input_column2"]
                    )
                ],
            }
        }
        self.assertEqual(result, expected)

    def test_get_column_lineage_empty_inputs_outputs(self):
        """Test with empty input and output lists."""
        inputs = []
        outputs = []
        result = self.open_lineage_source._get_column_lineage(inputs, outputs)
        self.assertEqual(result, {})

    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn"
    )
    def test_build_ol_name_to_fqn_map_with_valid_data(self, mock_get_table_fqn):
        # Mock _get_table_fqn to return a constructed FQN based on the provided table details
        mock_get_table_fqn.side_effect = (
            lambda table_details, namespace=None: f"database.schema.{table_details.name}"
        )

        tables = [
            {"name": "schema.table1", "facets": {}, "namespace": "ns://"},
            {"name": "schema.table2", "facets": {}, "namespace": "ns://"},
        ]

        expected_map = {
            "ns://schema.table1": "database.schema.table1",
            "ns://schema.table2": "database.schema.table2",
        }

        result = self.open_lineage_source._build_ol_name_to_fqn_map(tables)

        self.assertEqual(result, expected_map)
        self.assertEqual(mock_get_table_fqn.call_count, 2)

    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn"
    )
    def test_build_ol_name_to_fqn_map_with_missing_fqn(self, mock_get_table_fqn):
        # Mock _get_table_fqn to return None for missing FQN
        mock_get_table_fqn.return_value = None

        tables = [{"name": "schema.table1", "facets": {}, "namespace": "ns://"}]

        expected_map = {}  # Expect an empty map since FQN is missing

        result = self.open_lineage_source._build_ol_name_to_fqn_map(tables)

        self.assertEqual(result, expected_map)

    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn"
    )
    def test_build_ol_name_to_fqn_map_with_empty_tables(self, mock_get_table_fqn):
        # No need to set up the mock specifically since it won't be called with empty input

        tables = []  # No tables provided

        expected_map = {}  # Expect an empty map

        result = self.open_lineage_source._build_ol_name_to_fqn_map(tables)

        self.assertEqual(result, expected_map)
        mock_get_table_fqn.assert_not_called()

    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn"
    )
    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._build_ol_name_to_fqn_map"
    )
    def test_get_column_lineage_valid_inputs_outputs(
        self, mock_build_map, mock_get_table_fqn
    ):
        """Test with valid input and output lists."""
        # Setup
        mock_get_table_fqn.side_effect = (
            lambda table_details, namespace=None: f"database.schema.{table_details.name}"
        )
        mock_build_map.return_value = {
            "s3a:/project-db/src_test1": "database.schema.input_table_1",
            "s3a:/project-db/src_test2": "database.schema.input_table_2",
        }

        inputs = [
            {"name": "schema.input_table1", "facets": {}, "namespace": "hive://"},
            {"name": "schema.input_table2", "facets": {}, "namespace": "hive://"},
        ]
        outputs = [
            {
                "name": "schema.output_table",
                "facets": {
                    "columnLineage": {
                        "fields": {
                            "output_column1": {
                                "inputFields": [
                                    {
                                        "field": "input_column1",
                                        "namespace": "s3a://project-db",
                                        "name": "/src_test1",
                                    }
                                ]
                            },
                            "output_column2": {
                                "inputFields": [
                                    {
                                        "field": "input_column2",
                                        "namespace": "s3a://project-db",
                                        "name": "/src_test2",
                                    }
                                ]
                            },
                        }
                    }
                },
            }
        ]
        result = self.open_lineage_source._get_column_lineage(inputs, outputs)

        expected = {
            "database.schema.output_table": {
                "database.schema.input_table_1": [
                    ColumnLineage(
                        toColumn="database.schema.output_table.output_column1",
                        fromColumns=["database.schema.input_table_1.input_column1"],
                    )
                ],
                "database.schema.input_table_2": [
                    ColumnLineage(
                        toColumn="database.schema.output_table.output_column2",
                        fromColumns=["database.schema.input_table_2.input_column2"],
                    )
                ],
            }
        }
        self.assertEqual(result, expected)

    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn"
    )
    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._build_ol_name_to_fqn_map"
    )
    def test_get_column_lineage_normalizes_caps_columns_to_lowercase(
        self, mock_build_map, mock_get_table_fqn
    ):
        """Test that CAPS column names from OL events are normalized to lowercase in column FQNs."""
        mock_get_table_fqn.side_effect = (
            lambda table_details, namespace=None: f"database.schema.{table_details.name}"
        )
        mock_build_map.return_value = {
            "sqlserver:/host:1433/hk_schema.CASE_TEST_SOURCE": "database.schema.case_test_source",
        }

        inputs = [
            {
                "name": "hk_schema.CASE_TEST_SOURCE",
                "facets": {},
                "namespace": "sqlserver://host:1433",
            },
        ]
        outputs = [
            {
                "name": "hk_schema.CASE_TEST_TARGET",
                "facets": {
                    "columnLineage": {
                        "fields": {
                            "FIRST_NAME": {
                                "inputFields": [
                                    {
                                        "field": "FIRST_NAME",
                                        "namespace": "sqlserver://host:1433",
                                        "name": "hk_schema.CASE_TEST_SOURCE",
                                    }
                                ]
                            },
                            "LAST_NAME": {
                                "inputFields": [
                                    {
                                        "field": "LAST_NAME",
                                        "namespace": "sqlserver://host:1433",
                                        "name": "hk_schema.CASE_TEST_SOURCE",
                                    }
                                ]
                            },
                        }
                    }
                },
            }
        ]
        result = self.open_lineage_source._get_column_lineage(inputs, outputs)

        expected = {
            "database.schema.case_test_target": {
                "database.schema.case_test_source": [
                    ColumnLineage(
                        toColumn="database.schema.case_test_target.first_name",
                        fromColumns=["database.schema.case_test_source.first_name"],
                    ),
                    ColumnLineage(
                        toColumn="database.schema.case_test_target.last_name",
                        fromColumns=["database.schema.case_test_source.last_name"],
                    ),
                ],
            }
        }
        self.assertEqual(result, expected)

    def test_get_column_lineage__invalid_inputs_outputs_structure(self):
        """Test with invalid input and output structure."""
        inputs = [{"invalid": "data"}]
        outputs = [{"invalid": "data"}]
        with self.assertRaises(ValueError):
            self.open_lineage_source._get_column_lineage(inputs, outputs)

    def test_get_table_details_with_symlinks(self):
        """Test with valid data where symlinks are present."""
        data = {
            "facets": {"symlinks": {"identifiers": [{"name": "project.schema.table"}]}}
        }
        result = self.open_lineage_source._get_table_details(data)
        self.assertEqual(result.name, "table")
        self.assertEqual(result.schema, "schema")

    def test_get_table_details_without_symlinks(self):
        """Test with valid data but without symlinks."""
        data = {"name": "schema.table"}
        result = self.open_lineage_source._get_table_details(data)
        self.assertEqual(result.name, "table")
        self.assertEqual(result.schema, "schema")

    def test_get_table_details_normalizes_caps_symlinks_to_lowercase(self):
        """Test that CAPS table/schema names from symlinks are normalized to lowercase."""
        data = {
            "facets": {
                "symlinks": {
                    "identifiers": [{"name": "PROJECT.SCHEMA.CASE_TEST_SOURCE"}]
                }
            }
        }
        result = self.open_lineage_source._get_table_details(data)
        self.assertEqual(result.name, "case_test_source")
        self.assertEqual(result.schema, "schema")

    def test_get_table_details_normalizes_caps_name_to_lowercase(self):
        """Test that CAPS table/schema names from name attribute are normalized to lowercase."""
        data = {"name": "HK_SCHEMA.CASE_TEST_SOURCE"}
        result = self.open_lineage_source._get_table_details(data)
        self.assertEqual(result.name, "case_test_source")
        self.assertEqual(result.schema, "hk_schema")

    def test_get_table_details_normalizes_mixed_case_to_lowercase(self):
        """Test that mixed-case names are normalized to lowercase."""
        data = {"name": "MySchema.MyTable"}
        result = self.open_lineage_source._get_table_details(data)
        self.assertEqual(result.name, "mytable")
        self.assertEqual(result.schema, "myschema")

    def test_get_table_details_invalid_data_missing_symlinks_and_name(self):
        """Test with invalid data missing both symlinks and name."""
        data = {}
        with self.assertRaises(ValueError):
            self.open_lineage_source._get_table_details(data)

    def test_get_table_details_invalid_symlinks_structure(self):
        """Test with invalid symlinks structure."""
        data = {"facets": {"symlinks": {"identifiers": [{}]}}}
        with self.assertRaises(ValueError):
            self.open_lineage_source._get_table_details(data)

    def test_get_table_details_invalid_name_structure(self):
        """Test with invalid name structure."""
        data = {"name": "invalidname"}
        with self.assertRaises(ValueError):
            self.open_lineage_source._get_table_details(data)

    def test_get_pipelines_list(self):
        """Test get_pipelines_list method"""
        ol_event = self.read_openlineage_event_from_kafka(FULL_OL_KAFKA_EVENT)
        self.assertIsInstance(ol_event, OpenLineageEvent)
        self.assertEqual(ol_event, EXPECTED_OL_EVENT)

    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn_from_om"
    )
    def test_yield_pipeline_lineage_details(self, mock_get_table_from_om):
        def t_fqn_build_side_effect(
            table_details,
            services=None,
        ):
            return f"testService.shopify.{table_details.name}"

        def mock_get_uuid_by_name(entity, fqn):
            if fqn == "testService.shopify.raw_product_catalog":
                # source of table lineage
                return Mock(id=Mock(root="69fc8906-4a4a-45ab-9a54-9cc2d399e10e"))
            elif fqn == "testService.shopify.fact_order_new5":
                # dst of table lineage
                return Mock(id=Mock(root="59fc8906-4a4a-45ab-9a54-9cc2d399e10e"))
            else:
                # pipeline
                z = Mock()
                z.id.root = "79fc8906-4a4a-45ab-9a54-9cc2d399e10e"
                return z

        def extract_lineage_details(pip_results):
            table_lineage = []
            col_lineage = []
            for r in pip_results:
                table_lineage.append(
                    (
                        r.right.edge.fromEntity.id.root,
                        r.right.edge.toEntity.id.root,
                    )
                )
                for col in r.right.edge.lineageDetails.columnsLineage:
                    col_lineage.append((col.fromColumns[0].root, col.toColumn.root))
            return table_lineage, col_lineage

        # Set up the side effect for the mock entity FQN builder
        mock_get_table_from_om.side_effect = t_fqn_build_side_effect

        ol_event = self.read_openlineage_event_from_kafka(FULL_OL_KAFKA_EVENT)

        with patch.object(
            OpenMetadataConnection,
            "get_by_name",
            create=True,
            side_effect=mock_get_uuid_by_name,
        ):
            pip_results = self.open_lineage_source.yield_pipeline_lineage_details(
                ol_event
            )
            table_lineage, col_lineage = extract_lineage_details(pip_results)

        expected_table_lineage = [
            (
                UUID("69fc8906-4a4a-45ab-9a54-9cc2d399e10e"),
                UUID("59fc8906-4a4a-45ab-9a54-9cc2d399e10e"),
            )
        ]
        expected_col_lineage = [
            (
                "testService.shopify.raw_product_catalog.comments",
                "testService.shopify.fact_order_new5.id",
            ),
            (
                "testService.shopify.raw_product_catalog.products",
                "testService.shopify.fact_order_new5.randomid",
            ),
            (
                "testService.shopify.raw_product_catalog.platform",
                "testService.shopify.fact_order_new5.zip",
            ),
        ]

        self.assertEqual(col_lineage, expected_col_lineage)
        self.assertEqual(table_lineage, expected_table_lineage)

    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn_from_om"
    )
    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_schema_fqn_from_om"
    )
    def test_get_create_table_request(self, mock_get_schema_fqn, mock_get_table_fqn):
        """Test successful table creation request with multiple columns when table doesn't exist"""
        # Setup: Table doesn't exist, schema exists
        mock_get_table_fqn.side_effect = FQNNotFoundException("Table not found")
        mock_get_schema_fqn.return_value = "testService.testDatabase.testSchema"
        table_data = {
            "name": "testSchema.employees",
            "namespace": "bigquery",
            "facets": {
                "schema": {
                    "fields": [
                        {"name": "employee_id", "type": "INT64"},
                        {"name": "first_name", "type": "STRING"},
                        {"name": "last_name", "type": "STRING"},
                        {"name": "email", "type": "STRING"},
                        {"name": "salary", "type": "FLOAT64"},
                        {"name": "hire_date", "type": "TIMESTAMP"},
                        {"name": "department_id", "type": "INT64"},
                        {"name": "is_active", "type": "BOOLEAN"},
                    ]
                }
            },
        }

        result = self.open_lineage_source.get_create_table_request(table_data)

        # Assertions
        self.assertIsInstance(result, Either)
        self.assertIsNone(result.left)
        self.assertIsNotNone(result.right)

        create_request = result.right
        self.assertIsInstance(create_request, CreateTableRequest)
        self.assertEqual(create_request.name.root, "employees")
        self.assertEqual(
            create_request.databaseSchema.root, "testService.testDatabase.testSchema"
        )
        self.assertEqual(len(create_request.columns), 8)

        # Verify all columns are created with correct types
        expected_columns = [
            ("employee_id", "BIGINT", "INT64"),
            ("first_name", "STRING", "STRING"),
            ("last_name", "STRING", "STRING"),
            ("email", "STRING", "STRING"),
            ("salary", "DOUBLE", "FLOAT64"),
            ("hire_date", "TIMESTAMP", "TIMESTAMP"),
            ("department_id", "BIGINT", "INT64"),
            ("is_active", "BOOLEAN", "BOOLEAN"),
        ]

        for i, (expected_name, expected_type, expected_type_display) in enumerate(
            expected_columns
        ):
            self.assertEqual(create_request.columns[i].name.root, expected_name)
            self.assertEqual(create_request.columns[i].dataType.value, expected_type)
            self.assertEqual(
                create_request.columns[i].dataTypeDisplay, expected_type_display
            )

    @patch("confluent_kafka.Consumer")
    def test_get_pipelines_list_filters_complete_events(self, mock_consumer_class):
        """Test that get_pipelines_list returns COMPLETE events"""
        event = copy.deepcopy(VALID_EVENT)
        event["eventType"] = "COMPLETE"
        self.setup_mock_consumer_with_kafka_event(event)

        result_generator = self.open_lineage_source.get_pipelines_list()
        results = list(result_generator)

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], OpenLineageEvent)
        self.assertEqual(results[0].event_type, "COMPLETE")

    @patch("confluent_kafka.Consumer")
    def test_get_pipelines_list_filters_running_events(self, mock_consumer_class):
        """Test that get_pipelines_list returns RUNNING events"""
        event = copy.deepcopy(VALID_EVENT)
        event["eventType"] = "RUNNING"
        self.setup_mock_consumer_with_kafka_event(event)

        result_generator = self.open_lineage_source.get_pipelines_list()
        results = list(result_generator)

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], OpenLineageEvent)
        self.assertEqual(results[0].event_type, "RUNNING")

    @patch("confluent_kafka.Consumer")
    def test_get_pipelines_list_filters_start_events(self, mock_consumer_class):
        """Test that get_pipelines_list returns START events"""
        event = copy.deepcopy(VALID_EVENT)
        event["eventType"] = "START"
        self.setup_mock_consumer_with_kafka_event(event)

        result_generator = self.open_lineage_source.get_pipelines_list()
        results = list(result_generator)

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], OpenLineageEvent)
        self.assertEqual(results[0].event_type, "START")

    @patch("confluent_kafka.Consumer")
    def test_get_pipelines_list_filters_out_fail_events(self, mock_consumer_class):
        """Test that get_pipelines_list filters out FAIL events"""
        event = copy.deepcopy(VALID_EVENT)
        event["eventType"] = "FAIL"
        self.setup_mock_consumer_with_kafka_event(event)

        result_generator = self.open_lineage_source.get_pipelines_list()
        results = list(result_generator)

        self.assertEqual(len(results), 0)

    @patch("confluent_kafka.Consumer")
    def test_get_pipelines_list_filters_out_abort_events(self, mock_consumer_class):
        """Test that get_pipelines_list filters out ABORT events"""
        event = copy.deepcopy(VALID_EVENT)
        event["eventType"] = "ABORT"
        self.setup_mock_consumer_with_kafka_event(event)

        result_generator = self.open_lineage_source.get_pipelines_list()
        results = list(result_generator)

        self.assertEqual(len(results), 0)

    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn_from_om"
    )
    def test_lineage_merge_start_with_data_running_without(
        self, mock_get_table_from_om
    ):
        """
        Test that START event with lineage data followed by RUNNING event without
        lineage data does not overwrite existing lineage in the database.

        This simulates Flink streaming jobs where:
        - START event contains initial lineage
        - RUNNING events are heartbeats with no/empty lineage

        The test verifies the complete flow:
        1. START event creates lineage with column details
        2. RUNNING event with empty data is processed
        3. Query back the lineage - it should still have the original data
        """
        # Create START event with lineage data
        start_event = copy.deepcopy(FULL_OL_KAFKA_EVENT)
        start_event["eventType"] = "START"

        # Create RUNNING event with same job but no lineage (empty inputs/outputs)
        running_event = copy.deepcopy(FULL_OL_KAFKA_EVENT)
        running_event["eventType"] = "RUNNING"
        running_event["inputs"] = []
        running_event["outputs"] = []

        # Mock table FQN lookup
        def mock_fqn_side_effect(table_details, services=None):
            return f"testService.shopify.{table_details.name}"

        mock_get_table_from_om.side_effect = mock_fqn_side_effect

        # Mock metadata.get_by_name for table lookups
        from_table_id = "69fc8906-4a4a-45ab-9a54-9cc2d399e10e"
        to_table_id = "59fc8906-4a4a-45ab-9a54-9cc2d399e10e"

        def mock_get_uuid_by_name(entity, fqn):
            if fqn == "testService.shopify.raw_product_catalog":
                return Mock(id=Mock(root=from_table_id))
            elif fqn == "testService.shopify.fact_order_new5":
                return Mock(id=Mock(root=to_table_id))
            elif "openlineage_source" in fqn:  # Pipeline entity
                return Mock(id=Mock(root="79fc8906-4a4a-45ab-9a54-9cc2d399e10e"))
            return None

        # Process START event with lineage
        start_ol_event = message_to_open_lineage_event(start_event)
        with patch.object(
            OpenMetadataConnection,
            "get_by_name",
            create=True,
            side_effect=mock_get_uuid_by_name,
        ):
            start_lineage_results = list(
                self.open_lineage_source.yield_pipeline_lineage_details(start_ol_event)
            )

        # Process RUNNING event without lineage
        running_ol_event = message_to_open_lineage_event(running_event)
        with patch.object(
            OpenMetadataConnection,
            "get_by_name",
            create=True,
            side_effect=mock_get_uuid_by_name,
        ):
            running_lineage_results = list(
                self.open_lineage_source.yield_pipeline_lineage_details(
                    running_ol_event
                )
            )

        # Extract lineage requests from START event
        start_lineage_requests = [
            r.right
            for r in start_lineage_results
            if r.right and isinstance(r.right, AddLineageRequest)
        ]

        # Extract lineage requests from RUNNING event
        running_lineage_requests = [
            r.right
            for r in running_lineage_results
            if r.right and isinstance(r.right, AddLineageRequest)
        ]

        # Verify START event produced lineage with column details
        start_requests_with_columns = [
            req
            for req in start_lineage_requests
            if req.edge.lineageDetails and req.edge.lineageDetails.columnsLineage
        ]
        self.assertGreater(
            len(start_requests_with_columns),
            0,
            "START event should produce lineage requests with column details",
        )

        # Count column lineage entries from START
        start_column_count = sum(
            len(req.edge.lineageDetails.columnsLineage)
            for req in start_requests_with_columns
        )
        self.assertGreater(
            start_column_count, 0, "START event should have column lineage"
        )

        # Key assertion: RUNNING event with empty inputs/outputs produces no lineage requests
        # This prevents empty data from being sent to the database
        self.assertEqual(
            len(running_lineage_requests),
            0,
            "RUNNING event with empty inputs/outputs should not produce any lineage requests",
        )

    def _build_mock_kinesis_client(self, events):
        mock_kinesis = MagicMock()
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [{"Shards": [{"ShardId": "shard-0001"}]}]
        mock_kinesis.get_paginator.return_value = mock_paginator

        mock_kinesis.get_shard_iterator.return_value = {
            "ShardIterator": "test-iterator"
        }

        records = [{"Data": json.dumps(event).encode()} for event in events]
        mock_kinesis.get_records.side_effect = [
            {"Records": records, "NextShardIterator": "next-iter"},
            {"Records": [], "NextShardIterator": "next-iter"},
            {"Records": [], "NextShardIterator": "next-iter"},
            {"Records": [], "NextShardIterator": "next-iter"},
            {"Records": [], "NextShardIterator": None},
        ]

        self.open_lineage_kinesis_source.client = mock_kinesis
        return mock_kinesis

    def test_kinesis_config_validation(self):
        """Test that Kinesis config is parsed and validated correctly."""
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_OL_KINESIS_CONFIG)
        connection = config.source.serviceConnection.root.config
        self.assertEqual(connection.type.value, "OpenLineage")
        broker = connection.brokerConfig
        self.assertEqual(broker.streamName, "test-openlineage-stream")
        self.assertEqual(broker.awsConfig.awsRegion, "us-east-1")
        self.assertEqual(broker.consumerOffsets, ConsumerOffsets1.TRIM_HORIZON)

    def test_get_pipelines_list_kinesis(self):
        """Test get_pipelines_list with Kinesis broker."""
        self._build_mock_kinesis_client([FULL_OL_KAFKA_EVENT])

        result_generator = self.open_lineage_kinesis_source.get_pipelines_list()
        results = list(result_generator)

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], OpenLineageEvent)
        self.assertEqual(results[0], EXPECTED_OL_EVENT)

    def test_get_pipelines_list_kinesis_filters_complete_events(self):
        """Test that Kinesis get_pipelines_list returns COMPLETE events."""
        event = copy.deepcopy(VALID_EVENT)
        event["eventType"] = "COMPLETE"
        self._build_mock_kinesis_client([event])

        results = list(self.open_lineage_kinesis_source.get_pipelines_list())

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], OpenLineageEvent)
        self.assertEqual(results[0].event_type, "COMPLETE")

    def test_get_pipelines_list_kinesis_filters_running_events(self):
        """Test that Kinesis get_pipelines_list returns RUNNING events."""
        event = copy.deepcopy(VALID_EVENT)
        event["eventType"] = "RUNNING"
        self._build_mock_kinesis_client([event])

        results = list(self.open_lineage_kinesis_source.get_pipelines_list())

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], OpenLineageEvent)
        self.assertEqual(results[0].event_type, "RUNNING")

    def test_get_pipelines_list_kinesis_filters_start_events(self):
        """Test that Kinesis get_pipelines_list returns START events."""
        event = copy.deepcopy(VALID_EVENT)
        event["eventType"] = "START"
        self._build_mock_kinesis_client([event])

        results = list(self.open_lineage_kinesis_source.get_pipelines_list())

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], OpenLineageEvent)
        self.assertEqual(results[0].event_type, "START")

    def test_get_pipelines_list_kinesis_filters_out_fail_events(self):
        """Test that Kinesis get_pipelines_list filters out FAIL events."""
        event = copy.deepcopy(VALID_EVENT)
        event["eventType"] = "FAIL"
        self._build_mock_kinesis_client([event])

        results = list(self.open_lineage_kinesis_source.get_pipelines_list())

        self.assertEqual(len(results), 0)

    def test_get_pipelines_list_kinesis_filters_out_abort_events(self):
        """Test that Kinesis get_pipelines_list filters out ABORT events."""
        event = copy.deepcopy(VALID_EVENT)
        event["eventType"] = "ABORT"
        self._build_mock_kinesis_client([event])

        results = list(self.open_lineage_kinesis_source.get_pipelines_list())

        self.assertEqual(len(results), 0)

    def test_get_pipelines_list_kinesis_multiple_records(self):
        """Test Kinesis polling with multiple records in a single batch."""
        event1 = copy.deepcopy(VALID_EVENT)
        event1["eventType"] = "COMPLETE"
        event1["job"]["name"] = "job-1"
        event2 = copy.deepcopy(VALID_EVENT)
        event2["eventType"] = "START"
        event2["job"]["name"] = "job-2"
        self._build_mock_kinesis_client([event1, event2])

        results = list(self.open_lineage_kinesis_source.get_pipelines_list())

        self.assertEqual(len(results), 2)

    def test_get_pipelines_list_kinesis_empty_stream(self):
        """Test Kinesis polling with no records."""
        mock_kinesis = MagicMock()
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [{"Shards": [{"ShardId": "shard-0001"}]}]
        mock_kinesis.get_paginator.return_value = mock_paginator
        mock_kinesis.get_shard_iterator.return_value = {
            "ShardIterator": "test-iterator"
        }
        mock_kinesis.get_records.side_effect = [
            {"Records": [], "NextShardIterator": "next-iter"},
            {"Records": [], "NextShardIterator": "next-iter"},
            {"Records": [], "NextShardIterator": "next-iter"},
            {"Records": [], "NextShardIterator": "next-iter"},
            {"Records": [], "NextShardIterator": None},
        ]
        self.open_lineage_kinesis_source.client = mock_kinesis

        results = list(self.open_lineage_kinesis_source.get_pipelines_list())

        self.assertEqual(len(results), 0)

    @patch(
        "metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn_from_om"
    )
    def test_yield_pipeline_lineage_details_kinesis(self, mock_get_table_from_om):
        """Test lineage extraction from a Kinesis-sourced event."""

        def t_fqn_build_side_effect(table_details, services=None):
            return f"testService.shopify.{table_details.name}"

        def mock_get_uuid_by_name(entity, fqn):
            if fqn == "testService.shopify.raw_product_catalog":
                return Mock(id=Mock(root="69fc8906-4a4a-45ab-9a54-9cc2d399e10e"))
            elif fqn == "testService.shopify.fact_order_new5":
                return Mock(id=Mock(root="59fc8906-4a4a-45ab-9a54-9cc2d399e10e"))
            else:
                return Mock(id=Mock(root="79fc8906-4a4a-45ab-9a54-9cc2d399e10e"))

        mock_get_table_from_om.side_effect = t_fqn_build_side_effect

        self._build_mock_kinesis_client([FULL_OL_KAFKA_EVENT])
        results = list(self.open_lineage_kinesis_source.get_pipelines_list())
        ol_event = results[0]

        with patch.object(
            OpenMetadataConnection,
            "get_by_name",
            create=True,
            side_effect=mock_get_uuid_by_name,
        ):
            pip_results = list(
                self.open_lineage_kinesis_source.yield_pipeline_lineage_details(
                    ol_event
                )
            )

        lineage_requests = [
            r.right
            for r in pip_results
            if r.right and isinstance(r.right, AddLineageRequest)
        ]
        self.assertGreater(len(lineage_requests), 0)

        for req in lineage_requests:
            if req.edge.lineageDetails and req.edge.lineageDetails.columnsLineage:
                self.assertGreater(len(req.edge.lineageDetails.columnsLineage), 0)

    def test_entity_detection_kafka_namespace_returns_topic(self):
        """Test that _get_entity_details correctly identifies Kafka topics vs tables
        based on the namespace prefix, exercising the full detection path including
        _get_topic_details for kafka:// and _get_table_details for other namespaces."""
        kafka_data = {
            "name": "my-events-topic",
            "namespace": "kafka://broker-host:9092",
            "facets": {},
        }
        result = OpenlineageSource._get_entity_details(kafka_data)
        self.assertIsInstance(result, EntityDetails)
        self.assertEqual(result.entity_type, "topic")
        self.assertIsNotNone(result.topic_details)
        self.assertIsNone(result.table_details)
        self.assertEqual(result.topic_details.name, "my-events-topic")
        self.assertEqual(result.topic_details.broker_hostname, "broker-host:9092")

    def test_entity_detection_non_kafka_namespace_returns_table(self):
        """Test that non-kafka namespaces (e.g. bigquery, hive) are detected as tables."""
        table_data = {
            "name": "schema.my_table",
            "namespace": "bigquery",
            "facets": {},
        }
        result = OpenlineageSource._get_entity_details(table_data)
        self.assertEqual(result.entity_type, "table")
        self.assertIsNotNone(result.table_details)
        self.assertIsNone(result.topic_details)
        self.assertEqual(result.table_details.name, "my_table")
        self.assertEqual(result.table_details.schema, "schema")

    def test_topic_details_extraction_various_broker_formats(self):
        """Test _get_topic_details extracts broker hostname correctly from various
        kafka:// namespace formats (with port, without port, multi-segment hostname)."""
        # Standard broker:port format
        result = OpenlineageSource._get_topic_details(
            {"name": "topic1", "namespace": "kafka://my-broker:9092"}
        )
        self.assertEqual(result.name, "topic1")
        self.assertEqual(result.broker_hostname, "my-broker:9092")

        # Broker without port
        result = OpenlineageSource._get_topic_details(
            {"name": "topic2", "namespace": "kafka://broker-only"}
        )
        self.assertEqual(result.name, "topic2")
        self.assertEqual(result.broker_hostname, "broker-only")

    def test_topic_details_missing_fields_raises_value_error(self):
        """Test that _get_topic_details raises ValueError when namespace or name is missing."""
        with self.assertRaises(ValueError):
            OpenlineageSource._get_topic_details(
                {"name": "topic1"}
            )  # missing namespace

        with self.assertRaises(ValueError):
            OpenlineageSource._get_topic_details(
                {"namespace": "kafka://broker:9092"}
            )  # missing name

    def _run_lineage_with_kafka_broker(
        self, ol_event, get_by_name_fn, extra_patches=None
    ):
        """Run yield_pipeline_lineage_details with a kafka-broker:9092 messaging service
        mock and return the AddLineageRequest results."""
        mock_svc = Mock()
        mock_svc.connection.config.bootstrapServers = "kafka-broker:9092"
        mock_svc.fullyQualifiedName.root = "kafka-service"
        mock_svc.name = "kafka-service"

        if hasattr(self.open_lineage_source, "_broker_to_service"):
            del self.open_lineage_source._broker_to_service

        with contextlib.ExitStack() as stack:
            mock_metadata = stack.enter_context(
                patch.object(self.open_lineage_source, "metadata")
            )
            for p in extra_patches or []:
                stack.enter_context(p)
            mock_metadata.list_all_entities.return_value = iter([mock_svc])
            mock_metadata.get_by_name.side_effect = get_by_name_fn
            results = list(
                self.open_lineage_source.yield_pipeline_lineage_details(ol_event)
            )

        return [
            r.right
            for r in results
            if r.right and isinstance(r.right, AddLineageRequest)
        ]

    def test_yield_pipeline_lineage_with_kafka_topic_input_and_kafka_topic_output(self):
        """End-to-end test: Kafka topic input and Kafka topic output produces a
        single topic -> topic lineage edge."""
        input_topic_id = UUID("aaaa1111-1111-1111-1111-111111111111")
        output_topic_id = UUID("bbbb2222-2222-2222-2222-222222222222")
        pipeline_id = UUID("cccc3333-3333-3333-3333-333333333333")

        mock_input_topic = Mock()
        mock_input_topic.id.root = input_topic_id
        mock_input_topic.fullyQualifiedName.root = "kafka-service.input-topic"

        mock_output_topic = Mock()
        mock_output_topic.id.root = output_topic_id
        mock_output_topic.fullyQualifiedName.root = "kafka-service.output-topic"

        mock_pipeline = Mock()
        mock_pipeline.id.root = pipeline_id

        ol_event = OpenLineageEvent(
            run_facet={
                "facets": {
                    "parent": {
                        "job": {
                            "name": "kafka-to-kafka-job",
                            "namespace": "test-namespace",
                        }
                    }
                }
            },
            job={"name": "kafka-to-kafka-job", "namespace": "test-namespace"},
            event_type="COMPLETE",
            inputs=[
                {
                    "name": "input-topic",
                    "namespace": "kafka://kafka-broker:9092",
                    "facets": {},
                }
            ],
            outputs=[
                {
                    "name": "output-topic",
                    "namespace": "kafka://kafka-broker:9092",
                    "facets": {},
                }
            ],
        )

        from metadata.generated.schema.entity.data.topic import Topic

        def get_by_name(entity, fqn, **kwargs):
            if entity == Topic and fqn == "kafka-service.input-topic":
                return mock_input_topic
            if entity == Topic and fqn == "kafka-service.output-topic":
                return mock_output_topic
            if entity == Pipeline:
                return mock_pipeline
            return None

        lineage_requests = self._run_lineage_with_kafka_broker(ol_event, get_by_name)

        self.assertEqual(len(lineage_requests), 1)
        edge = lineage_requests[0].edge
        self.assertEqual(edge.fromEntity.id.root, input_topic_id)
        self.assertEqual(edge.fromEntity.type, "topic")
        self.assertEqual(edge.toEntity.id.root, output_topic_id)
        self.assertEqual(edge.toEntity.type, "topic")

    def test_yield_pipeline_lineage_with_kafka_topic_input_and_table_output(self):
        """End-to-end test: Kafka topic input and table output produces a single
        topic -> table lineage edge."""
        topic_id = UUID("aaaa1111-1111-1111-1111-111111111111")
        table_id = UUID("bbbb2222-2222-2222-2222-222222222222")
        pipeline_id = UUID("cccc3333-3333-3333-3333-333333333333")

        mock_topic = Mock()
        mock_topic.id.root = topic_id
        mock_topic.fullyQualifiedName.root = "kafka-service.input-events-topic"

        mock_table = Mock()
        mock_table.id.root = table_id

        mock_pipeline = Mock()
        mock_pipeline.id.root = pipeline_id

        ol_event = OpenLineageEvent(
            run_facet={
                "facets": {
                    "parent": {
                        "job": {
                            "name": "kafka-to-table-job",
                            "namespace": "test-namespace",
                        }
                    }
                }
            },
            job={"name": "kafka-to-table-job", "namespace": "test-namespace"},
            event_type="COMPLETE",
            inputs=[
                {
                    "name": "input-events-topic",
                    "namespace": "kafka://kafka-broker:9092",
                    "facets": {},
                }
            ],
            outputs=[
                {
                    "name": "public.output_table",
                    "namespace": "postgres://db:5432",
                    "facets": {},
                }
            ],
        )

        from metadata.generated.schema.entity.data.table import Table
        from metadata.generated.schema.entity.data.topic import Topic

        def get_by_name(entity, fqn, **kwargs):
            if entity == Topic:
                return mock_topic
            if entity == Table:
                return mock_table
            if entity == Pipeline:
                return mock_pipeline
            return None

        extra_patches = [
            patch.object(
                self.open_lineage_source,
                "_get_table_fqn",
                return_value="db-service.public.output_table",
            ),
            patch.object(
                self.open_lineage_source, "get_create_table_request", return_value=None
            ),
        ]

        lineage_requests = self._run_lineage_with_kafka_broker(
            ol_event, get_by_name, extra_patches
        )

        self.assertEqual(len(lineage_requests), 1)
        edge = lineage_requests[0].edge
        self.assertEqual(edge.fromEntity.id.root, topic_id)
        self.assertEqual(edge.fromEntity.type, "topic")
        self.assertEqual(edge.toEntity.id.root, table_id)
        self.assertEqual(edge.toEntity.type, "table")

    def test_namespace_resolution_skips_when_service_not_in_configured_names(self):
        """Edge case 1: When the namespace maps to a service that is NOT in get_db_service_names(),
        resolution should fall through and the table should not be found.

        Setup: Two DB services exist (mysql_prod, redshift_prod) but only redshift_prod
        is in dbServiceNames. The event namespace is mysql://... which would map to mysql_prod,
        but since mysql_prod is not in dbServiceNames, resolution must skip it.
        The table exists only in mysql_prod, so the result should be None.
        """
        source = self.open_lineage_source

        source._namespace_to_service_cache = {}
        # Only redshift_prod is configured — mysql_prod is NOT in dbServiceNames
        source.source_config.lineageInformation = LineageInformation(
            dbServiceNames=["redshift_prod"]
        )
        # _build_db_service_type_map only includes configured services
        source._db_service_type_map = {"redshift_prod": DatabaseServiceType.Redshift}

        # namespaceToServiceMapping maps namespace to mysql_prod which is NOT configured
        object.__setattr__(
            source.service_connection,
            "namespaceToServiceMapping",
            {"mysql://mysql-host:3306": "mysql_prod"},
        )

        table = TableDetails(name="user_stat", schema="analytics")

        # fqn.build returns None for redshift_prod (table doesn't exist there)
        with patch("metadata.utils.fqn.build", return_value=None):
            result = source._get_table_fqn(
                table, namespace="mysql://mysql-host:3306/mydb"
            )

        # mysql_prod is not in dbServiceNames so mapping is ignored.
        # Fallback scheme-based: redshift:// != mysql://, no match.
        # Falls through to all dbServiceNames (redshift_prod) where table doesn't exist.
        assert result is None

    def test_namespace_scheme_resolves_correct_service_among_different_types(self):
        """Edge case 2: Same table name exists in both a MySQL and a Redshift service.
        The namespace scheme (mysql:// vs redshift://) disambiguates which service to search.

        Setup: Two services configured — mysql_prod (Mysql) and redshift_prod (Redshift).
        Both have a table analytics.user_stat. A mysql:// namespace should find only the
        MySQL table FQN, and a redshift:// namespace should find only the Redshift one.
        """
        source = self.open_lineage_source

        source._namespace_to_service_cache = {}
        source.source_config.lineageInformation = LineageInformation(
            dbServiceNames=["mysql_prod", "redshift_prod"]
        )
        source._db_service_type_map = {
            "mysql_prod": DatabaseServiceType.Mysql,
            "redshift_prod": DatabaseServiceType.Redshift,
        }

        table = TableDetails(name="user_stat", schema="analytics")

        def mock_fqn_build(
            metadata,
            entity_type,
            service_name,
            database_name,
            schema_name,
            table_name,
            **kwargs,
        ):
            if service_name == "mysql_prod":
                return "mysql_prod.db.analytics.user_stat"
            elif service_name == "redshift_prod":
                return "redshift_prod.warehouse.analytics.user_stat"
            return None

        with patch("metadata.utils.fqn.build", side_effect=mock_fqn_build):
            # MySQL namespace -> scheme resolves to mysql_prod only
            mysql_result = source._get_table_fqn(
                table, namespace="mysql://mysql-host:3306/db"
            )
            assert mysql_result == "mysql_prod.db.analytics.user_stat"

            # Clear cache for next lookup
            source._namespace_to_service_cache = {}

            # Redshift namespace -> scheme resolves to redshift_prod only
            redshift_result = source._get_table_fqn(
                table, namespace="redshift://cluster:5439/warehouse"
            )
            assert redshift_result == "redshift_prod.warehouse.analytics.user_stat"

    def test_namespace_mapping_config_disambiguates_same_type_services(self):
        """Edge case 3: Two MySQL services (mysql_cluster_a, mysql_cluster_b) both have
        a table analytics.user_stat. Scheme-based resolution returns both (ambiguous).
        The namespaceToServiceMapping config disambiguates to the correct cluster.
        """
        source = self.open_lineage_source

        source._namespace_to_service_cache = {}
        source.source_config.lineageInformation = LineageInformation(
            dbServiceNames=["mysql_cluster_a", "mysql_cluster_b"]
        )
        source._db_service_type_map = {
            "mysql_cluster_a": DatabaseServiceType.Mysql,
            "mysql_cluster_b": DatabaseServiceType.Mysql,
        }

        # Config maps specific namespace prefixes to the correct cluster
        object.__setattr__(
            source.service_connection,
            "namespaceToServiceMapping",
            {
                "mysql://cluster-a:3306": "mysql_cluster_a",
                "mysql://cluster-b:3306": "mysql_cluster_b",
            },
        )

        table = TableDetails(name="user_stat", schema="analytics")

        def mock_fqn_build(
            metadata,
            entity_type,
            service_name,
            database_name,
            schema_name,
            table_name,
            **kwargs,
        ):
            if service_name == "mysql_cluster_a":
                return "mysql_cluster_a.db.analytics.user_stat"
            elif service_name == "mysql_cluster_b":
                return "mysql_cluster_b.db.analytics.user_stat"
            return None

        with patch("metadata.utils.fqn.build", side_effect=mock_fqn_build):
            # cluster-a namespace -> mapping resolves to mysql_cluster_a
            result_a = source._get_table_fqn(
                table, namespace="mysql://cluster-a:3306/db"
            )
            assert result_a == "mysql_cluster_a.db.analytics.user_stat"

            source._namespace_to_service_cache = {}

            # cluster-b namespace -> mapping resolves to mysql_cluster_b
            result_b = source._get_table_fqn(
                table, namespace="mysql://cluster-b:3306/db"
            )
            assert result_b == "mysql_cluster_b.db.analytics.user_stat"

    def test_namespace_scheme_resolves_known_vs_custom_db_type(self):
        """Edge case 4: A MySQL service and a custom/unknown DB service both have the
        same table analytics.user_stat. A mysql:// namespace should resolve to the MySQL
        service only, while a custom://... namespace (unknown scheme) should resolve to
        the custom service.

        find_services_by_scheme returns services with non-standard types for unknown schemes.
        """
        source = self.open_lineage_source

        source._namespace_to_service_cache = {}
        source.source_config.lineageInformation = LineageInformation(
            dbServiceNames=["mysql_prod", "custom_lakehouse"]
        )
        source._db_service_type_map = {
            "mysql_prod": DatabaseServiceType.Mysql,
            "custom_lakehouse": "CustomDatabase",
        }

        table = TableDetails(name="user_stat", schema="analytics")

        def mock_fqn_build(
            metadata,
            entity_type,
            service_name,
            database_name,
            schema_name,
            table_name,
            **kwargs,
        ):
            if service_name == "mysql_prod":
                return "mysql_prod.db.analytics.user_stat"
            elif service_name == "custom_lakehouse":
                return "custom_lakehouse.lake.analytics.user_stat"
            return None

        with patch("metadata.utils.fqn.build", side_effect=mock_fqn_build):
            # mysql:// namespace -> scheme matches Mysql -> resolves to mysql_prod only
            mysql_result = source._get_table_fqn(
                table, namespace="mysql://mysql-host:3306/db"
            )
            assert mysql_result == "mysql_prod.db.analytics.user_stat"

            source._namespace_to_service_cache = {}

            # custom:// namespace (unknown scheme) -> find_services_by_scheme returns
            # services whose type is NOT in the known scheme map, i.e. custom_lakehouse
            custom_result = source._get_table_fqn(
                table, namespace="custom://lakehouse-host:8080/lake"
            )
            assert custom_result == "custom_lakehouse.lake.analytics.user_stat"

    def test_table_found_in_multiple_services_raises_ambiguous(self):
        """When the same table exists in multiple DB services,
        AmbiguousServiceException is raised, caught in _get_table_fqn,
        logged as a warning, and None is returned (lineage skipped for this entity).
        """
        source = self.open_lineage_source

        source._namespace_to_service_cache = LRUCache(maxsize=10000)
        source.source_config.lineageInformation = LineageInformation(
            dbServiceNames=["mysql_a", "mysql_b"]
        )
        source._db_service_type_map = {
            "mysql_a": DatabaseServiceType.Mysql,
            "mysql_b": DatabaseServiceType.Mysql,
        }

        table = TableDetails(name="user_stat", schema="analytics")

        def mock_fqn_build(
            metadata,
            entity_type,
            service_name,
            database_name,
            schema_name,
            table_name,
            **kwargs,
        ):
            if service_name == "mysql_a":
                return "mysql_a.db.analytics.user_stat"
            elif service_name == "mysql_b":
                return "mysql_b.db.analytics.user_stat"
            return None

        import logging

        with patch("metadata.utils.fqn.build", side_effect=mock_fqn_build):
            with self.assertLogs("metadata.Ingestion", level=logging.WARNING) as cm:
                result = source._get_table_fqn(
                    table, namespace="mysql://some-host:3306/db"
                )

        assert result is None
        assert any("Failed to get FQN for table" in msg for msg in cm.output)
        assert any("AmbiguousServiceException" in msg for msg in cm.output)

    def test_yield_pipeline_lineage_topic_not_found_skips_gracefully(self):
        """When a Kafka topic input cannot be resolved (no matching messaging service),
        no lineage edge should be produced for that topic, even though the table output
        is resolvable. The topic is silently skipped."""
        ol_event = OpenLineageEvent(
            run_facet={
                "facets": {
                    "parent": {
                        "job": {
                            "name": "unknown-broker-job",
                            "namespace": "test-ns",
                        }
                    }
                }
            },
            job={"name": "unknown-broker-job", "namespace": "test-ns"},
            event_type="COMPLETE",
            inputs=[
                {
                    "name": "orphan-topic",
                    "namespace": "kafka://unknown-broker:9092",
                    "facets": {},
                }
            ],
            outputs=[
                {
                    "name": "public.some_table",
                    "namespace": "postgres://db:5432",
                    "facets": {},
                }
            ],
        )

        table_id = "dddd4444-4444-4444-4444-444444444444"
        pipeline_id = "eeee5555-5555-5555-5555-555555555555"

        mock_table = Mock()
        mock_table.id.root = table_id

        mock_pipeline = Mock()
        mock_pipeline.id.root = pipeline_id

        with patch.object(
            self.open_lineage_source, "metadata"
        ) as mock_metadata, patch.object(
            self.open_lineage_source,
            "_get_table_fqn",
            return_value="db-service.public.some_table",
        ), patch.object(
            self.open_lineage_source,
            "get_create_table_request",
            return_value=None,
        ):
            # Empty messaging services list — no broker match for unknown-broker
            mock_metadata.list_all_entities.return_value = iter([])

            def mock_get_by_name(entity, fqn, **kwargs):
                from metadata.generated.schema.entity.data.table import Table

                if entity == Table:
                    return mock_table
                elif entity == Pipeline:
                    return mock_pipeline
                return None

            mock_metadata.get_by_name.side_effect = mock_get_by_name

            if hasattr(self.open_lineage_source, "_broker_to_service"):
                del self.open_lineage_source._broker_to_service

            results = list(
                self.open_lineage_source.yield_pipeline_lineage_details(ol_event)
            )

        lineage_requests = [
            r.right
            for r in results
            if r.right and isinstance(r.right, AddLineageRequest)
        ]

        # No lineage should be produced because the topic input couldn't be resolved
        # (no matching broker), so there are no input edges to pair with the table output
        self.assertEqual(
            len(lineage_requests),
            0,
            "No lineage edges should be produced when input topic cannot be resolved",
        )

    def test_yield_pipeline_lineage_producer_only_no_inputs(self):
        """When an event has only outputs (producer), the pipeline itself becomes the
        fromEntity and each output becomes the toEntity."""
        output_topic_id = UUID("bbbb2222-2222-2222-2222-222222222222")
        pipeline_id = UUID("cccc3333-3333-3333-3333-333333333333")

        mock_output_topic = Mock()
        mock_output_topic.id.root = output_topic_id
        mock_output_topic.fullyQualifiedName.root = "kafka-service.output-topic"

        mock_pipeline = Mock()
        mock_pipeline.id.root = pipeline_id

        ol_event = OpenLineageEvent(
            run_facet={
                "facets": {
                    "parent": {
                        "job": {
                            "name": "producer-job",
                            "namespace": "test-namespace",
                        }
                    }
                }
            },
            job={"name": "producer-job", "namespace": "test-namespace"},
            event_type="COMPLETE",
            inputs=[],
            outputs=[
                {
                    "name": "output-topic",
                    "namespace": "kafka://kafka-broker:9092",
                    "facets": {},
                }
            ],
        )

        from metadata.generated.schema.entity.data.topic import Topic

        def get_by_name(entity, fqn, **kwargs):
            if entity == Topic:
                return mock_output_topic
            if entity == Pipeline:
                return mock_pipeline
            return None

        lineage_requests = self._run_lineage_with_kafka_broker(ol_event, get_by_name)

        self.assertEqual(len(lineage_requests), 1)
        edge = lineage_requests[0].edge
        self.assertEqual(edge.fromEntity.id.root, pipeline_id)
        self.assertEqual(edge.fromEntity.type, "pipeline")
        self.assertEqual(edge.toEntity.id.root, output_topic_id)
        self.assertEqual(edge.toEntity.type, "topic")
        self.assertIsNone(edge.lineageDetails.pipeline)

    def test_yield_pipeline_lineage_consumer_only_no_outputs(self):
        """When an event has only inputs (consumer), each input becomes the
        fromEntity and the pipeline itself becomes the toEntity."""
        input_topic_id = UUID("aaaa1111-1111-1111-1111-111111111111")
        pipeline_id = UUID("cccc3333-3333-3333-3333-333333333333")

        mock_input_topic = Mock()
        mock_input_topic.id.root = input_topic_id
        mock_input_topic.fullyQualifiedName.root = "kafka-service.input-topic"

        mock_pipeline = Mock()
        mock_pipeline.id.root = pipeline_id

        ol_event = OpenLineageEvent(
            run_facet={
                "facets": {
                    "parent": {
                        "job": {
                            "name": "consumer-job",
                            "namespace": "test-namespace",
                        }
                    }
                }
            },
            job={"name": "consumer-job", "namespace": "test-namespace"},
            event_type="COMPLETE",
            inputs=[
                {
                    "name": "input-topic",
                    "namespace": "kafka://kafka-broker:9092",
                    "facets": {},
                }
            ],
            outputs=[],
        )

        from metadata.generated.schema.entity.data.topic import Topic

        def get_by_name(entity, fqn, **kwargs):
            if entity == Topic:
                return mock_input_topic
            if entity == Pipeline:
                return mock_pipeline
            return None

        lineage_requests = self._run_lineage_with_kafka_broker(ol_event, get_by_name)

        self.assertEqual(len(lineage_requests), 1)
        edge = lineage_requests[0].edge
        self.assertEqual(edge.fromEntity.id.root, input_topic_id)
        self.assertEqual(edge.fromEntity.type, "topic")
        self.assertEqual(edge.toEntity.id.root, pipeline_id)
        self.assertEqual(edge.toEntity.type, "pipeline")
        self.assertIsNone(edge.lineageDetails.pipeline)

    def test_yield_pipeline_lineage_consumer_only_table_input(self):
        """When an event has only a table input (consumer/batch job), the table
        becomes the fromEntity and the pipeline becomes the toEntity."""
        table_id = UUID("aaaa1111-1111-1111-1111-111111111111")
        pipeline_id = UUID("cccc3333-3333-3333-3333-333333333333")

        mock_table = Mock()
        mock_table.id.root = table_id

        mock_pipeline = Mock()
        mock_pipeline.id.root = pipeline_id

        ol_event = OpenLineageEvent(
            run_facet={
                "facets": {
                    "parent": {
                        "job": {
                            "name": "batch-consumer-job",
                            "namespace": "test-namespace",
                        }
                    }
                }
            },
            job={"name": "batch-consumer-job", "namespace": "test-namespace"},
            event_type="COMPLETE",
            inputs=[
                {
                    "name": "public.source_table",
                    "namespace": "postgres://db:5432",
                    "facets": {},
                }
            ],
            outputs=[],
        )

        from metadata.generated.schema.entity.data.table import Table

        def get_by_name(entity, fqn, **kwargs):
            if entity == Table:
                return mock_table
            if entity == Pipeline:
                return mock_pipeline
            return None

        extra_patches = [
            patch.object(
                self.open_lineage_source,
                "_get_table_fqn",
                return_value="db-service.public.source_table",
            ),
            patch.object(
                self.open_lineage_source,
                "get_create_table_request",
                return_value=None,
            ),
        ]

        lineage_requests = self._run_lineage_with_kafka_broker(
            ol_event, get_by_name, extra_patches
        )

        self.assertEqual(len(lineage_requests), 1)
        edge = lineage_requests[0].edge
        self.assertEqual(edge.fromEntity.id.root, table_id)
        self.assertEqual(edge.fromEntity.type, "table")
        self.assertEqual(edge.toEntity.id.root, pipeline_id)
        self.assertEqual(edge.toEntity.type, "pipeline")
        self.assertIsNone(edge.lineageDetails.pipeline)

    def test_yield_pipeline_lineage_producer_only_table_output(self):
        """When an event has only a table output (producer/batch job), the pipeline
        becomes the fromEntity and the table becomes the toEntity."""
        table_id = UUID("bbbb2222-2222-2222-2222-222222222222")
        pipeline_id = UUID("cccc3333-3333-3333-3333-333333333333")

        mock_table = Mock()
        mock_table.id.root = table_id

        mock_pipeline = Mock()
        mock_pipeline.id.root = pipeline_id

        ol_event = OpenLineageEvent(
            run_facet={
                "facets": {
                    "parent": {
                        "job": {
                            "name": "batch-producer-job",
                            "namespace": "test-namespace",
                        }
                    }
                }
            },
            job={"name": "batch-producer-job", "namespace": "test-namespace"},
            event_type="COMPLETE",
            inputs=[],
            outputs=[
                {
                    "name": "public.target_table",
                    "namespace": "postgres://db:5432",
                    "facets": {},
                }
            ],
        )

        from metadata.generated.schema.entity.data.table import Table

        def get_by_name(entity, fqn, **kwargs):
            if entity == Table:
                return mock_table
            if entity == Pipeline:
                return mock_pipeline
            return None

        extra_patches = [
            patch.object(
                self.open_lineage_source,
                "_get_table_fqn",
                return_value="db-service.public.target_table",
            ),
            patch.object(
                self.open_lineage_source,
                "get_create_table_request",
                return_value=None,
            ),
        ]

        lineage_requests = self._run_lineage_with_kafka_broker(
            ol_event, get_by_name, extra_patches
        )

        self.assertEqual(len(lineage_requests), 1)
        edge = lineage_requests[0].edge
        self.assertEqual(edge.fromEntity.id.root, pipeline_id)
        self.assertEqual(edge.fromEntity.type, "pipeline")
        self.assertEqual(edge.toEntity.id.root, table_id)
        self.assertEqual(edge.toEntity.type, "table")
        self.assertIsNone(edge.lineageDetails.pipeline)

    def test_cleanup_only_deletes_edges_matching_current_event_datasets(self):
        """When a both-sided event arrives, cleanup should only remove
        pipeline-as-node edges for the datasets in that event, not unrelated ones."""
        pipeline_id = "cccc3333-3333-3333-3333-333333333333"
        topic_a_id = "aaaa1111-1111-1111-1111-111111111111"
        topic_b_id = "bbbb2222-2222-2222-2222-222222222222"

        mock_pipeline = Mock()
        mock_pipeline.id.root = pipeline_id
        mock_pipeline.fullyQualifiedName.root = "ol-service.test-pipeline"

        lineage_data = {
            "upstreamEdges": [
                {
                    "fromEntity": topic_a_id,
                    "toEntity": pipeline_id,
                    "lineageDetails": {"source": "OpenLineage"},
                },
                {
                    "fromEntity": topic_b_id,
                    "toEntity": pipeline_id,
                    "lineageDetails": {"source": "OpenLineage"},
                },
            ],
            "downstreamEdges": [],
        }

        with patch.object(self.open_lineage_source, "metadata") as mock_metadata:
            mock_metadata.get_lineage_by_id.return_value = lineage_data

            self.open_lineage_source._cleanup_pipeline_as_node_edges(
                mock_pipeline, event_entity_map={topic_a_id: "topic"}
            )

            mock_metadata.delete_lineage_edge.assert_called_once()
            deleted_edge = mock_metadata.delete_lineage_edge.call_args[0][0]
            self.assertEqual(str(deleted_edge.fromEntity.id.root), topic_a_id)
            self.assertEqual(deleted_edge.fromEntity.type, "topic")
            self.assertEqual(str(deleted_edge.toEntity.id.root), pipeline_id)

    def test_cleanup_preserves_non_openlineage_edges(self):
        """Cleanup should not touch edges that were not sourced from OpenLineage,
        even if the entity ID matches the current event."""
        pipeline_id = "cccc3333-3333-3333-3333-333333333333"
        table_id = "aaaa1111-1111-1111-1111-111111111111"

        mock_pipeline = Mock()
        mock_pipeline.id.root = pipeline_id
        mock_pipeline.fullyQualifiedName.root = "ol-service.test-pipeline"

        lineage_data = {
            "upstreamEdges": [
                {
                    "fromEntity": table_id,
                    "toEntity": pipeline_id,
                    "lineageDetails": {"source": "Manual"},
                },
            ],
            "downstreamEdges": [],
        }

        with patch.object(self.open_lineage_source, "metadata") as mock_metadata:
            mock_metadata.get_lineage_by_id.return_value = lineage_data

            self.open_lineage_source._cleanup_pipeline_as_node_edges(
                mock_pipeline, event_entity_map={table_id: "table"}
            )

            mock_metadata.delete_lineage_edge.assert_not_called()

    def test_cleanup_handles_downstream_edges_scoped_to_event(self):
        """Cleanup of downstream edges (pipeline → dataset) should also be
        scoped to only the current event's datasets."""
        pipeline_id = "cccc3333-3333-3333-3333-333333333333"
        table_a_id = "aaaa1111-1111-1111-1111-111111111111"
        table_b_id = "bbbb2222-2222-2222-2222-222222222222"

        mock_pipeline = Mock()
        mock_pipeline.id.root = pipeline_id
        mock_pipeline.fullyQualifiedName.root = "ol-service.test-pipeline"

        lineage_data = {
            "upstreamEdges": [],
            "downstreamEdges": [
                {
                    "fromEntity": pipeline_id,
                    "toEntity": table_a_id,
                    "lineageDetails": {"source": "OpenLineage"},
                },
                {
                    "fromEntity": pipeline_id,
                    "toEntity": table_b_id,
                    "lineageDetails": {"source": "OpenLineage"},
                },
            ],
        }

        with patch.object(self.open_lineage_source, "metadata") as mock_metadata:
            mock_metadata.get_lineage_by_id.return_value = lineage_data

            self.open_lineage_source._cleanup_pipeline_as_node_edges(
                mock_pipeline, event_entity_map={table_b_id: "table"}
            )

            mock_metadata.delete_lineage_edge.assert_called_once()
            deleted_edge = mock_metadata.delete_lineage_edge.call_args[0][0]
            self.assertEqual(str(deleted_edge.fromEntity.id.root), pipeline_id)
            self.assertEqual(str(deleted_edge.toEntity.id.root), table_b_id)
            self.assertEqual(deleted_edge.toEntity.type, "table")


if __name__ == "__main__":
    unittest.main()
