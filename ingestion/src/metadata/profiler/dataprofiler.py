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

import logging
import traceback
from typing import Any

from jsonschema import ValidationError

from metadata.generated.schema.entity.data.table import (
    ColumnProfile,
    Histogram,
    TableProfile,
)
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig
from metadata.profiler.profiler_runner import ProfilerRunner
from metadata.profiler.util import group_by

logger: logging.Logger = logging.getLogger(__name__)


class DataProfiler:
    status: SourceStatus
    config: SQLConnectionConfig

    def __init__(self, config, status):
        self.status = status
        self.config = config
        self.__create_profiler()

    def __create_profiler(self):
        profiler_config = {
            "profiler": {
                "type": self.config.service_type.lower(),
                "config": self.config,
            }
        }
        try:
            logger.debug(f"Using config: {profiler_config}")
            self.profiler_runner = ProfilerRunner.create(profiler_config)
        except ValidationError as e:
            logger.error(e)
            raise e

    def run_profiler(
        self,
        dataset_name: str,
        profile_date: str,
        schema: str = None,
        table: str = None,
        **kwargs: Any,
    ) -> TableProfile:
        try:
            profile_results = self.profiler_runner.execute(
                schema=schema, table_name=table, profile_date=profile_date
            )
            profile = self._parse_test_results_to_table_profile(
                profile_test_results=profile_results, dataset_name=dataset_name
            )
            return profile
        except Exception as err:
            logger.error(f"Failed to run data profiler on {dataset_name} due to {err}")
            traceback.print_exc()
            pass

    def _parse_test_results_to_table_profile(
        self, profile_test_results, dataset_name: str
    ) -> TableProfile:
        profile = TableProfile(profileDate=profile_test_results.profile_date)
        table_result = profile_test_results.table_result
        profile.rowCount = table_result.row_count
        profile.columnCount = table_result.col_count
        column_profiles = []
        for col_name, col_result in profile_test_results.columns_result.items():
            if col_name == "table":
                continue
            column_profile = ColumnProfile(name=col_name)
            for name, measurement in col_result.measurements.items():
                if name == "values_count":
                    column_profile.valuesCount = measurement.value
                elif name == "valid_count":
                    column_profile.validCount = measurement.value
                elif name == "min":
                    column_profile.min = measurement.value
                elif name == "max":
                    column_profile.max = measurement.value
                elif name == "sum":
                    column_profile.sum = measurement.value
                elif name == "avg":
                    column_profile.mean = measurement.value
                elif name == "variance":
                    column_profile.variance = measurement.value
                elif name == "stddev":
                    column_profile.stddev = measurement.value
                elif name == "missing_percentage":
                    column_profile.missingPercentage = measurement.value
                elif name == "missing_count":
                    column_profile.missingCount = measurement.value
                elif name == "values_percentage":
                    column_profile.valuesPercentage = measurement.value
                elif name == "distinct":
                    column_profile.distinctCount = measurement.value
                elif name == "unique_count":
                    column_profile.uniqueCount = measurement.value
                elif name == "uniqueness":
                    column_profile.uniqueProportion = measurement.value
                elif name == "duplicate_count":
                    column_profile.duplicateCount = measurement.value
                elif name == "histogram":
                    column_profile.histogram = Histogram()
                    column_profile.histogram.boundaries = measurement.value.get(
                        "boundaries", []
                    )
                    column_profile.histogram.frequencies = measurement.value.get(
                        "frequencies", []
                    )
                else:
                    logger.warning(
                        f"Ignoring metric {name} for {dataset_name}.{col_name}"
                    )
            column_profiles.append(column_profile)

        profile.columnProfile = column_profiles
        return profile
