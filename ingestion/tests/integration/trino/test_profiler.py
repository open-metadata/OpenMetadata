from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow


def test_profiler(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    profiler_config,
    create_test_data,
):
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    # trino connectors do not support all profiler funcitonalities so we can expect some failures
    workflow = run_workflow(ProfilerWorkflow, profiler_config, raise_from_status=False)
    assert len(workflow.steps[0].status.updated_records) > 0
