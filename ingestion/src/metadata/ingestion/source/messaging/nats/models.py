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
NATS connector data models
"""

from pydantic import BaseModel, ConfigDict


class NatsStreamConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    subjects: list[str] | None = None
    retention: str | None = None
    max_msgs: int | None = None
    max_bytes: int | None = None
    max_msg_size: int | None = None
    max_age: int | None = None
    num_replicas: int | None = None
    storage: str | None = None


class NatsStreamState(BaseModel):
    model_config = ConfigDict(extra="allow")

    messages: int | None = None
    bytes: int | None = None
    num_consumers: int | None = None
    first_seq: int | None = None
    last_seq: int | None = None


class NatsTopicMetadata(BaseModel):
    name: str
    config: NatsStreamConfig | None = None
    state: NatsStreamState | None = None
