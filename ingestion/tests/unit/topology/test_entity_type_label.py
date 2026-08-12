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
"""The progress label for a node is its primary entity type, not a side-output."""

from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.source.database.database_service import DatabaseServiceTopology


class TestEntityTypeLabel:
    def test_table_node_is_labelled_table_not_tag_stage(self):
        runner = TopologyRunnerMixin()
        topology = DatabaseServiceTopology()

        assert runner._get_entity_type_for_node(topology.table) == "Table"

    def test_schema_node_is_labelled_database_schema(self):
        runner = TopologyRunnerMixin()
        topology = DatabaseServiceTopology()

        assert runner._get_entity_type_for_node(topology.databaseSchema) == "DatabaseSchema"

    def test_stored_procedure_node_unchanged(self):
        runner = TopologyRunnerMixin()
        topology = DatabaseServiceTopology()

        assert runner._get_entity_type_for_node(topology.stored_procedure) == "StoredProcedure"
