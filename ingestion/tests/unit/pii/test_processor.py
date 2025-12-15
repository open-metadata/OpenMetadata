import importlib.util
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, Generator, List, Optional, Set, Tuple
from unittest.mock import Mock, create_autospec

import pytest

from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    AutoClassificationConfigType,
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.processor import PIIProcessor
from metadata.sampler.models import SamplerResponse


@pytest.fixture
def openmetadata() -> OpenMetadata:
    return create_autospec(OpenMetadata, spec_set=True, instance=True)


@pytest.fixture
def workflow_config() -> OpenMetadataWorkflowConfig:
    return OpenMetadataWorkflowConfig(
        source=Source(
            type="Postgres",
            sourceConfig=SourceConfig(
                config=DatabaseServiceAutoClassificationPipeline(
                    type=AutoClassificationConfigType.AutoClassification
                )
            ),
        ),
        workflowConfig=WorkflowConfig.model_construct(),
    )


def group_column_tags_by_column(column_tags: List[ColumnTag]) -> Dict[str, Set[str]]:
    column_tags_by_column: Dict[str, Set[str]] = defaultdict(set)
    for column_tag in column_tags:
        column_tags_by_column[column_tag.column_fqn].add(
            column_tag.tag_label.tagFQN.root
        )
    return column_tags_by_column


def import_from_path(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def generate_test_cases(
    include: Optional[Set[str]] = None,
) -> Generator[Tuple[str, SamplerResponse, List[ColumnTag]], None, None]:
    test_cases_dir = Path(os.path.join(os.path.dirname(__file__), "test_cases"))
    for file in os.listdir(test_cases_dir):
        file_path = test_cases_dir / file

        if not os.path.isfile(file_path):
            continue

        module_name = file.replace(".py", "")

        if include and module_name not in include:
            continue

        test_case = import_from_path(module_name, file_path)

        if getattr(test_case, "skip", False) is True:
            continue

        sampler_record = SamplerResponse(
            table=test_case.table,
            sample_data=test_case.sample_data,
        )

        yield test_case.__name__, sampler_record, test_case.expected_column_tags


@pytest.mark.parametrize(
    "test_case, sampler_record, expected_column_tags",
    generate_test_cases(),
)
def test_it_returns_the_expected_column_tags(
    test_case: str,
    sampler_record: SamplerResponse,
    openmetadata: Mock,
    workflow_config: OpenMetadataWorkflowConfig,
    expected_column_tags: List[ColumnTag],
):
    processor = PIIProcessor(workflow_config, openmetadata)

    result: SamplerResponse = processor.run(sampler_record)

    expected_tags_by_column = group_column_tags_by_column(expected_column_tags)
    obtained_tags_by_column = group_column_tags_by_column(result.column_tags)

    assert set(obtained_tags_by_column) == set(expected_tags_by_column)

    for expected_column, expected_tags in expected_tags_by_column.items():
        assert obtained_tags_by_column[expected_column] == expected_tags, (
            f"[Test case: {test_case}] Tags for column {expected_column!r} mismatch: "
            + f"Obtained({obtained_tags_by_column[expected_column]!r}) != Expected({expected_tags!r})"
        )
