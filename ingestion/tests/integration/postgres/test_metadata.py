import sys

import pytest

from metadata.workflow.metadata import MetadataWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


def test_ingest_metadata(
    patch_passwords_for_db_services, run_workflow, ingestion_config
):
    run_workflow(MetadataWorkflow, ingestion_config)
