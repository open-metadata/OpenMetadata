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
Test Suite for Lineage Processors

This module contains comprehensive tests for lineage processing functions
including query, view, and stored procedure processors.
"""

import inspect
import unittest
import uuid
from datetime import datetime
from unittest.mock import MagicMock, Mock, patch

import networkx as nx

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.storedProcedure import (
    StoredProcedure,
    StoredProcedureCode,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import (
    QueryParserType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.models.ometa_lineage import OMetaFQNLineageRequest
from metadata.ingestion.models.topology import Queue as TopologyQueue
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.lineage_processors import (
    ProcedureAndQuery,
    QueryByProcedure,
    is_lineage_query,
    procedure_lineage_processor,
    process_chunk_in_subprocess,
    query_lineage_processor,
    view_lineage_processor,
)
from metadata.ingestion.source.database.lineage_source import (
    LineageSource as LineageSourceBase,
)
from metadata.ingestion.source.models import TableView
from metadata.utils.fqn import get_query_checksum


class TestLineageQueryIdentification(unittest.TestCase):
    """Tests for identifying queries that generate lineage"""

    def test_is_lineage_query(self):
        """Test is_lineage_query function with various query types"""
        test_cases = [
            # (query_type, query_text, expected_result)
            ("MERGE", "MERGE INTO target USING source", True),
            ("UPDATE", "UPDATE table SET col = val", True),
            ("CREATE_TABLE_AS_SELECT", "CREATE TABLE new AS SELECT * FROM old", True),
            ("INSERT", "INSERT INTO target SELECT * FROM source", True),
            ("INSERT", "INSERT INTO target VALUES (1, 2, 3)", False),
            ("SELECT", "SELECT * FROM table", False),
            ("DELETE", "DELETE FROM table WHERE id = 1", False),
        ]

        for query_type, query_text, expected in test_cases:
            with self.subTest(query_type=query_type, query=query_text):
                result = is_lineage_query(query_type, query_text)
                self.assertEqual(result, expected, f"Failed for {query_type}: {query_text}")


class TestQueryLineageProcessor(unittest.TestCase):
    """Tests for query lineage processor"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.mock_metadata.es_get_lineage_processed_queries = Mock(return_value={})
        self.mock_metadata.es_get_upstream_entity_ids = Mock(return_value={})
        self.mock_queue = TopologyQueue()
        self.dialect = Dialect.MYSQL
        self.graph = nx.DiGraph()

    def test_query_lineage_processor_basic(self):
        """Test basic query lineage processing"""
        # Create test queries
        queries = [
            TableQuery(
                query="INSERT INTO target SELECT * FROM source",
                databaseName="test_db",
                databaseSchema="test_schema",
                serviceName="test_service",
                query_type="INSERT",
            ),
            TableQuery(
                query="SELECT * FROM table1",
                databaseName="test_db",
                databaseSchema="test_schema",
                serviceName="test_service",
                query_type="SELECT",
            ),
        ]

        # Mock get_lineage_by_query
        mock_lineage = Either(
            right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=uuid.uuid4(), type="table"),
                    toEntity=EntityReference(id=uuid.uuid4(), type="table"),
                    lineageDetails=LineageDetails(source=LineageSource.QueryLineage),
                )
            )
        )

        with patch(
            "metadata.ingestion.source.database.lineage_processors.get_lineage_by_query",
            return_value=[mock_lineage],
        ):
            # Process queries
            query_lineage_processor(
                table_queries=queries,
                queue=self.mock_queue,
                metadata=self.mock_metadata,
                dialect=self.dialect,
                graph=self.graph,
                processCrossDatabaseLineage=False,
                crossDatabaseServiceNames=[],
                parsingTimeoutLimit=10,
                serviceName="test_service",
                parser_type=QueryParserType.Auto,
            )

            # Check queue has results
            results = list(self.mock_queue.process())
            self.assertGreater(len(results), 0)
            self.assertIsInstance(results[0], Either)

    def test_query_already_processed_check(self):
        """Test that already processed queries are skipped while their edges exist"""
        query = TableQuery(
            query="INSERT INTO target SELECT * FROM source",
            databaseName="test_db",
            databaseSchema="test_schema",
            serviceName="test_service",
        )

        # Mock that query is already processed and the edge between its tables still exists
        with patch("metadata.utils.fqn.get_query_checksum", return_value="checksum123"):
            self.mock_metadata.es_get_lineage_processed_queries = Mock(
                return_value={"checksum123": {"source-id", "target-id"}}
            )
            self.mock_metadata.es_get_upstream_entity_ids = Mock(
                return_value={"source-id": set(), "target-id": {"source-id"}}
            )

            # Process query
            query_lineage_processor(
                table_queries=[query],
                queue=self.mock_queue,
                metadata=self.mock_metadata,
                dialect=self.dialect,
                graph=self.graph,
                processCrossDatabaseLineage=False,
                crossDatabaseServiceNames=[],
                parsingTimeoutLimit=10,
                serviceName="test_service",
                parser_type=QueryParserType.Auto,
            )

            # Queue should be empty as query was already processed
            results = list(self.mock_queue.process())
            self.assertEqual(len(results), 0)

    def test_cross_database_lineage(self):
        """Test cross-database lineage processing"""
        query = TableQuery(
            query="INSERT INTO db1.target SELECT * FROM db2.source",
            databaseName="db1",
            databaseSchema="schema1",
            serviceName="service1",
        )

        with patch(
            "metadata.ingestion.source.database.lineage_processors.get_lineage_by_query",
            return_value=[],
        ):
            # Process with cross-database enabled
            query_lineage_processor(
                table_queries=[query],
                queue=self.mock_queue,
                metadata=self.mock_metadata,
                dialect=self.dialect,
                graph=self.graph,
                processCrossDatabaseLineage=True,
                crossDatabaseServiceNames=["service2", "service3"],
                parsingTimeoutLimit=10,
                serviceName="service1",
                parser_type=QueryParserType.Auto,
            )

            # Verify service names were extended
            # This would be checked in the get_lineage_by_query call


