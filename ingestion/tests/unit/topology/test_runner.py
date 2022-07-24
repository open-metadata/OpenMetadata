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
from unittest import TestCase

from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyNode,
    create_source_context,
)


class MockTopology(ServiceTopology):
    root = TopologyNode(
        producer="get_numbers",
        stages=[
            NodeStage(
                type_=int,
                context="numbers",
                processor="yield_numbers",
                ack_sink=False,
            )
        ],
        children=["strings"],
    )
    strings = TopologyNode(
        producer="get_strings",
        stages=[
            NodeStage(
                type_=str,
                context="strings",
                processor="yield_strings",
                ack_sink=False,
                consumer=["numbers"],
            )
        ],
    )


class MockSource(TopologyRunnerMixin):
    topology = MockTopology()
    context = create_source_context(topology)

    @staticmethod
    def get_numbers():
        yield 1
        yield 2

    @staticmethod
    def get_strings():
        yield "abc"
        yield "def"

    @staticmethod
    def yield_numbers(number: int):
        yield number + 1

    def yield_strings(self, my_str: str):
        yield my_str + str(self.context.numbers)


class TopologyRunnerTest(TestCase):
    """
    Validate filter patterns
    """

    def test_node_and_stage(self):
        source = MockSource()
        processed = list(source.next_record())
        assert processed == [2, "abc2", "def2", 3, "abc3", "def3"]
