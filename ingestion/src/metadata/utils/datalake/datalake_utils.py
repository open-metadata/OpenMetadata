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
Module to define helper methods for datalake and to fetch data and metadata 
from different auths and different file systems.
"""

from typing import List, Optional

from metadata.readers.dataframe.models import (
    DatalakeColumnWrapper,
    DatalakeTableSchemaWrapper,
)
from metadata.readers.dataframe.reader_factory import SupportedTypes, get_reader
from metadata.utils.logger import utils_logger

logger = utils_logger()


def fetch_dataframe(
    config_source,
    client,
    file_fqn: DatalakeTableSchemaWrapper,
    **kwargs,
) -> Optional[List["DataFrame"]]:
    """
    Method to get dataframe for profiling
    """
    # dispatch to handle fetching of data from multiple file formats (csv, tsv, json, avro and parquet)
    key: str = file_fqn.key
    bucket_name: str = file_fqn.bucket_name

    try:
        for supported_type in SupportedTypes:
            if key.endswith(supported_type.value):

                df_reader = get_reader(
                    type_=supported_type,
                    config_source=config_source,
                    client=client,
                )

                df_wrapper: DatalakeColumnWrapper = df_reader.read(
                    key=key, bucket_name=bucket_name, **kwargs
                )
                return df_wrapper.dataframes

    except Exception as err:
        logger.error(
            f"Error fetching file [{bucket_name}/{key}] using [{config_source.__class__.__name__}] due to: [{err}]"
        )
        # Here we need to blow things up. Without the dataframe we cannot move forward
        raise err

    return None


def get_file_format_type(
    key: str,
) -> Optional[str]:
    """
    Method to get file format type
    """
    for supported_type in SupportedTypes:
        if key.endswith(supported_type.value):
            return supported_type.value

    return None
