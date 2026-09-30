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
Issue #29757: against a real broker, the OpenLineage source commits an event's
offset only after the event has been processed, so each run resumes exactly
where the previous one stopped.
"""

from collections.abc import Iterator

from metadata.generated.schema.entity.services.connections.pipeline.openlineage.kafkaBrokerConfig import (
    Kafka as KafkaBrokerConfig,
)
from metadata.ingestion.source.pipeline.openlineage.connection import (
    _get_kafka_connection,
)
from metadata.ingestion.source.pipeline.openlineage.metadata import OpenlineageSource
from metadata.ingestion.source.pipeline.openlineage.models import OpenLineageEvent

from .conftest import OPENLINEAGE_JOBS  # noqa: TID252


def _ingestion_run(broker: KafkaBrokerConfig) -> Iterator[OpenLineageEvent]:
    source = object.__new__(OpenlineageSource)
    source.client, _ = _get_kafka_connection(broker)
    return source._poll_kafka(broker)


def _job_names(events) -> list[str]:
    return [event.job["name"] for event in events]


def test_event_in_flight_when_a_run_stops_is_read_by_the_next_run(kafka_broker):
    run = _ingestion_run(kafka_broker)
    next(run)
    # Asking for job_1 means job_0 went through the topology. The run then stops
    # while job_1 is still being processed.
    next(run)
    run.close()

    assert _job_names(_ingestion_run(kafka_broker)) == OPENLINEAGE_JOBS[1:]


def test_processed_events_are_not_read_by_the_next_run(kafka_broker):
    assert _job_names(_ingestion_run(kafka_broker)) == OPENLINEAGE_JOBS

    assert _job_names(_ingestion_run(kafka_broker)) == []
