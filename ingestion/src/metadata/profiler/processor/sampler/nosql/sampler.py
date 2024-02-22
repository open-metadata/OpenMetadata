from typing import Dict, List, Optional, Tuple

from metadata.generated.schema.entity.data.table import ProfileSampleType, TableData
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor
from metadata.profiler.processor.sampler.sampler_interface import SamplerInterface
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
from metadata.utils.sqa_like_column import SQALikeColumn


class NoSQLSampler(SamplerInterface):
    client: NoSQLAdaptor

    def _rdn_sample_from_user_query(self) -> List[Dict[str, any]]:
        """
        Get random sample from user query
        """
        limit = self._get_limit()
        return self.client.query(
            self.table, self.table.columns, self._profile_sample_query, limit
        )

    def _fetch_sample_data_from_user_query(self) -> TableData:
        """
        Fetch sample data based on a user query. Assuming the enging has one (example: MongoDB)
        If the engine does not support a custom query, an error will be raised.
        """
        records = self._rdn_sample_from_user_query()
        columns = [
            SQALikeColumn(name=column.name.__root__, type=column.dataType)
            for column in self.table.columns
        ]
        rows, cols = self.transpose_records(records, columns)
        return TableData(rows=rows, columns=[c.name for c in cols])

    def random_sample(self):
        pass

    def fetch_sample_data(self, columns: List[SQALikeColumn]) -> TableData:
        if self._profile_sample_query:
            return self._fetch_sample_data_from_user_query()
        return self._fetch_sample_data(columns)

    def _fetch_sample_data(self, columns: List[SQALikeColumn]):
        """
        returns sampled ometa dataframes
        """
        limit = self._get_limit()
        records = self.client.scan(self.table, self.table.columns, limit)
        rows, cols = self.transpose_records(records, columns)
        return TableData(rows=rows, columns=[col.name for col in cols])

    def _get_limit(self) -> Optional[int]:
        num_rows = self.client.item_count(self.table)
        if self.profile_sample_type == ProfileSampleType.PERCENTAGE:
            limit = num_rows * (self.profile_sample / 100)
        elif self.profile_sample_type == ProfileSampleType.ROWS:
            limit = self.profile_sample
        else:
            limit = SAMPLE_DATA_DEFAULT_COUNT
        return limit

    @staticmethod
    def transpose_records(
        records: List[Dict[str, any]], columns: List[SQALikeColumn]
    ) -> Tuple[List[List[any]], List[SQALikeColumn]]:
        rows = []
        for record in records:
            row = []
            for column in columns:
                row.append(record.get(column.name))
            rows.append(row)
        return rows, columns
