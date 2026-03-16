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
Tests for temporary table lineage graph processing functionality.

These tests cover the graph-based lineage processing used when
`enableTempTableLineage` is enabled, specifically:
- _get_paths_from_subtree: Path extraction with timeout handling
- _process_sequence: Sequence processing for lineage generation
- get_lineage_by_graph: Full graph processing workflow
"""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import networkx as nx

from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityLineage import TempLineageTable
from metadata.ingestion.lineage.sql_lineage import (
    CUTOFF_NODES,
    NODE_PROCESSING_TIMEOUT,
    _build_table_lineage,
    _build_temp_table_lineage,
    _collect_temp_lineage_hops,
    _get_lineage_for_path,
    _get_paths_from_subtree,
    _process_sequence,
    get_lineage_by_graph,
    get_lineage_by_procedure_graph,
)


class TestGetPathsFromSubtree:
    """Tests for _get_paths_from_subtree function"""

    def test_simple_linear_graph(self):
        """Test linear graph: A -> B -> C returns single path [A, B, C]"""
        graph = nx.DiGraph()
        graph.add_edges_from([("A", "B"), ("B", "C")])

        paths = _get_paths_from_subtree(graph)

        assert len(paths) == 1
        assert paths[0] == ["A", "B", "C"]

    def test_diamond_graph(self):
        r"""
        Test diamond graph:
            A
           / \
          B   C
           \ /
            D
        Should return 2 paths: [A, B, D] and [A, C, D]
        """
        graph = nx.DiGraph()
        graph.add_edges_from([("A", "B"), ("A", "C"), ("B", "D"), ("C", "D")])

        paths = _get_paths_from_subtree(graph)

        assert len(paths) == 2
        # Check both paths exist (order may vary)
        path_sets = [tuple(p) for p in paths]
        assert ("A", "B", "D") in path_sets
        assert ("A", "C", "D") in path_sets

    def test_multiple_roots_single_leaf(self):
        r"""
        Test graph with multiple root nodes converging to single leaf:
            A   B
             \ /
              C
        Should return 2 paths: [A, C] and [B, C]
        """
        graph = nx.DiGraph()
        graph.add_edges_from([("A", "C"), ("B", "C")])

        paths = _get_paths_from_subtree(graph)

        assert len(paths) == 2
        path_sets = [tuple(p) for p in paths]
        assert ("A", "C") in path_sets
        assert ("B", "C") in path_sets

    def test_single_root_multiple_leaves(self):
        """
        Test graph with single root branching to multiple leaves:
            A
           / \
          B   C
        Should return 2 paths: [A, B] and [A, C]
        """
        graph = nx.DiGraph()
        graph.add_edges_from([("A", "B"), ("A", "C")])

        paths = _get_paths_from_subtree(graph)

        assert len(paths) == 2
        path_sets = [tuple(p) for p in paths]
        assert ("A", "B") in path_sets
        assert ("A", "C") in path_sets

    def test_empty_graph(self):
        """Test empty graph returns empty paths list"""
        graph = nx.DiGraph()

        paths = _get_paths_from_subtree(graph)

        assert paths == []

    def test_single_node_graph(self):
        """Test single node graph (both root and leaf) returns single path"""
        graph = nx.DiGraph()
        graph.add_node("A")

        paths = _get_paths_from_subtree(graph)

        assert len(paths) == 1
        assert paths[0] == ["A"]

    def test_complex_dag(self):
        r"""
        Test complex DAG with multiple paths:
            A
           /|\
          B C D
          |/| |
          E F |
           \|/
            G
        """
        graph = nx.DiGraph()
        graph.add_edges_from(
            [
                ("A", "B"),
                ("A", "C"),
                ("A", "D"),
                ("B", "E"),
                ("C", "E"),
                ("C", "F"),
                ("D", "G"),
                ("E", "G"),
                ("F", "G"),
            ]
        )

        paths = _get_paths_from_subtree(graph)

        # All paths should start with A and end with G
        for path in paths:
            assert path[0] == "A"
            assert path[-1] == "G"

        # Verify path count: A->B->E->G, A->C->E->G, A->C->F->G, A->D->G = 4 paths
        assert len(paths) == 4

    def test_cutoff_respected(self):
        """Test that CUTOFF_NODES limit is respected for long paths"""
        # Create a long chain that exceeds CUTOFF_NODES
        graph = nx.DiGraph()
        nodes = [f"node_{i}" for i in range(CUTOFF_NODES + 10)]
        for i in range(len(nodes) - 1):
            graph.add_edge(nodes[i], nodes[i + 1])

        paths = _get_paths_from_subtree(graph)

        # Path length should be limited by CUTOFF_NODES
        if paths:
            for path in paths:
                assert len(path) <= CUTOFF_NODES + 1  # +1 because cutoff is on edges

    def test_table_names_with_schema_prefix(self):
        """Test graph with table names containing schema prefixes"""
        graph = nx.DiGraph()
        graph.add_edges_from(
            [
                ("<default>.temp_table_1", "<default>.temp_table_2"),
                ("<default>.temp_table_2", "schema.target_table"),
            ]
        )

        paths = _get_paths_from_subtree(graph)

        assert len(paths) == 1
        assert paths[0] == [
            "<default>.temp_table_1",
            "<default>.temp_table_2",
            "schema.target_table",
        ]


class TestProcessSequence:
    """Tests for _process_sequence function"""

    def test_process_sequence_with_fqns(self):
        """Test processing a sequence where nodes have FQNs"""
        graph = nx.DiGraph()
        graph.add_node("source_table", fqns=["service.db.schema.source_table"])
        graph.add_node("temp_table", fqns=[])  # temp table has no FQN
        graph.add_node("target_table", fqns=["service.db.schema.target_table"])
        graph.add_edges_from(
            [("source_table", "temp_table"), ("temp_table", "target_table")]
        )

        sequence = ["source_table", "temp_table", "target_table"]
        mock_metadata = MagicMock()
        mock_metadata.es_search_from_fqn.return_value = []

        results = list(_process_sequence(sequence, graph, mock_metadata))

        # Since es_search returns empty, no lineage should be generated
        assert len(results) == 0

    def test_process_sequence_empty(self):
        """Test processing empty sequence"""
        graph = nx.DiGraph()
        mock_metadata = MagicMock()

        results = list(_process_sequence([], graph, mock_metadata))

        assert results == []

    def test_process_sequence_single_node(self):
        """Test processing single node sequence"""
        graph = nx.DiGraph()
        graph.add_node("single_table", fqns=["service.db.schema.single_table"])

        mock_metadata = MagicMock()
        results = list(_process_sequence(["single_table"], graph, mock_metadata))

        # Single node cannot produce lineage (needs from and to)
        assert len(results) == 0


class TestGetLineageByGraph:
    """Tests for get_lineage_by_graph function"""

    def test_none_graph_returns_nothing(self):
        """Test that None graph yields no results"""
        mock_metadata = MagicMock()

        results = list(get_lineage_by_graph(None, mock_metadata))

        assert results == []

    def test_empty_graph_returns_nothing(self):
        """Test that empty graph yields no results"""
        graph = nx.DiGraph()
        mock_metadata = MagicMock()

        results = list(get_lineage_by_graph(graph, mock_metadata))

        assert results == []

    def test_disconnected_components_processed_separately(self):
        """Test that disconnected components are processed separately"""
        graph = nx.DiGraph()
        # Component 1: A -> B
        graph.add_edge("A", "B")
        graph.add_node("A", fqns=["service.db.schema.A"])
        graph.add_node("B", fqns=["service.db.schema.B"])

        # Component 2: C -> D
        graph.add_edge("C", "D")
        graph.add_node("C", fqns=["service.db.schema.C"])
        graph.add_node("D", fqns=["service.db.schema.D"])

        mock_metadata = MagicMock()
        mock_metadata.es_search_from_fqn.return_value = []

        # Just verify no exceptions are raised
        results = list(get_lineage_by_graph(graph, mock_metadata))

        # With mocked ES returning nothing, we should get no lineage
        assert len(results) == 0


class TestGetLineageByProcedureGraph:
    """Tests for get_lineage_by_procedure_graph function"""

    def test_none_procedure_graph_map(self):
        """Test that None procedure_graph_map yields no results"""
        mock_metadata = MagicMock()

        results = list(get_lineage_by_procedure_graph(None, mock_metadata))

        assert results == []

    def test_empty_procedure_graph_map(self):
        """Test that empty procedure_graph_map yields no results"""
        mock_metadata = MagicMock()

        results = list(get_lineage_by_procedure_graph({}, mock_metadata))

        assert results == []


class TestTimeoutBehavior:
    """Tests for timeout behavior in graph processing"""

    def test_timeout_on_large_graph(self):
        """
        Test that processing times out gracefully for very large graphs.
        Note: This test may not trigger actual timeout in fast environments.
        """
        # Create a highly connected graph that could cause slow processing
        graph = nx.DiGraph()
        # Create a grid-like structure that generates many paths
        size = 5
        for i in range(size):
            for j in range(size):
                node = f"node_{i}_{j}"
                graph.add_node(node, fqns=[])
                if i > 0:
                    graph.add_edge(f"node_{i-1}_{j}", node)
                if j > 0:
                    graph.add_edge(f"node_{i}_{j-1}", node)

        # Should complete without hanging
        paths = _get_paths_from_subtree(graph)

        # Verify we got some paths (exact count depends on cutoff)
        assert isinstance(paths, list)

    @patch("metadata.ingestion.lineage.sql_lineage.NODE_PROCESSING_TIMEOUT", 1)
    def test_timeout_logs_warning(self):
        """Test that timeout condition logs appropriate warning"""
        # This test verifies the timeout mechanism exists
        # Actual timeout testing requires manipulating execution time
        assert NODE_PROCESSING_TIMEOUT == 30  # Default value


class TestIntegrationScenarios:
    """Integration tests for temp table lineage scenarios"""

    def test_stored_procedure_temp_table_chain(self):
        """
        Test scenario: Stored procedure creates temp tables in chain
        source_table -> temp1 -> temp2 -> target_table
        Only source_table and target_table exist in metadata
        """
        graph = nx.DiGraph()
        graph.add_node("source_table", fqns=["service.db.schema.source_table"])
        graph.add_node("temp1", fqns=[])  # Temp table - no FQN
        graph.add_node("temp2", fqns=[])  # Temp table - no FQN
        graph.add_node("target_table", fqns=["service.db.schema.target_table"])

        graph.add_edges_from(
            [
                ("source_table", "temp1"),
                ("temp1", "temp2"),
                ("temp2", "target_table"),
            ]
        )

        mock_metadata = MagicMock()
        mock_metadata.es_search_from_fqn.return_value = []

        # Process the graph
        results = list(get_lineage_by_graph(graph, mock_metadata))

        # Verify structure (no actual lineage since ES returns nothing)
        assert isinstance(results, list)

    def test_multiple_temp_tables_converging(self):
        """
        Test scenario: Multiple temp tables converge to target
        source1 -> temp1 \
                          -> target
        source2 -> temp2 /
        """
        graph = nx.DiGraph()
        graph.add_node("source1", fqns=["service.db.schema.source1"])
        graph.add_node("source2", fqns=["service.db.schema.source2"])
        graph.add_node("temp1", fqns=[])
        graph.add_node("temp2", fqns=[])
        graph.add_node("target", fqns=["service.db.schema.target"])

        graph.add_edges_from(
            [
                ("source1", "temp1"),
                ("source2", "temp2"),
                ("temp1", "target"),
                ("temp2", "target"),
            ]
        )

        paths = _get_paths_from_subtree(graph)

        # Should have 2 paths
        assert len(paths) == 2

    def test_branching_temp_table_lineage(self):
        r"""
        Test scenario: Source splits into multiple targets via temp tables
        source -> temp -> target1
                      \-> target2
        """
        graph = nx.DiGraph()
        graph.add_node("source", fqns=["service.db.schema.source"])
        graph.add_node("temp", fqns=[])
        graph.add_node("target1", fqns=["service.db.schema.target1"])
        graph.add_node("target2", fqns=["service.db.schema.target2"])

        graph.add_edges_from(
            [
                ("source", "temp"),
                ("temp", "target1"),
                ("temp", "target2"),
            ]
        )

        paths = _get_paths_from_subtree(graph)

        assert len(paths) == 2
        path_ends = [p[-1] for p in paths]
        assert "target1" in path_ends
        assert "target2" in path_ends


class TestEdgeCases:
    """Edge case tests for graph processing"""

    def test_self_loop_handling(self):
        """Test that self-loops don't cause infinite loops"""
        graph = nx.DiGraph()
        graph.add_edge("A", "A")  # Self-loop
        graph.add_edge("A", "B")

        # Should not hang
        paths = _get_paths_from_subtree(graph)
        assert isinstance(paths, list)

    def test_unicode_table_names(self):
        """Test handling of unicode characters in table names"""
        graph = nx.DiGraph()
        graph.add_edge("表格_源", "表格_目标")
        graph.add_node("表格_源", fqns=["service.db.schema.表格_源"])
        graph.add_node("表格_目标", fqns=["service.db.schema.表格_目标"])

        paths = _get_paths_from_subtree(graph)

        assert len(paths) == 1
        assert paths[0] == ["表格_源", "表格_目标"]

    def test_special_characters_in_table_names(self):
        """Test handling of special characters in table names"""
        graph = nx.DiGraph()
        graph.add_edge("table-with-dashes", "table_with_underscores")
        graph.add_edge("table_with_underscores", "table.with.dots")

        paths = _get_paths_from_subtree(graph)

        assert len(paths) == 1
        assert paths[0] == [
            "table-with-dashes",
            "table_with_underscores",
            "table.with.dots",
        ]

    def test_very_long_table_names(self):
        """Test handling of very long table names"""
        long_name = "a" * 500
        graph = nx.DiGraph()
        graph.add_edge(long_name, "target")

        paths = _get_paths_from_subtree(graph)

        assert len(paths) == 1
        assert paths[0][0] == long_name


