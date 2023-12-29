#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Check that we are properly running nodes and stages
"""
from typing import List, Optional
from unittest import TestCase
from unittest.mock import patch

from pydantic import BaseModel

from metadata.ingestion.api.models import Either
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyNode,
    create_source_context,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.source_hash import generate_source_hash


class MockSchema(BaseModel):
    sourceHash: Optional[str] = None
    name: str
    # Keeping it None to reuse the same class for Create and Entity
    fullyQualifiedName: Optional[str] = None


class MockTable(BaseModel):
    sourceHash: Optional[str] = None
    name: str
    # Keeping it None to reuse the same class for Create and Entity
    fullyQualifiedName: Optional[str] = None
    columns: List[str]


class MockTopology(ServiceTopology):
    root = TopologyNode(
        producer="get_schemas",
        stages=[
            NodeStage(
                type_=MockSchema,
                processor="yield_schemas",
                context="schemas",
            )
        ],
        children=["tables"],
        post_process=["yield_hello"],
    )
    tables = TopologyNode(
        producer="get_tables",
        stages=[
            NodeStage(
                type_=MockTable,
                processor="yield_tables",
                consumer=["schemas"],
                context="tables",
            )
        ],
    )


class MockSource(TopologyRunnerMixin):
    topology = MockTopology()
    context = create_source_context(topology)

    @staticmethod
    def get_schemas():
        yield "schema1"
        yield "schema2"

    @staticmethod
    def get_tables():
        yield "table1"
        yield "table2"

    @staticmethod
    def yield_schemas(name: str):
        yield Either(right=MockSchema(name=name))

    @staticmethod
    def yield_tables(name: str):
        yield Either(right=MockTable(name=name, columns=["c1", "c2"]))

    @staticmethod
    def yield_hello():
        yield "hello"


class TopologyRunnerTest(TestCase):
    """Validate filter patterns"""

    source = MockSource()

    def test_source_hash(self):
        """Check it works with generic models"""

        mock_table = MockTable(name="name", columns=["a", "b", "c"])
        real_fingerprint = "b26507e2abea036be183507e4794b223"

        self.assertEqual(real_fingerprint, generate_source_hash(mock_table))

        # if we exclude some other field, the fingerprint should not match
        self.assertNotEqual(
            real_fingerprint,
            generate_source_hash(mock_table, exclude_fields={"columns": True}),
        )

    def test_node_and_stage(self):
        """The step behaves properly"""
        processed = list(self.source._iter())
        self.assertEqual(
            # check the post process being at the end
            [
                either.right if hasattr(either, "right") else either
                for either in processed
            ],
            [
                MockSchema(
                    name="schema1", sourceHash="da1c4385f20477a716b0423317016e43"
                ),
                MockTable(
                    name="table1",
                    sourceHash="42373213656fb27d2f0aeb0abf81b5b2",
                    columns=["c1", "c2"],
                ),
                MockTable(
                    name="table2",
                    sourceHash="c7d6b4802530b8ca54a48c76af56b7b4",
                    columns=["c1", "c2"],
                ),
                MockSchema(
                    name="schema2", sourceHash="31db3d644ba1bd6024c149dd3e88abe9"
                ),
                MockTable(
                    name="table1",
                    sourceHash="42373213656fb27d2f0aeb0abf81b5b2",
                    columns=["c1", "c2"],
                ),
                MockTable(
                    name="table2",
                    sourceHash="c7d6b4802530b8ca54a48c76af56b7b4",
                    columns=["c1", "c2"],
                ),
                "hello",
            ],
        )

    def test_get_children(self):
        """We get the right children information"""

        self.assertEqual(
            self.source._get_child_nodes(self.source.topology.root),
            [self.source.topology.tables],
        )
        self.assertEqual(self.source._get_child_nodes(self.source.topology.tables), [])

    def test_run_node_post_process(self):
        """We get the right post_process results"""

        self.assertEqual(
            list(self.source._run_node_post_process(self.source.topology.root)),
            ["hello"],
        )
        self.assertEqual(
            list(self.source._run_node_post_process(self.source.topology.tables)), []
        )

    def test_init_hash_dict(self):
        """We get the right cache dict"""

        local_source = MockSource()

        mock_list_all_entities = [
            MockTable(
                name="table1",
                fullyQualifiedName="schema1.table1",
                sourceHash="c238b14e87fe6d54e35dbca4a97e1e83",
                columns=["c1", "c2"],
            ),
            MockTable(
                name="table2",
                fullyQualifiedName="schema1.table2",
                sourceHash="acd38ff1a662adc0c88225f2666ff423",
                columns=["c1", "c2"],
            ),
        ]

        with patch.object(
            OpenMetadata, "list_all_entities", return_value=mock_list_all_entities
        ):
            local_source.metadata = OpenMetadata

            local_source.get_fqn_source_hash_dict(
                parent_type=MockSchema, child_type=MockTable, entity_fqn="fqn"
            )

        self.assertEqual(
            dict(local_source.cache),
            {
                MockTable: {
                    "schema1.table1": "c238b14e87fe6d54e35dbca4a97e1e83",
                    "schema1.table2": "acd38ff1a662adc0c88225f2666ff423",
                }
            },
        )
