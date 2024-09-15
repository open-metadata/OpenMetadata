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
Profiler Processor Step
"""
import json
import traceback
from datetime import datetime
from functools import singledispatch
from io import BytesIO

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    DataStorageConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.models.custom_pydantic import ignore_type_decoder
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class PathPatternException(Exception):
    """
    Exception class need to validate the file path pattern
    """


def validate_path_pattern(file_path_format: str) -> None:
    if not (
        "{service_name}" in file_path_format
        and "{database_name}" in file_path_format
        and "{database_schema_name}" in file_path_format
        and "{table_name}" in file_path_format
        and file_path_format.endswith(".parquet")
    ):
        raise PathPatternException(
            "Please provide a valid path pattern, "
            "the pattern should include these components {service_name}, "
            "{database_name}, {database_schema_name}, {table_name} and "
            "it should end with extension .parquet"
        )


def _get_object_key(
    table: Table, prefix: str, overwrite_data: bool, file_path_format: str
) -> str:
    validate_path_pattern(file_path_format)
    file_name = file_path_format.format(
        service_name=table.service.name,
        database_name=table.database.name,
        database_schema_name=table.databaseSchema.name,
        table_name=table.name.root,
    )
    if not overwrite_data:
        file_name = file_name.replace(
            ".parquet", f"_{datetime.now().strftime('%Y_%m_%d')}.parquet"
        )
    if prefix:
        return f"{clean_uri(prefix)}/{file_name}"
    return file_name


def upload_sample_data(data: TableData, profiler_interface: ProfilerInterface) -> None:
    """
    Upload Sample data to storage config
    """
    import pandas as pd  # pylint: disable=import-outside-toplevel

    try:
        sample_storage_config: DataStorageConfig = profiler_interface.storage_config
        if not sample_storage_config:
            return
        # Ignore any decoding error for byte data
        ignore_type_decoder(bytes)
        deserialized_data = json.loads(data.json())
        df = pd.DataFrame(
            data=deserialized_data.get("rows", []),
            columns=[i.root for i in data.columns],
        )
        pq_buffer = BytesIO()
        df.to_parquet(pq_buffer)
        object_key = _get_object_key(
            table=profiler_interface.table_entity,
            prefix=sample_storage_config.prefix,
            overwrite_data=sample_storage_config.overwriteData,
            file_path_format=sample_storage_config.filePathPattern,
        )
        upload_to_storage(
            sample_storage_config.storageConfig,
            pq_buffer,
            sample_storage_config.bucketName,
            object_key,
        )
    except Exception as err:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error uploading the sample data: {err}")


# pylint: disable=unused-argument
@singledispatch
def upload_to_storage(storage_config, pq_buffer, bucket_name, object_key):
    """
    Do noting if storage not supported or storage type openmetadata
    """


@upload_to_storage.register
def _(
    storage_config: AWSCredentials,
    pq_buffer: BytesIO,
    bucket_name: str,
    object_key: str,
):
    aws_client = AWSClient(config=storage_config).get_client("s3")
    aws_client.put_object(
        Body=pq_buffer.getvalue(),
        Bucket=bucket_name,
        Key=object_key,
    )
    logger.debug(f"Sample Data Successfully Uploaded to {object_key}")