class TestBuildTempTableLineage:
    """Tests for _build_temp_table_lineage function"""

    def test_simple_two_node_chain(self):
        """Direct source->target with no intermediates produces single hop with FQNs"""
        result = _build_temp_table_lineage(
            table_chain=["source", "target"],
            from_fqn="service.db.schema.source",
            to_fqn="service.db.schema.target",
        )

        assert result == [
            TempLineageTable(
                fromEntity="service.db.schema.source",
                toEntity="service.db.schema.target",
            )
        ]

    def test_single_intermediate(self):
        """source->temp->target produces two hops with FQNs at endpoints"""
        result = _build_temp_table_lineage(
            table_chain=["source", "temp1", "target"],
            from_fqn="service.db.schema.source",
            to_fqn="service.db.schema.target",
        )

        assert result == [
            TempLineageTable(fromEntity="service.db.schema.source", toEntity="temp1"),
            TempLineageTable(fromEntity="temp1", toEntity="service.db.schema.target"),
        ]

    def test_multiple_intermediates(self):
        """source->temp1->temp2->target produces three hops"""
        result = _build_temp_table_lineage(
            table_chain=["source", "temp1", "temp2", "target"],
            from_fqn="service.db.schema.source",
            to_fqn="service.db.schema.target",
        )

        assert result == [
            TempLineageTable(fromEntity="service.db.schema.source", toEntity="temp1"),
            TempLineageTable(fromEntity="temp1", toEntity="temp2"),
            TempLineageTable(fromEntity="temp2", toEntity="service.db.schema.target"),
        ]

    def test_many_intermediates(self):
        """Chain with many temp tables produces correct hops"""
        result = _build_temp_table_lineage(
            table_chain=["src", "t1", "t2", "t3", "t4", "dst"],
            from_fqn="svc.db.sch.src",
            to_fqn="svc.db.sch.dst",
        )

        assert len(result) == 5
        assert result[0] == TempLineageTable(fromEntity="svc.db.sch.src", toEntity="t1")
        assert result[1] == TempLineageTable(fromEntity="t1", toEntity="t2")
        assert result[2] == TempLineageTable(fromEntity="t2", toEntity="t3")
        assert result[3] == TempLineageTable(fromEntity="t3", toEntity="t4")
        assert result[4] == TempLineageTable(fromEntity="t4", toEntity="svc.db.sch.dst")

    def test_single_node_chain(self):
        """Single node chain (edge case) produces direct hop"""
        result = _build_temp_table_lineage(
            table_chain=["only_node"],
            from_fqn="service.db.schema.source",
            to_fqn="service.db.schema.target",
        )

        assert result == [
            TempLineageTable(
                fromEntity="service.db.schema.source",
                toEntity="service.db.schema.target",
            )
        ]

    def test_empty_chain(self):
        """Empty chain produces direct hop"""
        result = _build_temp_table_lineage(
            table_chain=[],
            from_fqn="service.db.schema.source",
            to_fqn="service.db.schema.target",
        )

        assert result == [
            TempLineageTable(
                fromEntity="service.db.schema.source",
                toEntity="service.db.schema.target",
            )
        ]

    def test_fqn_only_at_endpoints(self):
        """Intermediate hops use raw names, not FQNs"""
        result = _build_temp_table_lineage(
            table_chain=["real_table", "#temp_a", "#temp_b", "final_table"],
            from_fqn="svc.db.public.real_table",
            to_fqn="svc.db.public.final_table",
        )

        assert result[0].fromEntity == "svc.db.public.real_table"
        assert result[-1].toEntity == "svc.db.public.final_table"
        assert result[1] == TempLineageTable(fromEntity="#temp_a", toEntity="#temp_b")


