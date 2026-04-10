#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""BurstIQ-specific profiler interface overrides."""
import traceback as _tb
from typing import Callable, List, Optional

import pandas as _pd

from metadata.generated.schema.entity.data.table import DataType
from metadata.profiler.interface.pandas.profiler_interface import (
    PandasProfilerInterface,
)
from metadata.utils.datalake.datalake_utils import GenericDataFrameColumnParser
from metadata.utils.logger import profiler_interface_registry_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = profiler_interface_registry_logger()

_NUMERIC_TYPES = {
    DataType.DOUBLE,
    DataType.BIGINT,
    DataType.LONG,
    DataType.SMALLINT,
    DataType.TINYINT,
    DataType.DECIMAL,
    DataType.NUMERIC,
    DataType.NUMBER,
    DataType.FLOAT,
    DataType.INT,
}

_DATETIME_TYPES = {
    DataType.DATETIME,
    DataType.TIMESTAMP,
    DataType.DATE,
    DataType.TIME,
}


class BurstIQProfilerInterface(PandasProfilerInterface):
    """BurstIQ-specific profiler interface."""

    def get_columns(self) -> List[Optional[SQALikeColumn]]:
        """Override to fix type misclassification and column name consistency.

        The parent infers column types from pandas df dtypes. BurstIQ's timezone-aware
        datetime columns (datetime64[ns, UTC]) and string-encoded numerics ("9.87E+08")
        both land as object dtype, so fetch_col_types resolves them to STRING. This causes
        is_quantifiable() to return False and skips numeric metrics entirely.

        We use OM-declared types (e.g. DOUBLE, DATETIME) instead, looked up by column name.
        We also iterate only first_df.columns (columns the API actually returned) rather than
        self.table.columns (all 40 OM columns), which avoids KeyErrors for the columns absent
        from the TQL response and ensures the column names used here match exactly what
        _type_casted_dataset uses for its name-based lookups.
        """
        if self.dataset is None:
            return []
        first_df = next(self.dataset(), None)
        if first_df is None:
            return []
        om_type_by_name = {col.name.root: col.dataType for col in self.table.columns}
        return [
            SQALikeColumn(
                name=col_name,
                type=om_type_by_name.get(
                    col_name,
                    GenericDataFrameColumnParser.fetch_col_types(first_df, col_name),
                ),
            )
            for col_name in first_df.columns
        ]

    def _type_casted_dataset(self, original_dataset: Callable) -> Callable:
        """Override to fix wrong positional type mapping and numeric casting failures.

        The parent builds a type list from all OM columns and zips it positionally against
        df columns. When BurstIQ's TQL returns fewer columns than OM declares, the positions
        diverge — e.g. a STRING column like 'lastsurname' gets mapped to an INT type and
        astype() raises "invalid literal for int() with base 10: 'Garcia'".

        Two additional casts the parent cannot handle:
        - Scientific notation strings: BurstIQ returns large numbers as "9.87E+08".
          astype("float64") silently leaves these as object dtype; pd.to_numeric parses them.
        - Timezone-aware datetimes: columns stored as datetime64[ns, UTC] raise TypeError
          when cast to timezone-naive. We skip datetime columns entirely.
        """
        numeric_cols = {
            col.name.root
            for col in self.table.columns
            if col.dataType in _NUMERIC_TYPES
        }
        data_formats = GenericDataFrameColumnParser._data_formats
        other_cast_map = {}
        for col in self.table.columns:
            if col.dataType in _NUMERIC_TYPES or col.dataType in _DATETIME_TYPES:
                continue
            coltype = next(
                (k for k, v in data_formats.items() if col.dataType == v), None
            )
            if coltype and col.dataType not in {DataType.JSON, DataType.ARRAY}:
                other_cast_map[col.name.root] = coltype

        def yield_type_casted_dfs():
            for df in original_dataset():
                try:
                    df = self._rename_complex_columns(df)
                    for col_name in numeric_cols:
                        if col_name in df.columns:
                            df[col_name] = _pd.to_numeric(df[col_name], errors="coerce")
                    if other_cast_map:
                        filtered = {
                            c: other_cast_map[c]
                            for c in df.keys()
                            if c in other_cast_map
                        }
                        if filtered:
                            try:
                                df = df.astype(filtered)
                            except (TypeError, ValueError) as err:
                                logger.warning(
                                    f"NaN/NoneType found in the Dataframe: {err}"
                                )
                except Exception as err:  # pylint: disable=broad-except
                    logger.warning(f"Error casting BurstIQ dataframe columns: {err}")
                    logger.debug(_tb.format_exc())
                yield df

        return yield_type_casted_dfs
