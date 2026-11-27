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
"""A larger classification budget must not grow the persisted sample (issue #34622)."""

from unittest.mock import Mock, create_autospec
from uuid import uuid4

import pytest

from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType, Table, TableData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.sink.metadata_rest import MetadataRestSink, MetadataRestSinkConfig
from metadata.sampler.models import SampleData, SamplerResponse
from metadata.utils.constants import SAMPLE_DATA_MAX_STORED_COUNT

TABLE = Table(
    id=uuid4(),
    name="t",
    fullyQualifiedName="svc.db.schema.t",
    columns=[Column(name=ColumnName("id"), dataType=DataType.INT)],
)


@pytest.fixture
def metadata() -> Mock:
    return create_autospec(OpenMetadata, instance=True)


@pytest.fixture
def sink(metadata) -> MetadataRestSink:
    return MetadataRestSink(MetadataRestSinkConfig(), metadata)


def _stored_rows(metadata: Mock) -> list[list]:
    return metadata.ingest_table_sample_data.call_args.kwargs["sample_data"].rows


@pytest.mark.parametrize(
    ("row_count", "expected_stored"),
    [
        (200, SAMPLE_DATA_MAX_STORED_COUNT),
        (SAMPLE_DATA_MAX_STORED_COUNT, SAMPLE_DATA_MAX_STORED_COUNT),
        (10, 10),
        (0, 0),
    ],
)
def test_stored_sample_is_capped(sink, metadata, row_count, expected_stored):
    rows = [[i] for i in range(row_count)]
    record = SamplerResponse(
        entity=TABLE,
        sample_data=SampleData(data=TableData(columns=["id"], rows=rows), store=True),
    )

    sink.write_sampler_response(record)

    assert _stored_rows(metadata) == rows[:expected_stored]
