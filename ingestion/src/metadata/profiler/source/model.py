from pydantic import ConfigDict

from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.models.entity_interface import EntityInterface
from metadata.profiler.source.profiler_source_interface import ProfilerSourceInterface


class ProfilerSourceAndEntity(BaseModel):
    """Return class for the OpenMetadata Profiler Source"""

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    profiler_source: ProfilerSourceInterface
    entity: EntityInterface

    def __str__(self):
        """Return the information of the table being profiler"""
        return f"Table [{self.entity.name.root}]"
