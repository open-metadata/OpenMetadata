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
Class defining the interface for the profiler source
"""

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
    ProcessingEngine,
)
from metadata.generated.schema.metadataIngestion.engine.nativeEngineConfig import (
    NativeEngineConfiguration,
    Type,
)
from metadata.profiler.interface.profiler_interface import ProfilerInterface

if TYPE_CHECKING:
    from datetime import datetime


class ProfilerSourceInterface(ABC):
    """Abstract class defining the interface for the profiler source"""

    run_started_at: "datetime | None" = None

    @property
    @abstractmethod
    def interface(self) -> ProfilerInterface | None:
        """Interface property"""
        raise NotImplementedError

    @interface.setter
    @abstractmethod
    def interface(self, interface):
        """Set the interface"""
        raise NotImplementedError

    @abstractmethod
    def get_profiler_runner(self, entity, profiler_config):
        """Get the profiler runner"""
        raise NotImplementedError

    @staticmethod
    def get_processing_engine(
        config: DatabaseServiceProfilerPipeline,
    ) -> ProcessingEngine:
        """Get the processing engine based on the configuration."""
        return config.processingEngine or ProcessingEngine(root=NativeEngineConfiguration(type=Type.Native))