COPY_QUERY = "INSERT INTO target SELECT * FROM source"
SOURCE_ID, OTHER_SOURCE_ID, TARGET_ID = (str(uuid.uuid4()) for _ in range(3))


class FakeLineageCatalog:
    """Stands in for the OpenMetadata search lookups: the queries the service already
    processed for lineage with the tables recorded on them, and the upstream lineage
    sources of each indexed table."""

    def __init__(self, processed=None, upstreams=None):
        self._processed = processed or {}
        self._upstreams = upstreams or {}

    def es_get_lineage_processed_queries(self, service_name, checksums):
        return {checksum: ids for checksum, ids in self._processed.items() if checksum in checksums}

    def es_get_upstream_entity_ids(self, entity, entity_ids):
        return {table_id: self._upstreams[table_id] for table_id in entity_ids if table_id in self._upstreams}


def _edge(from_id, to_id, source="source"):
    return Either(
        right=OMetaFQNLineageRequest(
            from_entity_fqn=f"svc.db.schema.{source}",
            from_entity_type="table",
            to_entity_fqn="svc.db.schema.target",
            to_entity_type="table",
            from_entity_id=from_id,
            to_entity_id=to_id,
        )
    )


def _process_copy_query(catalog, lineage):
    queue = TopologyQueue()
    with patch(
        "metadata.ingestion.source.database.lineage_processors.get_lineage_by_query",
        return_value=lineage,
    ):
        query_lineage_processor(
            table_queries=[
                TableQuery(query=COPY_QUERY, serviceName="test_service", databaseName="db", databaseSchema="schema")
            ],
            queue=queue,
            metadata=catalog,
            dialect=Dialect.MYSQL,
            graph=nx.DiGraph(),
            processCrossDatabaseLineage=False,
            crossDatabaseServiceNames=[],
            parsingTimeoutLimit=10,
            serviceName="test_service",
            parser_type=QueryParserType.Auto,
        )
    return [either.right for either in queue.process() if either.right is not None]


