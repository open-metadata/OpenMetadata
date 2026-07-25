"""
Populates a NATS JetStream KV bucket with topic schemas.

Each key must match exactly the JetStream stream name.
Values can be Avro JSON, JSON Schema, or Protobuf (.proto) text.

Usage:
    python populate_schemas_kv.py [--nats nats://localhost:4222] [--bucket SCHEMAS]
"""

import argparse
import asyncio
import json
import logging

import nats

logger = logging.getLogger(__name__)

SCHEMAS = {
    # Avro — detected by {"type": "record", ...} at root
    "orders": json.dumps(
        {
            "type": "record",
            "name": "Order",
            "namespace": "com.example",
            "fields": [
                {"name": "order_id", "type": "string"},
                {"name": "customer_id", "type": "string"},
                {"name": "amount", "type": "double"},
                {"name": "currency", "type": {"type": "enum", "name": "Currency", "symbols": ["BRL", "USD", "EUR"]}},
                {"name": "created_at", "type": "long"},
            ],
        }
    ),
    # Avro — nested record
    "users": json.dumps(
        {
            "type": "record",
            "name": "User",
            "namespace": "com.example",
            "fields": [
                {"name": "user_id", "type": "string"},
                {"name": "email", "type": "string"},
                {"name": "plan", "type": {"type": "enum", "name": "Plan", "symbols": ["FREE", "PRO", "ENTERPRISE"]}},
                {"name": "created_at", "type": "long"},
            ],
        }
    ),
    # JSON Schema — detected by {"$schema": ...} or {"properties": ...}
    "notifications": json.dumps(
        {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "Notification",
            "type": "object",
            "required": ["id", "type", "payload"],
            "properties": {
                "id": {"type": "string"},
                "type": {"type": "string", "enum": ["EMAIL", "PUSH", "SMS"]},
                "payload": {"type": "object"},
                "sent_at": {"type": "string", "format": "date-time"},
            },
        }
    ),
    # Protobuf — detected by syntax/message keywords
    "events": """\
syntax = "proto3";

package com.example;

message Event {
  string event_id = 1;
  string event_type = 2;
  string source = 3;
  int64 timestamp = 4;
  bytes payload = 5;
}
""",
}


async def main(nats_url: str, bucket: str) -> None:
    nc = await nats.connect(nats_url)
    js = nc.jetstream()

    try:
        kv = await js.key_value(bucket)
        logger.info("Using existing KV bucket '%s'", bucket)
    except Exception:
        kv = await js.create_key_value(bucket=bucket)
        logger.info("Created KV bucket '%s'", bucket)

    for stream_name, schema_text in SCHEMAS.items():
        await kv.put(stream_name, schema_text.encode())
        logger.info("Stored schema for stream: %s", stream_name)

    logger.info("Verifying %d schemas in bucket '%s'", len(SCHEMAS), bucket)
    for stream_name in SCHEMAS:
        entry = await kv.get(stream_name)
        preview = entry.value.decode()[:60].replace("\n", " ")
        logger.info("%s: %s...", stream_name, preview)

    await nc.drain()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Populate NATS KV bucket with schemas")
    parser.add_argument("--nats", default="nats://localhost:4222", help="NATS server URL")
    parser.add_argument("--bucket", default="SCHEMAS", help="KV bucket name")
    args = parser.parse_args()

    asyncio.run(main(args.nats, args.bucket))
