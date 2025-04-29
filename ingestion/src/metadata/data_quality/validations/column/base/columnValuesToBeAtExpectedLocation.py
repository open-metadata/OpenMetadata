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
from importlib import resources
from typing import Any, Callable, Dict, List, Optional, Union

from shapely.geometry import MultiPolygon, Point, Polygon

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.utils import casefold_if_string
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.utils import entity_link
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class BaseColumnValuesToBeAtExpectedLocationValidator(BaseTestValidator):
    """Validator for column value to be at expected location test case"""

    #  pylint: disable=too-many-locals
    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        valid = True
        valid_count = 0
        invalid_count = 0
        unknown_count = 0
        try:
            radius: float = self.get_test_case_param_value(
                self.test_case.parameterValues,  # type: ignore
                "radius",
                float,
            )
            lon: str = self.get_test_case_param_value(
                self.test_case.parameterValues,  # type: ignore
                "longitudeColumnName",
                str,
            )
            lat: str = self.get_test_case_param_value(
                self.test_case.parameterValues,  # type: ignore
                "latitudeColumnName",
                str,
            )
            ref_type: str = self.get_test_case_param_value(
                self.test_case.parameterValues,  # type: ignore
                "locationReferenceType",
                str,
            )

            column_reference = entity_link.split(self.test_case.entityLink.root)[-1]
            columns = [column_reference, lon, lat]
            shapes = self._get_shapes(radius, ref_type)
            for data in self._fetch_data(columns):
                is_valid = self._validate_point(
                    data[column_reference],
                    ref_type,
                    data[lat],
                    data[lon],
                    shapes,
                )
                if is_valid is False:
                    valid = False
                    invalid_count += 1
                elif is_valid is None:
                    unknown_count += 1
                else:
                    valid_count += 1

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
                        name="validLocation", value=None, predictedValue=None
                    ),
                    TestResultValue(
                        name="invalidLocation", value=None, predictedValue=None
                    ),
                    TestResultValue(
                        name="unknownLocation", value=None, predictedValue=None
                    ),
                ],
            )

        if self.test_case.computePassedFailedRowCount:
            row_count, failed_rows = (valid_count + invalid_count), invalid_count
        else:
            row_count, failed_rows = None, None

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(valid),
            (
                f"Found validLocation={valid_count}, invalidLocation={invalid_count},"
                f"unknownLocation={unknown_count} vs. expected 0 invalidLocation."
            ),
            [
                TestResultValue(
                    name="validLocation", value=str(valid_count), predictedValue=None
                ),
                TestResultValue(
                    name="invalidLocation",
                    value=str(invalid_count),
                    predictedValue=None,
                ),
                TestResultValue(
                    name="unknownLocation",
                    value=str(unknown_count),
                    predictedValue=None,
                ),
            ],
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
