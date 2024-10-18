"""
Manifests are used to store class information
"""

from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.utils.importer import (
    DynamicImportException,
    get_class_name_root,
    get_module_dir,
    import_from_module,
)


class BaseManifest(BaseModel):
    """Base manifest for storing class information for a source. We use strings to store the class information
    for these reasons:
    1. manifests can be defined using json/yaml and deserialized into this class.
    2. We can dynamically import the class when needed and avoid dependency issues.
    3. We avoid circular imports.
    4. We can hot-swap the class implementation without changing the manifest (example: for testing).

    # TODO: naming?
    - Dyanmic factory?
    - Different name the class name?

    # TODO: functionality
    - is this expected to be a extended?
    """

    profler_class: str

    @classmethod
    def get_for_source(
        cls, service_type: ServiceType, source_type: str, from_: str = "ingestion"
    ) -> "BaseManifest":
        """Retrieves the manifest for a given source type. If it does not exist will attempt to retrieve
        a default manifest for the service type.

        Args:
            service_type (ServiceType): The service type.
            source_type (str): The source type.
            from_ (str, optional): The module to import from. Defaults to "ingestion".

        Returns:
            BaseManifest: The manifest for the source type.
        """
        try:
            return cls.model_validate(
                import_from_module(
                    "metadata.{}.source.{}.{}.{}.{}Manifest".format(  # pylint: disable=C0209
                        from_,
                        service_type.name.lower(),
                        get_module_dir(source_type),
                        "manifest",
                        get_class_name_root(source_type),
                    )
                )
            )
        except DynamicImportException:
            try:
                return DEFAULT_MANIFEST_MAP[service_type]
            except KeyError:
                raise RuntimeError(f"No manifest found for source type: {source_type}")


def get_class_path(module):
    return module.__module__ + "." + module.__name__


DefaultDatabaseManifest = BaseManifest(
    profler_class=get_class_path(SQAProfilerInterface)
)


DEFAULT_MANIFEST_MAP = {ServiceType.Database: DefaultDatabaseManifest}
