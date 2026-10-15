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
Limits on the column children inferred from sampled JSON values.

The limits are applied while samples are merged, so a node never holds more than
`maxChildrenPerColumn` keys and nothing below `maxSchemaInferenceDepth` is explored.
Declared schemas (JSON Schema files, Avro, Parquet, Iceberg or Delta metadata) do not
go through this module.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any

from metadata.utils.logger import utils_logger

logger = utils_logger()


class InferenceLimit(Enum):
    """A limit that cut a node's children, valued with its pipeline config field."""

    DEPTH = "maxSchemaInferenceDepth"
    CHILDREN = "maxChildrenPerColumn"


class InferredStruct(dict):
    """Merged shape of the JSON objects sampled at one node.

    `cut_by` travels with the node through later merges and is dropped with it when
    the node itself is evicted, so only nodes that reach the built columns are reported.
    """

    cut_by: InferenceLimit | None = None


@dataclass(frozen=True)
class InferenceLimits:
    """Depth and per-column child limits. None means no limit."""

    max_depth: int | None = None
    max_children: int | None = None

    @classmethod
    def from_source_config(cls, source_config: Any) -> "InferenceLimits":
        return cls(
            max_depth=_int_or_none(getattr(source_config, InferenceLimit.DEPTH.value, None)),
            max_children=_int_or_none(getattr(source_config, InferenceLimit.CHILDREN.value, None)),
        )

    def value_of(self, limit: InferenceLimit) -> int | None:
        return self.max_depth if limit == InferenceLimit.DEPTH else self.max_children

    def allows_children(self, depth: int) -> bool:
        """Whether a node `depth` levels below its top-level column may hold children."""
        return self.max_depth is None or depth < self.max_depth

    def admit(self, node: InferredStruct, key: Any) -> bool:
        """Make room for `key` in `node` while it keeps at most `max_children` keys.

        The smallest key names are kept whatever order they arrive in, so the kept set
        does not depend on which records were sampled. A key that sorts before the largest
        kept one evicts it. Once evicted or refused, a key can never come back, because
        the largest kept name only decreases. Returns False when `key` must be dropped.
        """
        if self.max_children is None or key in node or len(node) < self.max_children:
            return True
        node.cut_by = InferenceLimit.CHILDREN
        if not node:
            return False
        largest = max(node, key=str)
        if str(key) >= str(largest):
            return False
        del node[largest]
        return True


NO_LIMITS = InferenceLimits()


class InferenceReport:
    """Column paths whose inferred children a limit cut, rendered as one warning per asset.

    Paths are recorded while columns are built, once per surviving node, so the set is
    never larger than the bounded column tree itself. Only names are kept, never values.
    """

    MAX_LISTED_PATHS = 10

    def __init__(self) -> None:
        self._cut_paths: dict[InferenceLimit, set[str]] = {limit: set() for limit in InferenceLimit}

    def record(self, node: Any, path: str) -> None:
        cut_by = getattr(node, "cut_by", None)
        if cut_by is not None:
            self._cut_paths[cut_by].add(path)

    def is_cut(self, path: str) -> bool:
        return any(path in paths for paths in self._cut_paths.values())

    def warning(self, limits: InferenceLimits) -> str | None:
        parts = []
        for limit, paths in self._cut_paths.items():
            if not paths:
                continue
            ordered = sorted(paths)
            listed = ", ".join(ordered[: self.MAX_LISTED_PATHS])
            if len(ordered) > self.MAX_LISTED_PATHS:
                listed += f" and {len(ordered) - self.MAX_LISTED_PATHS} more"
            parts.append(
                f"{limit.value}={limits.value_of(limit)} cut the children of {len(ordered)} column(s): {listed}."
            )
        if not parts:
            return None
        return " ".join(["Schema inference limits dropped nested columns.", *parts])

    def emit(self, status: Any, asset: str, limits: InferenceLimits) -> None:
        """Log the warning and add it to the workflow status under `asset`."""
        if message := self.warning(limits):
            logger.warning("[%s] %s", asset, message)
            status.warning(asset, message)


def _int_or_none(value: Any) -> int | None:
    """Unwrap the generated RootModel config values."""
    value = getattr(value, "root", value)
    return value if isinstance(value, int) else None
