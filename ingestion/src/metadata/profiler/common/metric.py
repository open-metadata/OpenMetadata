#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.


class Metric:
    ROW_COUNT = "row_count"
    AVG = "avg"
    AVG_LENGTH = "avg_length"
    DISTINCT = "distinct"
    DUPLICATE_COUNT = "duplicate_count"
    FREQUENT_VALUES = "frequent_values"
    HISTOGRAM = "histogram"
    INVALID_COUNT = "invalid_count"
    INVALID_PERCENTAGE = "invalid_percentage"
    MAX = "max"
    MAX_LENGTH = "max_length"
    MIN = "min"
    MIN_LENGTH = "min_length"
    MISSING_COUNT = "missing_count"
    MISSING_PERCENTAGE = "missing_percentage"
    STDDEV = "stddev"
    SUM = "sum"
    UNIQUENESS = "uniqueness"
    UNIQUE_COUNT = "unique_count"
    VALID_COUNT = "valid_count"
    VALID_PERCENTAGE = "valid_percentage"
    VALUES_COUNT = "values_count"
    VALUES_PERCENTAGE = "values_percentage"
    VARIANCE = "variance"

    METRIC_TYPES = [
        ROW_COUNT,
        AVG,
        AVG_LENGTH,
        DISTINCT,
        DUPLICATE_COUNT,
        FREQUENT_VALUES,
        HISTOGRAM,
        INVALID_COUNT,
        INVALID_PERCENTAGE,
        MAX,
        MAX_LENGTH,
        MIN,
        MIN_LENGTH,
        MISSING_COUNT,
        MISSING_PERCENTAGE,
        STDDEV,
        SUM,
        UNIQUENESS,
        UNIQUE_COUNT,
        VALID_COUNT,
        VALID_PERCENTAGE,
        VALUES_COUNT,
        VALUES_PERCENTAGE,
        VARIANCE,
    ]