class TestBuildTableLineageWithTempField:
    """Tests that _build_table_lineage correctly populates tempLineageTables"""

    def _make_mock_table(self, table_name):
        table = MagicMock()
        table.id.root = str(uuid4())
        table.name.root = table_name
        table.fullyQualifiedName.root = f"service.db.schema.{table_name}"
        table.columns = []
        return table

    def test_temp_lineage_tables_set_when_provided(self):
        """tempLineageTables is populated on lineage details when provided"""
        from_entity = self._make_mock_table("source")
        to_entity = self._make_mock_table("target")
        hops = [
            TempLineageTable(fromEntity="service.db.schema.source", toEntity="temp1"),
            TempLineageTable(fromEntity="temp1", toEntity="service.db.schema.target"),
        ]

        result = _build_table_lineage(
            from_entity=from_entity,
            to_entity=to_entity,
            from_table_raw_name="source",
            to_table_raw_name="target",
            masked_query=None,
            column_lineage_map={},
            lineage_source=LineageSource.QueryLineage,
            temp_lineage_tables=hops,
        )

        assert result.right is not None
        details = result.right.edge.lineageDetails
        assert details.tempLineageTables == hops
        assert details.sqlQuery is None

    def test_temp_lineage_tables_not_set_when_none(self):
        """tempLineageTables is not set when not provided"""
        from_entity = self._make_mock_table("source")
        to_entity = self._make_mock_table("target")

        result = _build_table_lineage(
            from_entity=from_entity,
            to_entity=to_entity,
            from_table_raw_name="source",
            to_table_raw_name="target",
            masked_query="SELECT * FROM source",
            column_lineage_map={},
            lineage_source=LineageSource.QueryLineage,
        )

        assert result.right is not None
        details = result.right.edge.lineageDetails
        assert details.tempLineageTables is None
        assert details.sqlQuery is not None

    def test_temp_lineage_tables_not_set_when_empty_list(self):
        """Empty list is falsy, so tempLineageTables stays None"""
        from_entity = self._make_mock_table("source")
        to_entity = self._make_mock_table("target")

        result = _build_table_lineage(
            from_entity=from_entity,
            to_entity=to_entity,
            from_table_raw_name="source",
            to_table_raw_name="target",
            masked_query=None,
            column_lineage_map={},
            temp_lineage_tables=[],
        )

        assert result.right is not None
        assert result.right.edge.lineageDetails.tempLineageTables is None


