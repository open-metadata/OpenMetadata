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
"""Strict lineage reads and full-FQN, direction-sensitive checks."""

from typing import Any

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.utils import get_entity_type, model_str, quote
from metadata.utils.fqn import split

from ...runtime.expect import Query


def lineage_query(om, fqn: str) -> Query[dict[str, Any] | None]:
    endpoint = (
        f"{om.get_suffix(AddLineageRequest)}/{get_entity_type(Table)}"
        f"/name/{quote(model_str(fqn))}?upstreamDepth=1&downstreamDepth=1"
    )

    def read():
        try:
            return om.client.get(endpoint)
        except APIError as error:
            if error.code == 404:
                return None
            raise

    return Query(f"lineage for {model_str(fqn)}", read)


def _edges(graph):
    assert graph is not None, "lineage missing"
    central = graph["entity"]
    nodes = {node["id"]: node["fullyQualifiedName"] for node in [central, *(graph.get("nodes") or [])]}
    for direction, self_field in (("upstream", "toEntity"), ("downstream", "fromEntity")):
        for edge in graph.get(f"{direction}Edges") or []:
            if edge.get(self_field) == central["id"]:
                yield nodes[edge["fromEntity"]], nodes[edge["toEntity"]], edge


def lineage_has_edge(source: str, target: str):
    if any(len(split(name)) != 4 for name in (source, target)):
        raise ValueError("table lineage requires full FQNs")

    def check(graph):
        actual = {(start, end) for start, end, _ in _edges(graph)}
        assert (source, target) in actual, f"lineage {source} -> {target} missing; actual={sorted(actual)}"

    return check


def lineage_has_columns(source_columns: tuple[str, ...], target_columns: tuple[str, ...]):
    if not source_columns or len(source_columns) != len(target_columns):
        raise ValueError("column lineage requires equal, nonempty column lists")
    if any(len(split(name)) < 5 for name in (*source_columns, *target_columns)):
        raise ValueError("column lineage requires full FQNs")
    wanted = set(zip(source_columns, target_columns, strict=True))

    def check(graph):
        actual = set()
        for start, end, edge in _edges(graph):
            for column_edge in (edge.get("lineageDetails") or {}).get("columnsLineage") or []:
                target = column_edge.get("toColumn") or ""
                for source in column_edge.get("fromColumns") or []:
                    if source.startswith(f"{start}.") and target.startswith(f"{end}."):
                        actual.add((source, target))
        assert wanted <= actual, f"column lineage missing {sorted(wanted - actual)}; actual={sorted(actual)}"

    return check
