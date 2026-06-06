from collections.abc import Iterable

from google.protobuf.duration_pb2 import Duration

class PublisherClient:
    def __init__(self) -> None: ...
    def list_topics(self, *, request: dict[str, str]) -> Iterable[Topic]: ...
    def list_topic_subscriptions(self, *, request: dict[str, str]) -> Iterable[str]: ...

class Topic:
    name: str
    message_retention_duration: Duration | str | None

class SubscriberClient:
    def __init__(self) -> None: ...
    def list_subscriptions(self, *, request: dict[str, str]) -> Iterable[Subscription]: ...
    def get_subscription(self, *, request: dict[str, str]) -> Subscription: ...

class DeadLetterPolicy:
    dead_letter_topic: str

class PushConfig:
    push_endpoint: str

class BigQueryConfig:
    table: str
    use_topic_schema: bool | None
    write_metadata: bool | None
    drop_unknown_fields: bool | None

class Subscription:
    name: str
    ack_deadline_seconds: int
    message_retention_duration: Duration | str | None
    dead_letter_policy: DeadLetterPolicy | None
    push_config: PushConfig | None
    filter: str
    bigquery_config: BigQueryConfig | None
    enable_exactly_once_delivery: bool | None
