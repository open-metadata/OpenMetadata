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
Storage-level stats of the object backing a Datalake table
"""

from datetime import datetime, timezone
from functools import singledispatch
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, field_validator

from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)

if TYPE_CHECKING:
    from azure.storage.blob import BlobServiceClient
    from google.cloud.storage import Client as GCSStorageClient


class ObjectStats(BaseModel):
    """Storage-level stats for a single object backing a Datalake table."""

    size_in_bytes: int | None = None
    create_date_time: datetime | None = None

    @field_validator("create_date_time")
    @classmethod
    def normalize_to_utc(cls, value: datetime | None) -> datetime | None:
        """Normalize a provider timestamp to timezone-aware UTC.

        `Profiler.get_profile` relabels the value with `replace(tzinfo=utc)` rather than converting
        it, so a non-UTC timestamp leaving this model would end up silently shifted on the profile.
        Validating here rather than at each call site means no provider below can forget.
        """
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


@singledispatch
def get_object_stats(config_source: object, client: object, bucket_name: str, key: str) -> ObjectStats:
    """Fetch the size and creation time of the object backing a Datalake table.

    Config sources that are not object stores (e.g. BurstIQ) get empty stats rather than an error,
    hence the `object` rather than a union of the three supported configs.
    """
    return ObjectStats()


# The config class is passed to `register` explicitly rather than read off the annotation:
# `singledispatch` resolves a function's annotations at registration time, which would blow up on
# the `TYPE_CHECKING`-only client types below.
@get_object_stats.register(S3Config)
def _(_: S3Config, client: Any, bucket_name: str, key: str) -> ObjectStats:
    # boto3 builds its clients at runtime, so `head_object` exists on no static type: `BaseClient`
    # would type-check the parameter at the cost of an unresolved attribute on the line below.
    response = client.head_object(Bucket=bucket_name, Key=key)
    # S3 exposes no creation time at all. Datalake objects are typically written once, so
    # LastModified is the closest available signal; on overwritten objects it tracks the write time
    # of the current version.
    return ObjectStats(
        size_in_bytes=response.get("ContentLength"),
        create_date_time=response.get("LastModified"),
    )


@get_object_stats.register(GCSConfig)
def _(_: GCSConfig, client: "GCSStorageClient", bucket_name: str, key: str) -> ObjectStats:
    # `bucket()` only builds a reference, so it needs no `storage.buckets.get` permission --
    # unlike `get_bucket()`. `get_blob()` then fetches the properties with object-level read access,
    # which the profiler already holds to read the object itself.
    blob = client.bucket(bucket_name).get_blob(key)
    if blob is None:
        return ObjectStats()
    return ObjectStats(size_in_bytes=blob.size, create_date_time=blob.time_created)


@get_object_stats.register(AzureConfig)
def _(_: AzureConfig, client: "BlobServiceClient", bucket_name: str, key: str) -> ObjectStats:
    props = client.get_blob_client(container=bucket_name, blob=key).get_blob_properties()
    return ObjectStats(
        size_in_bytes=props.size,
        create_date_time=props.creation_time or props.last_modified,
    )