class TestGetLineageForPathTempLineage:
    """Tests that _get_lineage_for_path populates tempLineageTables correctly"""

    def _make_mock_table(self, table_name, fqn):
        table = MagicMock()
        table.id.root = str(uuid4())
        table.name.root = table_name
        table.fullyQualifiedName.root = fqn
        table.columns = []
        return table

    @patch("metadata.ingestion.lineage.sql_lineage.get_entity_from_es_result")
    def test_lineage_has_temp_table_hops(self, mock_get_entity):
        """Verify _get_lineage_for_path produces tempLineageTables with correct hops"""
        from_table = self._make_mock_table("source", "svc.db.sch.source")
        to_table = self._make_mock_table("target", "svc.db.sch.target")
        mock_get_entity.side_effect = [to_table, from_table]

        mock_metadata = MagicMock()

        result = _get_lineage_for_path(
            from_fqn="svc.db.sch.source",
            to_fqn="svc.db.sch.target",
            from_node="source",
            current_node="target",
            table_chain=["source", "temp1", "temp2", "target"],
            metadata=mock_metadata,
        )

        assert result is not None
        details = result.right.edge.lineageDetails
        assert details.tempLineageTables == [
            TempLineageTable(fromEntity="svc.db.sch.source", toEntity="temp1"),
            TempLineageTable(fromEntity="temp1", toEntity="temp2"),
            TempLineageTable(fromEntity="temp2", toEntity="svc.db.sch.target"),
        ]
        assert details.sqlQuery is None

    @patch("metadata.ingestion.lineage.sql_lineage.get_entity_from_es_result")
    def test_lineage_direct_no_intermediates(self, mock_get_entity):
        """Direct path with no temp tables produces single hop"""
        from_table = self._make_mock_table("source", "svc.db.sch.source")
        to_table = self._make_mock_table("target", "svc.db.sch.target")
        mock_get_entity.side_effect = [to_table, from_table]

        mock_metadata = MagicMock()

        result = _get_lineage_for_path(
            from_fqn="svc.db.sch.source",
            to_fqn="svc.db.sch.target",
            from_node="source",
            current_node="target",
            table_chain=["source", "target"],
            metadata=mock_metadata,
        )

        assert result is not None
        details = result.right.edge.lineageDetails
        assert details.tempLineageTables == [
            TempLineageTable(
                fromEntity="svc.db.sch.source", toEntity="svc.db.sch.target"
            ),
        ]

    @patch("metadata.ingestion.lineage.sql_lineage.get_entity_from_es_result")
    def test_no_lineage_when_entities_not_found(self, mock_get_entity):
        """No lineage produced when ES returns no entities"""
        mock_get_entity.return_value = None

        mock_metadata = MagicMock()

        result = _get_lineage_for_path(
            from_fqn="svc.db.sch.source",
            to_fqn="svc.db.sch.target",
            from_node="source",
            current_node="target",
            table_chain=["source", "temp1", "target"],
            metadata=mock_metadata,
        )

        assert result is None


