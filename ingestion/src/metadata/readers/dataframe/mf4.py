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
MF4 DataFrame reader for processing MF4 (Measurement Data Format) files.
Extracts header metadata (small data) with streaming where possible.
"""
import tempfile
from functools import singledispatchmethod
from typing import Optional

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
from metadata.readers.file.adls import return_azure_storage_options
from metadata.readers.models import ConfigSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MF4DataFrameReader(DataFrameReader):
    """
    MF4 file reader implementation for extracting schema and data
    from MF4 (Measurement Data Format) files.
    Only extracts header metadata which is typically small.
    """

    @staticmethod
    def _extract_header_from_mdf(mdf) -> Optional[DatalakeColumnWrapper]:
        """Extract header properties from an opened MDF object."""
        import pandas as pd

        if hasattr(mdf, "header") and hasattr(mdf.header, "_common_properties"):
            common_props = mdf.header._common_properties

            if common_props:
                schema_dict = {
                    key: pd.Series(value) for key, value in common_props.items()
                }
                schema_df = pd.DataFrame(schema_dict, index=[0])
                logger.info(f"Extracted {len(schema_dict)} properties from MF4 header")

                def chunk_generator():
                    yield schema_df

                return DatalakeColumnWrapper(
                    dataframes=chunk_generator, raw_data=common_props, columns=None
                )

        logger.debug("No _common_properties found in header.")
        return DatalakeColumnWrapper(
            dataframes=lambda: iter([]), raw_data=None, columns=None
        )

    @singledispatchmethod
    def _read_mf4_dispatch(
        self, config_source: ConfigSource, key: str, bucket_name: str
    ) -> DatalakeColumnWrapper:
        raise FileFormatException(config_source=config_source, file_name=key)

    @_read_mf4_dispatch.register
    def _(self, _: S3Config, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """Read MF4 header from S3. Uses temp file as MDF requires seekable stream."""
        from asammdf import MDF

        response = self.client.get_object(Bucket=bucket_name, Key=key)

        with tempfile.NamedTemporaryFile(suffix=".mf4", delete=True) as tmp:
            for chunk in response["Body"].iter_chunks():
                tmp.write(chunk)
            tmp.flush()
            mdf = MDF(tmp.name, load_measured_data=False)
            return self._extract_header_from_mdf(mdf)

    @_read_mf4_dispatch.register
    def _(self, _: GCSConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """Read MF4 header from GCS. Uses temp file as MDF requires seekable stream."""
        from asammdf import MDF
        from gcsfs import GCSFileSystem

        gcs = GCSFileSystem()
        file_path = f"gs://{bucket_name}/{key}"

        with tempfile.NamedTemporaryFile(suffix=".mf4", delete=True) as tmp:
            gcs.get(file_path, tmp.name)
            mdf = MDF(tmp.name, load_measured_data=False)
            return self._extract_header_from_mdf(mdf)

    @_read_mf4_dispatch.register
    def _(self, _: AzureConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """Read MF4 header from Azure. Uses temp file as MDF requires seekable stream."""
        from adlfs import AzureBlobFileSystem
        from asammdf import MDF

        storage_options = return_azure_storage_options(self.config_source)
        adlfs_fs = AzureBlobFileSystem(
            account_name=self.config_source.securityConfig.accountName,
            **storage_options,
        )
        file_path = f"{bucket_name}/{key}"

        with tempfile.NamedTemporaryFile(suffix=".mf4", delete=True) as tmp:
            adlfs_fs.get(file_path, tmp.name)
            mdf = MDF(tmp.name, load_measured_data=False)
            return self._extract_header_from_mdf(mdf)

    @_read_mf4_dispatch.register
    def _(
        self,
        _: LocalConfig,
        key: str,
        bucket_name: str,  # pylint: disable=unused-argument
    ) -> DatalakeColumnWrapper:
        """Read MF4 header from local file - most efficient as no temp file needed."""
        from asammdf import MDF

        mdf = MDF(key, load_measured_data=False)
        return self._extract_header_from_mdf(mdf)

    def _read(self, *, key: str, bucket_name: str, **__) -> DatalakeColumnWrapper:
        return self._read_mf4_dispatch(
            self.config_source, key=key, bucket_name=bucket_name
        )
