import contextlib
import copy
import json
import unittest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch
from uuid import UUID, uuid4

from cachetools import LRUCache

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
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.source.pipeline.openlineage.metadata import (
    RESOLUTION_CACHE_MAXSIZE,
    OpenlineageSource,
)
from metadata.ingestion.source.pipeline.openlineage.models import (
    EntityDetails,
    OpenLineageEvent,
    ResolvedTable,
    TableDetails,
)
from metadata.ingestion.source.pipeline.openlineage.utils import (
    message_to_open_lineage_event,
)
from metadata.utils import fqn

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
    service=EntityReference(id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"),
)

VALID_EVENT = {
    "run": {"facets": {"parent": {"job": {"name": "test-job", "namespace": "test-namespace"}}}},
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

with open(f"{Path(__file__).parent}/../../resources/datasets/openlineage_event.json") as ol_file:  # noqa: PTH123
    FULL_OL_KAFKA_EVENT = json.load(ol_file)

EXPECTED_OL_EVENT = OpenLineageEvent(
    run_facet=FULL_OL_KAFKA_EVENT["run"],
    job=FULL_OL_KAFKA_EVENT["job"],
    event_type=FULL_OL_KAFKA_EVENT["eventType"],
    inputs=FULL_OL_KAFKA_EVENT["inputs"],
    outputs=FULL_OL_KAFKA_EVENT["outputs"],
)


class OpenLineageUnitTest(unittest.TestCase):
    @patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection")
    def __init__(self, methodName, test_connection) -> None:  # noqa: N803
        super().__init__(methodName)
        test_connection.return_value = False

        # Kafka source
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_OL_CONFIG)
        self.open_lineage_source = OpenlineageSource.create(
            MOCK_OL_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.open_lineage_source.context.get().pipeline = MOCK_PIPELINE.name.root
        self.open_lineage_source.context.get().pipeline_service = MOCK_PIPELINE_SERVICE.name.root
        self.open_lineage_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["skun"])

        # Kinesis source
        kinesis_config = OpenMetadataWorkflowConfig.model_validate(MOCK_OL_KINESIS_CONFIG)
        self.open_lineage_kinesis_source = OpenlineageSource.create(
            MOCK_OL_KINESIS_CONFIG["source"],
            kinesis_config.workflowConfig.openMetadataServerConfig,
        )
        self.open_lineage_kinesis_source.context.get().pipeline = MOCK_PIPELINE.name.root
        self.open_lineage_kinesis_source.context.get().pipeline_service = MOCK_PIPELINE_SERVICE.name.root
        self.open_lineage_kinesis_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["skun"])

    @patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection")
    @patch("confluent_kafka.Consumer")
    def setUp(self, mock_consumer, mock_test_connection):
        mock_test_connection.return_value = False
        self.mock_consumer = mock_consumer
        # Fresh per-test resolution cache, mirroring what prepare() sets up in
        # production, so each test starts with no memoized resolutions.
        for source in (self.open_lineage_source, self.open_lineage_kinesis_source):
            source._resolution_cache = LRUCache(maxsize=RESOLUTION_CACHE_MAXSIZE)

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
        lineage_info = [("output_table", "input_table", "output_column", "input_column")]
        result = self.open_lineage_source._create_output_lineage_dict(lineage_info)
        expected = {
            "output_table": {"input_table": [ColumnLineage(toColumn="output_column", fromColumns=["input_column"])]}
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
            "output_table1": {"input_table": [ColumnLineage(toColumn="output_column1", fromColumns=["input_column"])]},
            "output_table2": {"input_table": [ColumnLineage(toColumn="output_column2", fromColumns=["input_column"])]},
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
                "input_table1": [ColumnLineage(toColumn="output_column", fromColumns=["input_column1"])],
                "input_table2": [ColumnLineage(toColumn="output_column", fromColumns=["input_column2"])],
            }
        }
        self.assertEqual(result, expected)

    def test_get_column_lineage_empty_inputs_outputs(self):
        """Test with empty input and output lists."""
        inputs = []
        outputs = []
        result = self.open_lineage_source._get_column_lineage(inputs, outputs)
        self.assertEqual(result, {})

    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn")
    def test_build_ol_name_to_fqn_map_with_valid_data(self, mock_get_table_fqn):
        # Mock _get_table_fqn to return a constructed FQN based on the provided table details
        mock_get_table_fqn.side_effect = lambda table_details, namespace=None: f"database.schema.{table_details.name}"

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

    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn")
    def test_build_ol_name_to_fqn_map_with_missing_fqn(self, mock_get_table_fqn):
        # Mock _get_table_fqn to return None for missing FQN
        mock_get_table_fqn.return_value = None

        tables = [{"name": "schema.table1", "facets": {}, "namespace": "ns://"}]

        expected_map = {}  # Expect an empty map since FQN is missing

        result = self.open_lineage_source._build_ol_name_to_fqn_map(tables)

        self.assertEqual(result, expected_map)

    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn")
    def test_build_ol_name_to_fqn_map_with_empty_tables(self, mock_get_table_fqn):
        # No need to set up the mock specifically since it won't be called with empty input

        tables = []  # No tables provided

        expected_map = {}  # Expect an empty map

        result = self.open_lineage_source._build_ol_name_to_fqn_map(tables)

        self.assertEqual(result, expected_map)
        mock_get_table_fqn.assert_not_called()

    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn")
    def test_build_ol_name_to_fqn_map_aliases_symlink_identities(self, mock_get_table_fqn):
        """Every raw identity (top-level plus each TABLE symlink) must alias
        to the same resolved FQN, so a columnLineage.inputFields entry that
        references the table by its symlink identity still resolves."""
        mock_get_table_fqn.side_effect = lambda table_details, namespace=None: f"svc.db.schema.{table_details.name}"

        tables = [
            {
                "namespace": "s3://bucket",
                "name": "warehouse/db/users_raw",
                "facets": {
                    "symlinks": {
                        "identifiers": [
                            {
                                "namespace": "arn:aws:glue:us-east-1:1",
                                "name": "table/db/users_raw",
                                "type": "TABLE",
                            }
                        ]
                    }
                },
            }
        ]

        result = self.open_lineage_source._build_ol_name_to_fqn_map(tables)

        # Both the top-level and the symlink identity must key into the same FQN.
        self.assertIn("s3://bucket/warehouse/db/users_raw", result)
        self.assertIn("arn:aws:glue:us-east-1:1/table/db/users_raw", result)
        self.assertEqual(
            result["s3://bucket/warehouse/db/users_raw"],
            result["arn:aws:glue:us-east-1:1/table/db/users_raw"],
        )

    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn")
    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._build_ol_name_to_fqn_map")
    def test_get_column_lineage_valid_inputs_outputs(self, mock_build_map, mock_get_table_fqn):
        """Test with valid input and output lists."""
        # Setup
        mock_get_table_fqn.side_effect = lambda table_details, namespace=None: f"database.schema.{table_details.name}"
        mock_build_map.return_value = {
            "s3a://project-db/src_test1": "database.schema.input_table_1",
            "s3a://project-db/src_test2": "database.schema.input_table_2",
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

    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn")
    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._build_ol_name_to_fqn_map")
    def test_get_column_lineage_normalizes_caps_columns_to_lowercase(self, mock_build_map, mock_get_table_fqn):
        """Test that CAPS column names from OL events are normalized to lowercase in column FQNs."""
        mock_get_table_fqn.side_effect = lambda table_details, namespace=None: f"database.schema.{table_details.name}"
        mock_build_map.return_value = {
            "sqlserver://host:1433/hk_schema.CASE_TEST_SOURCE": "database.schema.case_test_source",
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
        """Datasets with no resolvable identity are skipped, not fatal.

        A malformed/unresolvable dataset must not abort the event - column
        lineage simply yields nothing for it.
        """
        inputs = [{"invalid": "data"}]
        outputs = [{"invalid": "data"}]
        result = self.open_lineage_source._get_column_lineage(inputs, outputs)
        self.assertEqual(result, {})

    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn")
    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._build_ol_name_to_fqn_map")
    def test_get_column_lineage_skips_when_input_unresolved(self, mock_build_map, mock_get_table_fqn):
        """When the input table is not in OpenMetadata, the column entry must
        be skipped instead of being emitted with a literal 'None.column' FQN
        on the input side."""
        mock_get_table_fqn.side_effect = lambda table_details, namespace=None: f"svc.schema.{table_details.name}"
        # Only the output resolves; the input is intentionally absent from the map.
        mock_build_map.return_value = {"hive:///schema.output_table": "svc.schema.output_table"}

        inputs = [{"name": "schema.missing_input", "facets": {}, "namespace": "hive://"}]
        outputs = [
            {
                "name": "schema.output_table",
                "facets": {
                    "columnLineage": {
                        "fields": {
                            "col_out": {
                                "inputFields": [
                                    {
                                        "field": "col_in",
                                        "namespace": "hive://",
                                        "name": "schema.missing_input",
                                    }
                                ]
                            }
                        }
                    }
                },
            }
        ]
        result = self.open_lineage_source._get_column_lineage(inputs, outputs)
        self.assertEqual(result, {})

    def test_get_column_lineage_tolerates_null_facets_at_any_level(self):
        """An explicit None at facets, columnLineage, fields, or inputFields
        must not raise. ``_resolve_table`` returns a real ``ResolvedTable``
        so execution actually enters the facets-parsing block where the
        isinstance/null guards live (mocking it to None would short-circuit
        on ``if not resolved: continue`` and the test would pass vacuously)."""
        resolved = ResolvedTable(
            fqn="svc.db.schema.t",
            details=TableDetails(name="t", schema="schema"),
        )
        outputs_null_facets = [{"name": "schema.t", "facets": None, "namespace": "hive://"}]
        outputs_null_column_lineage = [
            {"name": "schema.t", "facets": {"columnLineage": None}, "namespace": "hive://"},
        ]
        outputs_null_fields = [
            {
                "name": "schema.t",
                "facets": {"columnLineage": {"fields": None}},
                "namespace": "hive://",
            },
        ]
        outputs_null_input_fields = [
            {
                "name": "schema.t",
                "facets": {"columnLineage": {"fields": {"col": {"inputFields": None}}}},
                "namespace": "hive://",
            },
        ]
        with patch.object(self.open_lineage_source, "_resolve_table", return_value=resolved):
            for outputs in (
                outputs_null_facets,
                outputs_null_column_lineage,
                outputs_null_fields,
                outputs_null_input_fields,
            ):
                self.assertEqual(self.open_lineage_source._get_column_lineage([], outputs), {})

    def test_get_column_lineage_tolerates_non_dict_facets_at_any_level(self):
        """A malformed event where facets/columnLineage/fields is the wrong
        shape (list, string, etc.) must not raise. Without the isinstance
        guards, ``fields.items()`` would AttributeError on a list. The
        output table must resolve so we actually enter the parsing block."""
        resolved = ResolvedTable(
            fqn="svc.db.schema.t",
            details=TableDetails(name="t", schema="schema"),
        )
        outputs_facets_list = [{"name": "schema.t", "facets": [], "namespace": "hive://"}]
        outputs_column_lineage_list = [
            {"name": "schema.t", "facets": {"columnLineage": []}, "namespace": "hive://"},
        ]
        outputs_fields_list = [
            {
                "name": "schema.t",
                "facets": {"columnLineage": {"fields": ["not a dict"]}},
                "namespace": "hive://",
            },
        ]
        outputs_fields_string = [
            {
                "name": "schema.t",
                "facets": {"columnLineage": {"fields": "broken"}},
                "namespace": "hive://",
            },
        ]
        with patch.object(self.open_lineage_source, "_resolve_table", return_value=resolved):
            for outputs in (
                outputs_facets_list,
                outputs_column_lineage_list,
                outputs_fields_list,
                outputs_fields_string,
            ):
                self.assertEqual(self.open_lineage_source._get_column_lineage([], outputs), {})

    def test_get_entity_details_tolerates_null_namespace(self):
        """Explicit ``"namespace": null`` on a dataset must not crash the
        Kafka prefix check. The dataset is treated as a table candidate that
        downstream candidate parsing will then evaluate or skip."""
        result = OpenlineageSource._get_entity_details({"namespace": None, "name": "schema.t"})
        self.assertEqual(result.entity_type, "table")

    def test_iter_table_candidates_with_symlinks(self):
        """Symlink identity is a candidate; dotted name parsed to schema.table."""
        data = {"facets": {"symlinks": {"identifiers": [{"name": "project.schema.table", "type": "TABLE"}]}}}
        candidates = OpenlineageSource._iter_table_candidates(data)
        self.assertEqual(candidates[0][0].name, "table")
        self.assertEqual(candidates[0][0].schema, "schema")

    def test_iter_table_candidates_without_symlinks(self):
        """Top-level dotted name is the sole candidate when no symlinks."""
        data = {"name": "schema.table"}
        candidates = OpenlineageSource._iter_table_candidates(data)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0][0].name, "table")
        self.assertEqual(candidates[0][0].schema, "schema")

    def test_iter_table_candidates_normalizes_caps_symlinks_to_lowercase(self):
        """CAPS names from a symlink identifier are normalized to lowercase."""
        data = {"facets": {"symlinks": {"identifiers": [{"name": "PROJECT.SCHEMA.CASE_TEST_SOURCE", "type": "TABLE"}]}}}
        candidates = OpenlineageSource._iter_table_candidates(data)
        self.assertEqual(candidates[0][0].name, "case_test_source")
        self.assertEqual(candidates[0][0].schema, "schema")

    def test_iter_table_candidates_normalizes_caps_name_to_lowercase(self):
        """CAPS names from the top-level name attribute are normalized to lowercase."""
        data = {"name": "HK_SCHEMA.CASE_TEST_SOURCE"}
        candidates = OpenlineageSource._iter_table_candidates(data)
        self.assertEqual(candidates[0][0].name, "case_test_source")
        self.assertEqual(candidates[0][0].schema, "hk_schema")

    def test_iter_table_candidates_missing_symlinks_and_name_is_empty(self):
        """No name and no symlinks yields no candidates (no exception raised)."""
        self.assertEqual(OpenlineageSource._iter_table_candidates({}), [])

    def test_iter_table_candidates_unparseable_name_is_empty(self):
        """A single-segment top-level name parses to nothing and is skipped."""
        self.assertEqual(OpenlineageSource._iter_table_candidates({"name": "invalidname"}), [])

    def test_iter_table_candidates_glue_symlink_over_s3_toplevel(self):
        """Customer scenario: Spark writes a Glue-cataloged table stored in S3.

        The Glue identity lives only in the symlinks facet; the top-level
        namespace is the physical S3 bucket. The Glue symlink must win.
        Source: https://openlineage.io/spec/facets/dataset-facets/symlinks/
        """
        data = {
            "namespace": "s3://lakehouse--managed-us-west-2--prod",
            "name": "main/store_of_value/gsheet_recon_stats_notes",
            "facets": {
                "symlinks": {
                    "identifiers": [
                        {
                            "namespace": "arn:aws:glue:us-west-2:012621376717",
                            "name": "table/store_of_value/gsheet_recon_stats_notes",
                            "type": "TABLE",
                        }
                    ]
                }
            },
        }
        candidates = OpenlineageSource._iter_table_candidates(data)
        self.assertEqual(candidates[0][0].schema, "store_of_value")
        self.assertEqual(candidates[0][0].name, "gsheet_recon_stats_notes")
        self.assertEqual(candidates[0][1], "arn:aws:glue:us-west-2:012621376717")

    def test_iter_table_candidates_skips_location_symlink(self):
        """LOCATION symlinks are physical paths and must be excluded entirely."""
        data = {
            "namespace": "hive://metastore:9083",
            "name": "analytics.daily_revenue",
            "facets": {
                "symlinks": {
                    "identifiers": [
                        {"namespace": "s3://bucket", "name": "warehouse/analytics/daily_revenue", "type": "LOCATION"}
                    ]
                }
            },
        }
        candidates = OpenlineageSource._iter_table_candidates(data)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0][0].schema, "analytics")
        self.assertEqual(candidates[0][0].name, "daily_revenue")

    def test_iter_table_candidates_dedupes_identical_identities(self):
        """A symlink byte-identical to the top-level identity is de-duplicated."""
        data = {
            "namespace": "bigquery",
            "name": "proj.schema.table",
            "facets": {
                "symlinks": {"identifiers": [{"namespace": "bigquery", "name": "proj.schema.table", "type": "TABLE"}]}
            },
        }
        candidates = OpenlineageSource._iter_table_candidates(data)
        self.assertEqual(len(candidates), 1)

    def test_iter_table_candidates_keeps_same_table_under_different_namespaces(self):
        """Same schema.table under different namespaces are distinct resolution
        paths (namespace drives service lookup) and must both be kept."""
        data = {
            "namespace": "trino://host:8080",
            "name": "catalog.sales.users",
            "facets": {
                "symlinks": {
                    "identifiers": [{"namespace": "arn:aws:glue:r:a", "name": "table/sales/users", "type": "TABLE"}]
                }
            },
        }
        candidates = OpenlineageSource._iter_table_candidates(data)
        self.assertEqual(len(candidates), 2)
        self.assertEqual({ns for _, ns in candidates}, {"arn:aws:glue:r:a", "trino://host:8080"})

    def test_iter_table_candidates_keeps_distinct_databases_under_same_namespace(self):
        """Two three-part identities that differ only in the database/catalog
        segment must both stay as candidates so each is tried. The dedup key
        includes database, so a Trino dataset that carries 'catA.schema.t' and
        'catB.schema.t' resolves both catalogs in priority order."""
        data = {
            "namespace": "trino://host:8080",
            "name": "catA.sales.users",
            "facets": {
                "symlinks": {
                    "identifiers": [
                        {"namespace": "trino://host:8080", "name": "catB.sales.users", "type": "TABLE"},
                    ]
                }
            },
        }
        candidates = OpenlineageSource._iter_table_candidates(data)
        self.assertEqual(len(candidates), 2)
        self.assertEqual({d.database for d, _ in candidates}, {"cata", "catb"})

    def test_symlink_identifiers_tolerates_malformed_facets(self):
        """Missing, null, or wrongly typed facet shapes yield an empty list."""
        self.assertEqual(OpenlineageSource._symlink_identifiers({}), [])
        self.assertEqual(OpenlineageSource._symlink_identifiers({"facets": None}), [])
        self.assertEqual(OpenlineageSource._symlink_identifiers({"facets": {"symlinks": None}}), [])
        self.assertEqual(
            OpenlineageSource._symlink_identifiers({"facets": {"symlinks": {"identifiers": {}}}}),
            [],
        )

    def test_symlink_identifiers_drops_non_dict_entries(self):
        """Non-dictionary identifier entries are skipped, valid ones kept."""
        data = {"facets": {"symlinks": {"identifiers": ["bad", None, {"name": "schema.tbl", "type": "TABLE"}]}}}
        self.assertEqual(
            OpenlineageSource._symlink_identifiers(data),
            [{"name": "schema.tbl", "type": "TABLE"}],
        )

    def test_iter_table_candidates_tolerates_malformed_facets(self):
        """A malformed facets block must not abort candidate extraction; the
        top-level identity is still returned."""
        data = {"namespace": "trino://host", "name": "schema.tbl", "facets": None}
        candidates = OpenlineageSource._iter_table_candidates(data)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0][0].name, "tbl")

    def test_iter_table_candidates_tolerates_null_namespace_and_name(self):
        """Explicit ``null`` (not just missing) in namespace/name must be
        treated as empty so namespace-based dispatch in ``_parse_table_identity``
        does not crash on ``None.startswith``. A null name short-circuits to
        no candidate; a null namespace falls through to the dotted parser."""
        # Symlink with null namespace but a dotted name -> parsed via dotted
        # fallback (namespace fallthrough), candidate retained.
        symlink_null_ns = {
            "facets": {"symlinks": {"identifiers": [{"namespace": None, "name": "schema.tbl", "type": "TABLE"}]}}
        }
        candidates = OpenlineageSource._iter_table_candidates(symlink_null_ns)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0][0].name, "tbl")
        self.assertEqual(candidates[0][1], "")

        # Symlink with explicit-null name -> no parseable identity, no crash.
        symlink_null_name = {
            "facets": {"symlinks": {"identifiers": [{"namespace": "arn:aws:glue:r:a", "name": None, "type": "TABLE"}]}}
        }
        self.assertEqual(OpenlineageSource._iter_table_candidates(symlink_null_name), [])

        # Top-level explicit-null name -> no parseable identity, no crash.
        top_null_name = {"namespace": "trino://host", "name": None}
        self.assertEqual(OpenlineageSource._iter_table_candidates(top_null_name), [])

    def test_resolve_table_falls_back_to_toplevel_when_symlink_unresolved(self):
        """Resolution-aware: a symlink that parses but does not resolve to a
        configured service falls through to the next candidate."""
        data = {
            "namespace": "s3://bucket",
            "name": "schema.real_table",
            "facets": {
                "symlinks": {"identifiers": [{"namespace": "arn:aws:glue:r:a", "name": "table/g/t", "type": "TABLE"}]}
            },
        }
        with patch.object(
            self.open_lineage_source,
            "_get_table_fqn",
            side_effect=lambda details, namespace=None: (
                "svc.schema.real_table" if details.name == "real_table" else None
            ),
        ):
            resolved = self.open_lineage_source._resolve_table(data)
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.fqn, "svc.schema.real_table")
        self.assertEqual(resolved.details.name, "real_table")

    def test_resolve_table_returns_none_when_nothing_resolves(self):
        """No candidate resolves -> None (event continues, warning logged)."""
        data = {"namespace": "s3://b", "name": "schema.table"}
        with patch.object(self.open_lineage_source, "_get_table_fqn", return_value=None):
            self.assertIsNone(self.open_lineage_source._resolve_table(data))

    def test_resolve_table_returns_none_for_location_only_dataset(self):
        """An object-store-only dataset (no parseable identity) resolves to None."""
        data = {"namespace": "s3://bucket", "name": "warehouse/path/to/file"}
        self.assertIsNone(self.open_lineage_source._resolve_table(data))

    def test_resolve_table_memoizes_within_event(self):
        """The underlying resolution runs once per dataset; repeated calls for
        the same dataset are served from the per-event cache."""
        data = {"namespace": "trino://host", "name": "schema.tbl"}
        sentinel = ResolvedTable(fqn="svc.schema.tbl", details=TableDetails(name="tbl", schema="schema"))
        with patch.object(self.open_lineage_source, "_resolve_table_uncached", return_value=sentinel) as mock_uncached:
            first = self.open_lineage_source._resolve_table(data)
            second = self.open_lineage_source._resolve_table(data)
        self.assertIs(first, second)
        self.assertEqual(mock_uncached.call_count, 1)

    def test_resolve_table_memoizes_negative_result(self):
        """An unresolvable dataset is cached too, so its warning is logged once."""
        data = {"namespace": "trino://host", "name": "schema.missing"}
        with patch.object(self.open_lineage_source, "_resolve_table_uncached", return_value=None) as mock_uncached:
            self.open_lineage_source._resolve_table(data)
            self.open_lineage_source._resolve_table(data)
        self.assertEqual(mock_uncached.call_count, 1)

    def test_resolve_table_cache_distinguishes_symlink_only_datasets(self):
        """Two symlink-only datasets without a top-level identity must not
        collide in the resolution cache (they would share the same ol_name)."""
        dataset_a = {
            "facets": {
                "symlinks": {"identifiers": [{"namespace": "trino://host", "name": "schema.alpha", "type": "TABLE"}]}
            }
        }
        dataset_b = {
            "facets": {
                "symlinks": {"identifiers": [{"namespace": "trino://host", "name": "schema.beta", "type": "TABLE"}]}
            }
        }

        def fake_resolution(data, ol_name):
            symlinks = data["facets"]["symlinks"]["identifiers"]
            name = symlinks[0]["name"].split(".")[-1]
            return ResolvedTable(fqn=f"svc.schema.{name}", details=TableDetails(name=name, schema="schema"))

        with patch.object(
            self.open_lineage_source, "_resolve_table_uncached", side_effect=fake_resolution
        ) as mock_uncached:
            resolved_a = self.open_lineage_source._resolve_table(dataset_a)
            resolved_b = self.open_lineage_source._resolve_table(dataset_b)

        self.assertEqual(resolved_a.fqn, "svc.schema.alpha")
        self.assertEqual(resolved_b.fqn, "svc.schema.beta")
        self.assertEqual(mock_uncached.call_count, 2)

    def test_yield_pipeline_lineage_details_resets_resolution_cache(self):
        """Each event starts with a fresh resolution cache, so a result from an
        earlier event can never be served as a stale hit."""
        self.open_lineage_source._resolution_cache["stale-key"] = "STALE"
        cache_before = self.open_lineage_source._resolution_cache

        event = copy.deepcopy(FULL_OL_KAFKA_EVENT)
        event["inputs"] = []
        event["outputs"] = []
        ol_event = self.read_openlineage_event_from_kafka(event)

        with patch.object(OpenMetadataConnection, "get_by_name", create=True, return_value=None):
            list(self.open_lineage_source.yield_pipeline_lineage_details(ol_event))

        self.assertIsNot(self.open_lineage_source._resolution_cache, cache_before)
        self.assertNotIn("stale-key", self.open_lineage_source._resolution_cache)

    def test_get_pipelines_list(self):
        """Test get_pipelines_list method"""
        ol_event = self.read_openlineage_event_from_kafka(FULL_OL_KAFKA_EVENT)
        self.assertIsInstance(ol_event, OpenLineageEvent)
        self.assertEqual(ol_event, EXPECTED_OL_EVENT)

    def test_yield_pipeline_sets_owners_from_job_ownership_facet(self):
        """Test pipeline owners are populated from OpenLineage job ownership facet."""
        ol_event = copy.deepcopy(EXPECTED_OL_EVENT)
        ol_event.job = {
            **ol_event.job,
            "facets": {"ownership": {"owners": [{"name": "team:data-platform", "type": "OWNER"}]}},
        }
        owners = EntityReferenceList(
            root=[
                EntityReference(
                    id=uuid4(),
                    type="team",
                    name="data-platform",
                    displayName="Data Platform",
                )
            ]
        )
        owner_resolver = Mock()
        owner_resolver.get_pipeline_job_owners.return_value = owners
        self.open_lineage_source._owner_resolver = owner_resolver

        with (
            patch.object(
                self.open_lineage_source,
                "_resolve_pipeline_service",
                return_value=MOCK_PIPELINE_SERVICE.name.root,
            ),
            patch.object(self.open_lineage_source, "register_record"),
        ):
            results = list(self.open_lineage_source.yield_pipeline(ol_event))

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].right.owners, owners)
        owner_resolver.get_pipeline_job_owners.assert_called_once()
        self.assertEqual(
            owner_resolver.get_pipeline_job_owners.call_args.args,
            (ol_event.job,),
        )
        self.assertEqual(
            owner_resolver.get_pipeline_job_owners.call_args.kwargs["pipeline_fqn"],
            fqn.build(
                metadata=self.open_lineage_source.metadata,
                entity_type=Pipeline,
                service_name=MOCK_PIPELINE_SERVICE.name.root,
                pipeline_name=self.open_lineage_source.get_pipeline_name(ol_event),
            ),
        )

    def test_prepare_passes_include_owners_to_owner_resolver(self):
        self.open_lineage_source.source_config.includeOwners = False

        with (
            patch.object(self.open_lineage_source, "_build_db_service_type_map", return_value={}),
            patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenLineageOwnerResolver") as resolver_cls,
        ):
            self.open_lineage_source.prepare()

        resolver_cls.assert_called_once_with(
            self.open_lineage_source.metadata,
            include_owners=False,
            ownership_update_mode=self.open_lineage_source.source_config.ownershipUpdateMode,
        )

    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn_from_om")
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
            elif fqn == "testService.shopify.fact_order_new5":  # noqa: RET505
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
                    col_lineage.append((col.fromColumns[0].root, col.toColumn.root))  # noqa: PERF401
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
            pip_results = self.open_lineage_source.yield_pipeline_lineage_details(ol_event)
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

    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn_from_om")
    def test_yield_pipeline_lineage_details_glue_symlink_datasets(self, mock_get_table_from_om):
        """End-to-end: an event whose datasets carry the Glue identity only in
        the symlinks facet (top-level namespace is the physical S3 bucket)
        still produces a table lineage edge - the Spark-on-Glue-catalog
        customer scenario. Only the OpenMetadata boundary is mocked; the full
        candidate-resolution path runs for real.
        """
        src_uuid = "11111111-1111-1111-1111-111111111111"
        dst_uuid = "22222222-2222-2222-2222-222222222222"

        def t_fqn_build_side_effect(table_details, services=None):
            return f"glueService.{table_details.schema}.{table_details.name}"

        def mock_get_by_name(entity, fqn):
            ids = {
                "glueService.store_of_value.src_table": src_uuid,
                "glueService.store_of_value.gsheet_recon_stats_notes": dst_uuid,
            }
            return Mock(id=Mock(root=ids.get(fqn, "33333333-3333-3333-3333-333333333333")))

        mock_get_table_from_om.side_effect = t_fqn_build_side_effect

        def glue_symlink_dataset(table_name):
            return {
                "namespace": "s3://lakehouse--managed-us-west-2--prod",
                "name": f"main/store_of_value/{table_name}",
                "facets": {
                    "symlinks": {
                        "identifiers": [
                            {
                                "namespace": "arn:aws:glue:us-west-2:012621376717",
                                "name": f"table/store_of_value/{table_name}",
                                "type": "TABLE",
                            }
                        ]
                    }
                },
            }

        event = copy.deepcopy(FULL_OL_KAFKA_EVENT)
        event["inputs"] = [glue_symlink_dataset("src_table")]
        event["outputs"] = [glue_symlink_dataset("gsheet_recon_stats_notes")]
        ol_event = self.read_openlineage_event_from_kafka(event)

        with patch.object(
            OpenMetadataConnection,
            "get_by_name",
            create=True,
            side_effect=mock_get_by_name,
        ):
            results = list(self.open_lineage_source.yield_pipeline_lineage_details(ol_event))

        lineage = [r.right for r in results if r.right and isinstance(r.right, AddLineageRequest)]
        self.assertEqual(len(lineage), 1, "Glue-symlink datasets must produce exactly one lineage edge")
        edge = lineage[0].edge
        self.assertEqual(str(edge.fromEntity.id.root), src_uuid)
        self.assertEqual(str(edge.toEntity.id.root), dst_uuid)

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

    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn_from_om")
    def test_lineage_merge_start_with_data_running_without(self, mock_get_table_from_om):
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
            elif fqn == "testService.shopify.fact_order_new5":  # noqa: RET505
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
            start_lineage_results = list(self.open_lineage_source.yield_pipeline_lineage_details(start_ol_event))

        # Process RUNNING event without lineage
        running_ol_event = message_to_open_lineage_event(running_event)
        with patch.object(
            OpenMetadataConnection,
            "get_by_name",
            create=True,
            side_effect=mock_get_uuid_by_name,
        ):
            running_lineage_results = list(self.open_lineage_source.yield_pipeline_lineage_details(running_ol_event))

        # Extract lineage requests from START event
        start_lineage_requests = [
            r.right for r in start_lineage_results if r.right and isinstance(r.right, AddLineageRequest)
        ]

        # Extract lineage requests from RUNNING event
        running_lineage_requests = [
            r.right for r in running_lineage_results if r.right and isinstance(r.right, AddLineageRequest)
        ]

        # Verify START event produced lineage with column details
        start_requests_with_columns = [
            req for req in start_lineage_requests if req.edge.lineageDetails and req.edge.lineageDetails.columnsLineage
        ]
        self.assertGreater(
            len(start_requests_with_columns),
            0,
            "START event should produce lineage requests with column details",
        )

        # Count column lineage entries from START
        start_column_count = sum(len(req.edge.lineageDetails.columnsLineage) for req in start_requests_with_columns)
        self.assertGreater(start_column_count, 0, "START event should have column lineage")

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

        mock_kinesis.get_shard_iterator.return_value = {"ShardIterator": "test-iterator"}

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
        mock_kinesis.get_shard_iterator.return_value = {"ShardIterator": "test-iterator"}
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

    @patch("metadata.ingestion.source.pipeline.openlineage.metadata.OpenlineageSource._get_table_fqn_from_om")
    def test_yield_pipeline_lineage_details_kinesis(self, mock_get_table_from_om):
        """Test lineage extraction from a Kinesis-sourced event."""

        def t_fqn_build_side_effect(table_details, services=None):
            return f"testService.shopify.{table_details.name}"

        def mock_get_uuid_by_name(entity, fqn):
            if fqn == "testService.shopify.raw_product_catalog":
                return Mock(id=Mock(root="69fc8906-4a4a-45ab-9a54-9cc2d399e10e"))
            elif fqn == "testService.shopify.fact_order_new5":  # noqa: RET505
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
            pip_results = list(self.open_lineage_kinesis_source.yield_pipeline_lineage_details(ol_event))

        lineage_requests = [r.right for r in pip_results if r.right and isinstance(r.right, AddLineageRequest)]
        self.assertGreater(len(lineage_requests), 0)

        for req in lineage_requests:
            if req.edge.lineageDetails and req.edge.lineageDetails.columnsLineage:
                self.assertGreater(len(req.edge.lineageDetails.columnsLineage), 0)

    def test_entity_detection_kafka_namespace_returns_topic(self):
        """_get_entity_details identifies kafka:// datasets as topics and
        extracts topic details via _get_topic_details."""
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
        """Non-kafka namespaces are classified as tables; identity resolution
        is candidate-based and handled separately by _resolve_table."""
        table_data = {
            "name": "schema.my_table",
            "namespace": "bigquery",
            "facets": {},
        }
        result = OpenlineageSource._get_entity_details(table_data)
        self.assertEqual(result.entity_type, "table")
        self.assertIsNone(result.topic_details)

    def test_topic_details_extraction_various_broker_formats(self):
        """Test _get_topic_details extracts broker hostname correctly from various
        kafka:// namespace formats (with port, without port, multi-segment hostname)."""
        # Standard broker:port format
        result = OpenlineageSource._get_topic_details({"name": "topic1", "namespace": "kafka://my-broker:9092"})
        self.assertEqual(result.name, "topic1")
        self.assertEqual(result.broker_hostname, "my-broker:9092")

        # Broker without port
        result = OpenlineageSource._get_topic_details({"name": "topic2", "namespace": "kafka://broker-only"})
        self.assertEqual(result.name, "topic2")
        self.assertEqual(result.broker_hostname, "broker-only")

    def test_topic_details_missing_fields_raises_value_error(self):
        """Test that _get_topic_details raises ValueError when namespace or name is missing."""
        with self.assertRaises(ValueError):
            OpenlineageSource._get_topic_details({"name": "topic1"})  # missing namespace

        with self.assertRaises(ValueError):
            OpenlineageSource._get_topic_details({"namespace": "kafka://broker:9092"})  # missing name

    def _run_lineage_with_kafka_broker(self, ol_event, get_by_name_fn, extra_patches=None):
        """Run yield_pipeline_lineage_details with a kafka-broker:9092 messaging service
        mock and return the AddLineageRequest results."""
        mock_svc = Mock()
        mock_svc.connection.config.bootstrapServers = "kafka-broker:9092"
        mock_svc.fullyQualifiedName.root = "kafka-service"
        mock_svc.name = "kafka-service"

        if hasattr(self.open_lineage_source, "_broker_to_service"):
            del self.open_lineage_source._broker_to_service

        with contextlib.ExitStack() as stack:
            mock_metadata = stack.enter_context(patch.object(self.open_lineage_source, "metadata"))
            for p in extra_patches or []:
                stack.enter_context(p)
            mock_metadata.list_all_entities.return_value = iter([mock_svc])
            mock_metadata.get_by_name.side_effect = get_by_name_fn
            results = list(self.open_lineage_source.yield_pipeline_lineage_details(ol_event))

        return [r.right for r in results if r.right and isinstance(r.right, AddLineageRequest)]

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
        ]

        lineage_requests = self._run_lineage_with_kafka_broker(ol_event, get_by_name, extra_patches)

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
        source.source_config.lineageInformation = LineageInformation(dbServiceNames=["redshift_prod"])
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
            result = source._get_table_fqn(table, namespace="mysql://mysql-host:3306/mydb")

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
        source.source_config.lineageInformation = LineageInformation(dbServiceNames=["mysql_prod", "redshift_prod"])
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
            elif service_name == "redshift_prod":  # noqa: RET505
                return "redshift_prod.warehouse.analytics.user_stat"
            return None

        with patch("metadata.utils.fqn.build", side_effect=mock_fqn_build):
            # MySQL namespace -> scheme resolves to mysql_prod only
            mysql_result = source._get_table_fqn(table, namespace="mysql://mysql-host:3306/db")
            assert mysql_result == "mysql_prod.db.analytics.user_stat"

            # Clear cache for next lookup
            source._namespace_to_service_cache = {}

            # Redshift namespace -> scheme resolves to redshift_prod only
            redshift_result = source._get_table_fqn(table, namespace="redshift://cluster:5439/warehouse")
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
            elif service_name == "mysql_cluster_b":  # noqa: RET505
                return "mysql_cluster_b.db.analytics.user_stat"
            return None

        with patch("metadata.utils.fqn.build", side_effect=mock_fqn_build):
            # cluster-a namespace -> mapping resolves to mysql_cluster_a
            result_a = source._get_table_fqn(table, namespace="mysql://cluster-a:3306/db")
            assert result_a == "mysql_cluster_a.db.analytics.user_stat"

            source._namespace_to_service_cache = {}

            # cluster-b namespace -> mapping resolves to mysql_cluster_b
            result_b = source._get_table_fqn(table, namespace="mysql://cluster-b:3306/db")
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
        source.source_config.lineageInformation = LineageInformation(dbServiceNames=["mysql_prod", "custom_lakehouse"])
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
            elif service_name == "custom_lakehouse":  # noqa: RET505
                return "custom_lakehouse.lake.analytics.user_stat"
            return None

        with patch("metadata.utils.fqn.build", side_effect=mock_fqn_build):
            # mysql:// namespace -> scheme matches Mysql -> resolves to mysql_prod only
            mysql_result = source._get_table_fqn(table, namespace="mysql://mysql-host:3306/db")
            assert mysql_result == "mysql_prod.db.analytics.user_stat"

            source._namespace_to_service_cache = {}

            # custom:// namespace (unknown scheme) -> find_services_by_scheme returns
            # services whose type is NOT in the known scheme map, i.e. custom_lakehouse
            custom_result = source._get_table_fqn(table, namespace="custom://lakehouse-host:8080/lake")
            assert custom_result == "custom_lakehouse.lake.analytics.user_stat"

    def test_table_found_in_multiple_services_raises_ambiguous(self):
        """When the same table exists in multiple DB services,
        AmbiguousServiceException is raised, caught in _get_table_fqn,
        logged as a warning, and None is returned (lineage skipped for this entity).
        """
        source = self.open_lineage_source

        source._namespace_to_service_cache = LRUCache(maxsize=10000)
        source.source_config.lineageInformation = LineageInformation(dbServiceNames=["mysql_a", "mysql_b"])
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
            elif service_name == "mysql_b":  # noqa: RET505
                return "mysql_b.db.analytics.user_stat"
            return None

        import logging

        with patch("metadata.utils.fqn.build", side_effect=mock_fqn_build):  # noqa: SIM117
            with self.assertLogs("metadata.Ingestion", level=logging.WARNING) as cm:
                result = source._get_table_fqn(table, namespace="mysql://some-host:3306/db")

        assert result is None
        # The handler now logs the AmbiguousServiceException message itself
        # without a traceback, so the warning carries the actionable hint
        # rather than a stack trace.
        assert any("found in multiple services" in msg for msg in cm.output)
        assert any("namespaceToServiceMapping" in msg for msg in cm.output)

    def test_yield_pipeline_lineage_skips_when_pipeline_fqn_unbuildable(self):
        """If fqn.build returns None for the pipeline (e.g. an unexpected
        service/name combination), the connector logs a clear warning and
        skips the event without raising or calling get_by_name with None."""
        ol_event = OpenLineageEvent(
            run_facet={"facets": {"parent": {"job": {"name": "j", "namespace": "ns"}}}},
            job={"name": "j", "namespace": "ns"},
            event_type="COMPLETE",
            inputs=[{"name": "schema.in", "namespace": "postgres://h:5432", "facets": {}}],
            outputs=[{"name": "schema.out", "namespace": "postgres://h:5432", "facets": {}}],
        )

        mock_table = Mock()
        mock_table.id.root = "aaaa1111-1111-1111-1111-111111111111"

        import logging

        with (
            patch.object(self.open_lineage_source, "metadata") as mock_metadata,
            patch.object(self.open_lineage_source, "_get_table_fqn", return_value="svc.db.schema.in"),
            patch("metadata.utils.fqn.build", return_value=None),
            self.assertLogs("metadata.Ingestion", level=logging.WARNING) as cm,
        ):
            mock_metadata.get_by_name.return_value = mock_table
            results = list(self.open_lineage_source.yield_pipeline_lineage_details(ol_event))

        self.assertEqual([r for r in results if r.right and isinstance(r.right, AddLineageRequest)], [])
        self.assertTrue(any("Could not build pipeline FQN" in msg for msg in cm.output))
        # get_by_name must never be called with fqn=None for the Pipeline lookup.
        for call in mock_metadata.get_by_name.call_args_list:
            self.assertIsNotNone(call.kwargs.get("fqn", call.args[1] if len(call.args) > 1 else "ok"))

    def test_log_unmatched_dataset_attempts_carry_database_segment(self):
        """The diagnostic log for an unmatched 3-part identity must include the
        database segment so operators can tell which catalog was searched."""
        data = {"namespace": "trino://h:8080", "name": "mycat.myschema.mytable"}
        import logging

        with (
            patch.object(self.open_lineage_source, "_get_table_fqn", return_value=None),
            self.assertLogs("metadata.Ingestion", level=logging.WARNING) as cm,
        ):
            self.assertIsNone(self.open_lineage_source._resolve_table(data))

        joined = "\n".join(cm.output)
        self.assertIn("database='mycat'", joined)
        self.assertIn("schema='myschema'", joined)
        self.assertIn("table='mytable'", joined)

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

        with (
            patch.object(self.open_lineage_source, "metadata") as mock_metadata,
            patch.object(
                self.open_lineage_source,
                "_get_table_fqn",
                return_value="db-service.public.some_table",
            ),
        ):
            # Empty messaging services list — no broker match for unknown-broker
            mock_metadata.list_all_entities.return_value = iter([])

            def mock_get_by_name(entity, fqn, **kwargs):
                from metadata.generated.schema.entity.data.table import Table

                if entity == Table:
                    return mock_table
                elif entity == Pipeline:  # noqa: RET505
                    return mock_pipeline
                return None

            mock_metadata.get_by_name.side_effect = mock_get_by_name

            if hasattr(self.open_lineage_source, "_broker_to_service"):
                del self.open_lineage_source._broker_to_service

            results = list(self.open_lineage_source.yield_pipeline_lineage_details(ol_event))

        lineage_requests = [r.right for r in results if r.right and isinstance(r.right, AddLineageRequest)]

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
        ]

        lineage_requests = self._run_lineage_with_kafka_broker(ol_event, get_by_name, extra_patches)

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
        ]

        lineage_requests = self._run_lineage_with_kafka_broker(ol_event, get_by_name, extra_patches)

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

    def test_parse_glue_table_name_trino_glue_catalog_schema(self):
        """Trino backed by AWS Glue Data Catalog uses the public schema and underscore-separated table names.
        Verifies the parser handles the common Glue catalog table naming pattern correctly.
        """
        result = OpenlineageSource._parse_glue_table_name("table/public/order_line_items")
        self.assertEqual(result.name, "order_line_items")
        self.assertEqual(result.schema, "public")

    def test_parse_glue_table_name_happy_path(self):
        """Glue OL naming: table/{database}/{table} — source: Naming.java GlueNaming."""
        result = OpenlineageSource._parse_glue_table_name("table/sales/users")
        self.assertEqual(result.name, "users")
        self.assertEqual(result.schema, "sales")

    def test_parse_table_identity_glue_namespace_uses_glue_parser(self):
        """A conformant Glue name on a Glue namespace uses the Glue parser."""
        result = OpenlineageSource._parse_table_identity("arn:aws:glue:us-east-1:123456789012", "table/sales/users")
        self.assertEqual(result.schema, "sales")
        self.assertEqual(result.name, "users")

    def test_parse_table_identity_falls_back_to_dotted_for_nonconformant_name(self):
        """A dotted name on a Glue namespace falls back to dotted parsing
        instead of being dropped when the Glue parser does not match."""
        result = OpenlineageSource._parse_table_identity("arn:aws:glue:us-east-1:123456789012", "sales.users")
        self.assertIsNotNone(result)
        self.assertEqual(result.schema, "sales")
        self.assertEqual(result.name, "users")

    def test_parse_dotted_table_name_captures_database_for_three_part_names(self):
        """Three-part db.schema.table names populate database so OpenMetadata
        can disambiguate the same schema.table across multiple databases."""
        result = OpenlineageSource._parse_dotted_table_name("mydb.myschema.mytable")
        self.assertEqual(result.database, "mydb")
        self.assertEqual(result.schema, "myschema")
        self.assertEqual(result.name, "mytable")

    def test_parse_dotted_table_name_two_part_leaves_database_none(self):
        """Two-part schema.table names (MySQL, Hive, Teradata, Cassandra)
        leave database as None for OpenMetadata's partial FQN search."""
        result = OpenlineageSource._parse_dotted_table_name("myschema.mytable")
        self.assertIsNone(result.database)
        self.assertEqual(result.schema, "myschema")
        self.assertEqual(result.name, "mytable")

    def test_get_ol_table_name_preserves_uri_scheme(self):
        """The namespace/name boundary is normalized without collapsing the
        URI scheme, so distinct datasets do not collide as cache keys."""
        leading_slash = OpenlineageSource._get_ol_table_name({"namespace": "s3://bucket", "name": "/path/obj"})
        no_leading_slash = OpenlineageSource._get_ol_table_name({"namespace": "s3://bucket", "name": "path/obj"})
        self.assertEqual(leading_slash, "s3://bucket/path/obj")
        self.assertEqual(leading_slash, no_leading_slash)

    def test_parse_glue_table_name_normalizes_to_lowercase(self):
        """Glue table and database names are normalized to lowercase for FQN matching."""
        result = OpenlineageSource._parse_glue_table_name("table/Sales/Users")
        self.assertEqual(result.name, "users")
        self.assertEqual(result.schema, "sales")

    def test_parse_glue_table_name_not_glue_format_returns_none(self):
        """Names without the table/ prefix are not Glue format and return None."""
        self.assertIsNone(OpenlineageSource._parse_glue_table_name("sales.users"))

    def test_parse_glue_table_name_missing_table_part_returns_none(self):
        """table/ prefix with only one path segment is malformed and returns None."""
        self.assertIsNone(OpenlineageSource._parse_glue_table_name("table/only_db"))

    def test_parse_slash_table_name_happy_path(self):
        """Kusto OL naming: {database}/{table} — source: Naming.java KustoNaming."""
        result = OpenlineageSource._parse_slash_table_name("mydb/mytable")
        self.assertEqual(result.name, "mytable")
        self.assertEqual(result.schema, "mydb")

    def test_parse_slash_table_name_normalizes_to_lowercase(self):
        """Kusto table and database names are normalized to lowercase for FQN matching."""
        result = OpenlineageSource._parse_slash_table_name("MyDB/MyTable")
        self.assertEqual(result.name, "mytable")
        self.assertEqual(result.schema, "mydb")

    def test_parse_slash_table_name_single_part_returns_none(self):
        """A single path segment without a slash cannot be split into db/table and returns None."""
        self.assertIsNone(OpenlineageSource._parse_slash_table_name("only_table"))

    def test_parse_cosmos_table_name_happy_path(self):
        """Cosmos OL naming: db from namespace /dbs/{db}, name colls/{coll} — source: Naming.java CosmosNaming."""
        result = OpenlineageSource._parse_cosmos_table_name(
            "azurecosmos://myaccount.documents.azure.com/dbs/mydb",
            "colls/mycollection",
        )
        self.assertEqual(result.name, "mycollection")
        self.assertEqual(result.schema, "mydb")

    def test_parse_cosmos_table_name_normalizes_to_lowercase(self):
        """Cosmos database and collection names are normalized to lowercase for FQN matching."""
        result = OpenlineageSource._parse_cosmos_table_name("azurecosmos://host/dbs/MyDB", "colls/MyCollection")
        self.assertEqual(result.name, "mycollection")
        self.assertEqual(result.schema, "mydb")

    def test_parse_cosmos_table_name_no_dbs_segment_returns_none(self):
        """A Cosmos namespace without /dbs/{db} cannot provide the database name and returns None."""
        self.assertIsNone(OpenlineageSource._parse_cosmos_table_name("azurecosmos://host", "colls/mycoll"))

    def test_parse_cosmos_table_name_non_colls_name_returns_none(self):
        """A Cosmos name not matching colls/{collection} is non-conformant and returns None."""
        self.assertIsNone(OpenlineageSource._parse_cosmos_table_name("azurecosmos://host/dbs/mydb", "mycollection"))

    def test_candidate_glue_namespace_parses_slash_name(self):
        """AWS Glue EMR events use arn:aws:glue namespace + table/{db}/{table} name."""
        data = {
            "namespace": "arn:aws:glue:us-east-1:123456789012",
            "name": "table/sales/users",
        }
        details, _ = OpenlineageSource._iter_table_candidates(data)[0]
        self.assertEqual(details.name, "users")
        self.assertEqual(details.schema, "sales")

    def test_candidate_kusto_namespace_parses_slash_name(self):
        """Azure Kusto events use azurekusto namespace + {db}/{table} name."""
        data = {
            "namespace": "azurekusto://mycluster.kusto.windows.net",
            "name": "mydb/mytable",
        }
        details, _ = OpenlineageSource._iter_table_candidates(data)[0]
        self.assertEqual(details.name, "mytable")
        self.assertEqual(details.schema, "mydb")

    def test_candidate_cosmos_namespace_parses_colls_name(self):
        """Azure Cosmos DB events carry the database in the namespace path."""
        data = {
            "namespace": "azurecosmos://host.documents.azure.com/dbs/mydb",
            "name": "colls/orders",
        }
        details, _ = OpenlineageSource._iter_table_candidates(data)[0]
        self.assertEqual(details.name, "orders")
        self.assertEqual(details.schema, "mydb")

    def test_entity_details_glue_namespace_classified_as_table(self):
        """Glue ARN namespace is classified as a table; identity parses via candidates."""
        data = {
            "namespace": "arn:aws:glue:us-east-1:123456789012",
            "name": "table/sales/users",
            "facets": {},
        }
        self.assertEqual(OpenlineageSource._get_entity_details(data).entity_type, "table")
        details, _ = OpenlineageSource._iter_table_candidates(data)[0]
        self.assertEqual(details.name, "users")
        self.assertEqual(details.schema, "sales")

    def test_unparseable_name_yields_no_candidates(self):
        """Unrecognised name formats yield no candidates instead of raising,
        so a single bad dataset never aborts the whole event."""
        data = {"namespace": "trino://host:8080", "name": "invalidname"}
        self.assertEqual(OpenlineageSource._iter_table_candidates(data), [])


if __name__ == "__main__":
    unittest.main()
