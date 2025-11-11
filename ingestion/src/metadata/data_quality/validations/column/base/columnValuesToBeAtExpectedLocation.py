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
Validator for column value to be at expected location test case
"""

import json
import traceback
from abc import abstractmethod
from collections import defaultdict
from importlib import resources
from typing import Any, Callable, Dict, List, NamedTuple, Optional, Union

from shapely.geometry import MultiPolygon, Point, Polygon

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_IMPACT_SCORE_KEY,
    DIMENSION_NULL_LABEL,
    DIMENSION_OTHERS_LABEL,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
    BaseTestValidator,
)
from metadata.data_quality.validations.impact_score import (
    DEFAULT_TOP_DIMENSIONS,
    calculate_impact_score,
)
from metadata.data_quality.validations.utils import casefold_if_string
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.utils import entity_link
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

VALID_LOCATION_KEY = "validLocation"
INVALID_LOCATION_KEY = "invalidLocation"
UNKNOWN_LOCATION_KEY = "unknownLocation"


class CountResult(NamedTuple):
    valid_count: int
    invalid_count: int
    unknown_count: int


DimensionCountResult = defaultdict[str, CountResult]
DimensionsCountResult = Dict[str, DimensionCountResult]


class BaseColumnValuesToBeAtExpectedLocationValidator(BaseTestValidator):
    """Validator for column value to be at expected location test case"""

    RADIUS = "radius"
    LONGITUDE_COL_NAME = "longitudeColumnName"
    LATITUDE_COL_NAME = "latitudeColumnName"
    LOCATION_REF_TYPE = "locationReferenceType"

    def _calculate_counts(
        self, dimension_columns: Optional[List[str]] = None
    ) -> DimensionsCountResult:
        """Calculate location validation counts for dimensions.

        Treats non-dimensional as a special case with synthetic dimension.

        Args:
            dimension_columns: List of dimension column names, or None for non-dimensional

        Returns:
            Dict structure: {dimension_col_name: {dim_value: {VALID/INVALID/UNKNOWN: count}}}
            For non-dimensional, uses synthetic dimension "__OVERALL__" with value "__ALL__"
        """
        # Extract parameters (common for both dimensional and non-dimensional)
        radius: float = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            self.RADIUS,
            float,
        )
        lon: str = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            self.LONGITUDE_COL_NAME,
            str,
        )
        lat: str = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            self.LATITUDE_COL_NAME,
            str,
        )
        ref_type: str = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            self.LOCATION_REF_TYPE,
            str,
        )

        column_reference = entity_link.split(self.test_case.entityLink.root)[-1]
        shapes = self._get_shapes(radius, ref_type)

        # Handle non-dimensional case with synthetic dimension
        if not dimension_columns:
            dimension_columns = ["__OVERALL__"]
            is_synthetic = True
            columns = [column_reference, lon, lat]
        else:
            is_synthetic = False
            columns = dimension_columns + [column_reference, lon, lat]

        # Pre-create counts dict for all dimensions
        dimension_counts = {
            dim_col: defaultdict(lambda: CountResult(0, 0, 0))
            for dim_col in dimension_columns
        }

        # Single-pass validation
        for row_data in self._fetch_data(columns):
            is_valid = self._validate_point(
                row_data[column_reference],
                ref_type,
                row_data[lat],
                row_data[lon],
                shapes,
            )

            # Update counts for ALL dimensions
            for dimension_col_name in dimension_columns:
                if is_synthetic:
                    dim_value = "__ALL__"
                else:
                    dim_value = self.format_dimension_value(
                        row_data[dimension_col_name]
                    )

                current = dimension_counts[dimension_col_name][dim_value]
                if is_valid is True:
                    dimension_counts[dimension_col_name][dim_value] = current._replace(
                        valid_count=current.valid_count + 1
                    )
                elif is_valid is False:
                    dimension_counts[dimension_col_name][dim_value] = current._replace(
                        invalid_count=current.invalid_count + 1
                    )
                else:
                    dimension_counts[dimension_col_name][dim_value] = current._replace(
                        unknown_count=current.unknown_count + 1
                    )

        return dimension_counts

    def _evaluate_test_condition(self, counts: CountResult) -> bool:
        """Evaluate if test passes based on location counts.

        Args:
            counts: CountResult with valid/invalid/unknown counts

        Returns:
            bool: True if test passes (no invalid locations)
        """
        return counts.invalid_count == 0

    def _format_result_message(
        self,
        counts: CountResult,
        dimension_col: Optional[str] = None,
        dimension_value: Optional[str] = None,
    ) -> str:
        """Format the result message for location validation.

        Args:
            counts: CountResult with valid/invalid/unknown counts
            dimension_col: Optional dimension column name
            dimension_value: Optional dimension value

        Returns:
            str: Formatted result message
        """
        if dimension_col and dimension_value:
            return (
                f"Dimension {dimension_col}={dimension_value}: "
                f"Found validLocation={counts.valid_count}, invalidLocation={counts.invalid_count}, "
                f"unknownLocation={counts.unknown_count} vs. expected 0 invalidLocation."
            )
        return (
            f"Found validLocation={counts.valid_count}, invalidLocation={counts.invalid_count},"
            f"unknownLocation={counts.unknown_count} vs. expected 0 invalidLocation."
        )

    def _get_test_result_values(self, counts: CountResult) -> List[TestResultValue]:
        """Get test result values from location counts.

        Args:
            counts: CountResult with valid/invalid/unknown counts

        Returns:
            List[TestResultValue]: Test result values for all location categories
        """
        return [
            TestResultValue(
                name=VALID_LOCATION_KEY,
                value=str(counts.valid_count),
                predictedValue=None,
            ),
            TestResultValue(
                name=INVALID_LOCATION_KEY,
                value=str(counts.invalid_count),
                predictedValue=None,
            ),
            TestResultValue(
                name=UNKNOWN_LOCATION_KEY,
                value=str(counts.unknown_count),
                predictedValue=None,
            ),
        ]

    def _run_validation(self) -> TestCaseResult:
        """Execute the specific test validation logic

        This method contains the core validation logic that was previously
        in the run_validation method.

        Returns:
            TestCaseResult: The test case result for the overall validation
        """
        try:
            # Use unified counting logic (non-dimensional = synthetic dimension)
            dimension_counts = self._calculate_counts(dimension_columns=None)
            counts = dimension_counts["__OVERALL__"]["__ALL__"]

        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [
                    TestResultValue(
                        name=VALID_LOCATION_KEY, value=None, predictedValue=None
                    ),
                    TestResultValue(
                        name=INVALID_LOCATION_KEY, value=None, predictedValue=None
                    ),
                    TestResultValue(
                        name=UNKNOWN_LOCATION_KEY, value=None, predictedValue=None
                    ),
                ],
            )

        # Evaluate test condition and format results
        test_passed = self._evaluate_test_condition(counts)
        result_message = self._format_result_message(counts)
        test_result_values = self._get_test_result_values(counts)

        if self.test_case.computePassedFailedRowCount:
            row_count = counts.valid_count + counts.invalid_count
            failed_rows = counts.invalid_count
        else:
            row_count, failed_rows = None, None

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(test_passed),
            result_message,
            test_result_values,
            row_count=row_count,
            failed_rows=failed_rows,
            min_bound=None,
            max_bound=None,
        )

    @abstractmethod
    def _fetch_data(self, columns: List[str]):
        raise NotImplementedError

    def _get_shapes(self, radius: float, ref_type: str) -> List[Dict]:
        """Transform the json file into a list of shapes

        Args:
            radius (float): radius to buffer the shapes
        Returns:
            List[Dict]
        """
        geojson_property = "libgeo" if ref_type == "CITY" else "codgeo"
        # pylint: disable=deprecated-method
        with resources.open_text("metadata.data_quality.data", "fr-cities.json") as f:
            data = json.load(f)

        # bring meters to coordinates degrees (e.g. 1000 meter = 0.01 degree)
        radius = radius / 100000
        shapes = []

        for feature in data.get("features"):
            type_ = feature["geometry"]["type"]

            if type_ == "Polygon":
                polygon = Polygon(feature["geometry"]["coordinates"][0])
            else:
                coordinates = [
                    Polygon(c[0]) for c in feature["geometry"]["coordinates"]
                ]
                polygon = MultiPolygon(coordinates)
            polygon = polygon.buffer(radius)
            properties = feature["properties"]
            shapes.append({"geometry": polygon, "properties": properties})

        return sorted(shapes, key=lambda x: x["properties"][geojson_property])

    def _search_location(
        self, shapes: List[Dict], ref: Any, ref_type: str
    ) -> Optional[List]:
        """Search for the location in the shapes list

        Args:
            shapes (Dict): list of shapes
            ref (Any): reference to search for
            ref_type (str): type of reference
        Returns:
            Optional[Dict]
        """
        geojson_property = "libgeo" if ref_type == "CITY" else "codgeo"
        geotype = str

        if len(shapes) == 0:
            return []

        if len(shapes) == 1:
            return (
                shapes
                if self._compare_geojson_values(
                    self._get_geojson_value(shapes[0], geojson_property), ref, geotype
                )
                else []
            )

        n = len(shapes) // 2
        mid_value = casefold_if_string(
            self._get_geojson_value(shapes[n], geojson_property)
        )
        ref = casefold_if_string(ref)
        if self._compare_geojson_values(mid_value, ref, geotype):
            matches = [shapes[n]]
            left = n - 1

            while left >= 0 and self._compare_geojson_values(
                self._get_geojson_value(shapes[left], geojson_property), ref, geotype
            ):
                matches.append(shapes[left])
                left -= 1

            right = n + 1
            while right < len(shapes) and self._compare_geojson_values(
                self._get_geojson_value(shapes[right], geojson_property), ref, geotype
            ):
                matches.append(shapes[right])
                right += 1

            return matches

        if geotype(mid_value) > geotype(ref):
            return self._search_location(shapes[:n], ref, ref_type)
        return self._search_location(shapes[n:], ref, ref_type)

    def _get_geojson_value(self, shape: Dict, geojson_property: str):
        """Given a shape, return the geojson property value

        Args:
            shape (Dict): shape to extract the value from
            geojson_property (str): geojson property to extract
        """
        return shape.get("properties", {}).get(geojson_property, "")

    def _compare_geojson_values(self, value: Any, ref: Any, geotype: Callable) -> bool:
        """Compare the geojson values

        Args:
            value (Any): value to compare
            ref (Any): reference to compare to

        Returns:
            bool:
        """
        return geotype(casefold_if_string(value)) == geotype(casefold_if_string(ref))

    def _validate_point(
        self,
        ref: Any,
        ref_type: str,
        lat: float,
        lon: Union[float, str],
        shapes: List[Dict],
    ) -> Optional[bool]:
        """Validate the point is within the shapes

        Args:
            ref (Any): reference to search for
            ref_type (str): type of reference
            lat (float): latitude
            lon (float): lonitude
            shapes (List[Dict]): list of shapes

        Returns:
            bool:
        """
        if isinstance(lon, str) or isinstance(lat, str):
            # lat/lon can be represented as strings in format 1,7743058 or 1.7743058
            try:
                lon = float(lon)
                lat = float(lat)
            except ValueError:
                lon = float(lon.replace(",", "."))  # type: ignore
                lat = float(lat.replace(",", "."))  # type: ignore

        if not lon or not lat:
            return None
        point = Point(lon, lat)
        locations = self._search_location(shapes, ref, ref_type)
        if not locations:
            return None
        for location in locations:
            if location["geometry"].contains(point):
                return True

        return False

    def _run_dimensional_validation(self) -> List[DimensionResult]:
        """Execute dimensional validation - all processing in Python

        Both SQLAlchemy and Pandas implementations just provide rows via _fetch_data().
        All validation happens in Python using Shapely (cannot be done in SQL).

        Returns:
            List[DimensionResult]: Dimension-specific test results
        """
        try:
            dimension_columns = self.test_case.dimensionColumns or []
            if not dimension_columns:
                return []

            # Use unified counting logic
            dimension_counts = self._calculate_counts(
                dimension_columns=dimension_columns
            )

            # Create results for each dimension
            all_dimension_results = []
            for dimension_col_name in dimension_columns:
                try:
                    dimension_results = (
                        self._create_dimension_results_from_location_counts(
                            dimension_counts[dimension_col_name], dimension_col_name
                        )
                    )
                    all_dimension_results.extend(dimension_results)

                except Exception as exc:
                    logger.warning(
                        f"Error creating dimension results for column {dimension_col_name}: {exc}"
                    )
                    logger.debug(traceback.format_exc())
                    continue

            return all_dimension_results

        except Exception as exc:
            logger.warning(f"Error executing dimensional validation: {exc}")
            logger.debug(traceback.format_exc())
            return []

    def _create_dimension_results_from_location_counts(
        self,
        dimension_counts: dict,
        dimension_col_name: str,
    ) -> List[DimensionResult]:
        """Apply top N + Others aggregation and create DimensionResults

        Args:
            dimension_counts: Dictionary mapping dimension values to location counts
            dimension_col_name: Name of the dimension column

        Returns:
            List[DimensionResult]: Dimension results with impact scores
        """
        if not dimension_counts:
            return []

        # Calculate impact score for each dimension
        dimension_data = []
        for dim_value, counts in dimension_counts.items():
            total_count = counts.valid_count + counts.invalid_count
            failed_count = counts.invalid_count
            impact_score = calculate_impact_score(failed_count, total_count)

            dimension_data.append(
                {
                    DIMENSION_VALUE_KEY: dim_value,
                    VALID_LOCATION_KEY: counts.valid_count,
                    INVALID_LOCATION_KEY: counts.invalid_count,
                    UNKNOWN_LOCATION_KEY: counts.unknown_count,
                    DIMENSION_TOTAL_COUNT_KEY: total_count,
                    DIMENSION_FAILED_COUNT_KEY: failed_count,
                    DIMENSION_IMPACT_SCORE_KEY: impact_score,
                }
            )

        # Sort by impact score descending
        dimension_data.sort(
            key=lambda x: (-x[DIMENSION_IMPACT_SCORE_KEY], x[DIMENSION_VALUE_KEY])
        )

        # Apply top N + Others aggregation
        top_n = DEFAULT_TOP_DIMENSIONS
        if len(dimension_data) <= top_n:
            final_data = dimension_data
        else:
            top_dimensions = dimension_data[:top_n]
            others_dimensions = dimension_data[top_n:]
            others_aggregate = self._aggregate_others_dimensions(others_dimensions)
            final_data = top_dimensions + [others_aggregate]

        # Convert to DimensionResult objects
        return [
            self._create_dimension_result_from_data(data, dimension_col_name)
            for data in final_data
        ]

    def _aggregate_others_dimensions(self, others_dimensions: List[dict]) -> dict:
        """Aggregate multiple dimensions into "Others" bucket.

        Args:
            others_dimensions: List of dimension data dicts to aggregate

        Returns:
            dict: Aggregated "Others" dimension data
        """
        others_valid = sum(d[VALID_LOCATION_KEY] for d in others_dimensions)
        others_invalid = sum(d[INVALID_LOCATION_KEY] for d in others_dimensions)
        others_unknown = sum(d[UNKNOWN_LOCATION_KEY] for d in others_dimensions)
        others_total = sum(d[DIMENSION_TOTAL_COUNT_KEY] for d in others_dimensions)
        others_failed = sum(d[DIMENSION_FAILED_COUNT_KEY] for d in others_dimensions)

        # Recalculate impact score for aggregated "Others"
        others_impact = calculate_impact_score(others_failed, others_total)

        return {
            DIMENSION_VALUE_KEY: DIMENSION_OTHERS_LABEL,
            VALID_LOCATION_KEY: others_valid,
            INVALID_LOCATION_KEY: others_invalid,
            UNKNOWN_LOCATION_KEY: others_unknown,
            DIMENSION_TOTAL_COUNT_KEY: others_total,
            DIMENSION_FAILED_COUNT_KEY: others_failed,
            DIMENSION_IMPACT_SCORE_KEY: others_impact,
        }

    def _create_dimension_result_from_data(
        self, data: dict, dimension_col_name: str
    ) -> DimensionResult:
        """Create a DimensionResult object from aggregated dimension data.

        Args:
            data: Dictionary with dimension value and location counts
            dimension_col_name: Name of the dimension column

        Returns:
            DimensionResult: Complete dimension result object
        """
        dim_value = data[DIMENSION_VALUE_KEY]
        counts = CountResult(
            valid_count=data[VALID_LOCATION_KEY],
            invalid_count=data[INVALID_LOCATION_KEY],
            unknown_count=data[UNKNOWN_LOCATION_KEY],
        )
        impact_score = data[DIMENSION_IMPACT_SCORE_KEY]

        # Use helper methods for evaluation and formatting
        test_passed = self._evaluate_test_condition(counts)
        result_message = self._format_result_message(
            counts, dimension_col_name, dim_value
        )
        test_result_values = self._get_test_result_values(counts)

        return self.get_dimension_result_object(
            dimension_values={dimension_col_name: dim_value},
            test_case_status=TestCaseStatus.Success
            if test_passed
            else TestCaseStatus.Failed,
            result=result_message,
            test_result_value=test_result_values,
            total_rows=counts.valid_count + counts.invalid_count,
            passed_rows=counts.valid_count,
            failed_rows=counts.invalid_count,
            impact_score=impact_score,
        )

    @staticmethod
    def format_dimension_value(value) -> str:
        """Format a dimension value, handling NULL values consistently

        Args:
            value: Raw dimension value

        Returns:
            str: Formatted dimension value ("NULL" for None, str() for others)
        """
        if value is None:
            return DIMENSION_NULL_LABEL
        return str(value)
