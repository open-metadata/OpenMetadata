import copy
import json
import unittest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch
from uuid import UUID

from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    ConsumerOffsets,
    SecurityProtocol,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.openlineage.metadata import OpenlineageSource
from metadata.ingestion.source.pipeline.openlineage.models import OpenLineageEvent
from metadata.ingestion.source.pipeline.openlineage.utils import (
    message_to_open_lineage_event,
)

# Global constants
MOCK_OL_CONFIG = {
    "source": {
        "type": "openlineage",
        "serviceName": "openlineage_source",
        "serviceConnection": {
            "config": {
                "type": "OpenLineage",
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
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_OL_CONFIG)
        self.open_lineage_source = OpenlineageSource.create(
            MOCK_OL_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.open_lineage_source.context.__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.open_lineage_source.context.__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root
        self.open_lineage_source.source_config.lineageInformation = {
            "dbServiceNames": ["skun"]
        }

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
        """Test conversion with missing 'run.facets.parent.job.name' field."""
        with self.assertRaises(ValueError):
            message_to_open_lineage_event(MISSING_RUN_FACETS_PARENT_JOB_NAME_EVENT)

    def test_message_to_ol_event_malformed_nested_structure(self):
        """Test conversion with a malformed nested structure."""
        with self.assertRaises(TypeError):
            message_to_open_lineage_event(MALFORMED_NESTED_STRUCTURE_EVENT)

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
            lambda table_details: f"database.schema.{table_details.name}"
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
            lambda table_details: f"database.schema.{table_details.name}"
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
    def test_yield_pipeline_lineage_details(self, mock_get_entity):
        def t_fqn_build_side_effect(
            table_details,
        ):
            return f"testService.shopify.{table_details.name}"

        def mock_get_uuid_by_name(entity, fqn):
            if fqn == "testService.shopify.raw_product_catalog":
                # source of table lineage
                return Mock(id="69fc8906-4a4a-45ab-9a54-9cc2d399e10e")
            elif fqn == "testService.shopify.fact_order_new5":
                # dst of table lineage
                return Mock(id="59fc8906-4a4a-45ab-9a54-9cc2d399e10e")
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
        mock_get_entity.side_effect = t_fqn_build_side_effect

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


if __name__ == "__main__":
    unittest.main()
