#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""S3 integration tests"""
import sys

import pytest

from metadata.generated.schema.entity.data.container import Container, FileFormat
from metadata.generated.schema.entity.services.storageService import StorageService


@pytest.mark.skipif(
    sys.version_info < (3, 9),
    reason="testcontainers Network feature requires python3.9 or higher",
)
def test_s3_ingestion(metadata, ingest_s3_storage, service_name):
    """Test the ingestion is working as expected"""

    service: StorageService = metadata.get_by_name(
        entity=StorageService, fqn=service_name
    )
    assert service

    # We should have the bucket and all its structured children
    bucket: Container = metadata.get_by_name(
        entity=Container, fqn=f"{service_name}.test-bucket", fields=["*"]
    )
    # The bucket has children and no dataModel
    assert 5 == len(bucket.children.__root__)
    assert not bucket.dataModel

    # We can validate the children
    cities: Container = metadata.get_by_name(
        entity=Container, fqn=f"{service_name}.test-bucket.cities", fields=["*"]
    )
    assert cities.dataModel.isPartitioned
    assert 9 == len(cities.dataModel.columns)
    assert FileFormat.parquet in cities.fileFormats

    cities_multiple: Container = metadata.get_by_name(
        entity=Container,
        fqn=f"{service_name}.test-bucket.cities_multiple",
        fields=["*"],
    )
    assert cities_multiple.dataModel.isPartitioned
    assert 11 == len(cities_multiple.dataModel.columns)
    assert FileFormat.parquet in cities_multiple.fileFormats

    cities_multiple_simple: Container = metadata.get_by_name(
        entity=Container,
        fqn=f"{service_name}.test-bucket.cities_multiple_simple",
        fields=["*"],
    )
    assert cities_multiple_simple.dataModel.isPartitioned
    assert 10 == len(cities_multiple_simple.dataModel.columns)
    assert FileFormat.parquet in cities_multiple_simple.fileFormats

    transactions: Container = metadata.get_by_name(
        entity=Container, fqn=f"{service_name}.test-bucket.transactions", fields=["*"]
    )
    assert not transactions.dataModel.isPartitioned
    assert 2 == len(transactions.dataModel.columns)
    assert FileFormat.csv in transactions.fileFormats

    transactions_separator: Container = metadata.get_by_name(
        entity=Container,
        fqn=f"{service_name}.test-bucket.transactions_separator",
        fields=["*"],
    )
    assert not transactions_separator.dataModel.isPartitioned
    assert 2 == len(transactions_separator.dataModel.columns)
    assert FileFormat.csv in transactions_separator.fileFormats
