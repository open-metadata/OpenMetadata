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
Life Cycle utils module
"""

import re
import traceback
from typing import Any, Optional

from metadata.generated.schema.type.lifeCycle import LifeCycle
from metadata.utils.logger import utils_logger

QUERY_TYPES_DICT = {
    "created": ["CREATE"],
    "updated": ["DELETE", "TRUNCATE_TABLE", "UPDATE", "ALTER", "INSERT", "MERGE"],
    "accessed": ["SHOW", "DESCRIBE", "SELECT"],
}


select_pattern = re.compile(r".*\s*(SELECT|SHOW|DESCRIBE)", re.IGNORECASE)
create_pattern = re.compile(r".*\s*CREATE", re.IGNORECASE)
update_pattern = re.compile(
    r".*\s*(UPDATE|INSERT|DELETE|MERGE|TRUNCATE_TABLE|ALTER)", re.IGNORECASE
)
drop_pattern = re.compile(r".*\s*DROP", re.IGNORECASE)

logger = utils_logger()


def init_empty_life_cycle_properties() -> LifeCycle:
    """
    Method which returns empty LifeCycleProperties object
    """
    return LifeCycle(created=None, updated=None, accessed=None)


def _get_query_type_from_name(create_query) -> Optional[Any]:
    """
    Method to get the query type from query_type field
    """
    for key, value in QUERY_TYPES_DICT.items():
        if create_query.query_type.upper() in value:
            return key
    return None


def _get_query_type_from_regex(create_query) -> Optional[Any]:
    """
    Method to get the query type from regex
    """
    if re.match(create_pattern, create_query.query.root):
        return "created"
    if re.match(update_pattern, create_query.query.root):
        return "updated"
    if re.match(select_pattern, create_query.query.root):
        return "accessed"
    return None


def get_query_type(create_query) -> Optional[str]:
    """
    Method to the type of query
    """
    try:
        query_type = None
        if create_query.query_type:
            query_type = _get_query_type_from_name(create_query=create_query)
        if query_type is None or create_query.query_type is None:
            query_type = _get_query_type_from_regex(create_query=create_query)
        if query_type:
            return query_type.lower()

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Unexpected exception get the query type: {exc}")
    return None
