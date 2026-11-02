"""
Manifests are used to store class information
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, cast

from pydantic import Field, model_validator

from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.ingestion.models.custom_pydantic import BaseModel
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

if TYPE_CHECKING:
    from metadata.data_quality.interface.test_suite_interface import TestSuiteInterface
    from metadata.entity_resolution.engine import EntityResolver
    from metadata.entity_resolution.table_binding import TableBindingResolution
    from metadata.ingestion.api.steps import Source
    from metadata.ingestion.connections.connection import BaseConnection
    from metadata.ingestion.ometa.ometa_api import OpenMetadata
    from metadata.profiler.interface.profiler_interface import ProfilerInterface
    from metadata.sampler.sampler_interface import SamplerInterface


class SourceLoader(ABC):
    @abstractmethod
    def __call__(self, service_type: ServiceType, source_type: str, from_: str) -> type[Any]:
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

    profiler_class: str | None = None
    test_suite_class: str | None = None
    metadata_source_class: str
    lineage_source_class: str | None = None
    usage_source_class: str | None = None
    sampler_class: str | None = None
    data_diff: str | None = None
    connection_class: str | None = None
    table_binding_resolution_class: str | None = Field(default=None)

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
    ) -> BaseSpec:
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
    ) -> type[Any]:
        """Default implementation for loading service specifications."""
        return import_from_module(
            "metadata.{}.source.{}.{}.{}.ServiceSpec".format(  # pylint: disable=C0209
                from_,
                service_type.name.lower(),
                get_module_dir(source_type),
                "service_spec",
            )
        )


def import_source_class(service_type: ServiceType, source_type: str, from_: str = "ingestion") -> type[Source]:
    """
    Import the source class for a given service type and source type.

    The source type can follow the format
    {base_source_type}{TYPE_SEPARATOR}{source_class_type} (for example,
    ``mysql-usage``), where ``source_class_type`` is one of ``metadata``,
    ``lineage``, or ``usage``.

    For ``usage`` and ``lineage`` source types, and for all other source
    types, the class path is resolved from the source ``ServiceSpec`` via the
    corresponding ``*_source_class`` field.
    """
    _, sep, source_class_type = source_type.rpartition(TYPE_SEPARATOR)
    if not sep:
        source_class_type = source_type
    if source_class_type in ["usage", "lineage"]:
        field = f"{source_class_type}_source_class"
    else:
        field = "metadata_source_class"
    spec = BaseSpec.get_for_source(service_type, source_type, from_)
    return cast(
        "type[Source]",
        import_from_module(spec.model_dump()[field]),
    )


def import_profiler_class(service_type: ServiceType, source_type: str) -> type[ProfilerInterface]:
    class_path = BaseSpec.get_for_source(service_type, source_type).profiler_class
    if not class_path:
        raise ValueError(f"Profiler class not found for service type {service_type} and source type {source_type}")
    return cast("type[ProfilerInterface]", import_from_module(class_path))


def import_test_suite_class(
    service_type: ServiceType,
    source_type: str,
    source_config_type: str | None = None,
) -> type[TestSuiteInterface]:
    try:
        class_path = BaseSpec.get_for_source(service_type, source_type).test_suite_class
    except DynamicImportException:
        if source_config_type:
            class_path = BaseSpec.get_for_source(service_type, source_config_type.lower()).test_suite_class
        else:
            raise
    if not class_path:
        raise ValueError(f"Test suite class not found for service type {service_type} and source type {source_type}")
    return cast("type[TestSuiteInterface]", import_from_module(class_path))


def import_sampler_class(
    service_type: ServiceType,
    source_type: str,
    source_config_type: str | None = None,
) -> type[SamplerInterface]:
    try:
        class_path = BaseSpec.get_for_source(service_type, source_type).sampler_class
    except DynamicImportException:
        if source_config_type:
            class_path = BaseSpec.get_for_source(service_type, source_config_type.lower()).sampler_class
        else:
            raise
    if not class_path:
        raise ValueError(f"Sampler class not found for service type {service_type} and source type {source_type}")
    return cast("type[SamplerInterface]", import_from_module(class_path))


def import_connection_class(
    service_type: ServiceType,
    source_type: str,
) -> type[BaseConnection]:
    """
    Import the connection class for a given service type and source type.
    """
    class_path = BaseSpec.get_for_source(service_type, source_type).connection_class
    if not class_path:
        raise ValueError(f"Connection class not found for service type {service_type} and source type {source_type}")
    return cast("type[BaseConnection]", import_from_module(class_path))


def load_table_binding_resolution(
    source_type: str | None,
    metadata: OpenMetadata,
    *,
    engine: EntityResolver | None = None,
) -> TableBindingResolution:
    """Select table resolution from the service spec, defaulting only when undeclared."""
    from metadata.entity_resolution.table_binding import TableBindingResolution

    if not source_type:
        return TableBindingResolution(metadata, engine)
    module = f"metadata.ingestion.source.database.{get_module_dir(source_type.lower())}.service_spec"
    try:
        spec = BaseSpec.get_for_source(ServiceType.Database, source_type.lower())
    except DynamicImportException as exc:
        cause = exc.cause
        if (
            isinstance(cause, ModuleNotFoundError)
            and cause.name
            and (cause.name == module or module.startswith(cause.name + "."))
        ):
            return TableBindingResolution(metadata, engine)
        raise
    if not spec.table_binding_resolution_class:
        return TableBindingResolution(metadata, engine)
    resolution_class = import_from_module(spec.table_binding_resolution_class)
    return resolution_class(metadata, engine)
