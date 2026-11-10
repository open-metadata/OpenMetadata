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
Neptune property graph schema: models, parsing of neptune.graph.pg_schema() output
and the schema computation lifecycle.
"""

from __future__ import annotations

import time
from collections.abc import Callable, Mapping
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict

from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.ingestion.source.database.neptune.queries import (
    NEPTUNE_PG_SCHEMA,
    NEPTUNE_PG_SCHEMA_COMPUTE,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

DEFAULT_POLL_INTERVAL_SECONDS = 5.0
MAX_POLL_INTERVAL_SECONDS = 30.0

# Lifecycle states of schema.status.state documented for neptune.graph.pg_schema()
_STATE_NOT_STARTED = "NotStarted"
_STATE_IN_PROGRESS = "InProgress"
_STATE_COMPLETED = "Completed"
_STATE_FAILED = "Failed"
# Interrupted computations keep partial results and only resume through compute()
_RESUMABLE_STATES = frozenset({"Stopped", "Paused"})


class NeptuneSchemaError(Exception):
    """The property graph schema could not be obtained."""


class NeptuneSchemaMissingError(NeptuneSchemaError):
    """No schema is computed and computing one was not allowed."""


class NeptuneSchemaFailedError(NeptuneSchemaError):
    """Neptune reported the schema computation as failed."""


class NeptuneSchemaTimeoutError(NeptuneSchemaError):
    """The schema computation did not finish within the configured timeout."""


class SchemaState(Enum):
    READY = "ready"
    IN_PROGRESS = "in_progress"
    MISSING = "missing"
    INTERRUPTED = "interrupted"


class PropertySpec(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    types: tuple[str, ...]


class GraphElementSpec(BaseModel):
    """A node label or edge label with its properties, and for edges the (from, to) label pairs"""

    model_config = ConfigDict(frozen=True)

    name: str
    properties: tuple[PropertySpec, ...]
    endpoints: tuple[tuple[str, str], ...] = ()


class GraphSchema(BaseModel):
    model_config = ConfigDict(frozen=True)

    nodes: tuple[GraphElementSpec, ...]
    edges: tuple[GraphElementSpec, ...]


_SCALAR_TYPES: dict[str, DataType] = {
    "String": DataType.STRING,
    "Bool": DataType.BOOLEAN,
    "Boolean": DataType.BOOLEAN,
    "Byte": DataType.TINYINT,
    "Short": DataType.SMALLINT,
    "Int": DataType.INT,
    "Integer": DataType.INT,
    "Long": DataType.BIGINT,
    "Float": DataType.FLOAT,
    "Double": DataType.DOUBLE,
    "Date": DataType.TIMESTAMP,
    "DateTime": DataType.TIMESTAMP,
}


def map_property_type(neptune_types: list[str] | tuple[str, ...]) -> DataType:
    """A property can hold several types across elements; anything but one known type is UNKNOWN."""
    types = set(neptune_types)
    if len(types) != 1:
        return DataType.UNKNOWN
    return _SCALAR_TYPES.get(next(iter(types)), DataType.UNKNOWN)


def property_to_column(prop: PropertySpec) -> Column:
    return Column(
        name=ColumnName(prop.name),
        dataType=map_property_type(prop.types),
        dataTypeDisplay=" | ".join(prop.types) or None,
    )


def unwrap_payload(rows: list[Mapping[str, Any]]) -> Mapping[str, Any] | None:
    """The pg_schema map, whether returned as a ``schema`` column or as the row itself."""
    if not rows:
        return None
    row = rows[0]
    payload = row.get("schema", row)
    return payload if isinstance(payload, Mapping) else None


def classify(payload: Mapping[str, Any] | None) -> SchemaState:
    """Where the computation stands, from the ``status.state`` of a pg_schema() payload.

    Raises NeptuneSchemaFailedError for a failed computation and NeptuneSchemaError
    for a missing payload or an unrecognized state.
    """
    if not payload:
        raise NeptuneSchemaError("Neptune returned no rows for neptune.graph.pg_schema().")
    status = payload.get("status") or {}
    state = status.get("state")
    if state == _STATE_FAILED:
        raise NeptuneSchemaFailedError(
            f"Neptune reported the schema computation as Failed: {status.get('errorMessage') or 'no error message'}"
        )
    if state == _STATE_COMPLETED:
        return SchemaState.READY
    if state == _STATE_IN_PROGRESS:
        return SchemaState.IN_PROGRESS
    if state in _RESUMABLE_STATES:
        return SchemaState.INTERRUPTED
    if state == _STATE_NOT_STARTED:
        return SchemaState.MISSING
    raise NeptuneSchemaError(f"Neptune returned an unrecognized schema state: {state!r}")


def _elements(
    labels: list[str], details: Mapping[str, Any], endpoints: Mapping[str, set[tuple[str, str]]]
) -> tuple[GraphElementSpec, ...]:
    names = sorted(set(labels) | set(details))
    return tuple(
        GraphElementSpec(
            name=name,
            properties=tuple(
                PropertySpec(name=prop, types=tuple(sorted(datatypes or ())))
                for prop, datatypes in sorted(((details.get(name) or {}).get("properties") or {}).items())
            ),
            endpoints=tuple(sorted(endpoints.get(name, ()))),
        )
        for name in names
    )


def parse_schema(payload: Mapping[str, Any]) -> GraphSchema:
    """Build the graph schema from a ready pg_schema() payload.

    Raises NeptuneSchemaError for an empty schema rather than reporting an empty graph.
    """
    triples: dict[str, set[tuple[str, str]]] = {}
    for triple in payload.get("labelTriples") or ():
        edge, source, target = triple.get("~type"), triple.get("~from"), triple.get("~to")
        if edge and source and target:
            triples.setdefault(edge, set()).add((source, target))
    nodes = _elements(list(payload.get("nodeLabels") or ()), payload.get("nodeLabelDetails") or {}, {})
    edges = _elements(list(payload.get("edgeLabels") or ()), payload.get("edgeLabelDetails") or {}, triples)
    if not nodes and not edges:
        raise NeptuneSchemaError(
            "Neptune returned a property graph schema without any node or edge labels; "
            "the graph is empty or the schema is stale. Refusing to ingest an empty schema."
        )
    return GraphSchema(nodes=nodes, edges=edges)


class SchemaReader:
    """Reads the property graph schema, computing it when absent and allowed.

    ``run`` executes an openCypher statement and returns its rows.
    """

    def __init__(
        self,
        run: Callable[[str], list[Mapping[str, Any]]],
        compute_if_missing: bool,
        timeout_seconds: float,
        poll_interval: float = DEFAULT_POLL_INTERVAL_SECONDS,
        sleep: Callable[[float], None] | None = None,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._run = run
        self._compute_if_missing = compute_if_missing
        self._timeout = timeout_seconds
        self._poll_interval = poll_interval
        self._sleep = sleep or time.sleep
        self._clock = clock or time.monotonic

    def read_state(self) -> tuple[SchemaState, Mapping[str, Any] | None]:
        payload = unwrap_payload(self._run(NEPTUNE_PG_SCHEMA))
        return classify(payload), payload

    def read(self) -> GraphSchema:
        state, payload = self.read_state()
        if state in (SchemaState.MISSING, SchemaState.INTERRUPTED):
            if not self._compute_if_missing:
                reason = (
                    "its computation was interrupted" if state is SchemaState.INTERRUPTED else "it was never computed"
                )
                raise NeptuneSchemaMissingError(
                    f"Neptune has no complete property graph schema ({reason}) and computeSchemaIfMissing is "
                    "disabled. Run `CALL neptune.graph.pg_schema.compute()` on the writer instance "
                    "or enable computeSchemaIfMissing."
                )
            self._start_compute()
            payload = self._wait()
        elif state is SchemaState.IN_PROGRESS:
            payload = self._wait()
        return parse_schema(payload or {})

    def _start_compute(self) -> None:
        logger.info("Starting Neptune property graph schema computation")
        try:
            self._run(NEPTUNE_PG_SCHEMA_COMPUTE)
        except Exception:
            # Neptune rejects compute() while one is running; another client may have won the race.
            state, _ = self.read_state()
            if state is not SchemaState.IN_PROGRESS:
                raise

    def _wait(self) -> Mapping[str, Any] | None:
        deadline = self._clock() + self._timeout
        interval = self._poll_interval
        while True:
            if self._clock() >= deadline:
                raise NeptuneSchemaTimeoutError(
                    f"Neptune did not finish computing the property graph schema within {self._timeout:g} seconds; "
                    "increase schemaComputeTimeoutSeconds or retry once the computation completes."
                )
            self._sleep(min(interval, max(deadline - self._clock(), 0)))
            interval = min(interval * 2, MAX_POLL_INTERVAL_SECONDS)
            state, payload = self.read_state()
            if state is SchemaState.READY:
                return payload
            if state is SchemaState.INTERRUPTED:
                raise NeptuneSchemaError(
                    "The Neptune schema computation was stopped or paused before completing; "
                    "run `CALL neptune.graph.pg_schema.compute()` to resume it."
                )
