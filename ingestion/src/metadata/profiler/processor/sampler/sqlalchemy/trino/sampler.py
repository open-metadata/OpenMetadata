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
Helper module to handle data sampling
for the profiler
"""
from sqlalchemy import and_, inspect, text

from metadata.generated.schema.entity.data.table import TableData
from metadata.profiler.orm.registry import FLOAT_SET
from metadata.profiler.processor.handle_partition import RANDOM_LABEL
from metadata.profiler.processor.sampler.sqlalchemy.sampler import SQASampler


class TrinoSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def fetch_sample_data(self) -> TableData:
        """
        Use the sampler to retrieve sample data rows as per limit given by user
        :return: TableData to be added to the Table Entity
        """
        if self._profile_sample_query:
            return self._fetch_sample_data_from_user_query()

        # Add new RandomNumFn column
        rnd = self.get_sample_query()
        sqa_columns = [col for col in inspect(rnd).c if col.name != RANDOM_LABEL]

        sqa_sample = (
            self.client.query(*sqa_columns)
            .select_from(rnd)
            .where(
                and_(
                    *[
                        text(f"is_nan({cols}) = False")
                        for cols in sqa_columns
                        if type(cols.type) in FLOAT_SET
                    ]
                )
            )
            .limit(self.sample_limit)
            .all()
        )
        return TableData(
            columns=[column.name for column in sqa_columns],
            rows=[list(row) for row in sqa_sample],
        )
