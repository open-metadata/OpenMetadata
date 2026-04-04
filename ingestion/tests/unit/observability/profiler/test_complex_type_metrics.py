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
Tests for profiler support of complex data types (issue #15627).

Validates that ARRAY, JSON, MAP, STRUCT and Geo columns receive null-family
metrics instead of being silently skipped.
"""

import sqlalchemy
import sqlalchemy.types

from metadata.generated.schema.entity.data.table import DataType
from metadata.ingestion.source.sqa_types import SQAMap, SQASet, SQAStruct, SQAUnion
from metadata.profiler.orm.registry import COMPLEX_TYPES, NOT_COMPUTE


class TestComplexTypesRegistryPartition:
    """
    COMPLEX_TYPES and NOT_COMPUTE must be disjoint and cover the right types.

    Previously, ARRAY / JSON / MAP / STRUCT / SET / UNION / GEO were all in
    NOT_COMPUTE, which silently dropped every column metric for those types.
    After issue #15627 they live in COMPLEX_TYPES so that null metrics can
    still be collected.
    """

    def test_array_not_in_not_compute(self):
        """ARRAY columns should now be profiled (nullCount at minimum)."""
        assert sqlalchemy.ARRAY.__name__ not in NOT_COMPUTE

    def test_json_not_in_not_compute(self):
        assert sqlalchemy.JSON.__name__ not in NOT_COMPUTE

    def test_map_not_in_not_compute(self):
        assert SQAMap.__name__ not in NOT_COMPUTE

    def test_struct_not_in_not_compute(self):
        assert SQAStruct.__name__ not in NOT_COMPUTE

    def test_set_not_in_not_compute(self):
        assert SQASet.__name__ not in NOT_COMPUTE

    def test_union_not_in_not_compute(self):
        assert SQAUnion.__name__ not in NOT_COMPUTE

    def test_geometry_datatype_not_in_not_compute(self):
        assert DataType.GEOMETRY.value not in NOT_COMPUTE

    def test_array_in_complex_types(self):
        assert sqlalchemy.ARRAY.__name__ in COMPLEX_TYPES

    def test_json_in_complex_types(self):
        assert sqlalchemy.JSON.__name__ in COMPLEX_TYPES

    def test_map_in_complex_types(self):
        assert SQAMap.__name__ in COMPLEX_TYPES

    def test_struct_in_complex_types(self):
        assert SQAStruct.__name__ in COMPLEX_TYPES

    def test_geometry_in_complex_types(self):
        assert DataType.GEOMETRY.value in COMPLEX_TYPES

    def test_complex_types_and_not_compute_are_disjoint(self):
        """No type should appear in both sets."""
        overlap = COMPLEX_TYPES & NOT_COMPUTE
        assert overlap == set(), f"Types in both sets: {overlap}"

    def test_null_type_still_in_not_compute(self):
        """NullType is truly un-profilable and must stay in NOT_COMPUTE."""
        assert sqlalchemy.types.NullType.__name__ in NOT_COMPUTE

    def test_xml_still_in_not_compute(self):
        assert DataType.XML.value in NOT_COMPUTE

    def test_null_type_not_in_complex_types(self):
        assert sqlalchemy.types.NullType.__name__ not in COMPLEX_TYPES


class TestComplexTypeColumnSeparation:
    """
    Validates that the _prepare_column_metrics helper in the Profiler correctly
    routes complex-type columns to the null-only path and regular columns to
    the full metric path.
    """

    def _make_column(self, sqa_type):
        """Create a minimal SQLAlchemy column stub for testing."""
        col = sqlalchemy.Column("test_col", sqa_type)
        return col

    def test_array_column_goes_to_complex_path(self):
        col = self._make_column(sqlalchemy.ARRAY(sqlalchemy.String))
        assert col.type.__class__.__name__ in COMPLEX_TYPES
        assert col.type.__class__.__name__ not in NOT_COMPUTE

    def test_json_column_goes_to_complex_path(self):
        col = self._make_column(sqlalchemy.JSON())
        assert col.type.__class__.__name__ in COMPLEX_TYPES
        assert col.type.__class__.__name__ not in NOT_COMPUTE

    def test_string_column_goes_to_regular_path(self):
        col = self._make_column(sqlalchemy.String(256))
        assert col.type.__class__.__name__ not in COMPLEX_TYPES
        assert col.type.__class__.__name__ not in NOT_COMPUTE

    def test_null_type_column_excluded_entirely(self):
        col = self._make_column(sqlalchemy.types.NullType())
        assert col.type.__class__.__name__ in NOT_COMPUTE
        assert col.type.__class__.__name__ not in COMPLEX_TYPES


class TestNullMetricNamesForComplexTypes:
    """
    NullRatio (nullProportion) is a ComposedMetric that depends on both
    Count (valuesCount) and NullCount.  The StaticMetric filter in
    _prepare_column_metrics must therefore include "valuesCount" so that
    run_composed_metrics can correctly compute nullProportion.

    Previously the filter checked for "nullProportion" by name, which is
    a dead-code path because NullRatio is never returned by
    get_column_metrics(StaticMetric, ...).
    """

    NULL_METRIC_NAMES = {"valuesCount", "nullCount"}

    def test_null_proportion_not_in_static_metric_filter(self):
        """'nullProportion' must not appear in the static filter — it is a ComposedMetric."""
        assert "nullProportion" not in self.NULL_METRIC_NAMES

    def test_values_count_in_static_metric_filter(self):
        """'valuesCount' must be present so NullRatio can compute null_count / total."""
        assert "valuesCount" in self.NULL_METRIC_NAMES

    def test_null_count_in_static_metric_filter(self):
        """'nullCount' must be present as the primary null metric for complex types."""
        assert "nullCount" in self.NULL_METRIC_NAMES

    def test_null_ratio_required_metrics_are_covered(self):
        """NullRatio.required_metrics() must be a subset of what we compute statically."""
        from metadata.profiler.metrics.composed.null_ratio import NullRatio

        for required in NullRatio.required_metrics():
            assert required in self.NULL_METRIC_NAMES, (
                f"NullRatio requires '{required}' but it is not in the static filter "
                f"for complex columns. Without it, nullProportion will be computed "
                f"incorrectly (divide-by-zero or wrong denominator)."
            )
