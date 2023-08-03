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
Module to define Datalake Exceptions
"""
from typing import Any, Dict

from metadata.utils.constants import CHUNKSIZE

AZURE_PATH = "abfs://{bucket_name}@{account_name}.dfs.core.windows.net/{key}"


class DatalakeFileFormatException(Exception):
    def __init__(self, config_source: Any, file_name: str) -> None:
        message = f"Missing implementation for {config_source.__class__.__name__} for {file_name}"
        super().__init__(message)


def return_azure_storage_options(config_source: Any) -> Dict:
    """
    Build the Azure Storage options to pass to the readers.
    We are not adding the `account_name` since it is added in the path.
    If we pass it here as well we'll get an error reading the data:
      "got multiple values for argument 'account_name'"
    """
    connection_args = config_source.securityConfig
    return {
        "tenant_id": connection_args.tenantId,
        "client_id": connection_args.clientId,
        "client_secret": connection_args.clientSecret.get_secret_value(),
    }


def dataframe_to_chunks(df):
    """
    Reads the Dataframe and returns list of dataframes broken down in chunks
    """
    return [
        df[range_iter : range_iter + CHUNKSIZE]
        for range_iter in range(0, len(df), CHUNKSIZE)
    ]
