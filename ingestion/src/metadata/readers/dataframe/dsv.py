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

"""
Generic Delimiter-Separated-Values implementation
"""
import csv
import functools
import traceback
from functools import singledispatchmethod
from io import StringIO
from typing import Any, Dict, List, Optional

from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    LocalConfig,
)
from metadata.readers.dataframe.base import DataFrameReader, FileFormatException
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.readers.file.adls import AZURE_PATH, return_azure_storage_options
from metadata.readers.file.s3 import return_s3_storage_options
from metadata.readers.models import ConfigSource
from metadata.utils.constants import CHUNKSIZE
from metadata.utils.logger import ingestion_logger

TSV_SEPARATOR = "\t"
CSV_SEPARATOR = ","
logger = ingestion_logger()


class DSVDataFrameReader(DataFrameReader):
    """
    Manage the implementation to read DSV dataframes
    from any source based on its init client.
    """

    def _reformat_malformed_csv_data(
        self, chunk_list: List, parsed_columns: List, separator: str
    ):
        import pandas as pd  # pylint: disable=import-outside-toplevel

        try:
            updated_chunk_list = []
            for chunk in chunk_list:
                values_list = []
                for value in chunk.values:
                    single_row_value = list(
                        csv.reader(StringIO(str(value[0])), delimiter=separator)
                    )
                    if single_row_value:
                        values_list.append(single_row_value[0])
                updated_chunk_list.append(
                    pd.DataFrame(columns=parsed_columns, data=values_list)
                )
            return updated_chunk_list
        except Exception as exc:
            logger.error(f"Error reformating the data: {exc}")
            logger.debug(traceback.format_exc())
            logger.debug(
                "Only parsing column data from csv since csv data can't be parsed"
            )
            return [pd.DataFrame(columns=parsed_columns)]

    def _fix_malformed_quoted_chunk(self, chunk_list: list, separator: str) -> list:
        """
        Fix malformed CSV where header row is wrapped in quotes as a single column.

        Some CSV exports incorrectly wrap the entire header row in quotes, e.g.:
        "col1,col2,col3" instead of col1,col2,col3

        This causes pandas to parse it as a single column with the entire header
        string as the column name.

        For header-only files (no data rows), creates a new DataFrame with proper columns.
        For files with data, the data is also malformed and cannot be automatically fixed,
        so we return a header-only DataFrame to at least capture the schema.

        Returns the fixed chunk_list.
        """
        import pandas as pd  # pylint: disable=import-outside-toplevel

        if not chunk_list:
            return chunk_list

        first_chunk = chunk_list[0]
        columns = list(first_chunk.columns)

        if len(columns) == 1 and separator in str(columns[0]):
            parsed_columns = list(
                csv.reader(StringIO(str(columns[0])), delimiter=separator)
            )
            if parsed_columns:
                return self._reformat_malformed_csv_data(
                    chunk_list, parsed_columns[0], separator
                )
        return chunk_list

    def __init__(
        self,
        config_source: ConfigSource,
        client: Optional[Any],
        separator: str = CSV_SEPARATOR,
    ):
        self.separator = separator
        super().__init__(config_source, client)

    def read_from_pandas(
        self,
        path: str,
        storage_options: Optional[Dict[str, Any]] = None,
        compression: Optional[str] = None,
    ) -> DatalakeColumnWrapper:
        import pandas as pd  # pylint: disable=import-outside-toplevel

        # Determine compression based on file extension if not provided
        if compression is None and path.endswith(".gz"):
            compression = "gzip"

        def chunk_generator():
            with pd.read_csv(
                path,
                sep=self.separator,
                chunksize=CHUNKSIZE,
                storage_options=storage_options,
                compression=compression,
                encoding_errors="ignore",
                escapechar="\\",
            ) as reader:
                for chunks in reader:
                    chunks = self._fix_malformed_quoted_chunk(
                        chunk_list=[chunks], separator=self.separator
                    )[0]
                    yield chunks

        return DatalakeColumnWrapper(
            dataframes=chunk_generator, columns=None, raw_data=None
        )

    @singledispatchmethod
    def _read_dsv_dispatch(
        self, config_source: ConfigSource, key: str, bucket_name: str
    ) -> DatalakeColumnWrapper:
        raise FileFormatException(config_source=config_source, file_name=key)

    @_read_dsv_dispatch.register
    def _(self, _: GCSConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """
        Read the CSV file from the gcs bucket and return a dataframe
        """
        # Determine compression based on file extension
        compression = None
        if key.endswith(".gz"):
            compression = "gzip"

        path = f"gs://{bucket_name}/{key}"
        return self.read_from_pandas(path=path, compression=compression)

    @_read_dsv_dispatch.register
    def _(self, _: S3Config, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        compression = "gzip" if key.endswith(".gz") else None

        storage_options = return_s3_storage_options(self.config_source)
        path = f"s3://{bucket_name}/{key}"
        return self.read_from_pandas(
            path=path, storage_options=storage_options, compression=compression
        )

    @_read_dsv_dispatch.register
    def _(self, _: AzureConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        # Determine compression based on file extension
        compression = None
        if key.endswith(".gz"):
            compression = "gzip"

        storage_options = return_azure_storage_options(self.config_source)
        path = AZURE_PATH.format(
            bucket_name=bucket_name,
            account_name=self.config_source.securityConfig.accountName,
            key=key,
        )
        return self.read_from_pandas(
            path=path,
            storage_options=storage_options,
            compression=compression,
        )

    @_read_dsv_dispatch.register
    def _(  # pylint: disable=unused-argument
        self, _: LocalConfig, key: str, bucket_name: str
    ) -> DatalakeColumnWrapper:
        # Determine compression based on file extension
        compression = None
        if key.endswith(".gz"):
            compression = "gzip"

        return self.read_from_pandas(path=key, compression=compression)

    def _read(self, *, key: str, bucket_name: str, **__) -> DatalakeColumnWrapper:
        return self._read_dsv_dispatch(
            self.config_source, key=key, bucket_name=bucket_name
        )


def get_dsv_reader_by_separator(separator: str) -> functools.partial:
    return functools.partial(DSVDataFrameReader, separator=separator)


CSVDataFrameReader = get_dsv_reader_by_separator(separator=CSV_SEPARATOR)
TSVDataFrameReader = get_dsv_reader_by_separator(separator=TSV_SEPARATOR)
