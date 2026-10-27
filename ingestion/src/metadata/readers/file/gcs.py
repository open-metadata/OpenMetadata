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
Read files as string from S3
"""

import traceback
from typing import Any

from google.auth import impersonated_credentials

from metadata.readers.file.base import Reader, ReadException
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_gcs_impersonated_token(client: Any) -> impersonated_credentials.Credentials | None:
    """gcsfs (directly or through pandas `gs://` paths) resolves its own identity from ADC,
    i.e. the base service account, so hand it the impersonated credentials the client was
    built with. The client's credentials object is reused so the whole run shares one
    token and one cached filesystem. None keeps gcsfs' default auth untouched."""
    credentials = getattr(client, "_credentials", None)
    return credentials if isinstance(credentials, impersonated_credentials.Credentials) else None


class GCSReader(Reader):
    """GCS Reader
    Class to read from buckets with prefix as paths
    """

    def __init__(self, client):
        self.client = client

    def read(self, path: str, *, bucket_name: str = None, verbose: bool = True, **__) -> bytes:  # noqa: RUF013
        try:
            return self.client.get_bucket(bucket_name).get_blob(path).download_as_string()
        except Exception as err:
            if verbose:
                logger.debug(traceback.format_exc())
            raise ReadException(f"Error fetching file [{path}] from GCS: {err}")  # noqa: B904

    def _get_tree(self) -> list[str]:
        """
        We are not implementing this yet. This should
        only be needed for now for the Datalake where we don't need
        to traverse any directories.
        """
        raise NotImplementedError("Not implemented")

    def download(
        self,
        path: str,
        local_file_path: str,
        *,
        bucket_name: str = None,  # noqa: RUF013
        verbose: bool = True,
        **__,
    ) -> bytes:
        try:
            self.client.get_bucket(bucket_name).get_blob(path).download_to_filename(local_file_path)
        except Exception as err:
            if verbose:
                logger.debug(traceback.format_exc())
            raise ReadException(f"Error downloading file [{path}] from GCS: {err}")  # noqa: B904
