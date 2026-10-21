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
The configured sample budget must reach classification on NoSQL sources too (issue #34622).
"""

from uuid import uuid4

import pytest

from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection,
)
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.samplingConfig import ProfileSampleConfig, SampleConfigType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.sampler.models import SampleConfig
from metadata.sampler.nosql.sampler import NoSQLSampler
from metadata.sampler.sampler_config import DatabaseSamplerConfig
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT

DATABASE = "sample_budget"


@pytest.fixture(scope="module")
def mongo_connection(mongodbContainer) -> MongoDBConnection:  # noqa: N803
    return MongoDBConnection(
        username="test",
        password="test",
        hostPort=f"localhost:{mongodbContainer.get_exposed_port(27017)}",
    )


@pytest.fixture
def make_sampler(mongodbContainer, mongo_connection):  # noqa: N803
    """Build a sampler over a fresh collection of `row_count` documents; the last one holds the only email."""
    samplers = []

    def _make(row_count: int, sample_data_count: int | None, **config) -> NoSQLSampler:
        name = f"budget_{uuid4().hex[:8]}"
        collection = mongodbContainer.get_connection_client()[DATABASE][name]
        collection.insert_many(
            [
                {"seq": i, "contact_email": "alice@example.com" if i == row_count else ""}
                for i in range(1, row_count + 1)
            ]
        )
        entity = Table(
            id=uuid4(),
            name=name,
            fullyQualifiedName=f"mongo.default.{DATABASE}.{name}",
            databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name=DATABASE),
            columns=[
                Column(name=ColumnName("seq"), dataType=DataType.INT),
                Column(name=ColumnName("contact_email"), dataType=DataType.STRING),
            ],
        )
        sampler = NoSQLSampler(
            service_connection_config=mongo_connection,
            ometa_client=None,
            entity=entity,
            config=DatabaseSamplerConfig(sample_data_count=sample_data_count, **config),
        )
        samplers.append(sampler)
        return sampler

    yield _make
    for sampler in samplers:
        sampler.close()


def test_budget_of_60_returns_all_60_rows(make_sampler):
    sampler = make_sampler(row_count=60, sample_data_count=60)

    sample = sampler.generate_sample_data()

    assert len(sample.rows) == 60
    email_index = [column.root for column in sample.columns].index("contact_email")
    assert "alice@example.com" in [row[email_index] for row in sample.rows]


def test_custom_query_honors_budget(make_sampler):
    sampler = make_sampler(row_count=80, sample_data_count=60, sample_query='{"seq": {"$gte": 1}}')

    assert len(sampler.generate_sample_data().rows) == 60


def test_default_budget_is_50(make_sampler):
    sampler = make_sampler(row_count=80, sample_data_count=None)

    assert len(sampler.generate_sample_data().rows) == SAMPLE_DATA_DEFAULT_COUNT


def test_smaller_profile_sample_still_bounds_rows(make_sampler):
    sampler = make_sampler(
        row_count=80,
        sample_data_count=60,
        sample_config=SampleConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.STATIC,
                config=StaticSamplingConfig(profileSample=30, profileSampleType=ProfileSampleType.ROWS),
            )
        ),
    )

    assert len(sampler.generate_sample_data().rows) == 30
