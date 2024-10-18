from metadata.profiler.interface.sqlalchemy.mariadb.profiler_interface import (
    MariaDBProfilerInterface,
)
from metadata.utils.manifest import BaseManifest, get_class_path

MariadbManifest = BaseManifest(profler_class=get_class_path(MariaDBProfilerInterface))
