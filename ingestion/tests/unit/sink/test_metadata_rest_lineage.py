#  Copyright 2026 Collate
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
write_lineage status-identifier tests.

The sink writes lineage with return_lineage=False, so add_lineage answers with the
minimal ``{"entity": ...}`` payload rebuilt from the request instead of the server
graph. Either.right must stay non-None even for producers that build id-only edge
references (dbt, pipeline sources, external tables): ReturnStep.run only counts a
record in scanned status when right is not None, and write_override_lineage only
patches the lineage-processed flag under the same condition.
"""

from unittest.mock import MagicMock

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.sink.metadata_rest import MetadataRestSink, MetadataRestSinkConfig

FROM_ID = "d311bdf2-c4a9-4be3-9937-3b26309759af"
TO_ID = "abea43f7-ccc2-4daf-9dfb-115549461244"
FROM_FQN = "svc.db.sch.source"


def make_sink(add_lineage_response):
    metadata = MagicMock()
    metadata.add_lineage.return_value = add_lineage_response
    return MetadataRestSink(config=MetadataRestSinkConfig(), metadata=metadata)


def lineage_request(with_fqn):
    from_entity = (
        EntityReference(id=FROM_ID, type="table", fullyQualifiedName=FROM_FQN)
        if with_fqn
        else EntityReference(id=FROM_ID, type="table")
    )
    return AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=from_entity,
            toEntity=EntityReference(id=TO_ID, type="table"),
            lineageDetails=LineageDetails(source=LineageSource.QueryLineage),
        )
    )


def entity_summary(fqn):
    """Mirror of the {"entity": ...} payload add_lineage builds via _entity_ref_summary
    when return_lineage=False."""
    return {"entity": {"fullyQualifiedName": fqn, "id": FROM_ID, "type": "table"}}


class TestWriteLineageStatusIdentifier:
    def test_returns_fqn_when_reference_carries_one(self):
        sink = make_sink(entity_summary(FROM_FQN))

        result = sink.write_lineage(lineage_request(with_fqn=True))

        assert result.right == FROM_FQN

    def test_falls_back_to_type_id_label_for_id_only_references(self):
        sink = make_sink(entity_summary(None))

        result = sink.write_lineage(lineage_request(with_fqn=False))

        assert result.right == f"table:{FROM_ID}"

    def test_skips_graph_fetch_via_return_lineage_flag(self):
        sink = make_sink(entity_summary(FROM_FQN))
        request = lineage_request(with_fqn=True)

        sink.write_lineage(request)

        sink.metadata.add_lineage.assert_called_once_with(request, check_patch=True, return_lineage=False)

    def test_propagates_error_as_left(self):
        sink = make_sink({"error": "boom"})

        result = sink.write_lineage(lineage_request(with_fqn=True))

        assert result.left is not None
        assert result.left.error == "boom"
        assert result.right is None
