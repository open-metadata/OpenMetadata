from metadata.ingestion.source.database.snowflake.profiler.profiler import (
    SnowflakeProfiler,
)
from metadata.utils.manifest import BaseManifest, get_class_path

SnowflakeManifest = BaseManifest(profler_class=get_class_path(SnowflakeProfiler))
