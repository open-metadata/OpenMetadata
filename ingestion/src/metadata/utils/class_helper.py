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
Helper module to process the service type from the config
"""

from pydoc import locate
from typing import Type

from pydantic import BaseModel

from metadata.generated.schema.entity.services.serviceType import ServiceType


def _clean(source_type: str):
    source_type = source_type.replace("-", "_")
    source_type = source_type.replace("_usage", "")
    source_type = source_type.replace("_lineage", "")
    source_type = source_type.replace("_", "")
    if source_type == "metadataelasticsearch":
        source_type = "metadataes"
    return source_type


def _get_service_type_from(  # pylint: disable=inconsistent-return-statements
    service_subtype: str,
) -> ServiceType:

    for service_type in ServiceType:
        if service_subtype.lower() in [
            subtype.value.lower()
            for subtype in locate(
                f"metadata.generated.schema.entity.services.{service_type.name.lower()}Service.{service_type.name}ServiceType"  # pylint: disable=line-too-long
            )
            or []
        ]:
            return service_type


def get_service_type_from_source_type(source_type: str) -> ServiceType:
    """
    Method to get service type from source type
    """

    return _get_service_type_from(_clean(source_type))


def get_service_class_from_service_type(service_type: ServiceType) -> Type[BaseModel]:
    """
    Method to get service class from service type
    """

    return locate(
        f"metadata.generated.schema.entity.services.{service_type.name.lower()}Service.{service_type.name}Service"
    )
