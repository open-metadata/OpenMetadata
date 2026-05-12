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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
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


class PerEntityIsolationTest(TestCase):
    """
    Regression tests for the per-entity exception isolation added to
    `TopologyRunnerMixin._process_stage`. A single yielded entity that fails
    in sink_request must not halt the whole stage; it should be recorded as
    a `status.failed(...)` and the loop should continue with the next entity.
    """

    @staticmethod
    def _build_source():
        source = MockSource()
        # Status is normally provided by the enclosing Step; the new defensive
        # branch in _process_stage calls self.status.failed(...) on failure.
        source.status = MagicMock()
        return source

    def test_process_stage_isolates_per_entity_failure(self):
        """A failing entity is logged and skipped — surrounding entities still
        flow through, so the stage does not halt on a single bad item."""
        source = self._build_source()
        stage = source.topology.tables.stages[0]

        def fake_run_stage_processor(stage, node_entity):
            yield Either(right=MockTable(name="t1", columns=["c1"]))
            yield Either(right=MockTable(name="t_bad", columns=["c1"]))
            yield Either(right=MockTable(name="t2", columns=["c1"]))

        def fake_sink_request(stage, entity_request):
            if entity_request.right.name == "t_bad":
                raise RuntimeError("Boom for t_bad")
            yield entity_request

        with (
            patch.object(MockSource, "_run_stage_processor", side_effect=fake_run_stage_processor),
            patch.object(MockSource, "sink_request", side_effect=fake_sink_request),
            self.assertLogs("metadata.Ingestion", level="WARNING") as cm,
        ):
            results = list(source._process_stage(stage=stage, node_entity="schema1", child_nodes=[]))

        # Entities before AND after the failure are yielded — iteration didn't halt.
        yielded_names = [r.right.name for r in results]
        self.assertEqual(yielded_names, ["t1", "t2"])

        # The failure is observable through the warning log (label + stage + error).
        warning = "\n".join(cm.output)
        self.assertIn("t_bad", warning)
        self.assertIn("yield_tables", warning)
        self.assertIn("Boom for t_bad", warning)

    def test_process_stage_handles_entity_without_name(self):
        """If the failing entity doesn't expose a usable .name, the warning
        still emits a fallback label and iteration continues."""
        source = self._build_source()
        stage = source.topology.tables.stages[0]

        class _Bag:  # no .name attribute
            pass

        bag = _Bag()

        def fake_run_stage_processor(stage, node_entity):
            yield Either(right=MockTable(name="t1", columns=["c1"]))
            yield Either(right=bag)
            yield Either(right=MockTable(name="t2", columns=["c1"]))

        def fake_sink_request(stage, entity_request):
            if entity_request.right is bag:
                raise RuntimeError("noname failure")
            yield entity_request

        with (
            patch.object(MockSource, "_run_stage_processor", side_effect=fake_run_stage_processor),
            patch.object(MockSource, "sink_request", side_effect=fake_sink_request),
            self.assertLogs("metadata.Ingestion", level="WARNING") as cm,
        ):
            results = list(source._process_stage(stage=stage, node_entity="schema1", child_nodes=[]))

        # Good entities surrounding the bad one are still yielded.
        self.assertEqual(
            [r.right.name for r in results if hasattr(r.right, "name")],
            ["t1", "t2"],
        )
        # Warning still emitted with the fallback label, no exception escaped.
        warning = "\n".join(cm.output)
        self.assertIn("yield_tables", warning)
        self.assertIn("noname failure", warning)

    def test_entity_request_label_handles_various_shapes(self):
        """_entity_request_label must never raise and must return a useful
        label across the shapes _process_stage might see in failure paths."""
        stage = MockSource().topology.tables.stages[0]
        # 1. Normal entity_request with .name
        label = TopologyRunnerMixin._entity_request_label(Either(right=MockTable(name="x", columns=[])), stage)
        self.assertEqual(label, "x")

        # 2. None entity_request → fallback
        label = TopologyRunnerMixin._entity_request_label(None, stage)
        self.assertIn("yield_tables", label)

        # 3. Right side is None → fallback
        label = TopologyRunnerMixin._entity_request_label(Either(right=None, left=None), stage)
        self.assertIn("yield_tables", label)

        # 4. Right side has no .name attr → fallback (does not raise)
        class _NoName:
            pass

        label = TopologyRunnerMixin._entity_request_label(Either(right=_NoName()), stage)
        self.assertIn("yield_tables", label)

    def test_init_hash_dict(self):
        """We get the right cache dict"""

        local_source = MockSource()

        # clear cache before test
        local_source.cache.clear()

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

        with patch.object(OpenMetadata, "list_all_entities", return_value=mock_list_all_entities):
            local_source.metadata = OpenMetadata

            local_source.get_fqn_source_hash_dict(parent_type=MockSchema, child_type=MockTable, entity_fqn="fqn")

        self.assertEqual(
            dict(local_source.cache),
            {
                MockTable: {
                    "schema1.table1": "c238b14e87fe6d54e35dbca4a97e1e83",
                    "schema1.table2": "acd38ff1a662adc0c88225f2666ff423",
                }
            },
        )
