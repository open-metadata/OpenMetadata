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
"""A model outage preserves real sample writes and tags, then fails the run."""

import json
from copy import deepcopy

import pytest

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.tagLabel import LabelType, State, TagLabel, TagSource
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.pii.algorithms import presidio_utils
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.workflow_status_mixin import WorkflowResultStatus


def test_model_outage_preserves_samples_tags_and_recovers(
    db_service,
    metadata,
    load_metadata,
    workflow_config,
    sink_config,
    monkeypatch,
    tmp_path,
):
    config = {
        "source": {
            "type": "postgres",
            "serviceName": db_service.fullyQualifiedName.root,
            "serviceConnection": db_service.connection.model_dump(),
            "sourceConfig": {
                "config": {
                    "type": "AutoClassification",
                    "enableAutoClassification": True,
                    "storeSampleData": True,
                    "tableFilterPattern": {"includes": ["^(example_table|card_prefix_cases)$"]},
                }
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
    fqns = [
        f"{db_service.fullyQualifiedName.root}.test_db.public.{name}" for name in ("example_table", "card_prefix_cases")
    ]
    table = metadata.get_by_name(entity=Table, fqn=fqns[0], fields=["tags"])
    manual = TagLabel(
        tagFQN="PII.Sensitive", labelType=LabelType.Manual, state=State.Confirmed, source=TagSource.Classification
    )
    metadata.patch_column_tags(table, [ColumnTag(column_fqn=f"{fqns[0]}.customer_id", tag_label=manual)])
    before = {fqn: metadata.get_table_columns(fqn, fields=["tags"]) for fqn in fqns}
    assert any(tag.labelType == LabelType.Manual for column in before[fqns[0]] for tag in column.tags or [])
    presidio_utils.load_nlp_engine.cache_clear()

    def unavailable_download(model_name):
        raise ConnectionError("test runner cannot download models")

    # A real missing artifact reaches spaCy's local-load failure before the network boundary fails.
    with monkeypatch.context() as fault:
        fault.setattr(presidio_utils, "get_model_for_language", lambda _: str(tmp_path / "absent_model"))
        fault.setattr(presidio_utils, "download", unavailable_download)
        workflow = AutoClassificationWorkflow.create(deepcopy(config))
        workflow.execute()
        with pytest.raises(WorkflowExecutionError):
            workflow.raise_from_status()
        workflow.write_status_file(tmp_path / "failed-status.json")
        assert json.loads((tmp_path / "failed-status.json").read_text())["success"] is False
        assert len(workflow.get_failures()) == 1
        assert workflow.result_status() is WorkflowResultStatus.FAILURE

    for fqn in fqns:
        after = metadata.get_by_name(entity=Table, fqn=fqn, fields=["tags"])
        assert [(c.name, c.tags) for c in metadata.get_table_columns(fqn, fields=["tags"])] == [
            (c.name, c.tags) for c in before[fqn]
        ]
        samples = metadata.get_sample_data(after)
        assert samples.sampleData.rows

    presidio_utils.load_nlp_engine.cache_clear()
    repaired = AutoClassificationWorkflow.create(deepcopy(config))
    repaired.execute()
    repaired.raise_from_status()
    assert not repaired.get_failures()
    columns = metadata.get_table_columns(fqns[0], fields=["tags"])
    assert any(tag.labelType == LabelType.Generated for column in columns for tag in column.tags or [])
    assert any(tag.labelType == LabelType.Manual for column in columns for tag in column.tags or [])
