#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Regression coverage for pipeline connection capabilities."""

from metadata.generated.schema.entity.services.connections.pipeline.sparkConnection import (
    SparkConnection,
)


def test_spark_connection_does_not_support_metadata_extraction():
    connection = SparkConnection()

    assert connection.model_dump()["supportsMetadataExtraction"] is False
