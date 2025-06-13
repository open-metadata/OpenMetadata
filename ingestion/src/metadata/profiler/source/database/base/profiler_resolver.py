from abc import ABC, abstractmethod
from typing import Tuple, Type

from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.service_spec.service_spec import (
    import_profiler_class,
    import_sampler_class,
)


class ProfilerResolver(ABC):
    """Abstract class for the profiler resolver"""

    @staticmethod
    @abstractmethod
    def resolve(
        processing_engine: str, service_type: ServiceType, source_type: str
    ) -> Tuple[Type[SamplerInterface], Type[ProfilerInterface]]:
        """Resolve the sampler and profiler based on the processing engine."""
        raise NotImplementedError


class DefaultProfilerResolver(ProfilerResolver):
    """Default profiler resolver"""

    @staticmethod
    def resolve(
        processing_engine: str, service_type: ServiceType, source_type: str
    ) -> Tuple[Type[SamplerInterface], Type[ProfilerInterface]]:
        """Resolve the sampler and profiler based on the processing engine."""
        sampler_class = import_sampler_class(service_type, source_type=source_type)
        profiler_class = import_profiler_class(service_type, source_type=source_type)
        return sampler_class, profiler_class
