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
Source hash utils module
"""

import hashlib
import traceback
from typing import Dict, Optional

from metadata.ingestion.ometa.ometa_api import C
from metadata.utils.logger import utils_logger

logger = utils_logger()


SOURCE_HASH_EXCLUDE_FIELDS = {
    "sourceHash": True,
}


def generate_source_hash(
    create_request: C, exclude_fields: Optional[Dict] = None
) -> Optional[str]:
    """
    Given a create_request model convert it to json string and generate a hash value
    """
    try:
        # We always want to exclude the sourceHash when generating the fingerprint
        exclude_fields = (
            SOURCE_HASH_EXCLUDE_FIELDS.update(exclude_fields)
            if exclude_fields
            else SOURCE_HASH_EXCLUDE_FIELDS
        )

        create_request_json = create_request.model_dump_json(exclude=exclude_fields)

        json_bytes = create_request_json.encode("utf-8")
        return hashlib.md5(json_bytes).hexdigest()

    except Exception as exc:
        logger.warning(f"Failed to generate source hash due to - {exc}")
        logger.debug(traceback.format_exc())
    return None
