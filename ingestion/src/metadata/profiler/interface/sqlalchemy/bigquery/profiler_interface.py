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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""

from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.processor.sampler.sampler_factory import sampler_factory_


class BigQueryProfilerInterface(SQAProfilerInterface):
    """BigQuery profiler interface"""

    def _get_sampler(self, **kwargs):
        """get sampler object"""
        session = kwargs.get("session")
        table = kwargs["table"]

        return sampler_factory_.create(
            self.service_connection_config.__class__.__name__,
            client=session or self.session,
            table=table,
            profile_sample_config=self.profile_sample_config,
            partition_details=self.partition_details,
            profile_sample_query=self.profile_query,
            table_type=self.table_entity.tableType,
        )
