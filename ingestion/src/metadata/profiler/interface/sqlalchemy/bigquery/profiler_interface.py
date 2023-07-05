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

"""
Interfaces with database for BigQuery engine
supporting sqlalchemy abstraction layer
"""

from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.processor.sqlalchemy.bigquery_sampler import BigQuerySampler


class BigQueryProfilerInterface(SQAProfilerInterface):
    """
    Interface to interact with BigQuery registry.
    """

    _profiler_type: str = "BigQuery"

    def __init__(
        self,
        **kwargs,
    ):
        super().__init__(**kwargs)

    def _instantiate_sampler(
        self,
        session,
        table,
        sample_columns,
        profile_sample_config,
        partition_details,
        profile_sample_query,
    ):
        return BigQuerySampler(
            session=session,
            table=table,
            sample_columns=sample_columns,
            profile_sample_config=profile_sample_config,
            partition_details=partition_details,
            profile_sample_query=profile_sample_query,
        )
