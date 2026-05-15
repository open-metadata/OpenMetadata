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
NATS source ingestion
"""

import base64
import json
import traceback
from typing import TYPE_CHECKING, Iterable, Optional  # noqa: UP035
from urllib.parse import urlparse

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.entity.data.topic import Topic, TopicSampleData
from metadata.generated.schema.entity.services.connections.messaging.natsConnection import (
    NatsConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName, SourceUrl
from metadata.generated.schema.type.schema import SchemaType
from metadata.generated.schema.type.schema import Topic as TopicSchema
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_topic_data import OMetaTopicSampleData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.messaging.messaging_service import (
    BrokerTopicDetails,
    MessagingServiceSource,
)
from metadata.parsers.schema_parsers import schema_parser_config_registry
from metadata.utils import fqn
from metadata.utils.messaging_utils import merge_and_clean_protobuf_schema

if TYPE_CHECKING:
    from metadata.ingestion.source.messaging.nats.connection import NatsClient
from metadata.ingestion.source.messaging.nats.models import (
    NatsStreamConfig,
    NatsStreamState,
    NatsTopicMetadata,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

_NATS_RETENTION_TO_CLEANUP = {
    "limits": ["delete"],
    "workqueue": ["delete"],
    "interest": ["delete"],
}

_JS_STREAM_NAMES = "$JS.API.STREAM.NAMES"
_JS_STREAM_INFO = "$JS.API.STREAM.INFO.{}"
_JS_STREAM_MSG_GET = "$JS.API.STREAM.MSG.GET.{}"
_JS_KV_MSG_GET = "$JS.API.STREAM.MSG.GET.KV_{}"
_JS_PAGE_SIZE = 256
_NS_TO_MS = 1_000_000.0
_NATS_MONITORING_PORT = 8222
_SAMPLE_SIZE = 10


def _detect_schema_type(schema_text: str) -> str:
    stripped = schema_text.strip()
    if not stripped.startswith("{"):
        if "syntax " in stripped or "message " in stripped:
            return SchemaType.Protobuf.value.lower()
        return SchemaType.Other.value.lower()
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            if parsed.get("type") in ("record", "enum", "array", "fixed"):
                return SchemaType.Avro.value.lower()
            if "$schema" in parsed or "properties" in parsed:
                return "json"
    except Exception:
        pass
    return SchemaType.Other.value.lower()


def _build_source_url(nats_servers: str, stream_name: str) -> SourceUrl:
    first_server = nats_servers.split(",", maxsplit=1)[0].strip()
    try:
        parsed = urlparse(first_server)
        host = parsed.hostname or first_server
        return SourceUrl(f"http://{host}:{_NATS_MONITORING_PORT}/jsz?stream={stream_name}")
    except Exception:
        return SourceUrl(f"{first_server}/stream/{stream_name}")


class NatsSource(MessagingServiceSource):
    """
    Ingests NATS JetStream streams as OpenMetadata Topics.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.nats_client: NatsClient = self.connection
        self.generate_sample_data = self.config.sourceConfig.config.generateSampleData  # pyright: ignore[reportAttributeAccessIssue]
        if self.generate_sample_data and self._is_sample_data_storing_globally_disabled():
            self.generate_sample_data = False

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,  # noqa: UP045
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, NatsConnection):
            raise InvalidSourceException(f"Expected NatsConnection, but got {connection}")
        return cls(config, metadata)

    def _fetch_stream_info(self, stream_name: str) -> Optional[BrokerTopicDetails]:  # noqa: UP045
        try:
            info_resp = self.nats_client.request(_JS_STREAM_INFO.format(stream_name))
            if "error" in info_resp:
                logger.warning(f"Could not fetch info for stream {stream_name}: {info_resp['error']}")
                return None
            config_data = info_resp.get("config") or {}
            state_data = info_resp.get("state") or {}
            return BrokerTopicDetails(
                topic_name=stream_name,
                topic_metadata=NatsTopicMetadata(
                    name=stream_name,
                    config=NatsStreamConfig(**config_data),
                    state=NatsStreamState(**state_data),
                ),
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch metadata for NATS stream {stream_name}: {err}")
            return None

    def get_topic_list(self) -> Iterable[BrokerTopicDetails]:
        if not self.service_connection.jetStreamEnabled:
            logger.warning(
                "JetStream is disabled. Set jetStreamEnabled=true to ingest streams as topics. "
                "Core NATS subjects cannot be listed without JetStream."
            )
            return

        offset = 0
        total = None

        while total is None or offset < total:
            resp = self.nats_client.request(
                _JS_STREAM_NAMES,
                payload=f'{{"offset": {offset}}}'.encode(),
            )

            if "error" in resp:
                logger.error(f"JetStream API error listing streams: {resp['error']}")
                return

            stream_names = resp.get("streams") or []
            total = resp.get("total", len(stream_names))

            for stream_name in stream_names:
                details = self._fetch_stream_info(stream_name)
                if details:
                    yield details

            offset += len(stream_names)
            if not stream_names:
                break

    def get_topic_name(self, topic_details: BrokerTopicDetails) -> str:
        return topic_details.topic_name

    def _fetch_schema_from_kv(self, stream_name: str) -> Optional[tuple]:  # noqa: UP045
        bucket = getattr(self.service_connection, "schemaKvBucket", None)
        if not bucket:
            return None
        try:
            resp = self.nats_client.request(
                _JS_KV_MSG_GET.format(bucket),
                payload=json.dumps({"last_by_subj": f"$KV.{bucket}.{stream_name}"}).encode(),
            )
            if "error" in resp or "message" not in resp:
                return None
            raw = resp["message"].get("data", "")
            if not raw:
                return None
            schema_text = base64.b64decode(raw).decode("utf-8")
            return schema_text, _detect_schema_type(schema_text)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch schema from KV bucket '{bucket}' for stream '{stream_name}': {exc}")
        return None

    def yield_topic(self, topic_details: BrokerTopicDetails) -> Iterable[Either[CreateTopicRequest]]:
        try:
            logger.info(f"Fetching topic details for NATS stream {topic_details.topic_name}")
            metadata: NatsTopicMetadata = topic_details.topic_metadata
            schema_type_map = {k.lower(): v.value for k, v in SchemaType.__members__.items()}
            kv_schema = self._fetch_schema_from_kv(topic_details.topic_name)

            retention_ms = 0.0
            if metadata.config and metadata.config.max_age:
                retention_ms = metadata.config.max_age / _NS_TO_MS

            partitions = 1
            if metadata.state and metadata.state.num_consumers:
                partitions = metadata.state.num_consumers

            replication_factor = None
            max_message_size = None
            retention_size = None
            cleanup_policies = None
            topic_config = {}

            if metadata.config:
                replication_factor = metadata.config.num_replicas
                max_message_size = metadata.config.max_msg_size
                retention_size = metadata.config.max_bytes
                if metadata.config.retention:
                    cleanup_policies = _NATS_RETENTION_TO_CLEANUP.get(metadata.config.retention, ["delete"])
                if metadata.config.subjects:
                    topic_config["subjects"] = metadata.config.subjects
                if metadata.config.storage:
                    topic_config["storage"] = metadata.config.storage
                if metadata.config.retention:
                    topic_config["retention"] = metadata.config.retention

            topic = CreateTopicRequest(
                name=EntityName(topic_details.topic_name),
                service=FullyQualifiedEntityName(self.context.get().messaging_service),
                partitions=partitions,
                retentionTime=retention_ms,
                retentionSize=retention_size,
                replicationFactor=replication_factor,
                maximumMessageSize=max_message_size,
                cleanupPolicies=cleanup_policies,
                sourceUrl=_build_source_url(self.service_connection.natsServers, topic_details.topic_name),
            )
            if topic_config:
                topic.topicConfig = topic_config

            if kv_schema is not None:
                schema_text, schema_type = kv_schema
                load_parser_fn = schema_parser_config_registry.registry.get(schema_type)
                if load_parser_fn:
                    text_for_parsing = (
                        merge_and_clean_protobuf_schema(schema_text)
                        if schema_type == SchemaType.Protobuf.value.lower()
                        else schema_text
                    )
                    schema_fields = load_parser_fn(topic_details.topic_name, text_for_parsing)
                    topic.messageSchema = TopicSchema(
                        schemaText=schema_text,
                        schemaType=schema_type_map.get(schema_type, SchemaType.Other.value),
                        schemaFields=schema_fields if schema_fields is not None else [],
                    )
                else:
                    topic.messageSchema = TopicSchema(
                        schemaText=schema_text, schemaType=SchemaType.Other, schemaFields=[]
                    )
            else:
                topic.messageSchema = TopicSchema(schemaText="", schemaType=SchemaType.Other, schemaFields=[])

            yield Either(right=topic)
            self.register_record(topic_request=topic)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=topic_details.topic_name,
                    error=f"Unexpected exception yielding NATS stream [{topic_details.topic_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_topic_sample_data(self, topic_details: BrokerTopicDetails) -> Iterable[Either[OMetaTopicSampleData]]:
        try:
            if not self.generate_sample_data:
                return
            topic_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Topic,
                service_name=self.context.get().messaging_service,
                topic_name=self.context.get().topic,
            )
            topic_entity = self.metadata.get_by_name(entity=Topic, fqn=topic_fqn)
            if not topic_entity:
                return
            yield Either(
                right=OMetaTopicSampleData(
                    topic=topic_entity,
                    sample_data=TopicSampleData(messages=self._fetch_sample_messages(topic_details)),
                )
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=topic_details.topic_name,
                    error=f"Error fetching sample data for NATS stream [{topic_details.topic_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _fetch_sample_messages(self, topic_details: BrokerTopicDetails) -> list[str]:
        state = topic_details.topic_metadata.state
        if not state:
            return []

        last_seq = state.last_seq
        first_seq = state.first_seq or 1
        if not last_seq:
            return []

        messages = []
        start_seq = max(first_seq, last_seq - _SAMPLE_SIZE + 1)

        for seq in range(last_seq, start_seq - 1, -1):
            try:
                resp = self.nats_client.request(
                    _JS_STREAM_MSG_GET.format(topic_details.topic_name),
                    payload=json.dumps({"seq": seq}).encode(),
                )
                if "error" in resp or "message" not in resp:
                    continue
                raw = resp["message"].get("data", "")
                if raw:
                    decoded = base64.b64decode(raw).decode("utf-8", errors="replace")
                    messages.append(decoded)
            except Exception as err:
                logger.debug(f"Could not fetch seq {seq} from stream {topic_details.topic_name}: {err}")

        return messages

    def close(self) -> None:
        if self.nats_client:
            self.nats_client.close()
        super().close()
