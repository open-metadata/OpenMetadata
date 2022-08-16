from pydoc import locate
from typing import Type

from pydantic import BaseModel

from metadata.generated.schema.entity.services.serviceType import ServiceType


def _clean(source_type: str):
    source_type = source_type.replace("-", "_")
    source_type = source_type.replace("_usage", "")
    source_type = source_type.replace("_lineage", "")
    source_type = source_type.replace("_", "")
    if source_type == "sample":
        source_type = "sampledata"
    if source_type == "metadataelasticsearch":
        source_type = "metadataes"
    return source_type


def _get_service_type_from(service_subtype: str) -> ServiceType:

    for service_type in ServiceType:
        if service_subtype.lower() in [
            subtype.value.lower()
            for subtype in locate(
                f"metadata.generated.schema.entity.services.{service_type.name.lower()}Service.{service_type.name}ServiceType"
            )
            or []
        ]:
            return service_type


def get_service_type_from_source_type(source_type: str) -> ServiceType:
    return _get_service_type_from(_clean(source_type))


def get_service_class_from_service_type(service_type: ServiceType) -> Type[BaseModel]:
    return locate(
        f"metadata.generated.schema.entity.services.{service_type.name.lower()}Service.{service_type.name}Service"
    )
