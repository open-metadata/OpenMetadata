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
SignalBuilder — extracts structured diagnostic signals from a TestCaseResultResponse.

No LLM calls are made here.  This module is responsible only for translating the
rich result object into a flat, serialisable dict that the RCA agent prompt builder
can consume without knowing about generated schema types.
"""

from typing import Any, Dict, List, Optional

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class SignalBuilder:
    """
    Extracts diagnostic signals from a failed TestCaseResultResponse.

    Usage::

        signal = SignalBuilder.build(response)
        # → {"test_name": "...", "failed_rows": 42, ...}
    """

    @staticmethod
    def build(response: TestCaseResultResponse) -> Dict[str, Any]:
        """
        Build a flat signal dict from a TestCaseResultResponse.

        All field accesses are None-safe so that a missing sub-field can never
        cause an exception that propagates into the DQ pipeline.

        Returns a dict with the following keys:

        test_name             str   — test case name
        test_type             str   — short name from testDefinition (e.g. "columnValuesToBeNotNull")
        entity_link           str   — raw entityLink string (e.g. "<#E::table::db.schema.tbl>")
        result_message        str   — human-readable result text produced by the validator
        failed_rows           int|None
        passed_rows           int|None
        failed_pct            float|None
        parameters            dict  — {param_name: param_value, ...}
        sample_failing_values list  — up to 5 rows as [{col: val, ...}, ...]
        inspection_sql        str   — the SQL query that identified failing rows (may be "")
        dimension_failures    list  — names of dimensions whose testCaseStatus == "Failed"
        """
        test_case = response.testCase
        result = response.testCaseResult

        # ── test type from testDefinition ──────────────────────────────────────
        test_type = ""
        try:
            # testDefinition is an EntityReference; .name is the simple short name
            td = getattr(test_case, "testDefinition", None)
            if td is not None:
                test_type = str(getattr(td, "name", "") or "")
        except Exception:  # pylint: disable=broad-except
            pass

        # ── entityLink ─────────────────────────────────────────────────────────
        entity_link = ""
        try:
            el = getattr(test_case, "entityLink", None)
            if el is not None:
                entity_link = str(el) if not isinstance(el, str) else el
        except Exception:  # pylint: disable=broad-except
            pass

        # ── parameterValues → flat dict ────────────────────────────────────────
        parameters: Dict[str, Any] = {}
        try:
            param_values = getattr(test_case, "parameterValues", None) or []
            for pv in param_values:
                name = getattr(pv, "name", None)
                value = getattr(pv, "value", None)
                if name is not None:
                    parameters[str(name)] = value
        except Exception:  # pylint: disable=broad-except
            pass

        # ── failedRowsSample → list of row dicts ───────────────────────────────
        sample_failing_values = SignalBuilder._parse_sample_rows(
            response.failedRowsSample, max_rows=5
        )

        # ── dimensionResults → names of failed dimensions ─────────────────────
        dimension_failures: List[str] = []
        try:
            dim_results = getattr(result, "dimensionResults", None) or []
            for dr in dim_results:
                status = getattr(dr, "testCaseStatus", None)
                if status is not None and str(status) == "Failed":
                    dim_vals = getattr(dr, "dimensionValues", None) or []
                    for dv in dim_vals:
                        dv_name = getattr(dv, "name", None)
                        dv_val = getattr(dv, "value", None)
                        if dv_name and dv_val:
                            dimension_failures.append(f"{dv_name}={dv_val}")
        except Exception:  # pylint: disable=broad-except
            pass

        return {
            "test_name": str(getattr(test_case, "name", None) or "unknown"),
            "test_type": test_type,
            "entity_link": entity_link,
            "result_message": str(getattr(result, "result", None) or ""),
            "failed_rows": getattr(result, "failedRows", None),
            "passed_rows": getattr(result, "passedRows", None),
            "failed_pct": getattr(result, "failedRowsPercentage", None),
            "parameters": parameters,
            "sample_failing_values": sample_failing_values,
            "inspection_sql": response.inspectionQuery or "",
            "dimension_failures": dimension_failures,
        }

    @staticmethod
    def _parse_sample_rows(
        failed_rows_sample: Any, max_rows: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Safely convert a TableData object into a list of row dicts.

        TableData has:
          .columns — list of column name strings *or* Column objects
          .rows    — list of lists (each inner list is one row of values)

        Returns at most ``max_rows`` dicts of the form {column_name: value}.
        Returns an empty list on any error.
        """
        if failed_rows_sample is None:
            return []

        try:
            raw_cols = getattr(failed_rows_sample, "columns", None) or []
            raw_rows = getattr(failed_rows_sample, "rows", None) or []

            # Column entries may be plain strings or objects with a .name attribute
            col_names: List[str] = []
            for c in raw_cols:
                if isinstance(c, str):
                    col_names.append(c)
                else:
                    col_names.append(str(getattr(c, "name", c)))

            result: List[Dict[str, Any]] = []
            for row in raw_rows[:max_rows]:
                if not isinstance(row, (list, tuple)):
                    continue
                row_dict: Dict[str, Any] = {}
                for idx, val in enumerate(row):
                    col_key = col_names[idx] if idx < len(col_names) else f"col_{idx}"
                    row_dict[col_key] = val
                result.append(row_dict)

            return result

        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(f"Failed to parse sample rows: {exc}")
            return []
