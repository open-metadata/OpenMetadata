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
End-to-end integration tests for the Tableau Pipeline connector.

These exercise the full source surface the topology runner invokes:
- get_pipelines_list → yield_pipeline → yield_tag → yield_pipeline_status
  → yield_pipeline_lineage_details
Using a fake TSC-backed client with realistic data shapes.
"""

from unittest.mock import MagicMock
from uuid import uuid4

from metadata.generated.schema.entity.data.pipeline import PipelineStatus
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList

from ._fixtures import FLOW_MARKETING, FLOW_SALES


def _set_metadata_entity(source, entity, reference=None):
    """Wire source.metadata mock so get_by_name returns `entity` and
    get_reference_by_email returns `reference`."""
    source.metadata.get_by_name.return_value = entity
    source.metadata.search_in_any_service.return_value = entity
    if reference is not None:
        source.metadata.get_reference_by_email.return_value = reference


def _mock_entity(uuid):
    entity = MagicMock()
    entity.id = Uuid(root=uuid)
    return entity


class TestIngestionFlow:
    def test_pipeline_list_includes_sales_and_marketing(self, tableau_source):
        source, _ = tableau_source
        names = [p.name for p in source.get_pipelines_list()]
        assert names == ["flow-sales", "flow-marketing"]

    def test_yield_pipeline_sales_has_full_node_dag(self, tableau_source):
        source, _ = tableau_source
        reference = EntityReferenceList(root=[EntityReference(id=uuid4(), type="user")])
        _set_metadata_entity(source, None, reference=reference)
        results = list(source.yield_pipeline(FLOW_SALES))
        assert len(results) == 1, f"Expected 1 request, got {results}"
        request = results[0].right
        assert request is not None, f"Expected right, got left: {results[0].left}"
        assert request.name.root == "flow-sales"
        assert request.displayName == "Sales Prep Flow"

        task_types = [t.taskType for t in request.tasks]
        assert task_types.count("FlowInput") == 2
        assert task_types.count("FlowOutputStep") == 1
        assert task_types.count("FlowProcessing") == 1

        assert request.owners is not None
        # Note: request.tags is None until yield_tag has created the
        # classification in OpenMetadata — that flow is covered by the
        # yield_tag tests below.

    def test_yield_pipeline_marketing_without_owner_or_tags(self, tableau_source):
        source, _ = tableau_source
        results = list(source.yield_pipeline(FLOW_MARKETING))
        request = results[0].right
        assert request.owners is None
        assert request.tags is None

    def test_yield_tag_emits_classification_only_when_tags_exist(self, tableau_source):
        source, _ = tableau_source
        sales_tags = list(source.yield_tag(FLOW_SALES))
        marketing_tags = list(source.yield_tag(FLOW_MARKETING))
        assert len(sales_tags) > 0
        assert marketing_tags == []


class TestPipelineStatus:
    def test_status_per_task_for_multi_node_flow(self, tableau_source):
        source, _ = tableau_source
        source.context.get().__dict__["pipeline"] = FLOW_SALES.name
        source._get_tasks(FLOW_SALES)

        results = list(source.yield_pipeline_status(FLOW_SALES))
        assert all(r.left is None for r in results)
        assert len(results) == 2

        first: PipelineStatus = results[0].right.pipeline_status
        task_names = [ts.name for ts in first.taskStatus]
        assert any(n.startswith("input_") for n in task_names)
        assert "flow-sales" in task_names
        assert any(n.startswith("output_") for n in task_names)
        assert first.executionStatus.value in ("Successful", "Failed")

    def test_empty_runs_yields_nothing(self, tableau_source):
        source, _ = tableau_source
        source.context.get().__dict__["pipeline"] = FLOW_MARKETING.name
        results = list(source.yield_pipeline_status(FLOW_MARKETING))
        assert results == []


class TestLineage:
    def test_upstream_tables_emit_lineage_edges(self, tableau_source):
        source, _ = tableau_source
        table_uuid, pipeline_uuid = uuid4(), uuid4()
        table_entity = _mock_entity(table_uuid)
        pipeline_entity = _mock_entity(pipeline_uuid)
        source.metadata.get_by_name.return_value = pipeline_entity
        source.metadata.search_in_any_service.return_value = table_entity

        results = list(source.yield_pipeline_lineage_details(FLOW_SALES))
        rights = [r.right for r in results if r.right is not None]
        assert len(rights) >= 2

        types = {(r.edge.fromEntity.type, r.edge.toEntity.type) for r in rights}
        assert ("table", "pipeline") in types

    def test_downstream_flow_edge(self, tableau_source):
        source, _ = tableau_source
        pipeline_uuid, downstream_uuid = uuid4(), uuid4()
        this_entity = _mock_entity(pipeline_uuid)
        downstream_entity = _mock_entity(downstream_uuid)

        call_count = {"n": 0}

        def get_by_name(**kwargs):
            call_count["n"] += 1
            return this_entity if call_count["n"] == 1 else downstream_entity

        source.metadata.get_by_name.side_effect = get_by_name
        source.metadata.search_in_any_service.return_value = None

        results = list(source.yield_pipeline_lineage_details(FLOW_SALES))
        rights = [r.right for r in results if r.right is not None]
        flow_to_flow = [
            r
            for r in rights
            if r.edge.fromEntity.type == "pipeline"
            and r.edge.toEntity.type == "pipeline"
        ]
        assert len(flow_to_flow) == 1
        assert str(flow_to_flow[0].edge.toEntity.id.root) == str(downstream_uuid)

    def test_downstream_datasource_edge(self, tableau_source):
        source, _ = tableau_source
        pipeline_uuid, dm_uuid = uuid4(), uuid4()
        this_entity = _mock_entity(pipeline_uuid)
        dm_entity = _mock_entity(dm_uuid)
        source.metadata.get_by_name.return_value = this_entity
        source.metadata.es_search_from_fqn.return_value = [dm_entity]

        results = list(source.yield_pipeline_lineage_details(FLOW_SALES))
        rights = [r.right for r in results if r.right is not None]
        datamodel_edges = [
            r for r in rights if r.edge.toEntity.type == "dashboardDataModel"
        ]
        assert len(datamodel_edges) == 1

    def test_custom_sql_on_marketing_flow(self, tableau_source):
        source, _ = tableau_source
        table_uuid, pipeline_uuid = uuid4(), uuid4()
        this_entity = _mock_entity(pipeline_uuid)
        table_entity = _mock_entity(table_uuid)
        source.metadata.get_by_name.return_value = this_entity
        source.metadata.search_in_any_service.return_value = table_entity

        results = list(source.yield_pipeline_lineage_details(FLOW_MARKETING))
        rights = [r.right for r in results if r.right is not None]
        assert len(rights) >= 1
        assert rights[0].edge.fromEntity.type == "table"
