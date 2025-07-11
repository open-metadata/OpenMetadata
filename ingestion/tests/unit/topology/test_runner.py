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
Check that we are properly running nodes and stages
"""
from typing import List, Optional
from unittest import TestCase
from unittest.mock import patch

from pydantic import BaseModel, Field
from typing_extensions import Annotated

from metadata.ingestion.api.models import Either
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyContextManager,
    TopologyNode,
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
    root: Annotated[
        TopologyNode, Field(description="Root node for the topology")
    ] = TopologyNode(
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
    tables: Annotated[TopologyNode, Field(description="Ingest tables")] = TopologyNode(
        producer="get_tables",
        stages=[
            NodeStage(
                type_=MockTable,
                processor="yield_tables",
                consumer=["schemas"],
                context="tables",
            )
        ],
        threads=True,
    )


class MockSource(TopologyRunnerMixin):
    topology = MockTopology()
    context = TopologyContextManager(topology)

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
        real_fingerprint = "b4c6559d2fab833ba348c6bd98054b94"

        self.assertEqual(real_fingerprint, generate_source_hash(mock_table))

        # if we exclude some other field, the fingerprint should not match
        self.assertNotEqual(
            real_fingerprint,
            generate_source_hash(mock_table, exclude_fields={"columns": True}),
        )

    def test_node_and_stage(self):
        """The step behaves properly"""
        self.source.context = TopologyContextManager(self.source.topology)
        self.source.context.set_threads(0)

        with patch(
            "metadata.ingestion.models.topology.TopologyContextManager.pop",
            return_value=None,
        ):
            processed = list(self.source._iter())

        self.assertEqual(len(self.source.context.contexts.keys()), 1)

        self.assertEqual(
            # check the post process being at the end
            [
                either.right if hasattr(either, "right") else either
                for either in processed
            ],
            [
                MockSchema(
                    name="schema1", sourceHash="6414db364af730c9f34cdd705664dfbf"
                ),
                MockTable(
                    name="table1",
                    sourceHash="b3765a609adc20d8382eea0e595233cc",
                    columns=["c1", "c2"],
                ),
                MockTable(
                    name="table2",
                    sourceHash="37e964e369aa225211aa87b388b1e7d2",
                    columns=["c1", "c2"],
                ),
                MockSchema(
                    name="schema2", sourceHash="3e1fafb67d34fb25bec7adf59042da87"
                ),
                MockTable(
                    name="table1",
                    sourceHash="b3765a609adc20d8382eea0e595233cc",
                    columns=["c1", "c2"],
                ),
                MockTable(
                    name="table2",
                    sourceHash="37e964e369aa225211aa87b388b1e7d2",
                    columns=["c1", "c2"],
                ),
                "hello",
            ],
        )

    def test_multithread_node_and_stage(self):
        """The step behaves properly"""
        self.source.context = TopologyContextManager(self.source.topology)
        self.source.context.set_threads(2)
        # Avoid removing the ThreadIds from the TopologyContextManager dict.
        with patch(
            "metadata.ingestion.models.topology.TopologyContextManager.pop",
            return_value=None,
        ):
            processed = list(self.source._iter())

        # Since the threads can be reused or some other ID generated we are unsure the amount of contexts we
        # will get.
        self.assertGreater(len(self.source.context.contexts.keys()), 1)

        self.assertCountEqual(
            # check the post process being at the end
            [
                either.right if hasattr(either, "right") else either
                for either in processed
            ],
            [
                MockSchema(
                    name="schema1", sourceHash="6414db364af730c9f34cdd705664dfbf"
                ),
                MockTable(
                    name="table1",
                    sourceHash="b3765a609adc20d8382eea0e595233cc",
                    columns=["c1", "c2"],
                ),
                MockTable(
                    name="table2",
                    sourceHash="37e964e369aa225211aa87b388b1e7d2",
                    columns=["c1", "c2"],
                ),
                MockSchema(
                    name="schema2", sourceHash="3e1fafb67d34fb25bec7adf59042da87"
                ),
                MockTable(
                    name="table1",
                    sourceHash="b3765a609adc20d8382eea0e595233cc",
                    columns=["c1", "c2"],
                ),
                MockTable(
                    name="table2",
                    sourceHash="37e964e369aa225211aa87b388b1e7d2",
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