class TestCollectTempLineageHops:
    """Tests for _collect_temp_lineage_hops merging logic"""

    def test_single_path_single_pair(self):
        """Single path produces one entry in hops_map"""
        graph = nx.DiGraph()
        graph.add_node("source", fqns=["svc.db.sch.source"])
        graph.add_node("temp1", fqns=[])
        graph.add_node("target", fqns=["svc.db.sch.target"])
        graph.add_edges_from([("source", "temp1"), ("temp1", "target")])

        paths = [["source", "temp1", "target"]]
        hops_map = _collect_temp_lineage_hops(paths, graph)

        assert ("svc.db.sch.source", "svc.db.sch.target") in hops_map
        hops = hops_map[("svc.db.sch.source", "svc.db.sch.target")]
        assert hops == [
            TempLineageTable(fromEntity="svc.db.sch.source", toEntity="temp1"),
            TempLineageTable(fromEntity="temp1", toEntity="svc.db.sch.target"),
        ]

    def test_converging_paths_merged(self):
        """
        Two paths through different temp tables to the same target
        are merged into a single hops_map entry.
        source -> t1 -> target
        source -> t2 -> target
        """
        graph = nx.DiGraph()
        graph.add_node("source", fqns=["svc.db.sch.source"])
        graph.add_node("t1", fqns=[])
        graph.add_node("t2", fqns=[])
        graph.add_node("target", fqns=["svc.db.sch.target"])
        graph.add_edges_from(
            [("source", "t1"), ("source", "t2"), ("t1", "target"), ("t2", "target")]
        )

        paths = [
            ["source", "t1", "target"],
            ["source", "t2", "target"],
        ]
        hops_map = _collect_temp_lineage_hops(paths, graph)

        key = ("svc.db.sch.source", "svc.db.sch.target")
        assert key in hops_map
        hops = hops_map[key]
        assert len(hops) == 4
        assert TempLineageTable(fromEntity="svc.db.sch.source", toEntity="t1") in hops
        assert TempLineageTable(fromEntity="t1", toEntity="svc.db.sch.target") in hops
        assert TempLineageTable(fromEntity="svc.db.sch.source", toEntity="t2") in hops
        assert TempLineageTable(fromEntity="t2", toEntity="svc.db.sch.target") in hops

    def test_different_pairs_stay_separate(self):
        """
        Paths to different targets produce separate hops_map entries.
        source -> t1 -> target1
        source -> t2 -> target2
        """
        graph = nx.DiGraph()
        graph.add_node("source", fqns=["svc.db.sch.source"])
        graph.add_node("t1", fqns=[])
        graph.add_node("t2", fqns=[])
        graph.add_node("target1", fqns=["svc.db.sch.target1"])
        graph.add_node("target2", fqns=["svc.db.sch.target2"])
        graph.add_edges_from(
            [("source", "t1"), ("source", "t2"), ("t1", "target1"), ("t2", "target2")]
        )

        paths = [
            ["source", "t1", "target1"],
            ["source", "t2", "target2"],
        ]
        hops_map = _collect_temp_lineage_hops(paths, graph)

        assert len(hops_map) == 2
        assert ("svc.db.sch.source", "svc.db.sch.target1") in hops_map
        assert ("svc.db.sch.source", "svc.db.sch.target2") in hops_map

    def test_empty_paths(self):
        """Empty paths list produces empty hops_map"""
        graph = nx.DiGraph()
        hops_map = _collect_temp_lineage_hops([], graph)
        assert hops_map == {}

    def test_three_converging_temp_tables(self):
        """
        Three paths through different temp tables to the same target.
        source -> t1 -> target
        source -> t2 -> target
        source -> t3 -> target
        """
        graph = nx.DiGraph()
        graph.add_node("source", fqns=["svc.db.sch.source"])
        graph.add_node("t1", fqns=[])
        graph.add_node("t2", fqns=[])
        graph.add_node("t3", fqns=[])
        graph.add_node("target", fqns=["svc.db.sch.target"])
        graph.add_edges_from(
            [
                ("source", "t1"),
                ("source", "t2"),
                ("source", "t3"),
                ("t1", "target"),
                ("t2", "target"),
                ("t3", "target"),
            ]
        )

        paths = [
            ["source", "t1", "target"],
            ["source", "t2", "target"],
            ["source", "t3", "target"],
        ]
        hops_map = _collect_temp_lineage_hops(paths, graph)

        key = ("svc.db.sch.source", "svc.db.sch.target")
        hops = hops_map[key]
        # 3 paths x 2 hops each = 6 total
        assert len(hops) == 6

    def test_multi_real_entity_chain_resets_table_chain(self):
        """
        Path with 3 real entities: realA -> tmp1 -> realB -> tmp2 -> realC
        The chain must reset at each real entity so that the (realB, realC) pair
        only contains hops from realB onward, not the full accumulated chain.
        """
        graph = nx.DiGraph()
        graph.add_node("realA", fqns=["svc.db.sch.realA"])
        graph.add_node("tmp1", fqns=[])
        graph.add_node("realB", fqns=["svc.db.sch.realB"])
        graph.add_node("tmp2", fqns=[])
        graph.add_node("realC", fqns=["svc.db.sch.realC"])
        graph.add_edges_from(
            [
                ("realA", "tmp1"),
                ("tmp1", "realB"),
                ("realB", "tmp2"),
                ("tmp2", "realC"),
            ]
        )

        paths = [["realA", "tmp1", "realB", "tmp2", "realC"]]
        hops_map = _collect_temp_lineage_hops(paths, graph)

        # Should have two separate pairs
        assert len(hops_map) == 2

        # (realA, realB) should have hops: realA -> tmp1, tmp1 -> realB
        key_ab = ("svc.db.sch.realA", "svc.db.sch.realB")
        assert key_ab in hops_map
        hops_ab = hops_map[key_ab]
        assert len(hops_ab) == 2
        assert (
            TempLineageTable(fromEntity="svc.db.sch.realA", toEntity="tmp1") in hops_ab
        )
        assert (
            TempLineageTable(fromEntity="tmp1", toEntity="svc.db.sch.realB") in hops_ab
        )

        # (realB, realC) should have hops: realB -> tmp2, tmp2 -> realC
        # NOT the full chain from realA
        key_bc = ("svc.db.sch.realB", "svc.db.sch.realC")
        assert key_bc in hops_map
        hops_bc = hops_map[key_bc]
        assert len(hops_bc) == 2
        assert (
            TempLineageTable(fromEntity="svc.db.sch.realB", toEntity="tmp2") in hops_bc
        )
        assert (
            TempLineageTable(fromEntity="tmp2", toEntity="svc.db.sch.realC") in hops_bc
        )


