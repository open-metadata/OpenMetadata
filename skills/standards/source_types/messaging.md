# Messaging Connector Standards

## Base Class
`MessagingServiceSource` in `ingestion/src/metadata/ingestion/source/messaging/messaging_service.py`

## Reference Connector
`ingestion/src/metadata/ingestion/source/messaging/kafka/`

## Entity Hierarchy
```
MessagingService → Topic → SampleData (optional)
                         → TopicSchema (optional)
```

## Required Methods

| Method | Returns | Purpose |
|--------|---------|---------|
| `yield_topic(topic_details)` | `Iterable[Either[..., CreateTopicRequest]]` | Create topic entities |

## Topic Modeling

```python
CreateTopicRequest(
    name=topic_name,
    service=self.context.get().messaging_service,
    partitions=topic.get("partitions", 1),
    replicationFactor=topic.get("replication_factor", 1),
    messageSchema=self._get_topic_schema(topic),
)
```

## Schema Registry

If the messaging system has a schema registry (like Kafka + Confluent Schema Registry), extract topic schemas:

```python
def _get_topic_schema(self, topic):
    schema = self.schema_registry.get_latest_schema(topic["name"])
    if schema:
        return TopicSchema(
            schemaType=SchemaType.Avro,  # or Protobuf, JSON
            schemaText=schema.schema_str,
        )
    return None
```

## Schema Properties
- `bootstrapServers` (required for Kafka-like)
- `schemaRegistryURL` (optional)
- Auth (basic, SASL, SSL)
- `topicFilterPattern`
- `supportsMetadataExtraction`

## Connection Pattern
For Kafka-like brokers, typically wraps the admin client:

```python
def get_connection(connection):
    admin_client = KafkaAdminClient(
        bootstrap_servers=connection.bootstrapServers,
        **auth_config,
    )
    return admin_client
```
