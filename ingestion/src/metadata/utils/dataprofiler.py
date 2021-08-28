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
import collections
import contextlib
import dataclasses
import logging
import unittest.mock
import time
from typing import Any, Iterable, Optional, Callable, Tuple, TypeVar

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
from great_expectations.datasource.sqlalchemy_datasource import SqlAlchemyDatasource

from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.models.table_metadata import DatasetProfile, DatasetColumnProfile, Quantile, \
    Histogram, ValueFrequency

logger: logging.Logger = logging.getLogger(__name__)

T = TypeVar("T")
K = TypeVar("K")


def groupby_unsorted(
        iterable: Iterable[T], key: Callable[[T], K]
) -> Iterable[Tuple[K, Iterable[T]]]:
    """The default itertools.groupby() requires that the iterable is already sorted by the key.
    This method is similar to groupby() but without the pre-sorted requirement."""

    values = collections.defaultdict(list)
    for v in iterable:
        values[key(v)].append(v)
    return values.items()


@contextlib.contextmanager
def _properly_init_datasource(conn):
    underlying_datasource_init = SqlAlchemyDatasource.__init__

    def sqlalchemy_datasource_init(
            self: SqlAlchemyDatasource, *args: Any, **kwargs: Any
    ) -> None:
        underlying_datasource_init(self, *args, **kwargs, engine=conn)
        self.drivername = conn.dialect.name
        del self._datasource_config["engine"]

    with unittest.mock.patch(
            "great_expectations.datasource.sqlalchemy_datasource.SqlAlchemyDatasource.__init__",
            sqlalchemy_datasource_init,
    ), unittest.mock.patch(
        "great_expectations.data_context.store.validations_store.ValidationsStore.set"
    ):
        yield


