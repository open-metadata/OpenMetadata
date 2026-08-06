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

"""Sink dataset resolvers, keyed by Kafka Connect connector class."""

# Imported for its registration side effect, and re-exported below so that removing the
# import is an obvious API change: production reaches the resolvers through this package,
# and an unregistered connector class silently degrades to DefaultResolver.
from metadata.ingestion.source.pipeline.kafkaconnect.sinks import snowflake
from metadata.ingestion.source.pipeline.kafkaconnect.sinks.base import (
    DefaultResolver,
    SinkDatasetResolver,
    get_resolver,
    sink_resolver_registry,
)

__all__ = [
    "DefaultResolver",
    "SinkDatasetResolver",
    "get_resolver",
    "sink_resolver_registry",
    "snowflake",
]
