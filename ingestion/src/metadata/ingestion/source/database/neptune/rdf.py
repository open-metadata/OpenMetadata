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
"""Read-only, bounded RDF schema discovery for Amazon Neptune."""

from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.type.basic import Markdown

RDF_CLASSES_SCHEMA = "classes"
RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
XSD = "http://www.w3.org/2001/XMLSchema#"
RDF_LANG_STRING = "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"
SPARQL_HINTS = "http://aws.amazon.com/neptune/vocab/v01/QueryHints#"

DEFAULT_MAX_CLASSES = 100
DEFAULT_MAX_PREDICATES_PER_CLASS = 100
DEFAULT_SAMPLE_SIZE = 1000
DEFAULT_QUERY_TIMEOUT_SECONDS = 30

_NAME_RE = re.compile(r"[^a-zA-Z0-9_]+")
_IRI_SAFE = ":/?#[]@!$&'()*+,;=%-._~"


class NeptuneRDFSchemaError(Exception):
    """Neptune could not provide a usable RDF schema."""


class NeptuneRDFStatisticsUnavailableError(NeptuneRDFSchemaError):
    """Neptune has no DFE statistics from which to return an RDF summary."""


@dataclass(frozen=True)
class RDFGraphSummary:
    classes: tuple[str, ...]
    num_quads: int


@dataclass(frozen=True)
class RDFPropertySpec:
    iri: str
    name: str
    types: tuple[str, ...]
    target_classes: tuple[str, ...]


@dataclass(frozen=True)
class RDFClassSpec:
    iri: str
    name: str
    properties: tuple[RDFPropertySpec, ...]
    predicates_truncated: bool = False


@dataclass(frozen=True)
class RDFGraphSchema:
    classes: tuple[RDFClassSpec, ...]
    total_classes: int
    classes_truncated: bool


def parse_graph_summary(response: Mapping[str, Any]) -> RDFGraphSummary:
    """Validate the documented get_rdf_graph_summary response shape."""
    payload = response.get("payload")
    graph_summary = payload.get("graphSummary") if isinstance(payload, Mapping) else None
    if not isinstance(graph_summary, Mapping):
        raise NeptuneRDFSchemaError("Neptune returned no RDF graph summary.")

    classes = graph_summary.get("classes")
    if not isinstance(classes, list) or any(not isinstance(iri, str) or not iri for iri in classes):
        raise NeptuneRDFSchemaError("Neptune returned an invalid RDF class list in its graph summary.")

    num_quads = graph_summary.get("numQuads")
    if not isinstance(num_quads, int) or num_quads < 0:
        raise NeptuneRDFSchemaError("Neptune returned an invalid numQuads value in its RDF graph summary.")
    if num_quads and not classes:
        raise NeptuneRDFSchemaError(
            "Neptune reports RDF quads but no classes. The connector needs rdf:type classes "
            "to map the graph into tables."
        )

    return RDFGraphSummary(classes=tuple(sorted(set(classes))), num_quads=num_quads)


def get_graph_summary(client: Any) -> Mapping[str, Any]:
    """Fetch the RDF summary and translate Neptune's unavailable-statistics error."""
    try:
        response = client.get_rdf_graph_summary(mode="basic")
    except Exception as exc:
        error_response = getattr(exc, "response", None)
        error = error_response.get("Error") if isinstance(error_response, Mapping) else None
        error_code = error.get("Code") if isinstance(error, Mapping) else None
        if error_code == "StatisticsNotAvailableException":
            raise NeptuneRDFStatisticsUnavailableError(
                "Neptune RDF graph statistics are unavailable. Graph summary requires engine 1.2.1.0 or later "
                "and DFE statistics; statistics are disabled on db.t3.medium and db.t4g.medium instances. "
                "Wait for automatic statistics generation or use a supported instance. The connector does not "
                "trigger statistics recomputation."
            ) from exc
        raise
    if not isinstance(response, Mapping):
        raise NeptuneRDFSchemaError("Neptune returned an invalid RDF graph summary response.")
    return response


def sparql_iri_ref(iri: str) -> str:
    """Escape an endpoint-provided IRI for safe use in a SPARQL IRIREF."""
    return f"<{quote(iri, safe=_IRI_SAFE)}>"


def build_class_query(
    class_iri: str,
    sample_size: int,
    max_predicates: int,
    timeout_seconds: int,
) -> str:
    """Build a bounded query that samples subjects and returns observed value types."""
    if min(sample_size, max_predicates, timeout_seconds) < 1:
        raise ValueError("RDF sample, predicate, and timeout limits must be positive.")
    class_ref = sparql_iri_ref(class_iri)
    sample_subjects = f"{{ SELECT DISTINCT ?subject WHERE {{ ?subject rdf:type {class_ref} . }} LIMIT {sample_size} }}"
    return f"""PREFIX rdf: <{RDF_TYPE_IRI}>
PREFIX hint: <{SPARQL_HINTS}>
SELECT ?predicate ?valueType (SAMPLE(?linkedClass) AS ?targetClass) WHERE {{
  hint:Query hint:queryTimeout {timeout_seconds * 1000} .
  {{
    SELECT DISTINCT ?predicate WHERE {{
      {sample_subjects}
      ?subject ?predicate ?candidateValue .
      FILTER(?predicate != rdf:type)
    }}
    ORDER BY STR(?predicate)
    LIMIT {max_predicates + 1}
  }}
  {sample_subjects}
  ?subject ?predicate ?value .
  BIND(IF(isLiteral(?value), STR(DATATYPE(?value)), IF(isIRI(?value), "iri", "bnode")) AS ?valueType)
  OPTIONAL {{ ?value rdf:type ?linkedClass . }}
}}
GROUP BY ?predicate ?valueType
ORDER BY STR(?predicate) STR(?valueType)"""


