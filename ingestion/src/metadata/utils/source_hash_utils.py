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
Source hash utils module
"""

import hashlib
from typing import Dict, Optional

from metadata.ingestion.ometa.ometa_api import C

SOURCE_HASH_EXCLUDE_FIELDS = {
    "sourceHash": True,
}


def generate_source_hash(create_request: C, exclude_fields: Optional[Dict]) -> str:
    """
    Given a create_request model convert it to json string and generate a hash value
    """

    create_request_json = create_request.json(exclude=exclude_fields)

    json_bytes = create_request_json.encode("utf-8")
    return hashlib.md5(json_bytes).hexdigest()
