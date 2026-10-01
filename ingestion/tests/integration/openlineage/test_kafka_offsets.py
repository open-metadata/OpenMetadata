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

import time
from collections.abc import Iterator
from unittest.mock import patch

from confluent_kafka import Consumer

from metadata.generated.schema.entity.services.connections.pipeline.openlineage.kafkaBrokerConfig import (
    Kafka as KafkaBrokerConfig,
)
from metadata.ingestion.source.pipeline.openlineage.connection import (
    _get_kafka_connection,
)
from metadata.ingestion.source.pipeline.openlineage.metadata import OpenlineageSource
from metadata.ingestion.source.pipeline.openlineage.models import OpenLineageEvent

from .conftest import OPENLINEAGE_JOBS  # noqa: TID252

CONNECTION_MODULE = "metadata.ingestion.source.pipeline.openlineage.connection"


def _ingestion_run(broker: KafkaBrokerConfig, consumer_overrides: dict | None = None) -> Iterator[OpenLineageEvent]:
    """``consumer_overrides`` adds librdkafka properties the connector does not expose
    on top of the config it builds."""
    source = object.__new__(OpenlineageSource)
    with patch(f"{CONNECTION_MODULE}.KafkaConsumer", lambda config: Consumer({**config, **(consumer_overrides or {})})):
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


def test_run_evicted_while_processing_an_event_finishes_the_backlog_once(kafka_broker):
    # The connector leaves max.poll.interval.ms at its five-minute default, so the
    # test cuts it to ten seconds. It may not undercut session.timeout.ms, whose
    # broker minimum is six. The wider inactivity window gives the rejoin time.
    broker = kafka_broker.model_copy(update={"sessionTimeout": 20})
    run = _ingestion_run(broker, {"session.timeout.ms": 6000, "max.poll.interval.ms": 10000})
    events = [next(run)]
    # Processing job_0 outlasts the poll interval, so the consumer is evicted and,
    # once it rejoins, is handed job_0 again.
    time.sleep(12)
    events.extend(run)

    assert _job_names(events) == OPENLINEAGE_JOBS
    assert _job_names(_ingestion_run(kafka_broker)) == []
