from metadata.profiler.interface.pandas.profiler_interface import (
    PandasProfilerInterface,
)
from metadata.utils.manifest import BaseManifest, get_class_path

DatalakeManifest = BaseManifest(profler_class=get_class_path(PandasProfilerInterface))