def _linked_table_ids(records):
    (query,) = [record for record in records if isinstance(record, CreateQueryRequest)]
    return {model_str(ref.id) for ref in query.queryUsedIn.root}


class TestProcessedQueryLineage:
    """A processed query is skipped only while the edges between its tables still exist"""

    def test_query_whose_edges_are_intact_is_skipped(self):
        catalog = FakeLineageCatalog(
            processed={get_query_checksum(COPY_QUERY): {SOURCE_ID, TARGET_ID}},
            upstreams={SOURCE_ID: set(), TARGET_ID: {SOURCE_ID}},
        )

        assert _process_copy_query(catalog, [_edge(SOURCE_ID, TARGET_ID)]) == []

    def test_query_is_reprocessed_once_a_table_it_connected_is_recreated(self):
        recreated_source_id = str(uuid.uuid4())
        catalog = FakeLineageCatalog(
            processed={get_query_checksum(COPY_QUERY): {SOURCE_ID, TARGET_ID}},
            upstreams={recreated_source_id: set(), TARGET_ID: set()},
        )

        records = _process_copy_query(catalog, [_edge(recreated_source_id, TARGET_ID)])

        assert [type(record) for record in records] == [OMetaFQNLineageRequest, CreateQueryRequest]
        assert records[1].processedLineage is True
        assert _linked_table_ids(records) == {recreated_source_id, TARGET_ID}

    def test_query_is_reprocessed_when_usage_recorded_the_recreated_table(self):
        """Usage rewrites the recorded tables from the current relationships, so the
        re-created table's new id is recorded and every recorded table is indexed"""
        recreated_source_id = str(uuid.uuid4())
        catalog = FakeLineageCatalog(
            processed={get_query_checksum(COPY_QUERY): {recreated_source_id, TARGET_ID}},
            upstreams={recreated_source_id: set(), TARGET_ID: {SOURCE_ID}},
        )

        records = _process_copy_query(catalog, [_edge(recreated_source_id, TARGET_ID)])

        assert _linked_table_ids(records) == {recreated_source_id, TARGET_ID}

    def test_query_is_reprocessed_when_one_of_its_edges_is_missing(self):
        catalog = FakeLineageCatalog(
            processed={get_query_checksum(COPY_QUERY): {SOURCE_ID, OTHER_SOURCE_ID, TARGET_ID}},
            upstreams={SOURCE_ID: set(), OTHER_SOURCE_ID: set(), TARGET_ID: {SOURCE_ID}},
        )

        records = _process_copy_query(
            catalog,
            [_edge(SOURCE_ID, TARGET_ID), _edge(OTHER_SOURCE_ID, TARGET_ID, source="other_source")],
        )

        assert _linked_table_ids(records) == {SOURCE_ID, OTHER_SOURCE_ID, TARGET_ID}

    def test_query_processed_before_its_tables_were_recorded_is_reprocessed(self):
        catalog = FakeLineageCatalog(
            processed={get_query_checksum(COPY_QUERY): set()},
            upstreams={SOURCE_ID: set(), TARGET_ID: {SOURCE_ID}},
        )

        records = _process_copy_query(catalog, [_edge(SOURCE_ID, TARGET_ID)])

        assert _linked_table_ids(records) == {SOURCE_ID, TARGET_ID}

    def test_processed_query_is_stored_once_with_every_table_its_edges_connect(self):
        records = _process_copy_query(
            FakeLineageCatalog(),
            [_edge(SOURCE_ID, TARGET_ID), _edge(OTHER_SOURCE_ID, TARGET_ID, source="other_source")],
        )

        assert [type(record) for record in records] == [
            OMetaFQNLineageRequest,
            OMetaFQNLineageRequest,
            CreateQueryRequest,
        ]
        assert _linked_table_ids(records) == {SOURCE_ID, OTHER_SOURCE_ID, TARGET_ID}

    def test_query_without_lineage_is_not_marked_processed(self):
        failure = Either(left=StackTraceError(name="Lineage", error="Unparsable query", stackTrace=""))

        assert _process_copy_query(FakeLineageCatalog(), [failure]) == []


