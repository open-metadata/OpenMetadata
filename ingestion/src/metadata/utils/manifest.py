from typing import cast

from metadata.generated.schema.tests.testSuite import ServiceType
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.utils.importer import (
    import_from_module,
    get_module_dir,
    get_source_module_name,
    get_class_name_root,
)


class BaseManifest(BaseModel):
    """Base manifest for storing class information for a source. We use strings to store the class information
    for these reasons:
    1. manifests can be defined using json/yaml and deserialized into this class.
    2. We can dynamically import the class when needed and avoid dependency issues.
    3. We avoid circular imports.
    4. We can hot-swap the class implementation without changing the manifest (example: for testing).
    
    - Dyanmic factory?
    - Different name the class name?
    
    
        
    # TODO
    - add a "default" manifest that will provide "sensible" default like SQAProfilerInterface or based on entity type / service type
    
    """

    profler_class: str

    @classmethod
    def get_for_source(
        cls, service_type: ServiceType, source_type: str, from_: str = "ingestion"
    ) -> "BaseManifest":
        return cls.model_validate(
            import_from_module(
                "metadata.{}.source.{}.{}.{}.{}Manifest".format(
                    from_,
                    service_type.name.lower(),
                    get_module_dir(source_type),
                    "manifest",
                    get_class_name_root(source_type),
                )
            )
        )


def get_class_path(module):
    return module.__module__ + "." + module.__name__