@dataclasses.dataclass
class DataProfiler:
    data_context: BaseDataContext
    status: SourceStatus
    datasource_name: str = "om_sqlalchemy_datasource"

    def __init__(self, conn, status):
        self.conn = conn
        self.status = status

        data_context_config = DataContextConfig(
            datasources={
                self.datasource_name: DatasourceConfig(
                    class_name="SqlAlchemyDatasource",
                    credentials={
                        "url": self.conn.engine.url,
                    },
                )
            },
            store_backend_defaults=InMemoryStoreBackendDefaults(),
            anonymous_usage_statistics={
                "enabled": False,
            },
        )

        with _properly_init_datasource(self.conn):
            self.data_context = BaseDataContext(project_config=data_context_config)

    def generate_profile(
            self,
            pretty_name: str,
            schema: str = None,
            table: str = None,
            limit: int = None,
            offset: int = None,
            **kwargs: Any,
    ) -> DatasetProfile:
        with _properly_init_datasource(self.conn):
            evrs = self._profile_data_asset(
                {
                    "schema": schema,
                    "table": table,
                    "limit": limit,
                    "offset": offset,
                    **kwargs,
                },
                pretty_name=pretty_name,
            )
        profile = self._convert_evrs_to_profile(evrs, pretty_name=pretty_name)
        return profile

    def _profile_data_asset(
            self,
            batch_kwargs: dict,
            pretty_name: str,
    ) -> ExpectationSuiteValidationResult:
        # Internally, this uses the GE dataset profiler:
        # great_expectations.profile.basic_dataset_profiler.BasicDatasetProfiler

        profile_results = self.data_context.profile_data_asset(
            self.datasource_name,
            batch_kwargs={
                "datasource": self.datasource_name,
                **batch_kwargs,
            },
        )
        assert profile_results["success"]

        assert len(profile_results["results"]) == 1
        _suite, evrs = profile_results["results"][0]
        return evrs

    @staticmethod
    def _get_column_from_evr(evr: ExpectationValidationResult) -> Optional[str]:
        return evr.expectation_config.kwargs.get("column")

    def _convert_evrs_to_profile(
            self, evrs: ExpectationSuiteValidationResult, pretty_name: str
    ) -> DatasetProfile:
        profile = None
        column_profiles = []
        for col, evrs_for_col in groupby_unsorted(
                evrs.results, key=self._get_column_from_evr
        ):
            if col is None:
                profile = self._handle_convert_table_evrs(evrs_for_col, pretty_name=pretty_name)
            else:
                column_profile = self._handle_convert_column_evrs(col, evrs_for_col, pretty_name=pretty_name)
                column_profiles.append(column_profile)

        if profile is not None:
            profile.col_profiles = column_profiles
        return profile

    def _handle_convert_table_evrs(
            self,
            table_evrs: Iterable[ExpectationValidationResult],
            pretty_name: str,
    ) -> DatasetProfile:
        logger.info("generating table stats")
        profile = DatasetProfile(timestamp=round(time.time() * 1000), table_name=pretty_name)
        for evr in table_evrs:
            exp: str = evr.expectation_config.expectation_type
            res: dict = evr.result
            if exp == "expect_table_row_count_to_be_between":
                profile.row_count = res["observed_value"]
            elif exp == "expect_table_columns_to_match_ordered_list":
                profile.col_count = len(res["observed_value"])
            else:
                self.status.warning(
                    f"profile of {pretty_name}", f"unknown table mapper {exp}"
                )
        return profile

    def _handle_convert_column_evrs(
            self,
            column: str,
            col_evrs: Iterable[ExpectationValidationResult],
            pretty_name: str,
    ) -> DatasetColumnProfile:
        logger.info(f"Generating Column Stats for {column}")
        column_profile = DatasetColumnProfile(fqdn=column)
        for evr in col_evrs:
            exp: str = evr.expectation_config.expectation_type
            res: dict = evr.result
            if not res:
                self.status.warning(
                    f"profile of {pretty_name}", f"{exp} did not yield any results"
                )
                continue

            if exp == "expect_column_unique_value_count_to_be_between":
                column_profile.unique_count = res["observed_value"]
            elif exp == "expect_column_proportion_of_unique_values_to_be_between":
                column_profile.unique_proportion = res["observed_value"]
            elif exp == "expect_column_values_to_not_be_null":
                column_profile.null_count = res["unexpected_count"]
                if (
                        "unexpected_percent" in res
                        and res["unexpected_percent"] is not None
                ):
                    column_profile.null_proportion = res["unexpected_percent"] / 100
            elif exp == "expect_column_values_to_not_match_regex":
                pass
            elif exp == "expect_column_mean_to_be_between":
                column_profile.mean = str(res["observed_value"])
            elif exp == "expect_column_min_to_be_between":
                column_profile.min = str(res["observed_value"])
            elif exp == "expect_column_max_to_be_between":
                column_profile.max = str(res["observed_value"])
            elif exp == "expect_column_median_to_be_between":
                column_profile.median = str(res["observed_value"])
            elif exp == "expect_column_stdev_to_be_between":
                column_profile.stddev = str(res["observed_value"])
            elif exp == "expect_column_quantile_values_to_be_between":
                if "observed_value" in res:
                    column_profile.quantiles = [
                        Quantile(quantile=str(quantile), value=str(value))
                        for quantile, value in zip(
                            res["observed_value"]["quantiles"],
                            res["observed_value"]["values"],
                        )
                    ]
            elif exp == "expect_column_values_to_be_in_set":
                column_profile.sample_values = [
                    str(v) for v in res["partial_unexpected_list"]
                ]
            elif exp == "expect_column_kl_divergence_to_be_less_than":
                if "details" in res and "observed_partition" in res["details"]:
                    partition = res["details"]["observed_partition"]
                    column_profile.histogram = Histogram(
                        [str(v) for v in partition["bins"]],
                        [
                            partition["tail_weights"][0],
                            *partition["weights"],
                            partition["tail_weights"][1],
                        ],
                    )
            elif exp == "expect_column_distinct_values_to_be_in_set":
                if "details" in res and "value_counts" in res["details"]:
                    column_profile.distinct_value_frequencies = [
                        ValueFrequency(value=str(value), frequency=count)
                        for value, count in res["details"]["value_counts"].items()
                    ]
            elif exp == "expect_column_values_to_be_in_type_list":
                pass
            elif exp == "expect_column_values_to_be_unique":
                pass
            else:
                self.status.warning(
                    f"profile of {pretty_name}",
                    f"warning: unknown column mapper {exp} in col {column}",
                )
        return column_profile
