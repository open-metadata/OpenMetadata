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

import base64
import json
import re
import string
from typing import Any, Dict, Optional, Type, TypeVar, Union

from pydantic import BaseModel
from requests.utils import quote as url_quote

from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference

T = TypeVar("T", bound=BaseModel)


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


def decode_jwt_token(jwt_token: str) -> Optional[Dict[str, Any]]:
    """
    Decode JWT token to extract payload without verification.
    JWT tokens have three parts: header.payload.signature
    We only decode the payload part to get user information.
    """
    from metadata.utils.logger import ometa_logger

    logger = ometa_logger()
    try:
        # Split the JWT token into its three parts
        parts = jwt_token.split(".")
        if len(parts) != 3:
            logger.debug("Invalid JWT token format: expected 3 parts")
            return None

        # Decode the payload (second part)
        payload = parts[1]
        # Add padding if needed for base64 decoding
        payload += "=" * (4 - len(payload) % 4) if len(payload) % 4 else ""

        # Decode base64 and parse JSON
        decoded_payload = base64.urlsafe_b64decode(payload)
        return json.loads(decoded_payload.decode("utf-8"))
    except Exception as e:
        logger.debug(f"Failed to decode JWT token: {e}")
        return None
