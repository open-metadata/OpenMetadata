from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow


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
