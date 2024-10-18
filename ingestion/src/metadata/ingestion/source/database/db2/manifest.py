from metadata.profiler.interface.sqlalchemy.db2.profiler_interface import (
    DB2ProfilerInterface,
)
from metadata.utils.manifest import BaseManifest, get_class_path

Db2Manifest = BaseManifest(profler_class=get_class_path(DB2ProfilerInterface))
