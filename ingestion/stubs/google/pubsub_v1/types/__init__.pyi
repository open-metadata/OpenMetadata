from collections.abc import Mapping

from google.protobuf.duration_pb2 import Duration

class Schema:
    class Type:
        AVRO: int
        PROTOCOL_BUFFER: int
        def __init__(self, value: int) -> None: ...
        @property
        def name(self) -> str: ...

    name: str
    type_: Schema.Type
    definition: str
    revision_id: str

class SchemaSettings:
    schema: str
    encoding: int

class Topic:
    name: str
    labels: Mapping[str, str]
    schema_settings: SchemaSettings
    message_retention_duration: Duration | str | None
    kms_key_name: str
    message_ordering_enabled: bool
