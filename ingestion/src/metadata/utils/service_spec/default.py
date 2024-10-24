"""
Default service specs for services.
"""

from typing import Optional

from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec.service_spec import BaseSpec


class DefaultDatabaseSpec(BaseSpec):
    profiler_class: Optional[str] = get_class_path(SQAProfilerInterface)
