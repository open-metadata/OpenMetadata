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
s3 utils module
"""

import traceback
from typing import Iterable

from metadata.utils.logger import utils_logger

logger = utils_logger()


def list_s3_objects(client, **kwargs) -> Iterable:
    """
    Method to get list of s3 objects using pagination
    """
    try:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(**kwargs):
            yield from page.get("Contents", [])
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Unexpected exception to yield s3 object: {exc}")
