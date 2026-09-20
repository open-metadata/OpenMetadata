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
"""
OpenLineage over NATS, end to end against a real JetStream server.

A producer publishes OpenLineage events to a stream and the connector consumes them with a
durable pull consumer, which is what makes a scheduled ingestion run resume where the
previous one stopped.

Requires Docker for testcontainers.
"""

import asyncio
import contextlib
import json
import os
import shutil
import socket
import subprocess
import time
import uuid
from pathlib import Path

import pytest
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs

from metadata.generated.schema.entity.services.connections.pipeline.openlineage.natsBrokerConfig import (
    Nats as NatsBrokerConfig,
)
from metadata.ingestion.source.pipeline.openlineage.connection import (
    _get_nats_connection,
)
from metadata.ingestion.source.pipeline.openlineage.metadata import OpenlineageSource

STREAM = f"OPENLINEAGE_{uuid.uuid4().hex[:8]}"
SUBJECT = f"{STREAM.lower()}.events"
EVENT_FILE = Path(__file__).parents[1].parent / "unit" / "resources" / "datasets" / "openlineage_event.json"


@pytest.fixture(scope="module")
def nats_url() -> str:
    if external := os.getenv("NATS_URL"):
        yield external
        return
    container = DockerContainer("nats:2").with_command("-js").with_exposed_ports(4222)
    container.start()
    try:
        wait_for_logs(container, "Server is ready", timeout=60)
        yield f"nats://{container.get_container_host_ip()}:{container.get_exposed_port(4222)}"
    finally:
        container.stop()


def _publish(url: str, events: list[dict], stream: str = STREAM, subject: str = SUBJECT) -> None:
    """Stand in for an OpenLineage producer: publish events, wait for the stream's ack."""
    import nats
    import nats.js.errors
    from nats.js.api import StreamConfig

    async def publish() -> None:
        nc = await nats.connect(url)
        js = nc.jetstream()
        # NATS rejects a stream whose subjects overlap an existing one, so each run gets
        # its own subject namespace
        with contextlib.suppress(nats.js.errors.BadRequestError):
            await js.add_stream(StreamConfig(name=stream, subjects=[subject]))
        for event in events:
            await js.publish(subject, json.dumps(event).encode())
        await nc.close()

    asyncio.run(publish())


def _consume(url: str, durable: str) -> list:
    broker = NatsBrokerConfig(
        natsServers=url,
        streamName=STREAM,
        subject=SUBJECT,
        durableConsumerName=durable,
        poolTimeout=1.0,
        sessionTimeout=2,
    )
    client = _get_nats_connection(broker)
    source = OpenlineageSource.__new__(OpenlineageSource)
    source.client = client
    try:
        return list(source._poll_nats(broker))
    finally:
        client.close()


@pytest.mark.integration
def test_events_published_to_jetstream_are_consumed_once(nats_url):
    event = json.loads(EVENT_FILE.read_text())
    _publish(nats_url, [event, {**event, "eventType": "START"}])

    consumed = _consume(nats_url, durable="roundtrip")

    assert len(consumed) == 2
    # The durable consumer acknowledged both, so a second run has nothing left to read
    assert _consume(nats_url, durable="roundtrip") == []


@pytest.mark.integration
def test_a_new_consumer_replays_the_stream_from_the_start(nats_url):
    consumed = _consume(nats_url, durable="replay")

    assert len(consumed) == 2


@pytest.mark.integration
def test_slow_processing_still_acknowledges_every_event(tmp_path):
    """
    The loop runs on its own thread, so the connection survives a suspended generator.

    A loop that only ran inside fetch()/ack() could not answer the server's PINGs while
    the connector was busy downstream; the server dropped the connection and every
    acknowledgement published while disconnected was silently discarded.
    """
    if not shutil.which("nats-server"):
        pytest.skip("needs nats-server to configure aggressive PINGs")

    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    config = tmp_path / "ping.conf"
    config.write_text('ping_interval: "2s"\nping_max: 1\njetstream: enabled\n')
    server = subprocess.Popen(
        ["nats-server", "-p", str(port), "-sd", str(tmp_path / "js"), "-c", str(config)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    url = f"nats://127.0.0.1:{port}"
    try:
        _wait_for(url)
        event = json.loads(EVENT_FILE.read_text())
        _publish(url, [event, event, event], stream="SLOW", subject="slow.events")

        broker = NatsBrokerConfig(
            natsServers=url,
            streamName="SLOW",
            subject="slow.events",
            durableConsumerName="slow",
            poolTimeout=1.0,
            sessionTimeout=1,
            batchSize=3,
        )
        client = _get_nats_connection(broker)
        source = OpenlineageSource.__new__(OpenlineageSource)
        source.client = client
        try:
            consumed = 0
            for _ in source._poll_nats(broker):
                consumed += 1
                time.sleep(4)  # longer than ping_interval * ping_max
        finally:
            client.close()

        assert consumed == 3
        assert _ack_floor(url, "SLOW", "slow") == 3
    finally:
        server.terminate()
        server.wait(timeout=10)


def _wait_for(url: str, timeout: float = 20.0) -> None:
    import nats

    async def ready() -> None:
        nc = await nats.connect(url, connect_timeout=1, allow_reconnect=False)
        await nc.close()

    deadline = time.monotonic() + timeout
    while True:
        try:
            asyncio.run(ready())
        except Exception:
            if time.monotonic() > deadline:
                raise
            time.sleep(0.2)
        else:
            return


def _ack_floor(url: str, stream: str, durable: str) -> int:
    import nats

    async def read() -> int:
        nc = await nats.connect(url)
        info = await nc.jetstream().consumer_info(stream, durable)
        await nc.close()
        return int(info.ack_floor.stream_seq)

    return asyncio.run(read())
