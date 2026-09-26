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
"""Databend auto-classification and sample-data integration tests."""

from copy import deepcopy

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def auto_classification_config(classifier_config):
    config = deepcopy(classifier_config)
    config["source"]["sourceConfig"]["config"]["enableAutoClassification"] = True
    config["source"]["sourceConfig"]["config"]["storeSampleData"] = True
    config["processor"] = {"type": "tag-pii-processor", "config": {}}
    return config


def test_auto_classification_tags_pii_and_stores_sample_data(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    auto_classification_config,
    db_service,
    metadata,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(AutoClassificationWorkflow, auto_classification_config)

    table_fqn = f"{db_service.fullyQualifiedName.root}.default.analytics.customers"
    table = metadata.get_by_name(Table, table_fqn, nullable=False)
    email_column = next(
        column for column in metadata.get_table_columns(table_fqn, fields=["tags"]) if column.name.root == "email"
    )
    sample_data = metadata.get_sample_data(table)

    assert email_column.tags is not None
    assert any(tag.tagFQN.root == "PII.Sensitive" for tag in email_column.tags)
    assert sample_data is not None
    assert sample_data.sampleData is not None
    assert len(sample_data.sampleData.rows) > 0
