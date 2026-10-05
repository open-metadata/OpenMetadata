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
The configured sample budget must reach classification in full (issue #34622).
"""

import logging
from unittest.mock import create_autospec, patch
from uuid import uuid4

import pytest
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.classification import (
    ClassificationFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.tag import (
    TagFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.recognizer import (
    PredefinedRecognizerFactory,
    RecognizerFactory,
)
from _openmetadata_testutils.pii.fake_classification_manager import (
    FakeClassificationManager,
)
from metadata.generated.schema.configuration.profilerConfiguration import (
    SampleDataIngestionConfig,
)
from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
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
from metadata.generated.schema.type.predefinedRecognizer import Name
from metadata.generated.schema.type.recognizer import Target
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.tag_processor import TagProcessor
from metadata.sampler.models import SampleData, SamplerResponse
from metadata.sampler.sampler_config import DatabaseSamplerConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.constants import (
    SAMPLE_DATA_DEFAULT_COUNT,
    SAMPLE_DATA_MAX_COUNT,
    SAMPLE_DATA_MAX_STORED_COUNT,
)

Base = declarative_base()


class SampleBudgetTest(Base):
    __tablename__ = "sample_budget_test"
    id = Column(Integer, primary_key=True)
    contact_email = Column(String(256))


TABLE_ENTITY = Table(
    id=uuid4(),
    name="sample_budget_test",
    fullyQualifiedName="sqlite.main.main.sample_budget_test",
    columns=[
        EntityColumn(
            name=ColumnName("id"),
            dataType=DataType.INT,
            fullyQualifiedName="sqlite.main.main.sample_budget_test.id",
        ),
        EntityColumn(
            name=ColumnName("contact_email"),
            dataType=DataType.STRING,
            fullyQualifiedName="sqlite.main.main.sample_budget_test.contact_email",
        ),
    ],
)

CUSTOM_QUERY = "SELECT id, contact_email FROM sample_budget_test ORDER BY id ASC"


@pytest.fixture
def sqlite_conn(tmp_path) -> SQLiteConnection:
    return SQLiteConnection(
        scheme=SQLiteScheme.sqlite_pysqlite,
        databaseMode=f"{tmp_path / 'budget.db'}?check_same_thread=False",
    )


@pytest.fixture
def make_sampler(sqlite_conn):
    """Build a sampler over a table seeded with `row_count` rows; the last row holds the only email."""
    samplers = []

    def _make(row_count: int, sample_data_count: int | None, **config) -> SQASampler:
        with patch.object(SQASampler, "build_table_orm", return_value=SampleBudgetTest):
            sampler = SQASampler(
                service_connection_config=sqlite_conn,
                ometa_client=None,
                entity=TABLE_ENTITY,
                config=DatabaseSamplerConfig(sample_data_count=sample_data_count, **config),
            )
        engine = sampler.session_factory().get_bind()
        SampleBudgetTest.__table__.create(bind=engine, checkfirst=True)
        with sampler.session_factory() as session:
            session.add_all(
                SampleBudgetTest(id=i, contact_email="alice@example.com" if i == row_count else "")
                for i in range(1, row_count + 1)
            )
            session.commit()
        samplers.append(sampler)
        return sampler

    yield _make
    for sampler in samplers:
        sampler.close()


def test_budget_of_60_returns_all_60_rows(make_sampler):
    sampler = make_sampler(row_count=60, sample_data_count=60)

    sample = sampler.generate_sample_data()

    assert len(sample.rows) == 60
    assert "alice@example.com" in [row[1] for row in sample.rows]


def test_custom_query_honors_budget_above_100(make_sampler):
    sampler = make_sampler(row_count=150, sample_data_count=150, sample_query=CUSTOM_QUERY)

    sample = sampler.generate_sample_data()

    assert len(sample.rows) == 150
    assert sample.rows[-1] == [150, "alice@example.com"]


@pytest.mark.parametrize("sample_query", [None, CUSTOM_QUERY], ids=["table", "custom-query"])
@pytest.mark.parametrize(
    ("row_count", "sample_data_count", "expected_rows"),
    [
        (80, None, SAMPLE_DATA_DEFAULT_COUNT),
        (80, 10, 10),
        (0, 60, 0),
        (20, 60, 20),
    ],
    ids=["default-is-50", "smaller-budget", "empty-table", "table-smaller-than-budget"],
)
def test_returns_min_of_budget_and_available_rows(
    make_sampler, sample_query, row_count, sample_data_count, expected_rows
):
    sampler = make_sampler(row_count=row_count, sample_data_count=sample_data_count, sample_query=sample_query)

    assert len(sampler.generate_sample_data().rows) == expected_rows


def test_budget_above_maximum_is_clamped_with_warning(make_sampler, caplog):
    with caplog.at_level(logging.WARNING):
        sampler = make_sampler(
            row_count=SAMPLE_DATA_MAX_COUNT + 200, sample_data_count=5_000, sample_query=CUSTOM_QUERY
        )

    sample = sampler.generate_sample_data()

    assert len(sample.rows) == SAMPLE_DATA_MAX_COUNT
    assert "5000" in caplog.text
    assert str(SAMPLE_DATA_MAX_COUNT) in caplog.text


@pytest.fixture(scope="module")
def tag_processor() -> TagProcessor:
    pii = ClassificationFactory.create(fqn="PII", autoClassificationConfig__minimumConfidence=0.7)
    email_tag = TagFactory.create(
        tag_name="Sensitive",
        tag_classification=pii,
        recognizers=[
            RecognizerFactory.create(
                name="email_recognizer",
                recognizerConfig=PredefinedRecognizerFactory.create(name=Name.EmailRecognizer),
                target=Target.content,
            )
        ],
    )
    config = OpenMetadataWorkflowConfig(
        source=Source(
            type="sqlite",
            sourceConfig=SourceConfig(
                config=DatabaseServiceAutoClassificationPipeline(type=AutoClassificationConfigType.AutoClassification)
            ),
        ),
        workflowConfig=WorkflowConfig.model_construct(),
    )
    return TagProcessor(
        config,
        create_autospec(OpenMetadata, spec_set=True, instance=True),
        classification_manager=FakeClassificationManager((pii, [email_tag])),
    )


@pytest.mark.parametrize("sample_query", [None, CUSTOM_QUERY], ids=["table", "custom-query"])
@pytest.mark.parametrize(("sample_data_count", "expect_tag"), [(50, False), (60, True)])
def test_row_60_email_reaches_tag_processor(make_sampler, tag_processor, sample_query, sample_data_count, expect_tag):
    sampler = make_sampler(row_count=60, sample_data_count=sample_data_count, sample_query=sample_query)
    record = SamplerResponse(
        entity=TABLE_ENTITY,
        sample_data=SampleData(data=sampler.generate_sample_data(), store=False),
    )

    result: SamplerResponse = tag_processor.run(record)

    tagged = {(tag.column_fqn, tag.tag_label.tagFQN.root) for tag in result.column_tags}
    assert (("sqlite.main.main.sample_budget_test.contact_email", "PII.Sensitive") in tagged) is expect_tag


def test_upload_to_sample_storage_stays_capped_at_stored_max(make_sampler):
    sampler = make_sampler(row_count=60, sample_data_count=60, upload_sample_storage_config=object())

    with patch("metadata.sampler.sampler_interface.upload_sample_data") as upload:
        sample = sampler.generate_sample_data(SampleDataIngestionConfig(storeSampleData=True, readSampleData=True))

    assert len(sample.rows) == 60
    assert len(upload.call_args.kwargs["data"].rows) == SAMPLE_DATA_MAX_STORED_COUNT
