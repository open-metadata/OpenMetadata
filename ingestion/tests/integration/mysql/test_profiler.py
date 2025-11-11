import sys

import pytest

from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


def test_profiler(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    profiler_config,
    mysql_container,
):
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(ProfilerWorkflow, profiler_config)
