from metadata.profiler.interface.sqlalchemy.trino.profiler_interface import (
    TrinoProfilerInterface,
)
from metadata.utils.manifest import BaseManifest, get_class_path

TrinoManifest = BaseManifest(profler_class=get_class_path(TrinoProfilerInterface))
