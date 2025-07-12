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
Helper functions to handle OpenMetadata Entities' properties
"""

import re
import string
import threading
from functools import lru_cache
from typing import Any, Dict, Optional, Tuple, Type, TypeVar, Union

from pydantic import BaseModel
from requests.utils import quote as url_quote

from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference

T = TypeVar("T", bound=BaseModel)

# Thread-safe LRU cache for storing ETags by entity ID
# Limited to 1000 entries to prevent memory leaks
_etag_cache: Dict[str, str] = {}
_cache_lock = threading.RLock()
_MAX_CACHE_SIZE = 1000


def format_name(name: str) -> str:
    """
    Given a name, replace all special characters by `_`
    :param name: name to format
    :return: formatted string
    """
    subs = re.escape(string.punctuation + " ")
    return re.sub(r"[" + subs + "]", "_", name)


# pylint: disable=too-many-return-statements
def get_entity_type(
    entity: Union[Type[T], str],
) -> str:
    """
    Given an Entity T, return its type.
    E.g., Table returns table, Dashboard returns dashboard...

    Also allow to be the identity if we just receive a string
    """
    if isinstance(entity, str):
        return entity

    class_name: str = entity.__name__.lower()

    if "service" in class_name:
        # Capitalize service, e.g., pipelineService
        return class_name.replace("service", "Service")
    if "testdefinition" in class_name:
        return class_name.replace("testdefinition", "testDefinition")
    if "testsuite" in class_name:
        return class_name.replace("testsuite", "testSuite")
    if "databaseschema" in class_name:
        return class_name.replace("databaseschema", "databaseSchema")
    if "searchindex" in class_name:
        return class_name.replace("searchindex", "searchIndex")
    if "dashboarddatamodel" in class_name:
        return class_name.replace("dashboarddatamodel", "dashboardDataModel")

    return class_name


def model_str(arg: Any) -> str:
    """
    Default model stringifying method.

    Some elements such as FQN, EntityName, UUID
    have the actual value under the pydantic base root
    """
    if hasattr(arg, "root"):
        return str(arg.root)

    return str(arg)


def quote(fqn: Union[FullyQualifiedEntityName, str]) -> str:
    """
    Quote the FQN so that it's safe to pass to the API.
    E.g., `"foo.bar/baz"` -> `%22foo.bar%2Fbaz%22`
    """
    return url_quote(model_str(fqn), safe="")


def build_entity_reference(entity: T) -> EntityReference:
    """Get the EntityReference from the Entity itself"""
    return EntityReference(
        id=entity.id,
        type=get_entity_type(type(entity)),
        name=model_str(entity.name),
        fullyQualifiedName=model_str(entity.fullyQualifiedName),
        description=entity.description,
        href=entity.href,
    )


def store_etag(entity_id: str, etag: str) -> None:
    """Store ETag for an entity ID in the cache with thread safety and size limits"""
    if entity_id and etag:
        with _cache_lock:
            # Implement simple LRU eviction if cache is full
            if len(_etag_cache) >= _MAX_CACHE_SIZE:
                # Remove oldest entry (first key in dict)
                oldest_key = next(iter(_etag_cache))
                del _etag_cache[oldest_key]
            
            _etag_cache[str(entity_id)] = etag


def get_stored_etag(entity_id: str) -> Optional[str]:
    """Retrieve stored ETag for an entity ID with thread safety"""
    with _cache_lock:
        return _etag_cache.get(str(entity_id))


def extract_etag_from_headers(headers: Dict[str, str]) -> Optional[str]:
    """Extract ETag from response headers"""
    return headers.get("ETag") or headers.get("etag")


def handle_response_with_headers(response_data: Tuple[Any, Dict[str, str]], entity_id: str = None) -> Any:
    """
    Handle response data when headers are returned, automatically storing ETag if present
    
    Args:
        response_data: Tuple of (data, headers) from API response
        entity_id: Optional entity ID to associate with ETag
        
    Returns:
        The data portion of the response
    """
    data, headers = response_data
    if entity_id is not None:
        etag = extract_etag_from_headers(headers)
        if etag:
            store_etag(entity_id, etag)
    return data


def handle_response_without_headers(response_data: Any) -> Any:
    """
    Handle response data when no headers are returned
    
    Args:
        response_data: Direct response data from API
        
    Returns:
        The response data as-is
    """
    return response_data
