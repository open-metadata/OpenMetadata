from metadata.ingestion.source.database.redshift.profiler.profiler import (
    RedshiftProfiler,
)
from metadata.utils.manifest import BaseManifest, get_class_path

RedshiftManifest = BaseManifest(profler_class=get_class_path(RedshiftProfiler))
