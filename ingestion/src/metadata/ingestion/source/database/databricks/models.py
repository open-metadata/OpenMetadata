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
Databricks source models.

Pydantic shapes for the ``DESCRIBE TABLE EXTENDED ... AS JSON`` payload
(Databricks Runtime 16.2+).
"""

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel


class DescribeJsonType(BaseModel):
    """A type node from the AS JSON payload.

    Polymorphic on ``name``: ``struct`` populates ``fields``, ``array``
    populates ``element_type``, ``map`` populates ``key_type``/``value_type``,
    ``decimal``/``varchar``/``char`` populate ``precision``/``scale``/``length``.
    """

    name: Optional[str] = None  # noqa: UP045
    fields: Optional[List["DescribeJsonField"]] = None  # noqa: UP006, UP045
    element_type: Optional["DescribeJsonType"] = None
    key_type: Optional["DescribeJsonType"] = None
    value_type: Optional["DescribeJsonType"] = None
    precision: Optional[int] = None  # noqa: UP045
    scale: Optional[int] = None  # noqa: UP045
    length: Optional[int] = None  # noqa: UP045


class DescribeJsonField(BaseModel):
    """A struct field, with optional ``COMMENT '...'``."""

    name: Optional[str] = None  # noqa: UP045
    type: Optional[DescribeJsonType] = None  # noqa: UP045
    comment: Optional[str] = None  # noqa: UP045


class DescribeJsonColumn(BaseModel):
    """A top-level column from the AS JSON payload."""

    name: Optional[str] = None  # noqa: UP045
    type: Optional[DescribeJsonType] = None  # noqa: UP045
    comment: Optional[str] = None  # noqa: UP045


class DescribeJsonPayload(BaseModel):
    """The full ``DESCRIBE TABLE EXTENDED ... AS JSON`` payload (Databricks
    Runtime 16.2+). Unmodeled keys are ignored; an older runtime that does not
    support ``AS JSON`` makes the query error out and callers fall back to the
    legacy per-statement ``DESCRIBE`` path."""

    columns: List[DescribeJsonColumn] = []  # noqa: UP006
    type: Optional[str] = None  # noqa: UP045
    comment: Optional[str] = None  # noqa: UP045
    owner: Optional[str] = None  # noqa: UP045
    location: Optional[str] = None  # noqa: UP045
    view_text: Optional[str] = None  # noqa: UP045
    view_original_text: Optional[str] = None  # noqa: UP045


# Resolve forward references in ``DescribeJsonType``.
DescribeJsonType.model_rebuild()


# Output of the JSON walker, keyed by top-level column name.
NestedFieldPath = tuple[str, ...]
NestedDescriptions = dict[NestedFieldPath, str]
ColumnDescriptions = dict[str, NestedDescriptions]
