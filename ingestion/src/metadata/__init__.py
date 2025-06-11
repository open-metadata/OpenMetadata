"""
OpenMetadata package initialization.
"""
from typing import Callable

from metadata.utils.dependency_injector import DependencyContainer
from metadata.utils.service_spec.service_spec import SourceLoader, get_source_loader

# Initialize the dependency container
container = DependencyContainer[Callable]()

# Register the source loader
container.register(SourceLoader, get_source_loader)
