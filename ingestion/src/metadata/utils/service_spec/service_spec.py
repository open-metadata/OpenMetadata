"""
Manifests are used to store class information
"""

from abc import ABC, abstractmethod
from typing import Any, Optional, Type, cast

from pydantic import model_validator

from metadata.data_quality.interface.test_suite_interface import TestSuiteInterface
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.ingestion.api.steps import Source
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.dependency_injector.dependency_injector import Inject, inject
from metadata.utils.importer import (
    TYPE_SEPARATOR,
    DynamicImportException,
    get_class_path,
    get_module_dir,
    import_from_module,
)
from metadata.utils.logger import utils_logger

logger = utils_logger()


class SourceLoader(ABC):
    @abstractmethod
    def __call__(
        self, service_type: ServiceType, source_type: str, from_: str
    ) -> Type[Any]:
        """Load the service spec for a given service type and source type."""


class BaseSpec(BaseModel):
    """
    # The OpenMetadata Ingestion Service Specification (Spec)

    This is the API for defining a service in OpenMetadata it needs to be in the classpath of the connector in
    the form:

    metadata.ingestion.source.{service_type}.{service_name}.service_spec.ServiceSpec

    Example for postres:

    metadata.ingestion.source.database.postgres.service_spec.ServiceSpec

    You can supply either strings with the full classpath or concrete classes that will be converted to strings.

    The use of strings for the values gives us a few advantages:
    1. manifests can be defined using json/yaml and deserialized into this class.
    2. We can dynamically import the class when needed and avoid dependency issues.
    3. We avoid circular imports.
    4. We can hot-swap the class implementation without changing the manifest (example: for testing).
    """

    profiler_class: Optional[str] = None
    test_suite_class: Optional[str] = None
    metadata_source_class: str
    lineage_source_class: Optional[str] = None
    usage_source_class: Optional[str] = None
    sampler_class: Optional[str] = None
    data_diff: Optional[str] = None
    connection_class: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def transform_fields(cls, values):
        """This allows us to pass in the class directly instead of the string representation of the class. The
        validator will convert the class to a string representation of the class."""
        for field in list(cls.model_fields.keys()):
            if isinstance(values.get(field), type):
                values[field] = get_class_path(values[field])
        return values

    @classmethod
    @inject
    def get_for_source(
        cls,
        service_type: ServiceType,
        source_type: str,
        from_: str = "ingestion",
        source_loader: Inject[SourceLoader] = None,
    ) -> "BaseSpec":
        """Retrieves the manifest for a given source type. If it does not exist will attempt to retrieve
        a default manifest for the service type.

        Args:
            service_type (ServiceType): The service type.
            source_type (str): The source type.
            from_ (str, optional): The module to import from. Defaults to "ingestion".

        Returns:
            BaseSpec: The manifest for the source type.
        """
        if not source_loader:
            raise ValueError("Source loader is required")

        return cls.model_validate(source_loader(service_type, source_type, from_))


class DefaultSourceLoader(SourceLoader):
    def __call__(
        self,
        service_type: ServiceType,
        source_type: str,
        from_: str = "ingestion",
    ) -> Type[Any]:
        """Default implementation for loading service specifications."""
        return import_from_module(
            "metadata.{}.source.{}.{}.{}.ServiceSpec".format(  # pylint: disable=C0209
                from_,
                service_type.name.lower(),
                get_module_dir(source_type),
                "service_spec",
            )
        )


def import_source_class(
    service_type: ServiceType, source_type: str, from_: str = "ingestion"
) -> Type[Source]:
    source_class_type = source_type.split(TYPE_SEPARATOR)[-1]
    if source_class_type in ["usage", "lineage"]:
        field = f"{source_class_type}_source_class"
    else:
        field = "metadata_source_class"
    spec = BaseSpec.get_for_source(service_type, source_type, from_)
    return cast(
        Type[Source],
        import_from_module(spec.model_dump()[field]),
    )


def import_profiler_class(
    service_type: ServiceType, source_type: str
) -> Type[ProfilerInterface]:
    class_path = BaseSpec.get_for_source(service_type, source_type).profiler_class
    if not class_path:
        raise ValueError(
            f"Profiler class not found for service type {service_type} and source type {source_type}"
        )
    return cast(Type[ProfilerInterface], import_from_module(class_path))


def import_test_suite_class(
    service_type: ServiceType,
    source_type: str,
    source_config_type: Optional[str] = None,
) -> Type[TestSuiteInterface]:
    try:
        class_path = BaseSpec.get_for_source(service_type, source_type).test_suite_class
    except DynamicImportException:
        if source_config_type:
            class_path = BaseSpec.get_for_source(
                service_type, source_config_type.lower()
            ).test_suite_class
        else:
            raise
    if not class_path:
        raise ValueError(
            f"Test suite class not found for service type {service_type} and source type {source_type}"
        )
    return cast(Type[TestSuiteInterface], import_from_module(class_path))


def import_sampler_class(
    service_type: ServiceType,
    source_type: str,
    source_config_type: Optional[str] = None,
) -> Type[SamplerInterface]:
    try:
        class_path = BaseSpec.get_for_source(service_type, source_type).sampler_class
    except DynamicImportException:
        if source_config_type:
            class_path = BaseSpec.get_for_source(
                service_type, source_config_type.lower()
            ).sampler_class
        else:
            raise
    if not class_path:
        raise ValueError(
            f"Sampler class not found for service type {service_type} and source type {source_type}"
        )
    return cast(Type[SamplerInterface], import_from_module(class_path))


def import_connection_class(
    service_type: ServiceType,
    source_type: str,
) -> Type[BaseConnection]:
    """
    Import the connection class for a given service type and source type.
    """
    class_path = BaseSpec.get_for_source(service_type, source_type).connection_class
    if not class_path:
        raise ValueError(
            f"Connection class not found for service type {service_type} and source type {source_type}"
        )
    return cast(Type[BaseConnection], import_from_module(class_path))
