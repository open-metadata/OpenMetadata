"""
OpenMetadata package initialization.
"""
from typing import Any

from metadata.utils.dependency_injector import DependencyContainer
from metadata.utils.service_spec.service_spec import default_source_loader

# Initialize the dependency container
container = DependencyContainer[Any]()

# Register the source loader
container.register("source_loader", default_source_loader)
