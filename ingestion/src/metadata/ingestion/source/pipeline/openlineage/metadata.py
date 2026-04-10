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
OpenLineage source to extract metadata from Kafka or Kinesis events
"""
import json
import time
import traceback
from collections import defaultdict
from itertools import groupby, product
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote, urlparse

from cachetools import LRUCache

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    KafkaBrokerConfig,
    KinesisBrokerConfig,
    OpenLineageConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
    Source,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.pipeline.openlineage.models import (
    EntityDetails,
    EventType,
    LineageEdge,
    LineageNode,
    OpenLineageEvent,
    PipelineFQN,
    TableDetails,
    TableFQN,
    TopicDetails,
    TopicFQN,
)
from metadata.ingestion.source.pipeline.openlineage.service_resolver import (
    build_service_name,
    extract_integration_type,
    find_pipeline_by_namespace,
    get_or_create_pipeline_service,
    resolve_pipeline_service_type,
)
from metadata.ingestion.source.pipeline.openlineage.table_resolver import (
    extract_db_scheme_from_namespace,
    find_service_by_namespace_mapping,
    find_services_by_scheme,
)
from metadata.ingestion.source.pipeline.openlineage.utils import (
    AmbiguousServiceException,
    FQNNotFoundException,
    message_to_open_lineage_event,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class OpenlineageSource(PipelineServiceSource):
    """
    Implements the necessary methods of PipelineServiceSource to facilitate registering OpenLineage pipelines with
    metadata into Open Metadata.

    Works under the assumption that OpenLineage integrations produce events to Kafka topic or Kinesis stream,
    which is a source of events for this connector.

    Only OpenLineage events that indicate successfull data movement (COMPLETE, RUNNING, START) are taken into account in this connector.

    Configuring OpenLineage integrations: https://openlineage.io/docs/integrations/about
    """

    _db_service_names_warned: bool = False
    _service_cache: Dict[str, str]
    _current_pipeline_service: Optional[str] = None

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: OpenLineageConnection = config.serviceConnection.root.config
        if not isinstance(connection, OpenLineageConnection):
            raise InvalidSourceException(
                f"Expected OpenLineageConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        self._service_cache = {}
        self._current_pipeline_service = None
        self._entity_cache: LRUCache = LRUCache(maxsize=10000)
        self._namespace_to_service_cache: LRUCache = LRUCache(maxsize=10000)
        self._db_service_type_map: Dict[str, str] = self._build_db_service_type_map()

    def close(self) -> None:
        self.metadata.compute_percentile(Pipeline, self.today)
        self.metadata.close()

    @staticmethod
    def _get_entity_details(data: Dict) -> EntityDetails:
        """
        Determine the entity type (table or topic) from an OpenLineage input/output entry
        based on the namespace prefix.

        :param data: single input/output entry from an OpenLineage event
        :return: EntityDetails with entity_type and corresponding details (TableDetails or TopicDetails)
        """
        namespace = data.get("namespace", "")

        # Kafka topic detection
        if namespace.startswith("kafka://"):
            return EntityDetails(
                entity_type="topic",
                topic_details=OpenlineageSource._get_topic_details(data),
            )
        else:
            return EntityDetails(
                entity_type="table",
                table_details=OpenlineageSource._get_table_details(data),
            )

    @classmethod
    def _get_table_details(cls, data: Dict) -> TableDetails:
        """
        extracts table entity schema and name from input/output entry collected from Open Lineage.

        :param data: single entry from inputs/outputs objects
        :return: TableDetails object with schema and name
        """
        symlinks = data.get("facets", {}).get("symlinks", {}).get("identifiers", [])

        # for some OL events name can be extracted from dataset facet but symlinks is preferred so - if present - we
        # use it instead
        if len(symlinks) > 0:
            try:
                # @todo verify if table can have multiple identifiers pointing at it
                name = symlinks[0]["name"]
            except (KeyError, IndexError):
                raise ValueError(
                    "input table name cannot be retrieved from symlinks.identifiers facet."
                )
        else:
            try:
                name = data["name"]
            except KeyError:
                raise ValueError(
                    "input table name cannot be retrieved from name attribute."
                )

        name_parts = name.split(".")

        if len(name_parts) < 2:
            raise ValueError(
                f"input table name should be of 'schema.table' format! Received: {name}"
            )

        # we take last two elements to explicitly collect schema and table names
        # in BigQuery Open Lineage events name_parts would be list of 3 elements as first one is GCP Project ID
        # however, concept of GCP Project ID is not represented in Open Metadata and hence - we need to skip this part
        # Normalize to lowercase for case-insensitive FQN matching: different connectors
        # may store names in different cases (e.g. Trino lowercases, Spark preserves original)
        return TableDetails(name=name_parts[-1].lower(), schema=name_parts[-2].lower())

    @staticmethod
    def _get_topic_details(data: Dict) -> TopicDetails:
        """
        Extract topic name and broker hostname from an OpenLineage event.

        :param data: single input/output entry from an OpenLineage event
        :return: TopicDetails with topic name and broker hostname
        :raises ValueError: if namespace or name is missing from the data
        """
        try:
            namespace = data["namespace"]
        except KeyError:
            raise ValueError("Topic namespace is not present")

        try:
            name = data["name"]
        except KeyError:
            raise ValueError("Topic name is not present")

        parsed = urlparse(namespace)
        broker_hostname = parsed.hostname
        if not broker_hostname:
            raise ValueError(
                f"Could not extract broker hostname from namespace: {namespace}"
            )

        if parsed.port:
            broker_hostname = f"{broker_hostname}:{parsed.port}"

        return TopicDetails(name=name, broker_hostname=broker_hostname)

    def _get_by_name_cached(self, entity_class, fqn_str: str, **kwargs):
        """Wrapper around metadata.get_by_name with in-memory caching."""
        if not hasattr(self, "_entity_cache"):
            return self.metadata.get_by_name(entity_class, fqn_str, **kwargs)
        key = f"{entity_class.__name__}:{fqn_str}"
        if key not in self._entity_cache:
            result = self.metadata.get_by_name(entity_class, fqn_str, **kwargs)
            if result is not None:
                self._entity_cache[key] = result
            return result
        return self._entity_cache[key]

    def _build_db_service_type_map(self):
        """Build a map of {service_name: DatabaseServiceType} filtered to configured dbServiceNames."""
        type_map = {}
        for service_name in self.get_db_service_names():
            try:
                resp = self.metadata.client.get(
                    f"/services/databaseServices/name/{quote(service_name, safe='')}"
                )
                svc_type_str = resp.get("serviceType")
                if svc_type_str:
                    type_map[service_name] = DatabaseServiceType(svc_type_str)
            except Exception:
                logger.debug(f"Could not fetch DB service: {service_name}")
        return type_map

    def _resolve_db_services_for_namespace(self, namespace: str) -> Optional[List[str]]:
        """
        Resolve which DB services to search for a given OL dataset namespace.

        Resolution order:
        1. Check namespaceToServiceMapping config (exact then prefix match).
        2. Extract scheme from namespace, filter services by matching DB type.
           If exactly one match -> use it. If multiple -> log warning and return all.
        3. Return None -> caller falls back to all dbServiceNames.
        """
        if not hasattr(self, "_namespace_to_service_cache"):
            return None

        if namespace in self._namespace_to_service_cache:
            return self._namespace_to_service_cache[namespace]

        result = None
        configured = set(self.get_db_service_names() or [])

        mapping = self.service_connection.namespaceToServiceMapping or {}
        mapped_service = find_service_by_namespace_mapping(namespace, mapping)
        if mapped_service and mapped_service in configured:
            result = [mapped_service]
        elif mapped_service:
            logger.warning(
                f"Namespace mapping resolved '{namespace}' to service "
                f"'{mapped_service}', but it is not in the configured "
                f"dbServiceNames. Falling back to scheme-based resolution."
            )
        if not result:
            # Auto-discover by extracting the DB scheme from the namespace URL
            db_scheme = extract_db_scheme_from_namespace(namespace)
            if db_scheme:
                matched = find_services_by_scheme(db_scheme, self._db_service_type_map)
                if matched:
                    result = matched

        if result is not None:
            self._namespace_to_service_cache[namespace] = result
        return result

    def _get_table_fqn(
        self, table_details: TableDetails, namespace: Optional[str] = None
    ) -> Optional[str]:
        if not self.get_db_service_names():
            if not self._db_service_names_warned:
                logger.warning(
                    "No Database Service Names configured in Lineage Information. "
                    "Skipping table/schema FQN resolution. Configure 'Database Service "
                    "Names' in the pipeline metadata ingestion to enable lineage."
                )
                self._db_service_names_warned = True
            return None

        try:
            resolved_services = self._resolve_db_services_for_namespace(namespace)

            try:
                return self._get_table_fqn_from_om(
                    table_details, services=resolved_services
                )
            except FQNNotFoundException:
                try:
                    schema_fqn = self._get_schema_fqn_from_om(
                        table_details.schema, services=resolved_services
                    )
                    return f"{schema_fqn}.{table_details.name}"
                except FQNNotFoundException:
                    return None
        except Exception:
            logger.warning(
                f"Failed to get FQN for table {table_details.name}: {traceback.format_exc()}"
            )
            return None

    def _get_table_fqn_from_om(
        self, table_details: TableDetails, services: Optional[List[str]] = None
    ) -> str:
        """
        Looks for matching Table entity in OM across all configured DB services.
        Raises AmbiguousServiceException if the table exists in multiple services
        of the same scheme-resolved type.
        """
        resolved = services is not None
        found = []
        for db_service in services or self.get_db_service_names():
            result = fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                service_name=db_service,
                database_name=table_details.database,
                schema_name=table_details.schema,
                table_name=table_details.name,
            )
            if result:
                if not resolved:
                    return result
                found.append(result)
                if len(found) > 1:
                    raise AmbiguousServiceException(
                        f"Table '{table_details.name}' found in multiple services: "
                        f"{found}. Configure 'namespaceToServiceMapping' to disambiguate."
                    )
        if found:
            return found[0]
        raise FQNNotFoundException(f"Table FQN not found for {table_details}")

    def _build_broker_to_service_map(self) -> Dict[str, str]:
        """
        Build a cache mapping broker hostnames to messaging service FQNs.
        Reads each messaging service's connection config to extract bootstrapServers.

        :return: dictionary with key=broker_hostname and value=service FQN
        """
        if not hasattr(self, "_broker_to_service"):
            self._broker_to_service = {}
            try:
                services = self.metadata.list_all_entities(
                    entity=MessagingService,
                    fields=["connection"],
                )

                for svc in services:
                    try:
                        bootstrap_servers = svc.connection.config.bootstrapServers or ""
                        svc_fqn = svc.fullyQualifiedName.root
                        for broker in bootstrap_servers.split(","):
                            broker = broker.strip()
                            if broker:
                                self._broker_to_service[broker] = svc_fqn
                    except Exception:
                        logger.debug(
                            f"Could not extract bootstrapServers from service {svc.name}"
                        )

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error building broker-to-service map: {exc}")

        return self._broker_to_service

    def _find_service_fqn_by_broker(self, broker_hostname: str) -> Optional[str]:
        """
        Find the messaging service FQN whose bootstrapServers contains the given broker hostname.

        :param broker_hostname: hostname extracted from OpenLineage kafka:// namespace
        :return: fully qualified name of the matching MessagingService, or None
        """
        broker_map = self._build_broker_to_service_map()
        return broker_map.get(broker_hostname)

    def _get_topic_entity(self, topic_details: TopicDetails) -> Optional[Topic]:
        """
        Look up a Topic entity by finding the messaging service from the broker hostname,
        then constructing the topic FQN as {service_fqn}.{topic_name}.

        :param topic_details: TopicDetails with name and broker_hostname
        :return: Topic entity from OpenMetadata, or None
        """
        try:
            service_fqn = self._find_service_fqn_by_broker(
                topic_details.broker_hostname
            )
            if not service_fqn:
                logger.warning(
                    f"No messaging service found for broker: {topic_details.broker_hostname}"
                )
                return None

            topic_fqn = f"{service_fqn}.{fqn.quote_name(topic_details.name)}"
            topic = self.metadata.get_by_name(Topic, topic_fqn)

            if not topic:
                logger.warning(f"Topic not found in OpenMetadata: {topic_fqn}")

            return topic

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error finding topic for {topic_details.name}: {exc}")
            return None

    def _get_schema_fqn_from_om(
        self, schema: str, services: Optional[List[str]] = None
    ) -> Optional[str]:
        """
        Based on partial schema name look for any matching DatabaseSchema object in open metadata.

        :param schema: schema name
        :param services: optional list of service names to search
        :return: fully qualified name of a DatabaseSchema in Open Metadata
        """
        result = None
        services = services or self.get_db_service_names()

        for db_service in services:
            result = fqn.build(
                metadata=self.metadata,
                entity_type=DatabaseSchema,
                service_name=db_service,
                database_name=None,
                schema_name=schema,
                skip_es_search=False,
            )

            if result:
                return result

        if not result:
            raise FQNNotFoundException(
                f"Schema FQN not found within services: {services}"
            )

        return result

    @classmethod
    def _render_pipeline_name(cls, pipeline_details: OpenLineageEvent) -> str:
        """
        Construct a pipeline name from an OpenLineage event. If the event's run facet
        contains a parent job reference, the pipeline name is derived from the parent's
        namespace and name. Otherwise, it falls back to the top-level job's namespace and name.

        :param run_facet: Open Lineage run facet
        :return: pipeline name (not fully qualified name)
        """
        run_facet = pipeline_details.run_facet

        try:
            namespace = run_facet["facets"]["parent"]["job"]["namespace"]
            name = run_facet["facets"]["parent"]["job"]["name"]
        except (KeyError, TypeError):
            namespace = pipeline_details.job["namespace"]
            name = pipeline_details.job["name"]

        return f"{namespace}-{name}"

    @classmethod
    def _filter_event_by_types(
        cls, event: OpenLineageEvent, event_types: List[EventType]
    ) -> Optional[Dict]:
        """
        returns event if it's of one of the particular event_types.
        for example - for lineage events we will be only looking for EventType.COMPLETE event type.

        :param event: Open Lineage raw event.
        :param event_types: list of event types we are looking for.
        :return: Open Lineage event if matches one of the event_types, otherwise None
        """
        return event if event.event_type in event_types else {}

    @classmethod
    def _get_om_table_columns(cls, table_input: Dict) -> Optional[List]:
        """

        :param table_input:
        :return:
        """
        try:
            fields = table_input["facets"]["schema"]["fields"]

            columns = [
                Column(
                    name=f.get("name"),
                    dataTypeDisplay=f.get("type").upper(),
                    dataType=ColumnTypeParser.get_column_type(f.get("type").upper()),
                )
                for f in fields
            ]
            return columns
        except KeyError:
            return None

    def get_create_table_request(self, table: Dict) -> Optional[Either]:
        """
        If certain table from Open Lineage events doesn't already exist in Open Metadata, register appropriate entity.
        This makes sense especially for output facet of OpenLineage event - as database service ingestion is a scheduled
        process we might fall into situation where we received Open Lineage event about creation of a table that is yet
        to be ingested by database service ingestion process. To avoid missing on such lineage scenarios, we will create
        table entity beforehand.

        :param table: single object from inputs/outputs facet
        :return: request to create the entity (if needed)
        """
        if not self.get_db_service_names():
            return None

        om_table_fqn = None

        try:
            table_details = OpenlineageSource._get_table_details(table)
        except ValueError as e:
            return Either(
                left=StackTraceError(
                    name="",
                    error=f"Failed to get partial table name: {e}",
                    stackTrace=traceback.format_exc(),
                )
            )
        try:
            om_table_fqn = self._get_table_fqn_from_om(table_details)

            # if fqn found then it means table is already registered and we don't need to render create table request
            return None
        except FQNNotFoundException:
            pass

        # If OM Table FQN was not found based on OL Partial Name - we need to register it.
        if not om_table_fqn:
            try:
                om_schema_fqn = self._get_schema_fqn_from_om(table_details.schema)
            except FQNNotFoundException as e:
                return Either(
                    left=StackTraceError(
                        name="",
                        error=f"Failed to get fully qualified schema name: {e}",
                        stackTrace=traceback.format_exc(),
                    )
                )

            # After finding schema fqn (based on partial schema name) we know where we can create table
            # and we move forward with creating request.
            if om_schema_fqn:
                columns = OpenlineageSource._get_om_table_columns(table) or []

                request = CreateTableRequest(
                    name=table_details.name,
                    columns=columns,
                    databaseSchema=om_schema_fqn,
                )

                return Either(right=request)

        return None

    @classmethod
    def _get_ol_table_name(cls, table: Dict) -> str:
        return "/".join(table.get(f) for f in ["namespace", "name"]).replace("//", "/")

    def _build_ol_name_to_fqn_map(self, tables: List):
        result = {}

        for table in tables:
            entity_details = self._get_entity_details(table)
            if entity_details.entity_type != "table":
                continue
            table_fqn = self._get_table_fqn(
                entity_details.table_details,
                namespace=table.get("namespace"),
            )

            if table_fqn:
                result[OpenlineageSource._get_ol_table_name(table)] = table_fqn

        return result

    @classmethod
    def _create_output_lineage_dict(
        cls, lineage_info: List[Tuple[str, str, str, str]]
    ) -> Dict[str, Dict[str, List[ColumnLineage]]]:
        result = defaultdict(lambda: defaultdict(list))
        for (output_table, input_table, output_column), group in groupby(
            lineage_info, lambda x: x[:3]
        ):
            input_columns = [input_col for _, _, _, input_col in group]

            result[output_table][input_table] += [
                ColumnLineage(toColumn=output_column, fromColumns=input_columns)
            ]

        return result

    def _get_column_lineage(
        self, inputs: List, outputs: List
    ) -> Dict[str, Dict[str, List[ColumnLineage]]]:
        _result: List = []

        ol_name_to_fqn_map = self._build_ol_name_to_fqn_map(inputs + outputs)

        for table in outputs:
            entity_details = self._get_entity_details(table)
            # Column-level lineage is only supported for tables for now.
            if entity_details.entity_type != "table":
                continue

            output_table_fqn = self._get_table_fqn(
                entity_details.table_details,
                namespace=table.get("namespace"),
            )
            for field_name, field_spec in (
                table.get("facets", {})
                .get("columnLineage", {})
                .get("fields", {})
                .items()
            ):
                for input_field in field_spec.get("inputFields", []):
                    input_table_ol_name = OpenlineageSource._get_ol_table_name(
                        input_field
                    )

                    _result.append(  # output table, input table, output column, input column
                        (
                            output_table_fqn,
                            ol_name_to_fqn_map.get(input_table_ol_name),
                            f"{output_table_fqn}.{field_name.lower()}",
                            f'{ol_name_to_fqn_map.get(input_table_ol_name)}.{input_field.get("field", "").lower()}',
                        )
                    )

        return OpenlineageSource._create_output_lineage_dict(_result)

    def _resolve_pipeline_service(self, pipeline_details: OpenLineageEvent) -> str:
        """
        Resolve the pipeline service for the current event.

        Resolution order:
        1. **Namespace fallback** — try ``namespace.jobName`` as a pipeline
           FQN.  If a pipeline already exists (e.g. ingested by a native
           Airflow connector), reuse its service.
        2. **Integration type** — extract from
           ``job.facets.jobType.integration`` and create a typed service
           (e.g. ``spark_openlineage``).
        3. **Default** — fall back to the configured OpenLineage service.
        """
        fallback = self.context.get().pipeline_service

        ns_result = find_pipeline_by_namespace(self.metadata, pipeline_details)
        if ns_result:
            service_name, _ = ns_result
            return service_name

        integration = extract_integration_type(pipeline_details)
        service_name = build_service_name(integration, fallback)

        if service_name != fallback:
            service_type = resolve_pipeline_service_type(integration)
            get_or_create_pipeline_service(
                self.metadata, service_name, service_type, self._service_cache
            )

        return service_name

    def yield_pipeline(
        self, pipeline_details: OpenLineageEvent
    ) -> Iterable[Either[CreatePipelineRequest]]:
        pipeline_name = self.get_pipeline_name(pipeline_details)
        self._current_pipeline_service = self._resolve_pipeline_service(
            pipeline_details
        )
        try:
            description = f"""```json
            {json.dumps(pipeline_details.run_facet, indent=4).strip()}```"""
            request = CreatePipelineRequest(
                name=pipeline_name,
                service=self._current_pipeline_service,
                description=description,
                tasks=[],
            )

            yield Either(right=request)
            self.register_record(pipeline_request=request)
        except ValueError:
            yield Either(
                left=StackTraceError(
                    name=pipeline_name,
                    message="Failed to collect metadata required for pipeline creation.",
                ),
                stackTrace=traceback.format_exc(),
            )

    def _has_annotated_pipeline_edge(
        self,
        dataset_node: LineageNode,
        pipeline_entity: Pipeline,
        direction: str,
    ) -> bool:
        """
        Check if a dataset already has a proper both-sided lineage edge where the
        given pipeline is an annotation (in lineageDetails.pipeline), not a direct
        endpoint. This prevents creating redundant pipeline-as-node edges when a
        both-sided event was already processed.

        :param dataset_node: the dataset (table/topic) to check
        :param pipeline_entity: the pipeline to look for as an annotation
        :param direction: "upstream" or "downstream" — which edges of the dataset to check
        :return: True if an annotated edge already exists
        """
        entity_class = Table if dataset_node.node_type == "table" else Topic
        dataset_id = str(dataset_node.uuid)
        pipeline_id = str(pipeline_entity.id.root)
        try:
            lineage_data = self.metadata.get_lineage_by_id(
                entity=entity_class,
                entity_id=dataset_id,
                up_depth=1 if direction == "upstream" else 0,
                down_depth=1 if direction == "downstream" else 0,
            )
            if not lineage_data:
                return False

            edges_key = (
                "upstreamEdges" if direction == "upstream" else "downstreamEdges"
            )
            for edge_entry in lineage_data.get(edges_key, []):
                details = edge_entry.get("lineageDetails", {}) or {}
                pipeline_ref = details.get("pipeline")
                if pipeline_ref and str(pipeline_ref.get("id")) == pipeline_id:
                    return True
        except Exception:
            logger.debug(traceback.format_exc())
        return False

    def _cleanup_pipeline_as_node_edges(
        self,
        pipeline_entity: Pipeline,
        event_entity_map: Dict[str, str],
    ) -> None:
        """
        When a pipeline transitions from single-sided (pipeline-as-node) to both-sided
        lineage, remove stale edges where the pipeline is a direct from/to endpoint
        paired with a topic or table. Only targets OpenLineage-sourced edges whose
        other endpoint matches one of the datasets in the current event.

        :param pipeline_entity: the pipeline entity
        :param event_entity_map: mapping of entity ID -> entity type for datasets
            resolved from the current event's inputs and outputs
        """
        pipeline_id = str(pipeline_entity.id.root)
        try:
            lineage_data = self.metadata.get_lineage_by_id(
                entity=Pipeline,
                entity_id=pipeline_id,
                up_depth=1,
                down_depth=1,
            )
            if not lineage_data:
                return

            for direction, pipeline_field, dataset_field in [
                ("upstreamEdges", "toEntity", "fromEntity"),
                ("downstreamEdges", "fromEntity", "toEntity"),
            ]:
                for edge_entry in lineage_data.get(direction, []):
                    if str(edge_entry[pipeline_field]) != pipeline_id:
                        continue
                    details = edge_entry.get("lineageDetails", {}) or {}
                    if details.get("source") != Source.OpenLineage.value or details.get(
                        "pipeline"
                    ):
                        continue
                    dataset_id = str(edge_entry[dataset_field])
                    if dataset_id not in event_entity_map:
                        continue
                    from_ref, to_ref = (
                        (
                            EntityReference(
                                id=dataset_id, type=event_entity_map[dataset_id]
                            ),
                            EntityReference(id=pipeline_id, type="pipeline"),
                        )
                        if direction == "upstreamEdges"
                        else (
                            EntityReference(id=pipeline_id, type="pipeline"),
                            EntityReference(
                                id=dataset_id, type=event_entity_map[dataset_id]
                            ),
                        )
                    )
                    self.metadata.delete_lineage_edge(
                        EntitiesEdge(fromEntity=from_ref, toEntity=to_ref)
                    )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to cleanup pipeline-as-node edges for {pipeline_entity.fullyQualifiedName.root}: {exc}"
            )

    def yield_pipeline_lineage_details(
        self, pipeline_details: OpenLineageEvent
    ) -> Iterable[Either[AddLineageRequest]]:
        inputs, outputs = pipeline_details.inputs, pipeline_details.outputs

        input_edges: List[LineageNode] = []
        output_edges: List[LineageNode] = []

        for spec in [(inputs, input_edges), (outputs, output_edges)]:
            entities, entity_list = spec
            for entity_data in entities:
                entity_details = self._get_entity_details(entity_data)
                if entity_details.entity_type == "table":
                    create_table_request = self.get_create_table_request(entity_data)

                    if create_table_request:
                        yield create_table_request

                    table_fqn = self._get_table_fqn(
                        entity_details.table_details,
                        namespace=entity_data.get("namespace"),
                    )

                    if table_fqn:
                        table_entity = self._get_by_name_cached(Table, table_fqn)
                        if table_entity:
                            entity_list.append(
                                LineageNode(
                                    fqn=TableFQN(value=table_fqn),
                                    uuid=table_entity.id.root,
                                    node_type="table",
                                )
                            )
                        else:
                            logger.warning(f"Table entity not found for: {table_fqn}")
                            self.status.warning(
                                table_fqn, "Table entity not found in OpenMetadata"
                            )

                elif entity_details.entity_type == "topic":
                    topic_entity = self._get_topic_entity(entity_details.topic_details)

                    if topic_entity:
                        entity_list.append(
                            LineageNode(
                                fqn=TopicFQN(
                                    value=topic_entity.fullyQualifiedName.root
                                ),
                                uuid=topic_entity.id.root,
                                node_type="topic",
                            )
                        )
                    else:
                        logger.warning(
                            f"Topic entity not found for topic: {entity_details.topic_details.name} "
                            f"with broker: {entity_details.topic_details.broker_hostname}. "
                            f"Ensure the topic exists in OpenMetadata and the messaging service "
                            f"has matching bootstrapServers."
                        )
                        self.status.warning(
                            entity_details.topic_details.name,
                            "Topic entity not found in OpenMetadata",
                        )

        column_lineage = self._get_column_lineage(inputs, outputs)

        edges = [
            LineageEdge(from_node=n[0], to_node=n[1])
            for n in product(input_edges, output_edges)
        ]

        service_name = (
            self._current_pipeline_service or self.context.get().pipeline_service
        )
        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=service_name,
            pipeline_name=self.context.get().pipeline,
        )

        pipeline_entity = self.metadata.get_by_name(entity=Pipeline, fqn=pipeline_fqn)

        if not pipeline_entity:
            logger.warning(
                f"Pipeline entity not found for {pipeline_fqn}, skipping lineage"
            )
            return

        event_has_no_outputs = not outputs
        event_has_no_inputs = not inputs

        single_sided = None
        if event_has_no_outputs and input_edges:
            single_sided = (input_edges, "downstream", True)
        elif event_has_no_inputs and output_edges:
            single_sided = (output_edges, "upstream", False)

        if single_sided:
            dataset_nodes, direction, dataset_is_source = single_sided
            pipeline_node = LineageNode(
                fqn=PipelineFQN(value=pipeline_fqn),
                uuid=pipeline_entity.id.root,
                node_type="pipeline",
            )
            for dataset_node in dataset_nodes:
                if self._has_annotated_pipeline_edge(
                    dataset_node, pipeline_entity, direction=direction
                ):
                    from_fqn, to_fqn = (
                        (dataset_node.fqn.value, pipeline_fqn)
                        if dataset_is_source
                        else (pipeline_fqn, dataset_node.fqn.value)
                    )
                    logger.info(
                        f"Skipping pipeline-as-node edge {from_fqn} -> {to_fqn}: "
                        f"annotated edge already exists with this pipeline on {dataset_node.fqn.value}"
                    )
                    self.status.filter(
                        dataset_node.fqn.value,
                        f"Pipeline-as-node edge skipped: annotated edge with {pipeline_fqn} already exists",
                    )
                else:
                    edge = (
                        LineageEdge(from_node=dataset_node, to_node=pipeline_node)
                        if dataset_is_source
                        else LineageEdge(from_node=pipeline_node, to_node=dataset_node)
                    )
                    edges.append(edge)

        if inputs and outputs and input_edges and output_edges:
            event_entity_map = {
                str(node.uuid): node.node_type for node in input_edges + output_edges
            }
            self._cleanup_pipeline_as_node_edges(pipeline_entity, event_entity_map)

        for edge in edges:
            is_pipeline_endpoint = (
                edge.from_node.node_type == "pipeline"
                or edge.to_node.node_type == "pipeline"
            )
            yield Either(
                right=AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(
                            id=edge.from_node.uuid, type=edge.from_node.node_type
                        ),
                        toEntity=EntityReference(
                            id=edge.to_node.uuid, type=edge.to_node.node_type
                        ),
                        lineageDetails=LineageDetails(
                            pipeline=(
                                None
                                if is_pipeline_endpoint
                                else EntityReference(
                                    id=pipeline_entity.id.root,
                                    type="pipeline",
                                )
                            ),
                            description=f"Lineage extracted from OpenLineage job: {pipeline_details.job['name']}",
                            source=Source.OpenLineage,
                            columnsLineage=column_lineage.get(
                                edge.to_node.fqn.value, {}
                            ).get(edge.from_node.fqn.value, []),
                        ),
                    ),
                )
            )

    def get_pipelines_list(self) -> Optional[List[Any]]:
        """Get List of all pipelines"""
        broker = self.service_connection.brokerConfig

        if isinstance(broker, KafkaBrokerConfig):
            yield from self._poll_kafka(broker)
        elif isinstance(broker, KinesisBrokerConfig):
            yield from self._poll_kinesis(broker)
        else:
            raise InvalidSourceException(
                f"Unsupported broker config type: {type(broker)}"
            )

    def _poll_kafka(self, broker: KafkaBrokerConfig) -> Iterable[OpenLineageEvent]:
        """Poll events from Kafka topic."""
        try:
            consumer = self.client
            session_active = True
            empty_msg_cnt = 0
            pool_timeout = broker.poolTimeout
            while session_active:
                message = consumer.poll(timeout=pool_timeout)
                if message is None:
                    logger.debug("no new messages")
                    empty_msg_cnt += 1
                    if empty_msg_cnt * pool_timeout > broker.sessionTimeout:
                        session_active = False
                elif message.error():
                    logger.warning(f"Kafka consumer error: {message.error()}")
                    empty_msg_cnt += 1
                    if (
                        empty_msg_cnt * pool_timeout
                        > self.service_connection.sessionTimeout
                    ):
                        session_active = False
                else:
                    logger.debug(f"new message {message.value()}")
                    empty_msg_cnt = 0
                    try:
                        _result = message_to_open_lineage_event(
                            json.loads(message.value())
                        )
                        result = self._filter_event_by_types(
                            _result,
                            [EventType.COMPLETE, EventType.RUNNING, EventType.START],
                        )
                        if result:
                            yield result
                    except Exception as e:
                        logger.debug(e)

        except Exception as e:
            traceback.print_exc()
            raise InvalidSourceException(f"Failed to read from Kafka: {str(e)}")

        finally:
            # Close down consumer to commit final offsets.
            # @todo address this
            consumer.close()

    def _poll_kinesis(self, broker: KinesisBrokerConfig) -> Iterable[OpenLineageEvent]:
        """Poll events from Kinesis Data Stream."""
        try:
            kinesis_client = self.client
            shards = []
            paginator = kinesis_client.get_paginator("list_shards")
            for page in paginator.paginate(StreamName=broker.streamName):
                shards.extend(page.get("Shards", []))

            iterator_type = broker.consumerOffsets.value
            pool_timeout = broker.poolTimeout
            session_timeout = broker.sessionTimeout
            empty_response_time = 0.0

            for shard in shards:
                shard_id = shard["ShardId"]
                iterator_resp = kinesis_client.get_shard_iterator(
                    StreamName=broker.streamName,
                    ShardId=shard_id,
                    ShardIteratorType=iterator_type,
                )
                shard_iterator = iterator_resp["ShardIterator"]

                while shard_iterator and empty_response_time <= session_timeout:
                    response = kinesis_client.get_records(
                        ShardIterator=shard_iterator,
                        Limit=100,
                    )
                    records = response.get("Records", [])
                    shard_iterator = response.get("NextShardIterator")

                    if not records:
                        empty_response_time += pool_timeout
                        time.sleep(pool_timeout)
                        continue

                    empty_response_time = 0.0
                    for record in records:
                        try:
                            data = json.loads(record["Data"])
                            _result = message_to_open_lineage_event(data)
                            result = self._filter_event_by_types(
                                _result,
                                [
                                    EventType.COMPLETE,
                                    EventType.RUNNING,
                                    EventType.START,
                                ],
                            )
                            if result:
                                yield result
                        except Exception as e:
                            logger.debug(e)

                    time.sleep(pool_timeout)

        except Exception as e:
            traceback.print_exc()
            raise InvalidSourceException(f"Failed to read from Kinesis: {str(e)}")

    def get_pipeline_name(self, pipeline_details: OpenLineageEvent) -> str:
        return OpenlineageSource._render_pipeline_name(pipeline_details)

    def yield_pipeline_status(
        self, pipeline_details: OpenLineageEvent
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        pass

    def mark_pipelines_as_deleted(self):
        """
        OpenLineage pipelines are coming from streaming data and hence subsequent executions of ingestion processes
        can cause deletion of a pipeline. Because of this we turn off pipeline deletion by overwriting this method
        and leaving it blank. Setting 'Mark Deleted Pipelines' in ingestion process will have no effect!
        """
