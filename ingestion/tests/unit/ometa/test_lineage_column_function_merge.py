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
Merging column lineage onto an existing edge keeps each column line's ``function``.

The merge used to key column lines on (fromColumns, toColumn) only, so a ``function`` was
dropped whenever the edge already existed and never reached the server on a re-run.
"""

import pytest

from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.ingestion.ometa.mixins.lineage_mixin import OMetaLineageMixin

SRC = "svc.model.pub.col"
DST = "svc.model.emb.col"
OTHER_SRC = "svc.model.pub.other"
OTHER_DST = "svc.model.emb.other"


def line(from_column, to_column, function=None):
    return ColumnLineage(fromColumns=[from_column], toColumn=to_column, function=function)


def functions(merged):
    return {(*column["fromColumns"], column["toColumn"]): column.get("function") for column in merged}


@pytest.mark.parametrize(
    "stored, incoming, expected",
    [
        pytest.param(None, "f(x)", "f(x)", id="backfill-onto-function-less-line"),
        pytest.param("old(x)", "new(x)", "new(x)", id="incoming-function-wins"),
        pytest.param("old(x)", None, "old(x)", id="keep-stored-function-when-incoming-empty"),
        pytest.param(None, None, None, id="no-function-either-side"),
    ],
)
def test_merge_keeps_function(stored, incoming, expected):
    original = [line(SRC, DST, stored).model_dump()]

    merged = OMetaLineageMixin._merge_column_lineage(None, original, [line(SRC, DST, incoming)])

    assert functions(merged) == {(SRC, DST): expected}


def test_merge_unions_lines_and_keeps_each_function():
    original = [line(SRC, DST, "f(x)").model_dump()]

    merged = OMetaLineageMixin._merge_column_lineage(None, original, [line(OTHER_SRC, OTHER_DST, "g(y)")])

    assert functions(merged) == {(SRC, DST): "f(x)", (OTHER_SRC, OTHER_DST): "g(y)"}


def test_merge_returns_stored_lines_untouched_when_nothing_changes():
    original = [line(SRC, DST, "f(x)").model_dump()]

    merged = OMetaLineageMixin._merge_column_lineage(None, original, [line(SRC, DST)])

    assert merged is not None
    assert merged == original


AMOUNT = "svc.db.orders.amount"
TAX = "svc.db.orders.tax"
FLAG = "svc.db.orders.flag"
TOTAL = "svc.db.summary.total"


def test_merge_replaces_unlabelled_line_split_by_function():
    """An edge stored before a source labelled its inputs shows the labels after the next run."""
    original = [ColumnLineage(fromColumns=[AMOUNT, TAX, FLAG], toColumn=TOTAL).model_dump()]
    incoming = [
        ColumnLineage(fromColumns=[AMOUNT, TAX], toColumn=TOTAL, function="DIRECT/AGGREGATION"),
        ColumnLineage(fromColumns=[FLAG], toColumn=TOTAL, function="INDIRECT/FILTER"),
    ]

    merged = OMetaLineageMixin._merge_column_lineage(None, original, incoming)

    assert merged == [
        {"fromColumns": [AMOUNT, TAX], "toColumn": TOTAL, "function": "DIRECT/AGGREGATION"},
        {"fromColumns": [FLAG], "toColumn": TOTAL, "function": "INDIRECT/FILTER"},
    ]


@pytest.mark.parametrize(
    "incoming",
    [
        pytest.param(
            [ColumnLineage(fromColumns=[AMOUNT, TAX], toColumn=TOTAL, function="DIRECT/AGGREGATION")],
            id="a-stored-pair-not-covered",
        ),
        pytest.param(
            [
                ColumnLineage(fromColumns=[AMOUNT, TAX], toColumn=TOTAL, function="DIRECT/AGGREGATION"),
                ColumnLineage(fromColumns=[FLAG], toColumn=TOTAL),
            ],
            id="a-covering-line-has-no-function",
        ),
        pytest.param(
            [ColumnLineage(fromColumns=[AMOUNT, TAX, FLAG], toColumn=OTHER_DST, function="DIRECT")],
            id="covered-only-on-another-column",
        ),
    ],
)
def test_merge_keeps_unlabelled_line_unless_every_pair_is_labelled(incoming):
    stored = {"fromColumns": [AMOUNT, TAX, FLAG], "toColumn": TOTAL}
    original = [ColumnLineage(**stored).model_dump()]

    merged = OMetaLineageMixin._merge_column_lineage(None, original, incoming)

    assert merged[0] == stored


def test_merge_keeps_stored_labelled_line_covered_by_new_lines():
    original = [ColumnLineage(fromColumns=[AMOUNT, FLAG], toColumn=TOTAL, function="SUM").model_dump()]
    incoming = [
        ColumnLineage(fromColumns=[AMOUNT], toColumn=TOTAL, function="DIRECT/AGGREGATION"),
        ColumnLineage(fromColumns=[FLAG], toColumn=TOTAL, function="INDIRECT/FILTER"),
    ]

    merged = OMetaLineageMixin._merge_column_lineage(None, original, incoming)

    assert functions(merged)[(AMOUNT, FLAG, TOTAL)] == "SUM"