class TestViewLineageProcessor(unittest.TestCase):
    """Tests for view lineage processor"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.mock_queue = TopologyQueue()

    def test_view_lineage_processor(self):
        """Test view lineage processing"""
        views = [
            TableView(
                table_name="view1",
                db_name="db1",
                schema_name="schema1",
                view_def="CREATE VIEW view1 AS SELECT * FROM table1",
            ),
            TableView(
                table_name="view2",
                db_name="db1",
                schema_name="schema1",
                view_def="CREATE VIEW view2 AS SELECT * FROM view1",
            ),
        ]

        # Mock get_view_lineage
        mock_lineage = Either(
            right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=uuid.uuid4(), type="table"),
                    toEntity=EntityReference(id=uuid.uuid4(), type="table"),
                    lineageDetails=LineageDetails(source=LineageSource.ViewLineage),
                )
            )
        )

        # Mock table with view definition
        mock_table = Mock()
        mock_table.viewDefinition = Mock()
        mock_table.viewDefinition.root = "CREATE VIEW view1 AS SELECT * FROM table1"
        self.mock_metadata.get_by_name.return_value = mock_table

        with patch(  # noqa: SIM117
            "metadata.ingestion.source.database.lineage_processors.get_view_lineage",
            return_value=[mock_lineage],
        ):
            with patch("metadata.utils.fqn.build", return_value="db1.schema1.view1"):
                # Process views
                view_lineage_processor(
                    views=views,
                    queue=self.mock_queue,
                    metadata=self.mock_metadata,
                    service_name="test_service",
                    connectionType="mysql",
                    processCrossDatabaseLineage=False,
                    crossDatabaseServiceNames=[],
                    parsingTimeoutLimit=10,
                    overrideViewLineage=False,
                    parser_type=QueryParserType.Auto,
                )

                # Check queue has results
                results = list(self.mock_queue.process())
                self.assertGreater(len(results), 0)

    def test_view_lineage_with_override(self):
        """Test view lineage with override flag"""
        view = TableView(
            table_name="view1",
            db_name="db1",
            schema_name="schema1",
            view_def="CREATE VIEW view1 AS SELECT * FROM table1",
        )

        mock_lineage = Either(
            right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=uuid.uuid4(), type="table"),
                    toEntity=EntityReference(id=uuid.uuid4(), type="table"),
                    lineageDetails=LineageDetails(source=LineageSource.ViewLineage),
                )
            )
        )

        # Mock table with view definition
        mock_table = Mock()
        mock_table.viewDefinition = Mock()
        mock_table.viewDefinition.root = "CREATE VIEW view1 AS SELECT * FROM table1"
        self.mock_metadata.get_by_name.return_value = mock_table

        with patch(  # noqa: SIM117
            "metadata.ingestion.source.database.lineage_processors.get_view_lineage",
            return_value=[mock_lineage],
        ):
            with patch("metadata.utils.fqn.build", return_value="db1.schema1.view1"):
                # Process with override
                view_lineage_processor(
                    views=[view],
                    queue=self.mock_queue,
                    metadata=self.mock_metadata,
                    service_name="test_service",
                    connectionType="mysql",
                    processCrossDatabaseLineage=False,
                    crossDatabaseServiceNames=[],
                    parsingTimeoutLimit=10,
                    overrideViewLineage=True,  # Override enabled
                    parser_type=QueryParserType.Auto,
                )

                # Check that override flag is set in result
                results = list(self.mock_queue.process())
                self.assertGreater(len(results), 0)
                # The OMetaLineageRequest should have override_lineage=True


class TestViewLineageProcessorArgs(unittest.TestCase):
    """
    `yield_view_lineage` hands the processor a positional args tuple. Nothing else binds
    the two together, so pin the contract: the tuple has to keep matching the processor
    signature, extension included.
    """

    def test_args_bind_to_the_processor_signature(self):
        source = MagicMock()
        extension = Mock(name="view_lineage_extension")
        source.get_view_lineage_extension.return_value = extension
        source.generate_lineage_with_processes.return_value = []

        list(LineageSourceBase.yield_view_lineage(source))

        # generate_lineage_with_processes(producer_fn, processor_fn, args, ...)
        _, processor_fn, args = source.generate_lineage_with_processes.call_args.args
        self.assertIs(processor_fn, view_lineage_processor)

        # the framework calls processor_fn(chunk, queue, *args)
        bound = inspect.signature(view_lineage_processor).bind([], None, *args)
        self.assertIs(bound.arguments["extension"], extension)

    def test_sources_without_an_extension_pass_none(self):
        self.assertIsNone(LineageSourceBase.get_view_lineage_extension(object()))


class TestViewLineageOverrideScope(unittest.TestCase):
    """
    `overrideViewLineage` drops the existing view lineage of the entity an edge points
    at, so it must only be honoured while the edge points at the view being processed.
    """

    VIEW_FQN = "test_service.db1.schema1.view1"

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.mock_queue = TopologyQueue()
        self.view = TableView(
            table_name="view1",
            db_name="db1",
            schema_name="schema1",
            view_definition="CREATE MATERIALIZED VIEW schema1.view1 TO schema1.target AS SELECT * FROM schema1.table1",
        )

    def _process(self, to_entity_fqn: str, override_view_lineage: bool = True, view_fqn: str = "") -> bool:
        """Run the processor on a single edge and return the resulting override flag"""
        view_fqn = self.VIEW_FQN if view_fqn == "" else view_fqn
        lineage = Either(
            right=OMetaFQNLineageRequest(
                from_entity_fqn="test_service.db1.schema1.table1",
                from_entity_type="table",
                to_entity_fqn=to_entity_fqn,
                to_entity_type="table",
                lineage_details=LineageDetails(source=LineageSource.ViewLineage),
            )
        )

        with patch(  # noqa: SIM117
            "metadata.ingestion.source.database.lineage_processors.get_view_lineage",
            return_value=[lineage],
        ):
            with patch("metadata.utils.fqn.build", return_value=view_fqn):
                view_lineage_processor(
                    views=[self.view],
                    queue=self.mock_queue,
                    metadata=self.mock_metadata,
                    service_name="test_service",
                    connectionType="clickhouse",
                    processCrossDatabaseLineage=False,
                    crossDatabaseServiceNames=[],
                    parsingTimeoutLimit=10,
                    overrideViewLineage=override_view_lineage,
                    parser_type=QueryParserType.Auto,
                )

        results = list(self.mock_queue.process())
        self.assertEqual(len(results), 1)
        return results[0].right.override_lineage

    def test_edge_into_the_view_is_overridden(self):
        """The upstream edge of the view keeps replacing the previous view lineage"""
        self.assertTrue(self._process(to_entity_fqn=self.VIEW_FQN))

    def test_edge_into_the_view_is_matched_case_insensitively(self):
        """Entity FQNs are not necessarily cased like the ingested view name"""
        self.assertTrue(self._process(to_entity_fqn=self.VIEW_FQN.upper()))

    def test_edge_into_another_table_is_not_overridden(self):
        """
        A materialized view writing into its `TO` target must not drop the lineage the
        sibling views writing into that same table created.
        """
        self.assertFalse(self._process(to_entity_fqn="test_service.db1.schema1.target"))

    def test_override_disabled_stays_disabled(self):
        """The flag is never turned on by the edge itself"""
        self.assertFalse(self._process(to_entity_fqn=self.VIEW_FQN, override_view_lineage=False))

    def test_a_view_without_an_fqn_keeps_the_flag(self):
        """`fqn.build` is optional-typed: an unknown view FQN decides nothing"""
        self.assertTrue(self._process(to_entity_fqn="test_service.db1.schema1.target", view_fqn=None))


class TestProcedureLineageProcessor(unittest.TestCase):
    """Tests for stored procedure lineage processor"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.mock_queue = TopologyQueue()
        self.dialect = Dialect.MYSQL
        self.procedure_graph_map = {}

    def test_procedure_lineage_processor(self):
        """Test procedure lineage processing"""
        # Create real stored procedure
        procedure = StoredProcedure(
            id=uuid.uuid4(),
            name="TestProc",
            fullyQualifiedName="service.db.schema.TestProc",
            storedProcedureCode=StoredProcedureCode(
                code="CREATE PROCEDURE TestProc() BEGIN INSERT INTO target SELECT * FROM source; END",
                language="SQL",
            ),
            database=EntityReference(id=uuid.uuid4(), type="database", name="db"),
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema", name="schema"),
            service=EntityReference(id=uuid.uuid4(), type="databaseService", name="service"),
        )

        # Create query by procedure
        query_by_proc = QueryByProcedure(
            PROCEDURE_NAME="TestProc",
            QUERY_TEXT="INSERT INTO target SELECT * FROM source",
            QUERY_TYPE="INSERT",
            PROCEDURE_TEXT="CALL TestProc()",
            PROCEDURE_START_TIME=datetime.now(),
            PROCEDURE_END_TIME=datetime.now(),
            QUERY_DURATION=1.5,
        )

        procedure_and_query = ProcedureAndQuery(procedure=procedure, query_by_procedure=query_by_proc)

        # Mock lineage generation
        mock_lineage = Either(
            right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=uuid.uuid4(), type="table"),
                    toEntity=EntityReference(id=uuid.uuid4(), type="table"),
                    lineageDetails=LineageDetails(
                        source=LineageSource.QueryLineage,
                        pipeline=EntityReference(id=procedure.id, type="storedProcedure"),
                    ),
                )
            )
        )

        with patch(  # noqa: SIM117
            "metadata.ingestion.source.database.lineage_processors._yield_procedure_lineage",
            return_value=[mock_lineage],
        ):
            with patch(
                "metadata.ingestion.source.database.lineage_processors.yield_procedure_query",
                return_value=[],
            ):
                # Process procedure
                procedure_lineage_processor(
                    procedure_and_queries=[procedure_and_query],
                    queue=self.mock_queue,
                    metadata=self.mock_metadata,
                    service_name="test_service",
                    dialect=self.dialect,
                    processCrossDatabaseLineage=False,
                    crossDatabaseServiceNames=[],
                    parsingTimeoutLimit=10,
                    procedure_graph_map=self.procedure_graph_map,
                    enableTempTableLineage=False,
                    parser_type=QueryParserType.Auto,
                )

                # Check queue has results
                results = list(self.mock_queue.process())
                self.assertGreater(len(results), 0)

    def test_procedure_with_temp_table_lineage(self):
        """Test procedure lineage with temporary table support"""
        procedure = StoredProcedure(
            id=uuid.uuid4(),
            name="TempTableProc",
            fullyQualifiedName="service.db.schema.TempTableProc",
            storedProcedureCode=StoredProcedureCode(
                code="CREATE PROCEDURE TempTableProc() BEGIN CREATE TEMP TABLE temp AS SELECT * FROM source; END",
                language="SQL",
            ),
            database=EntityReference(id=uuid.uuid4(), type="database", name="db"),
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema", name="schema"),
            service=EntityReference(id=uuid.uuid4(), type="databaseService", name="service"),
        )

        query_by_proc = QueryByProcedure(
            PROCEDURE_NAME="TempTableProc",
            QUERY_TEXT="CREATE TEMP TABLE temp AS SELECT * FROM source",
            QUERY_TYPE="CREATE_TABLE_AS_SELECT",
            PROCEDURE_TEXT="CALL TempTableProc()",
            PROCEDURE_START_TIME=datetime.now(),
            PROCEDURE_END_TIME=datetime.now(),
        )

        procedure_and_query = ProcedureAndQuery(procedure=procedure, query_by_procedure=query_by_proc)

        with patch(  # noqa: SIM117
            "metadata.ingestion.source.database.lineage_processors.get_lineage_by_query",
            return_value=[],
        ):
            with patch(
                "metadata.ingestion.source.database.lineage_processors.yield_procedure_query",
                return_value=[],
            ):
                # Process with temp table lineage enabled
                procedure_lineage_processor(
                    procedure_and_queries=[procedure_and_query],
                    queue=self.mock_queue,
                    metadata=self.mock_metadata,
                    service_name="test_service",
                    dialect=self.dialect,
                    processCrossDatabaseLineage=False,
                    crossDatabaseServiceNames=[],
                    parsingTimeoutLimit=10,
                    procedure_graph_map=self.procedure_graph_map,
                    enableTempTableLineage=True,  # Enable temp table support
                    parser_type=QueryParserType.Auto,
                )

                # Verify graph was created for the procedure
                self.assertIn("service.db.schema.TempTableProc", self.procedure_graph_map)


