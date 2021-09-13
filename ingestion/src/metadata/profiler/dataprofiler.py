#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import logging
import time
from datetime import datetime
from typing import Any, Iterable, Optional

from great_expectations.core.expectation_validation_result import (
    ExpectationSuiteValidationResult,
    ExpectationValidationResult,
)
from great_expectations.data_context import BaseDataContext
from great_expectations.data_context.types.base import (
    DataContextConfig,
    DatasourceConfig,
    InMemoryStoreBackendDefaults,
)

from metadata.generated.schema.entity.data.table import TableProfile, ColumnProfile
from metadata.ingestion.api.source import SourceStatus
from metadata.profiler.util import group_by

logger: logging.Logger = logging.getLogger(__name__)


class DataProfiler:
    data_context: BaseDataContext
    status: SourceStatus
    datasource_name: str = "om_data_source"

    def __init__(self, connection_str, status):
        self.status = status
        self.connection_str = connection_str
        data_context_config = DataContextConfig(
            datasources={
                self.datasource_name: DatasourceConfig(
                    class_name="SqlAlchemyDatasource",
                    credentials={
                        "url": self.connection_str,
                    },
                )
            },
            store_backend_defaults=InMemoryStoreBackendDefaults(),
            anonymous_usage_statistics={
                "enabled": False,
            },
        )

        self.data_context = BaseDataContext(project_config=data_context_config)

    def run_profiler(
            self,
            dataset_name: str,
            schema: str = None,
            table: str = None,
            limit: int = None,
            offset: int = None,
            **kwargs: Any,
    ) -> TableProfile:
        profile_test_results = self._profile_data_asset(
            {
                "schema": schema,
                "table": table,
                "limit": limit,
                "offset": offset,
                **kwargs,
            }
        )
        profile = self._parse_test_results_to_table_profile(profile_test_results, dataset_name=dataset_name)
        return profile

    def _profile_data_asset(
            self,
            batch_kwargs: dict
    ) -> ExpectationSuiteValidationResult:

        profile_results = self.data_context.profile_data_asset(
            self.datasource_name,
            batch_kwargs={
                "datasource": self.datasource_name,
                **batch_kwargs,
            },
        )
        assert profile_results["success"]

        assert len(profile_results["results"]) == 1
        test_suite, test_results = profile_results["results"][0]
        return test_results

    @staticmethod
    def _get_column_from_result(result: ExpectationValidationResult) -> Optional[str]:
        return result.expectation_config.kwargs.get("column")

    def _parse_test_results_to_table_profile(
            self, profile_test_results: ExpectationSuiteValidationResult, dataset_name: str
    ) -> TableProfile:
        profile = None
        column_profiles = []
        for col, col_test_result in group_by(
                profile_test_results.results, key=self._get_column_from_result
        ):
            if col is None:
                profile = self._parse_table_test_results(col_test_result, dataset_name=dataset_name)
            else:
                column_profile = self._parse_column_test_results(col, col_test_result, dataset_name=dataset_name)
                column_profiles.append(column_profile)

        if profile is not None:
            profile.columnProfile = column_profiles
        return profile

    def _parse_table_test_results(
            self,
            table_test_results: Iterable[ExpectationValidationResult],
            dataset_name: str,
    ) -> TableProfile:
        logger.info("generating table stats")
        profile = TableProfile(profileDate=datetime.now(). strftime("%Y-%m-%d"))
        for table_result in table_test_results:
            expectation: str = table_result.expectation_config.expectation_type
            result: dict = table_result.result
            if expectation == "expect_table_row_count_to_be_between":
                profile.rowCount = result['observed_value']
            elif expectation == "expect_table_columns_to_match_ordered_list":
                profile.columnCount = len(result["observed_value"])
            else:
                self.status.warning(
                    f"profile of {dataset_name}", f"unknown table mapper {expectation}"
                )
        return profile

    def _parse_column_test_results(
            self,
            column: str,
            col_test_results: Iterable[ExpectationValidationResult],
            dataset_name: str,
    ) -> ColumnProfile:
        logger.info(f"Generating Column Stats for {column}")
        column_profile = ColumnProfile(name=column)
        for col_result in col_test_results:
            expectation: str = col_result.expectation_config.expectation_type
            result: dict = col_result.result
            if not result:
                self.status.warning(
                    f"profile of {dataset_name}", f"{expectation} did not yield any results"
                )
                continue

            if expectation == "expect_column_unique_value_count_to_be_between":
                column_profile.uniqueCount = result["observed_value"]
            elif expectation == "expect_column_proportion_of_unique_values_to_be_between":
                column_profile.uniqueProportion = result["observed_value"]
            elif expectation == "expect_column_values_to_not_be_null":
                column_profile.nullCount = result["unexpected_count"]
                if (
                        "unexpected_percent" in result
                        and result["unexpected_percent"] is not None
                ):
                    column_profile.nullProportion = result["unexpected_percent"] / 100
            elif expectation == "expect_column_values_to_not_match_regex":
                pass
            elif expectation == "expect_column_mean_to_be_between":
                column_profile.mean = str(result["observed_value"])
            elif expectation == "expect_column_min_to_be_between":
                column_profile.min = str(result["observed_value"])
            elif expectation == "expect_column_max_to_be_between":
                column_profile.max = str(result["observed_value"])
            elif expectation == "expect_column_median_to_be_between":
                column_profile.median = str(result["observed_value"])
            elif expectation == "expect_column_stdev_to_be_between":
                column_profile.stddev = str(result["observed_value"])
            elif expectation == "expect_column_quantile_values_to_be_between":
                pass
            elif expectation == "expect_column_values_to_be_in_set":
                #column_profile.sample_values = [
                 #   str(v) for v in result["partial_unexpected_list"]
                #]
                pass
            elif expectation == "expect_column_kl_divergence_to_be_less_than":
                pass
            elif expectation == "expect_column_distinct_values_to_be_in_set":
                pass
            elif expectation == "expect_column_values_to_be_in_type_list":
                pass
            elif expectation == "expect_column_values_to_be_unique":
                pass
            else:
                self.status.warning(
                    f"profile of {dataset_name}",
                    f"warning: unknown column mapper {expectation} in col {column}",
                )
        return column_profile
