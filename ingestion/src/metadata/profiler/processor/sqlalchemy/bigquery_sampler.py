"""
Helper module to handle BigQuery data sampling
for the profiler
"""
from typing import Dict, List, Optional

from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.generated.schema.entity.data.table import ProfileSampleType, TableData
from metadata.profiler.source.bigquery.queries import BIGQUERY_TABLESAMPLE
from metadata.profiler.api.models import ProfileSampleConfig
from metadata.profiler.processor.sampler import Sampler


class BigQuerySampler(Sampler):
    sample_stmt = BIGQUERY_TABLESAMPLE
    default_percent = 10

    def __init__(
        self,
        session: Optional[Session],
        table: DeclarativeMeta,
        sample_columns: List[str],
        profile_sample_config: Optional[ProfileSampleConfig] = None,
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
    ):
        super().__init__(
            session,
            table,
            sample_columns,
            profile_sample_config,
            partition_details,
            profile_sample_query,
        )

    def get_sample_query(self) -> str:
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

        bq_sample = self.session.execute(self.get_sample_query())
        return TableData(
            columns=[column for column in self.sample_columns],
            rows=[list(row) for row in bq_sample],
        )
