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
from functools import singledispatchmethod

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
from metadata.readers.dataframe.common import dataframe_to_chunks
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.readers.file.adls import AZURE_PATH, return_azure_storage_options
from metadata.readers.models import ConfigSource


class ParquetDataFrameReader(DataFrameReader):
    """
    Manage the implementation to read DSV dataframes
    from any source based on its init client.
    """

    @singledispatchmethod
    def _read_parquet_dispatch(
        self, config_source: ConfigSource, key: str, bucket_name: str
    ) -> DatalakeColumnWrapper:
        raise FileFormatException(config_source=config_source, file_name=key)

    @_read_parquet_dispatch.register
    def _(self, _: GCSConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """
        Read the CSV file from the gcs bucket and return a dataframe
        """
        # pylint: disable=import-outside-toplevel
        from gcsfs import GCSFileSystem
        from pyarrow.parquet import ParquetFile

        gcs = GCSFileSystem()
        file = gcs.open(f"gs://{bucket_name}/{key}")
        dataframe_response = (
            ParquetFile(file).read().to_pandas(split_blocks=True, self_destruct=True)
        )
        return dataframe_to_chunks(dataframe_response)

    @_read_parquet_dispatch.register
    def _(self, _: S3Config, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        # pylint: disable=import-outside-toplevel
        from pyarrow.fs import S3FileSystem
        from pyarrow.parquet import ParquetDataset

        client_kwargs = {
            "endpoint_override": (
                str(self.config_source.securityConfig.endPointURL)
                if self.config_source.securityConfig.endPointURL
                else None
            ),
            "region": (
                self.config_source.securityConfig.awsRegion
                if self.config_source.securityConfig.awsRegion
                else None
            ),
            "access_key": self.config_source.securityConfig.awsAccessKeyId,
            "session_token": self.config_source.securityConfig.awsSessionToken,
            "role_arn": self.config_source.securityConfig.assumeRoleArn,
            "session_name": self.config_source.securityConfig.assumeRoleSessionName,
        }
        if self.config_source.securityConfig.awsSecretAccessKey:
            client_kwargs[
                "secret_key"
            ] = self.config_source.securityConfig.awsSecretAccessKey.get_secret_value()
        s3_fs = S3FileSystem(**client_kwargs)

        bucket_uri = f"{bucket_name}/{key}"
        dataset = ParquetDataset(bucket_uri, filesystem=s3_fs)

        return dataframe_to_chunks(dataset.read_pandas().to_pandas())

    @_read_parquet_dispatch.register
    def _(self, _: AzureConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        import pandas as pd  # pylint: disable=import-outside-toplevel

        storage_options = return_azure_storage_options(self.config_source)
        account_url = AZURE_PATH.format(
            bucket_name=bucket_name,
            account_name=self.config_source.securityConfig.accountName,
            key=key,
        )
        dataframe = pd.read_parquet(account_url, storage_options=storage_options)
        return dataframe_to_chunks(dataframe)

    @_read_parquet_dispatch.register
    def _(
        self,
        _: LocalConfig,
        key: str,
        bucket_name: str,  # pylint: disable=unused-argument
    ) -> DatalakeColumnWrapper:
        import pandas as pd  # pylint: disable=import-outside-toplevel

        dataframe = pd.read_parquet(key)
        return dataframe_to_chunks(dataframe)

    def _read(self, *, key: str, bucket_name: str, **__) -> DatalakeColumnWrapper:
        return DatalakeColumnWrapper(
            dataframes=self._read_parquet_dispatch(
                self.config_source, key=key, bucket_name=bucket_name
            )
        )
