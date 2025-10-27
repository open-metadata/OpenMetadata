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
MF4 DataFrame reader for processing MF4 (Measurement Data Format) files
"""

import io

import pandas as pd

from metadata.readers.dataframe.base import DataFrameReader
from metadata.readers.dataframe.common import dataframe_to_chunks
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MF4DataFrameReader(DataFrameReader):
    """
    MF4 file reader implementation for extracting schema and data
    from MF4 (Measurement Data Format) files.
    """

    @staticmethod
    def extract_schema_from_header(mf4_bytes: bytes) -> DatalakeColumnWrapper:
        """
        Extract schema from MF4 header common properties.
        This method uses the MDF header metadata instead of actual data extraction.
        """
        from asammdf import MDF

        file_obj = io.BytesIO(mf4_bytes)

        mdf = MDF(file_obj)

        if hasattr(mdf, "header") and hasattr(mdf.header, "_common_properties"):
            common_props = mdf.header._common_properties

            schema_dict = {}

            for key, value in common_props.items():
                schema_dict[key] = pd.Series(value)

            if schema_dict:
                schema_df = pd.DataFrame(schema_dict, index=[0])
                logger.info(f"Extracted {len(schema_dict)} properties from MF4 header")
                return DatalakeColumnWrapper(
                    dataframes=dataframe_to_chunks(schema_df), raw_data=common_props
                )

        logger.debug("No _common_properties found in header.")

    @staticmethod
    def read_from_mf4(mf4_bytes: bytes) -> DatalakeColumnWrapper:
        """
        Convert MF4 file content to DatalakeColumnWrapper using header schema extraction.
        """
        return MF4DataFrameReader.extract_schema_from_header(mf4_bytes)

    def _read(self, *, key: str, bucket_name: str, **__) -> DatalakeColumnWrapper:
        """
        Read MF4 file and extract schema information.
        """
        file_content = self.reader.read(key, bucket_name=bucket_name)
        return self.read_from_mf4(file_content)
