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
Helper module to handle BigQuery data sampling
for the profiler
"""

from metadata.generated.schema.entity.data.table import ProfileSampleType, TableData
from metadata.profiler.processor.sqlalchemy.sampler import Sampler
from metadata.profiler.source.bigquery.queries import BIGQUERY_TABLESAMPLE


class BigQuerySampler(Sampler):
    """
    Generates a sample of the BigQuery to not
    run the query in the whole table.
    """

    sample_stmt = BIGQUERY_TABLESAMPLE
    default_percent = 10

    def __init__(
        self,
        **kwargs,
    ):
        super().__init__(**kwargs)

    def get_bq_sample_query(self) -> str:
        """get query for sample data"""
        if self.profile_sample_type == ProfileSampleType.PERCENTAGE:
            return self.sample_stmt.format(
                table=self.table.__tablename__,
                col=", ".join(
                    "`" + col_name.lower() + "`" for col_name in self.sample_columns
                ),
                relative_table=self.table.__table__,
                percent=self.profile_sample,
                result_limit=self.sample_limit,
            )

        return self.sample_stmt.format(
            table=self.table.__tablename__,
            col=", ".join(
                "`" + col_name.lower() + "`" for col_name in self.sample_columns
            ),
            relative_table=self.table.__table__,
            percent=self.default_percent,
            result_limit=self.profile_sample,
        )

    def fetch_sqa_sample_data(self) -> TableData:
        """
        Use the sampler to retrieve sample data rows as per limit given by user
        :return: TableData to be added to the Table Entity
        """
        if self._profile_sample_query:
            return self._fetch_sample_data_from_user_query()

        bq_sample = self.session.execute(self.get_bq_sample_query())
        return TableData(
            columns=list(self.sample_columns),
            rows=[list(row) for row in bq_sample],
        )
