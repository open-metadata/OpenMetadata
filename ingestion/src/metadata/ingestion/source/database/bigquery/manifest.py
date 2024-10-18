from metadata.profiler.interface.sqlalchemy.bigquery.profiler_interface import (
    BigQueryProfilerInterface,
)
from metadata.utils.manifest import BaseManifest, get_class_path

BigqueryManifest = BaseManifest(profler_class=get_class_path(BigQueryProfilerInterface))
