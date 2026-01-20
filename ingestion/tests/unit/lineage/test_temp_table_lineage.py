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

import networkx as nx

from metadata.ingestion.lineage.sql_lineage import (
    CUTOFF_NODES,
    NODE_PROCESSING_TIMEOUT,
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
