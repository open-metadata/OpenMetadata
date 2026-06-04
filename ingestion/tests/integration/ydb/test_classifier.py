#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Integration test for the YDB auto-classification workflow (sample data).

The classifier shares the SQA sampler with the profiler, so this test
proves end-to-end that ``YdbSampler.build_table_orm`` produces a query
that YDB accepts (``FROM `raw/events``` rather than ``FROM raw.events``)
and that the resulting rows round-trip through OM's sampleData store.
"""

from copy import deepcopy

from metadata.generated.schema.entity.data.table import Table
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.metadata import MetadataWorkflow


def test_sample_data(
    patch_passwords_for_db_services,
    create_test_data,
    run_workflow,
    ingestion_config,
    classifier_config,
    metadata,
    db_service,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    config = deepcopy(classifier_config)
    run_workflow(AutoClassificationWorkflow, config)

    service = db_service.fullyQualifiedName.root
    fqn = f"{service}./local.raw.events"
    table = metadata.get_by_name(entity=Table, fqn=fqn)
    assert table is not None
    with_samples = metadata.get_sample_data(table)
    assert with_samples is not None
    assert with_samples.sampleData is not None
    # We seeded 3 rows; sampling fetches up to sample_limit (default 50).
    assert len(with_samples.sampleData.rows or []) == 3
    col_names = {str(c.root) if hasattr(c, "root") else str(c) for c in (with_samples.sampleData.columns or [])}
    assert col_names == {"event_id", "user_id", "ts"}
