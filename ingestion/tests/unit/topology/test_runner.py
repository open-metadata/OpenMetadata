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

from typing import List, Optional  # noqa: UP035
from unittest import TestCase
from unittest.mock import MagicMock, patch

from pydantic import BaseModel, Field
from typing_extensions import Annotated  # noqa: UP035

from metadata.ingestion.api.models import Either
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyContextManager,
    TopologyNode,
)
from metadata.utils.source_hash import generate_source_hash


class MockSchema(BaseModel):
    sourceHash: Optional[str] = None  # noqa: N815, UP045
    name: str
    # Keeping it None to reuse the same class for Create and Entity
    fullyQualifiedName: Optional[str] = None  # noqa: N815, UP045
    deleted: Optional[bool] = None  # noqa: UP045


class MockTable(BaseModel):
    sourceHash: Optional[str] = None  # noqa: N815, UP045
    name: str
    # Keeping it None to reuse the same class for Create and Entity
    fullyQualifiedName: Optional[str] = None  # noqa: N815, UP045
    columns: List[str]  # noqa: UP006
    deleted: Optional[bool] = None  # noqa: UP045


class MockTopology(ServiceTopology):
    root: Annotated[TopologyNode, Field(description="Root node for the topology")] = TopologyNode(
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


class OverwriteFalseTopology(ServiceTopology):
    """A single-stage topology whose stage is not overwritable, like a service node."""

    root: Annotated[TopologyNode, Field(description="Root node")] = TopologyNode(
        producer="get_schemas",
        stages=[
            NodeStage(
                type_=MockSchema,
                processor="yield_schemas",
                context="schemas",
                overwrite=False,
            )
        ],
    )


class OverwriteFalseSource(TopologyRunnerMixin):
    topology = OverwriteFalseTopology()
    context = TopologyContextManager(topology)

    @staticmethod
    def get_schemas():
        yield "schema1"

    @staticmethod
    def yield_schemas(name: str):
        yield Either(right=MockSchema(name=name))

    def _is_force_overwrite_enabled(self) -> bool:
        return False


class TopologyRunnerTest(TestCase):
    """Validate filter patterns"""

    source = MockSource()

    def test_source_hash(self):
        """Check it works with generic models"""

        mock_table = MockTable(name="name", columns=["a", "b", "c"])
        real_fingerprint = "03a6bd999d83f6e8fe25659bb6f8ac90"

        self.assertEqual(real_fingerprint, generate_source_hash(mock_table))

        # if we exclude some other field, the fingerprint should not match
        self.assertNotEqual(
            real_fingerprint,
            generate_source_hash(mock_table, exclude_fields={"columns": True}),
        )

    def test_node_and_stage(self):
        """Every produced entity is yielded straight to the sink with its sourceHash stamped"""
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
            [either.right if hasattr(either, "right") else either for either in processed],
            [
                MockSchema(name="schema1", sourceHash="ddb43c9d34ccbe2363a37db746211fcb"),
                MockTable(
                    name="table1",
                    sourceHash="384ee4341cf5c1ac5658f9310ea8868c",
                    columns=["c1", "c2"],
                ),
                MockTable(
                    name="table2",
                    sourceHash="3b3c6ad507d2bbf24a68451d2bef38dd",
                    columns=["c1", "c2"],
                ),
                MockSchema(name="schema2", sourceHash="18e4768ea591108c38e6b24a861cb3d2"),
                MockTable(
                    name="table1",
                    sourceHash="384ee4341cf5c1ac5658f9310ea8868c",
                    columns=["c1", "c2"],
                ),
                MockTable(
                    name="table2",
                    sourceHash="3b3c6ad507d2bbf24a68451d2bef38dd",
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
            [either.right if hasattr(either, "right") else either for either in processed],
            [
                MockSchema(name="schema1", sourceHash="ddb43c9d34ccbe2363a37db746211fcb"),
                MockTable(
                    name="table1",
                    sourceHash="384ee4341cf5c1ac5658f9310ea8868c",
                    columns=["c1", "c2"],
                ),
                MockTable(
                    name="table2",
                    sourceHash="3b3c6ad507d2bbf24a68451d2bef38dd",
                    columns=["c1", "c2"],
                ),
                MockSchema(name="schema2", sourceHash="18e4768ea591108c38e6b24a861cb3d2"),
                MockTable(
                    name="table1",
                    sourceHash="384ee4341cf5c1ac5658f9310ea8868c",
                    columns=["c1", "c2"],
                ),
                MockTable(
                    name="table2",
                    sourceHash="3b3c6ad507d2bbf24a68451d2bef38dd",
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
        self.assertEqual(list(self.source._run_node_post_process(self.source.topology.tables)), [])

    def test_no_per_entity_api_calls(self):
        """The runner must not fetch existing entities per produced entity.

        Change detection now lives server-side in the bulk endpoint, so a normal run must
        never call get_by_name or list_all_entities for child entities - only the producers
        and the sink are exercised.
        """
        local_source = MockSource()
        local_source.context = TopologyContextManager(local_source.topology)
        local_source.context.set_threads(0)
        local_source.metadata = MagicMock()

        with patch(
            "metadata.ingestion.models.topology.TopologyContextManager.pop",
            return_value=None,
        ):
            list(local_source._iter())

        local_source.metadata.get_by_name.assert_not_called()
        local_source.metadata.list_all_entities.assert_not_called()

    def test_overwrite_false_skips_yield_when_entity_exists(self):
        """A non-overwritable stage returns the existing entity from the API and yields nothing."""
        local_source = OverwriteFalseSource()
        local_source.context = TopologyContextManager(local_source.topology)
        local_source.context.set_threads(0)
        local_source.metadata = MagicMock()
        local_source.metadata.get_by_name.return_value = MockSchema(name="schema1", fullyQualifiedName="schema1")

        with patch(
            "metadata.ingestion.models.topology.TopologyContextManager.pop",
            return_value=None,
        ):
            processed = list(local_source._iter())

        self.assertEqual(processed, [])
        local_source.metadata.get_by_name.assert_called_once()

    def test_overwrite_false_yields_when_entity_missing(self):
        """A non-overwritable stage still yields when the entity does not yet exist."""
        local_source = OverwriteFalseSource()
        local_source.context = TopologyContextManager(local_source.topology)
        local_source.context.set_threads(0)
        local_source.metadata = MagicMock()
        local_source.metadata.get_by_name.return_value = None

        with patch(
            "metadata.ingestion.models.topology.TopologyContextManager.pop",
            return_value=None,
        ):
            processed = list(local_source._iter())

        yielded = [either.right for either in processed if hasattr(either, "right")]
        self.assertEqual(
            yielded,
            [MockSchema(name="schema1", sourceHash="ddb43c9d34ccbe2363a37db746211fcb")],
        )