def _binding_value(row: Mapping[str, Any], key: str) -> str | None:
    value = row.get(key)
    if value is None:
        return None
    if not isinstance(value, Mapping) or not isinstance(value.get("value"), str):
        raise NeptuneRDFSchemaError(f"Neptune returned an invalid SPARQL binding for {key}.")
    return value["value"]


def parse_class_properties(
    rows: list[Mapping[str, Any]],
    max_predicates: int,
) -> tuple[tuple[RDFPropertySpec, ...], bool]:
    """Group sampled SPARQL bindings into predicates and their observed value types."""
    observed: dict[str, tuple[set[str], set[str]]] = defaultdict(lambda: (set(), set()))
    for row in rows:
        predicate = _binding_value(row, "predicate")
        value_type = _binding_value(row, "valueType")
        target_class = _binding_value(row, "targetClass")
        if not predicate or not value_type:
            raise NeptuneRDFSchemaError("Neptune returned an SPARQL row without a predicate or value type.")
        types, targets = observed[predicate]
        types.add(value_type)
        if target_class:
            targets.add(target_class)

    sorted_iris = sorted(observed)
    truncated = len(sorted_iris) > max_predicates
    selected = sorted_iris[:max_predicates]
    names = iri_names(selected)
    return (
        tuple(
            RDFPropertySpec(
                iri=iri,
                name=names[iri],
                types=tuple(sorted(observed[iri][0])),
                target_classes=tuple(sorted(observed[iri][1])),
            )
            for iri in selected
        ),
        truncated,
    )


def iri_names(iris: list[str] | tuple[str, ...]) -> dict[str, str]:
    """Create IRI-stable names independent of other classes or predicates in a run."""
    suffix_length = 65
    max_base_length = 256 - suffix_length
    return {
        iri: f"{_base_name(iri)[:max_base_length].rstrip('_')}_{hashlib.sha256(iri.encode('utf-8')).hexdigest()}"
        for iri in set(iris)
    }


def _base_name(iri: str) -> str:
    local_name = re.split(r"[/#:]", iri)[-1]
    name = _NAME_RE.sub("_", local_name).strip("_").lower()
    if not name:
        name = "iri"
    if not name[0].isalpha() and name[0] != "_":
        name = f"iri_{name}"
    return name


def rdf_data_type(types: tuple[str, ...]) -> DataType:
    """Infer a type only when all sampled values agree on one supported RDF datatype."""
    if len(types) != 1:
        return DataType.UNKNOWN
    value_type = types[0]
    if value_type in {"iri", "bnode", f"{XSD}string", f"{XSD}anyURI", RDF_LANG_STRING}:
        return DataType.STRING
    return {
        f"{XSD}boolean": DataType.BOOLEAN,
        f"{XSD}byte": DataType.TINYINT,
        f"{XSD}short": DataType.SMALLINT,
        f"{XSD}int": DataType.INT,
        f"{XSD}long": DataType.BIGINT,
        f"{XSD}float": DataType.FLOAT,
        f"{XSD}double": DataType.DOUBLE,
        f"{XSD}decimal": DataType.DECIMAL,
        f"{XSD}date": DataType.DATE,
        f"{XSD}time": DataType.TIME,
        f"{XSD}dateTime": DataType.TIMESTAMP,
        f"{XSD}dateTimeStamp": DataType.TIMESTAMP,
    }.get(value_type, DataType.UNKNOWN)


def rdf_property_to_column(prop: RDFPropertySpec) -> Column:
    description = f"RDF predicate IRI: {prop.iri}"
    if prop.target_classes:
        description += "\nObserved linked RDF classes (sampled): " + ", ".join(prop.target_classes)
    return Column(
        name=ColumnName(prop.name),
        dataType=rdf_data_type(prop.types),
        dataTypeDisplay=" | ".join(prop.types) or None,
        description=Markdown(description),
    )


def read_graph_schema(
    client: Any,
    max_classes: int,
    max_predicates: int,
    sample_size: int,
    timeout_seconds: int,
) -> RDFGraphSchema:
    """Read the RDF summary, then sample each class with bounded SPARQL."""
    summary = parse_graph_summary(get_graph_summary(client))
    selected_classes = summary.classes[:max_classes]
    classes = []
    class_names = iri_names(selected_classes)
    for class_iri in selected_classes:
        query = build_class_query(class_iri, sample_size, max_predicates, timeout_seconds)
        rows = client.execute_sparql_query(query, timeout_seconds=timeout_seconds)
        if not isinstance(rows, list) or any(not isinstance(row, Mapping) for row in rows):
            raise NeptuneRDFSchemaError(f"Neptune returned invalid SPARQL results for RDF class {class_iri}.")
        properties, predicates_truncated = parse_class_properties(rows, max_predicates)
        classes.append(
            RDFClassSpec(
                iri=class_iri,
                name=class_names[class_iri],
                properties=properties,
                predicates_truncated=predicates_truncated,
            )
        )
    return RDFGraphSchema(
        classes=tuple(classes),
        total_classes=len(summary.classes),
        classes_truncated=len(summary.classes) > len(selected_classes),
    )
