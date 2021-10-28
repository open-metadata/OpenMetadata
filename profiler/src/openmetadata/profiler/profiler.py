#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#   http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import logging
from datetime import datetime
from math import ceil, floor
from typing import List

from openmetadata.common.database import Database
from openmetadata.common.metric import Metric
from openmetadata.profiler.profiler_metadata import (
    ColumnProfileResult,
    MetricMeasurement,
    ProfileResult,
    SupportedDataType,
    Table,
    TableProfileResult,
    get_group_by_cte,
    get_group_by_cte_numeric_value_expression,
)

logger = logging.getLogger(__name__)


class Profiler:
    def __init__(
        self,
        database: Database,
        table_name: str,
        excluded_columns: List[str] = [],
        profile_time: str = None,
    ):
        self.database = database
        self.table = Table(name=table_name)
        self.excluded_columns = excluded_columns
        self.time = profile_time
        self.qualified_table_name = self.database.qualify_table_name(table_name)
        self.scan_reference = None
        self.start_time = None
        self.queries_executed = 0

        self.profiler_result = ProfileResult(
            profile_date=self.time,
            table_result=TableProfileResult(name=self.table.name),
        )

    def execute(self) -> ProfileResult:
        self.start_time = datetime.now()

        try:
            self.database.table_column_metadata(self.table.name, None)
            logger.debug(str(len(self.database.columns)) + " columns:")
            self.profiler_result.table_result.col_count = len(self.database.columns)
            self._profile_aggregations()
            self._query_group_by_value()
            self._query_histograms()
            logger.debug(
                f"Executed {self.queries_executed} queries in {(datetime.now() - self.start_time)}"
            )
        except Exception as e:
            logger.exception("Exception during scan")

        finally:
            self.database.close()

        return self.profiler_result

    def _profile_aggregations(self):
        measurements: List[MetricMeasurement] = []
        fields: List[str] = []

        # Compute Row Count
        fields.append(self.database.sql_exprs.count_all_expr)
        measurements.append(MetricMeasurement(name=Metric.ROW_COUNT, col_name="table"))
        column_metric_indices = {}

        try:
            for column in self.database.columns:
                metric_indices = {}
                column_metric_indices[column.name.lower()] = metric_indices
                column_name = column.name
                qualified_column_name = self.database.qualify_column_name(column_name)

                ## values_count
                metric_indices["non_missing"] = len(measurements)
                fields.append(self.database.sql_exprs.count(qualified_column_name))
                measurements.append(
                    MetricMeasurement(name=Metric.VALUES_COUNT, col_name=column_name)
                )

                # Valid Count
                fields.append(self.database.sql_exprs.count(qualified_column_name))
                measurements.append(
                    MetricMeasurement(name=Metric.VALID_COUNT, col_name=column_name)
                )
                if column.logical_type == SupportedDataType.TEXT:
                    length_expr = self.database.sql_exprs.length(qualified_column_name)
                    fields.append(self.database.sql_exprs.avg(length_expr))
                    measurements.append(
                        MetricMeasurement(name=Metric.AVG_LENGTH, col_name=column_name)
                    )

                    # Min Length
                    fields.append(self.database.sql_exprs.min(length_expr))
                    measurements.append(
                        MetricMeasurement(name=Metric.MIN_LENGTH, col_name=column_name)
                    )

                    # Max Length
                    fields.append(self.database.sql_exprs.max(length_expr))
                    measurements.append(
                        MetricMeasurement(name=Metric.MAX_LENGTH, col_name=column_name)
                    )

                if column.logical_type == SupportedDataType.NUMERIC:
                    # Min
                    fields.append(self.database.sql_exprs.min(qualified_column_name))
                    measurements.append(
                        MetricMeasurement(name=Metric.MIN, col_name=column_name)
                    )

                    # Max
                    fields.append(self.database.sql_exprs.max(qualified_column_name))
                    measurements.append(
                        MetricMeasurement(name=Metric.MAX, col_name=column_name)
                    )

                    # AVG
                    fields.append(self.database.sql_exprs.avg(qualified_column_name))
                    measurements.append(
                        MetricMeasurement(name=Metric.AVG, col_name=column_name)
                    )

                    # SUM
                    fields.append(self.database.sql_exprs.sum(qualified_column_name))
                    measurements.append(
                        MetricMeasurement(name=Metric.SUM, col_name=column_name)
                    )

                    # VARIANCE
                    fields.append(
                        self.database.sql_exprs.variance(qualified_column_name)
                    )
                    measurements.append(
                        MetricMeasurement(name=Metric.VARIANCE, col_name=column_name)
                    )

                    # STDDEV
                    fields.append(self.database.sql_exprs.stddev(qualified_column_name))
                    measurements.append(
                        MetricMeasurement(name=Metric.STDDEV, col_name=column_name)
                    )

            if len(fields) > 0:
                sql = (
                    "SELECT \n  " + ",\n  ".join(fields) + " \n"
                    "FROM " + self.qualified_table_name
                )
                query_result_tuple = self.database.execute_query(sql)
                self.queries_executed += 1

                for i in range(0, len(measurements)):
                    measurement = measurements[i]
                    measurement.value = query_result_tuple[i]
                    self._add_measurement(measurement)

                # Calculating derived measurements
                row_count_measurement = next(
                    (m for m in measurements if m.name == Metric.ROW_COUNT), None
                )

                if row_count_measurement:
                    row_count = row_count_measurement.value
                    self.profiler_result.table_result.row_count = row_count
                    for column in self.database.columns:
                        column_name = column.name
                        metric_indices = column_metric_indices[column_name.lower()]
                        non_missing_index = metric_indices.get("non_missing")
                        if non_missing_index is not None:
                            values_count = measurements[non_missing_index].value
                            missing_count = row_count - values_count
                            missing_percentage = (
                                missing_count * 100 / row_count
                                if row_count > 0
                                else None
                            )
                            values_percentage = (
                                values_count * 100 / row_count
                                if row_count > 0
                                else None
                            )
                            self._add_measurement(
                                MetricMeasurement(
                                    name=Metric.MISSING_PERCENTAGE,
                                    col_name=column_name,
                                    value=missing_percentage,
                                )
                            )
                            self._add_measurement(
                                MetricMeasurement(
                                    name=Metric.MISSING_COUNT,
                                    col_name=column_name,
                                    value=missing_count,
                                )
                            )
                            self._add_measurement(
                                MetricMeasurement(
                                    name=Metric.VALUES_PERCENTAGE,
                                    col_name=column_name,
                                    value=values_percentage,
                                )
                            )

                            valid_index = metric_indices.get("valid")
                            if valid_index is not None:
                                valid_count = measurements[valid_index].value
                                invalid_count = row_count - missing_count - valid_count
                                invalid_percentage = (
                                    invalid_count * 100 / row_count
                                    if row_count > 0
                                    else None
                                )
                                valid_percentage = (
                                    valid_count * 100 / row_count
                                    if row_count > 0
                                    else None
                                )
                                self._add_measurement(
                                    MetricMeasurement(
                                        name=Metric.INVALID_PERCENTAGE,
                                        col_name=column_name,
                                        value=invalid_percentage,
                                    )
                                )
                                self._add_measurement(
                                    MetricMeasurement(
                                        name=Metric.INVALID_COUNT,
                                        col_name=column_name,
                                        value=invalid_count,
                                    )
                                )
                                self._add_measurement(
                                    MetricMeasurement(
                                        name=Metric.VALID_PERCENTAGE,
                                        col_name=column_name,
                                        value=valid_percentage,
                                    )
                                )
        except Exception as e:
            logger.error(f"Exception during aggregation query", exc_info=e)

    def _query_group_by_value(self):
        for column in self.database.columns:
            try:
                measurements = []
                column_name = column.name
                group_by_cte = get_group_by_cte(
                    self.database.qualify_column_name(column.name),
                    self.database.qualify_table_name(self.table.name),
                )
                ## Compute Distinct, Unique, Unique_Count, Duplicate_count
                sql = (
                    f"{group_by_cte} \n"
                    f"SELECT COUNT(*), \n"
                    f"       COUNT(CASE WHEN frequency = 1 THEN 1 END), \n"
                    f"       SUM(frequency) \n"
                    f"FROM group_by_value"
                )

                query_result_tuple = self.database.execute_query(sql)
                self.queries_executed += 1

                distinct_count = query_result_tuple[0]
                unique_count = query_result_tuple[1]
                valid_count = query_result_tuple[2] if query_result_tuple[2] else 0
                duplicate_count = distinct_count - unique_count
                self._add_measurement(
                    MetricMeasurement(
                        name=Metric.DISTINCT, col_name=column_name, value=distinct_count
                    )
                )
                self._add_measurement(
                    MetricMeasurement(
                        name=Metric.UNIQUE_COUNT,
                        col_name=column_name,
                        value=unique_count,
                    )
                )
                self._add_measurement(
                    MetricMeasurement(
                        name=Metric.DUPLICATE_COUNT,
                        col_name=column_name,
                        value=duplicate_count,
                    )
                )
                if valid_count > 1:
                    uniqueness = (distinct_count - 1) * 100 / (valid_count - 1)
                    self._add_measurement(
                        MetricMeasurement(
                            name=Metric.UNIQUENESS,
                            col_name=column_name,
                            value=uniqueness,
                        )
                    )
            except Exception as e:
                logger.error(
                    f"Exception during column group by value queries", exc_info=e
                )

    def _query_histograms(self):
        for column in self.database.columns:
            column_name = column.name
            try:
                if column.is_number():
                    measurements = []
                    buckets: int = 20
                    column_results = self.profiler_result.columns_result[column_name]
                    min_value = column_results.measurements.get(Metric.MIN).value
                    max_value = column_results.measurements.get(Metric.MAX).value

                    if (
                        column.is_number()
                        and min_value
                        and max_value
                        and min_value < max_value
                    ):
                        min_value = floor(min_value * 1000) / 1000
                        max_value = ceil(max_value * 1000) / 1000
                        bucket_width = (max_value - min_value) / buckets

                        boundary = min_value
                        boundaries = [min_value]
                        for i in range(0, buckets):
                            boundary += bucket_width
                            boundaries.append(round(boundary, 3))

                        group_by_cte = get_group_by_cte(column_name, self.table.name)
                        numeric_value_expr = get_group_by_cte_numeric_value_expression(
                            column, self.database, None
                        )

                        field_clauses = []
                        for i in range(0, buckets):
                            lower_bound = (
                                ""
                                if i == 0
                                else f"{boundaries[i]} <= {numeric_value_expr}"
                            )
                            upper_bound = (
                                ""
                                if i == buckets - 1
                                else f"{numeric_value_expr} < {boundaries[i + 1]}"
                            )
                            optional_and = (
                                ""
                                if lower_bound == "" or upper_bound == ""
                                else " and "
                            )
                            field_clauses.append(
                                f"SUM(CASE WHEN {lower_bound}{optional_and}{upper_bound} THEN frequency END)"
                            )

                        fields = ",\n  ".join(field_clauses)

                        sql = (
                            f"{group_by_cte} \n"
                            f"SELECT \n"
                            f"  {fields} \n"
                            f"FROM group_by_value"
                        )

                        row = self.database.execute_query(sql)
                        self.queries_executed += 1

                        # Process the histogram query
                        frequencies = []
                        for i in range(0, buckets):
                            frequency = row[i]
                            frequencies.append(0 if not frequency else int(frequency))
                        histogram = {
                            "boundaries": boundaries,
                            "frequencies": frequencies,
                        }
                        self._add_measurement(
                            MetricMeasurement(
                                name=Metric.HISTOGRAM,
                                col_name=column_name,
                                value=histogram,
                            )
                        )
            except Exception as e:
                logger.error(f"Exception during aggregation query", exc_info=e)

    def _add_measurement(self, measurement):
        logger.debug(f"measurement: {measurement}")
        if measurement.col_name in self.profiler_result.columns_result.keys():
            col_result = self.profiler_result.columns_result[measurement.col_name]
            col_measurements = col_result.measurements
            col_measurements[measurement.name] = measurement
            self.profiler_result.columns_result[
                measurement.col_name
            ].measurements = col_measurements
        else:
            col_measurements = {measurement.name: measurement}
            self.profiler_result.columns_result[
                measurement.col_name
            ] = ColumnProfileResult(
                name=measurement.col_name, measurements=col_measurements
            )
