from ingestion.tests.integration.profiler.test_nosql_profiler import NoSQLProfiler
from metadata.utils.manifest import BaseManifest, get_class_path

DyanmodbManifest = BaseManifest(profler_class=get_class_path(NoSQLProfiler))
