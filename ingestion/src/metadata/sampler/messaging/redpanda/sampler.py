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
Redpanda sampler implementation.
Redpanda is Kafka-protocol compatible, so this delegates to KafkaSampler.
"""

from metadata.sampler.messaging.kafka.sampler import KafkaSampler
from metadata.utils.logger import sampler_logger

logger = sampler_logger()


class RedpandaSampler(KafkaSampler):
    """Sampler for Redpanda messaging service (uses Kafka protocol)."""