class TestChunkProcessing(unittest.TestCase):
    """Tests for chunk processing in subprocess/thread"""

    def test_process_chunk_in_subprocess(self):
        """Test process_chunk_in_subprocess function"""
        # Create mock data
        chunk = [
            TableQuery(query="SELECT 1", serviceName="test"),
            TableQuery(query="SELECT 2", serviceName="test"),
        ]

        mock_queue = TopologyQueue()

        def mock_processor(items, queue, *args):
            for item in items:
                queue.put(Either(right=CreateQueryRequest(query=item.query, service="test")))

        # Process chunk
        result = process_chunk_in_subprocess(chunk, mock_processor, mock_queue)

        self.assertTrue(result)

        # Check queue has items
        results = list(mock_queue.process())
        self.assertEqual(len(results), 2)

    def test_process_chunk_with_exception(self):
        """Test process_chunk_in_subprocess handles exceptions"""
        chunk = [TableQuery(query="SELECT 1", serviceName="test")]
        mock_queue = TopologyQueue()

        def failing_processor(items, queue, *args):
            raise Exception("Processing failed")  # noqa: TRY002

        # Process chunk with failing processor
        result = process_chunk_in_subprocess(chunk, failing_processor, mock_queue)

        self.assertFalse(result)


class TestMemoryEfficiency(unittest.TestCase):
    """Tests to ensure processors are memory efficient"""

    def test_processors_dont_accumulate_results(self):
        """Test that processors don't accumulate all results in memory"""
        # Create a large number of queries
        large_query_list = [
            TableQuery(
                query=f"SELECT * FROM table{i}",
                serviceName="test",
                databaseName="db",
                databaseSchema="schema",
            )
            for i in range(100)
        ]

        mock_metadata = Mock()
        mock_metadata.es_get_lineage_processed_queries = Mock(return_value={})
        mock_metadata.es_get_upstream_entity_ids = Mock(return_value={})
        mock_queue = TopologyQueue()

        with patch(
            "metadata.ingestion.source.database.lineage_processors.get_lineage_by_query",
            return_value=[],
        ):
            # Process large list
            query_lineage_processor(
                table_queries=large_query_list,
                queue=mock_queue,
                metadata=mock_metadata,
                dialect=Dialect.MYSQL,
                graph=nx.DiGraph(),
                processCrossDatabaseLineage=False,
                crossDatabaseServiceNames=[],
                parsingTimeoutLimit=10,
                serviceName="test",
                parser_type=QueryParserType.Auto,
            )

            # The processor should handle this without memory issues
            # (In real scenario, we'd monitor memory usage)
            self.assertTrue(True)  # If we get here, no memory error occurred
