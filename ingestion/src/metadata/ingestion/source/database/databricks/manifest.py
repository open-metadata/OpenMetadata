from metadata.profiler.interface.sqlalchemy.databricks.profiler_interface import (
    DatabricksProfilerInterface,
)
from metadata.utils.manifest import BaseManifest, get_class_path

DatabricksManifest = BaseManifest(
    profler_class=get_class_path(DatabricksProfilerInterface)
)
