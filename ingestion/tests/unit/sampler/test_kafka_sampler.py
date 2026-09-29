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

from metadata.utils.fqn import split as fqn_split


def _last_part(fqn: str) -> str:
    from metadata.utils.fqn import split as fqn_split

    parts = fqn_split(fqn)
    topic_name = parts[-1] if len(parts) > 1 else fqn
    if topic_name.startswith('"') and topic_name.endswith('"'):
        topic_name = topic_name[1:-1]
    return topic_name


def test_get_topic_name_simple() -> None:
    assert _last_part("kafka.simple-topic") == "simple-topic"


def test_get_topic_name_multiple_parts() -> None:
    parts = fqn_split("kafka.events.processed.v2")
    assert parts == ["kafka", "events", "processed", "v2"]
    assert _last_part("kafka.events.processed.v2") == "v2"


def test_get_topic_name_quoted() -> None:
    parts = fqn_split('kafka."events.v2"')
    assert parts == ["kafka", '"events.v2"']
    assert _last_part('kafka."events.v2"') == "events.v2"


def test_get_topic_name_single_part() -> None:
    assert _last_part("kafka") == "kafka"
