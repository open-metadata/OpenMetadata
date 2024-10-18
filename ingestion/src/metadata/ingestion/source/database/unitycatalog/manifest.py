from metadata.profiler.interface.sqlalchemy.unity_catalog.profiler_interface import (
    UnityCatalogProfilerInterface,
)
from metadata.utils.manifest import BaseManifest, get_class_path

UnitycatalogManifest = BaseManifest(
    profler_class=get_class_path(UnityCatalogProfilerInterface)
)
