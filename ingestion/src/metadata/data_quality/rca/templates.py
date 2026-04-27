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
Diagnostic hint templates keyed by OpenMetadata test-type short names.

These are injected into the LLM prompt to make the generated explanation
more targeted without requiring the model to have product-specific knowledge.
"""

SIGNAL_HINTS = {
    "columnValuesToBeNotNull": (
        "Null/missing values detected. Likely causes: upstream "
        "ETL producing nulls, optional field becoming required, "
        "JOIN producing nulls from unmatched rows."
    ),
    "columnValuesToBeUnique": (
        "Duplicate values detected. Likely causes: deduplication "
        "step missing, fan-out JOIN creating duplicates, "
        "incremental load inserting existing keys."
    ),
    "columnValuesToMatchRegex": (
        "Format mismatch. Likely causes: source system format "
        "change, encoding issue, schema migration, mixed formats "
        "from multiple sources."
    ),
    "columnValuesToNotMatchRegex": (
        "Unexpected format pattern found. Likely causes: injection "
        "of raw/unformatted values, encoding change, or upstream "
        "input validation removed."
    ),
    "columnValuesToBeInSet": (
        "Unexpected values found. Likely causes: new enum value "
        "added at source, data from uncatalogued source, "
        "case sensitivity mismatch."
    ),
    "columnValuesToBeNotInSet": (
        "Disallowed values found. Likely causes: business rule "
        "violated, incorrect classification applied, stale allow-list."
    ),
    "columnValueLengthsToBeBetween": (
        "String length out of expected bounds. Likely causes: "
        "truncation at source, unexpectedly long values from "
        "free-text input, encoding expansion."
    ),
    "columnValuesToBeBetween": (
        "Numeric values outside expected range. Likely causes: "
        "unit change, overflow/underflow, sign error, wrong "
        "column mapped in transformation."
    ),
    "tableRowCountToBeBetween": (
        "Row count anomaly. Likely causes: upstream pipeline "
        "failure, partial load, duplicate ingestion run, "
        "upstream filter change."
    ),
    "tableRowCountToEqual": (
        "Exact row count mismatch. Likely causes: partial load, "
        "records deleted upstream, deduplication step applied."
    ),
    "tableColumnCountToBeBetween": (
        "Unexpected number of columns. Likely causes: schema "
        "migration added/dropped columns, wrong source table "
        "selected."
    ),
    "tableCustomSQLQuery": (
        "Custom SQL assertion failed. Likely causes: business "
        "rule violated, referential integrity break, unexpected "
        "data state."
    ),
    "columnReferentialIntegrity": (
        "Referential integrity broken. Likely causes: orphaned "
        "records, delete cascade not applied, out-of-order "
        "data loading."
    ),
    "tableDiff": (
        "Table content differs from expected snapshot. Likely "
        "causes: unexpected DML, pipeline re-run without "
        "idempotency, data backfill."
    ),
}

DEFAULT_HINT = (
    "Data quality check failed. Analyze the failing samples "
    "and check for upstream pipeline changes, schema drift, "
    "or data source anomalies."
)


def get_hint(test_type: str) -> str:
    """Return a diagnostic hint string for the given test type.

    Falls back to DEFAULT_HINT when the type is unknown or empty.
    """
    return SIGNAL_HINTS.get(test_type or "", DEFAULT_HINT)