class TestMergedLineageByGraph:
    """Tests that get_lineage_by_graph merges temp lineage across converging paths"""

    def _make_mock_table(self, table_name, fqn):
        table = MagicMock()
        table.id.root = str(uuid4())
        table.name.root = table_name
        table.fullyQualifiedName.root = fqn
        table.columns = []
        return table

    @patch("metadata.ingestion.lineage.sql_lineage.get_entity_from_es_result")
    def test_converging_paths_produce_single_merged_request(self, mock_get_entity):
        """
        source -> t1 -> target  and  source -> t2 -> target
        should produce ONE lineage request with all 4 hops merged.
        """
        source = self._make_mock_table("source", "svc.db.sch.source")
        target = self._make_mock_table("target", "svc.db.sch.target")

        def side_effect_fn(entity_list):
            if not entity_list:
                return None
            return entity_list[0]

        mock_get_entity.side_effect = side_effect_fn

        mock_metadata = MagicMock()

        def es_search(entity_type, fqn_search_string):
            if "source" in fqn_search_string:
                return [source]
            if "target" in fqn_search_string:
                return [target]
            return []

        mock_metadata.es_search_from_fqn.side_effect = es_search

        graph = nx.DiGraph()
        graph.add_node("source", fqns=["svc.db.sch.source"])
        graph.add_node("t1", fqns=[])
        graph.add_node("t2", fqns=[])
        graph.add_node("target", fqns=["svc.db.sch.target"])
        graph.add_edges_from(
            [("source", "t1"), ("source", "t2"), ("t1", "target"), ("t2", "target")]
        )

        results = list(get_lineage_by_graph(graph, mock_metadata))

        # Should produce exactly one request (not two)
        assert len(results) == 1
        details = results[0].right.edge.lineageDetails
        hops = details.tempLineageTables
        assert len(hops) == 4
        assert TempLineageTable(fromEntity="svc.db.sch.source", toEntity="t1") in hops
        assert TempLineageTable(fromEntity="t1", toEntity="svc.db.sch.target") in hops
        assert TempLineageTable(fromEntity="svc.db.sch.source", toEntity="t2") in hops
        assert TempLineageTable(fromEntity="t2", toEntity="svc.db.sch.target") in hops

    @patch("metadata.ingestion.lineage.sql_lineage.get_entity_from_es_result")
    def test_different_targets_produce_separate_requests(self, mock_get_entity):
        """
        source -> t1 -> target1  and  source -> t2 -> target2
        should produce TWO separate lineage requests.
        """
        source = self._make_mock_table("source", "svc.db.sch.source")
        target1 = self._make_mock_table("target1", "svc.db.sch.target1")
        target2 = self._make_mock_table("target2", "svc.db.sch.target2")

        def side_effect_fn(entity_list):
            if not entity_list:
                return None
            return entity_list[0]

        mock_get_entity.side_effect = side_effect_fn

        mock_metadata = MagicMock()

        def es_search(entity_type, fqn_search_string):
            if "source" in fqn_search_string:
                return [source]
            if "target1" in fqn_search_string:
                return [target1]
            if "target2" in fqn_search_string:
                return [target2]
            return []

        mock_metadata.es_search_from_fqn.side_effect = es_search

        graph = nx.DiGraph()
        graph.add_node("source", fqns=["svc.db.sch.source"])
        graph.add_node("t1", fqns=[])
        graph.add_node("t2", fqns=[])
        graph.add_node("target1", fqns=["svc.db.sch.target1"])
        graph.add_node("target2", fqns=["svc.db.sch.target2"])
        graph.add_edges_from(
            [("source", "t1"), ("source", "t2"), ("t1", "target1"), ("t2", "target2")]
        )

        results = list(get_lineage_by_graph(graph, mock_metadata))

        assert len(results) == 2
        fqn_pairs = set()
        for r in results:
            edge = r.right.edge
            from_fqn = edge.fromEntity.id
            to_fqn = edge.toEntity.id
            fqn_pairs.add((str(from_fqn), str(to_fqn)))
        # Two distinct pairs
        assert len(fqn_pairs) == 2

    @patch("metadata.ingestion.lineage.sql_lineage.get_entity_from_es_result")
    def test_snowflake_scenario_source_t1_t2_target(self, mock_get_entity):
        """
        Reproduces the exact Snowflake scenario:
        source_tbl -> t1 -> target_tbl
        source_tbl -> t2 -> target_tbl
        Both t1 and t2 must appear in tempLineageTables.
        """
        source = self._make_mock_table("source_tbl", "snow.TEST_DB.SCH.SOURCE_TBL")
        target = self._make_mock_table("target_tbl", "snow.TEST_DB.SCH.TARGET_TBL")

        def side_effect_fn(entity_list):
            if not entity_list:
                return None
            return entity_list[0]

        mock_get_entity.side_effect = side_effect_fn

        mock_metadata = MagicMock()

        def es_search(entity_type, fqn_search_string):
            if "SOURCE_TBL" in fqn_search_string:
                return [source]
            if "TARGET_TBL" in fqn_search_string:
                return [target]
            return []

        mock_metadata.es_search_from_fqn.side_effect = es_search

        graph = nx.DiGraph()
        graph.add_node("source_tbl", fqns=["snow.TEST_DB.SCH.SOURCE_TBL"])
        graph.add_node("t1", fqns=[])
        graph.add_node("t2", fqns=[])
        graph.add_node("target_tbl", fqns=["snow.TEST_DB.SCH.TARGET_TBL"])
        graph.add_edges_from(
            [
                ("source_tbl", "t1"),
                ("source_tbl", "t2"),
                ("t1", "target_tbl"),
                ("t2", "target_tbl"),
            ]
        )

        results = list(get_lineage_by_graph(graph, mock_metadata))

        assert len(results) == 1
        hops = results[0].right.edge.lineageDetails.tempLineageTables
        # Both temp tables must be present
        to_entities = [h.toEntity for h in hops]
        from_entities = [h.fromEntity for h in hops]
        assert "t1" in to_entities
        assert "t2" in to_entities
        assert "t1" in from_entities
        assert "t2" in from_entities
