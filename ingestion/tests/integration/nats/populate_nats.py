# ruff: noqa: T201
"""
Creates JetStream streams and publishes sample messages for testing the NATS connector.

Run this before triggering ingestion in OpenMetadata so that streams exist
and sample data is available.

Usage:
    python populate_nats.py [--nats nats://localhost:4222] [--messages 20]
"""

import argparse
import asyncio
import json
import random
import time
import uuid

import nats

STREAMS = [
    {
        "name": "orders",
        "subjects": ["orders.>"],
        "retention": "limits",
        "storage": "file",
        "max_bytes": 500 * 1024 * 1024,
        "max_msg_size": 1 * 1024 * 1024,
        "max_age": 7 * 24 * 3600 * 1_000_000_000,
        "num_replicas": 1,
    },
    {
        "name": "users",
        "subjects": ["users.>"],
        "retention": "limits",
        "storage": "file",
        "max_age": 30 * 24 * 3600 * 1_000_000_000,
        "num_replicas": 1,
    },
    {
        "name": "notifications",
        "subjects": ["notifications.>"],
        "retention": "limits",
        "storage": "memory",
        "max_bytes": 50 * 1024 * 1024,
        "max_msg_size": 64 * 1024,
        "max_age": 24 * 3600 * 1_000_000_000,
        "num_replicas": 1,
    },
    {
        "name": "events",
        "subjects": ["events.>"],
        "retention": "limits",
        "storage": "file",
        "num_replicas": 1,
    },
]


def _make_order(i: int) -> tuple:
    return (
        "orders.created",
        {
            "order_id": f"ORD-{i:04d}",
            "customer_id": f"CUST-{random.randint(1, 100):03d}",
            "amount": round(random.uniform(10.0, 999.99), 2),
            "currency": random.choice(["BRL", "USD", "EUR"]),
            "items": random.randint(1, 10),
            "created_at": int(time.time()) - random.randint(0, 86400),
        },
    )


def _make_user(i: int) -> tuple:
    return (
        "users.updated",
        {
            "user_id": f"USR-{i:04d}",
            "email": f"user{i}@example.com",
            "plan": random.choice(["FREE", "PRO", "ENTERPRISE"]),
            "active": random.choice([True, False]),
            "updated_at": int(time.time()) - random.randint(0, 86400 * 7),
        },
    )


def _make_notification(i: int) -> tuple:
    return (
        "notifications.sent",
        {
            "id": str(uuid.uuid4()),
            "type": random.choice(["EMAIL", "PUSH", "SMS"]),
            "recipient": f"user{i}@example.com",
            "payload": {"subject": f"Notification #{i}", "body": f"Message body {i}"},
            "sent_at": int(time.time()) - random.randint(0, 3600),
        },
    )


def _make_event(i: int) -> tuple:
    event_types = ["user_signup", "order_created", "order_paid", "order_shipped", "user_churned"]
    return (
        f"events.{random.choice(event_types)}",
        {
            "event_id": str(uuid.uuid4()),
            "event_type": random.choice(event_types),
            "source": random.choice(["web", "mobile", "backend"]),
            "user_id": f"USR-{random.randint(1, 100):04d}",
            "timestamp": int(time.time()) - random.randint(0, 86400 * 30),
        },
    )


STREAM_FACTORY = {
    "orders": _make_order,
    "users": _make_user,
    "notifications": _make_notification,
    "events": _make_event,
}


async def _delete_stream(nc, name: str) -> None:
    try:
        resp = await nc.request(f"$JS.API.STREAM.DELETE.{name}", b"", timeout=5)
        data = json.loads(resp.data)
        if "error" not in data:
            print(f"  ~ {name} (deleted old stream)")
    except Exception:
        pass


async def _create_stream(nc, stream_cfg: dict) -> bool:
    name = stream_cfg["name"]
    payload = json.dumps(stream_cfg).encode()
    try:
        resp = await nc.request(f"$JS.API.STREAM.CREATE.{name}", payload, timeout=5)
        data = json.loads(resp.data)
        if "error" in data:
            err_code = data["error"].get("err_code", 0)
            if err_code in (10058, 10065):
                # name already in use or subjects overlap — delete and retry
                await _delete_stream(nc, name)
                resp = await nc.request(f"$JS.API.STREAM.CREATE.{name}", payload, timeout=5)
                data = json.loads(resp.data)
                if "error" in data:
                    print(f"  ✗ {name}: {data['error']}")
                    return False
            else:
                print(f"  ✗ {name}: {data['error']}")
                return False
    except Exception as e:
        print(f"  ✗ {name}: {e}")
        return False
    else:
        print(f"  ✓ {name} (created)")
        return True


async def main(nats_url: str, n_messages: int) -> None:
    print(f"Connecting to NATS at {nats_url}...")
    nc = await nats.connect(nats_url)

    print("\nCreating streams:")
    created = set()
    for cfg in STREAMS:
        ok = await _create_stream(nc, cfg)
        if ok:
            created.add(cfg["name"])

    print(f"\nPublishing {n_messages} messages per stream:")
    for stream_name, factory in STREAM_FACTORY.items():
        if stream_name not in created:
            print(f"  - {stream_name}: skipped (stream not ready)")
            continue
        for i in range(1, n_messages + 1):
            subject, payload = factory(i)
            await nc.publish(subject, json.dumps(payload).encode())
        print(f"  ✓ {stream_name}: {n_messages} messages")

    await nc.flush()
    await nc.drain()
    print("\nDone. Streams are ready for OpenMetadata ingestion.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Populate NATS JetStream streams with sample messages")
    parser.add_argument("--nats", default="nats://localhost:4222", help="NATS server URL")
    parser.add_argument("--messages", type=int, default=20, help="Number of messages per stream")
    args = parser.parse_args()

    asyncio.run(main(args.nats, args.messages))
