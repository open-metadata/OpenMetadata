#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Elasticsearch sink, sending metadata from OM to create and populate
the indexes used in OM.

We disable unexpected-keyword-arg as we get a false positive for request_timeout in put_mappings
"""

import json
import ssl
import traceback
from functools import singledispatch
from typing import Any, Dict, List, Optional

import boto3
from elasticsearch import Elasticsearch, RequestsHttpConnection
from elasticsearch.connection import create_ssl_context
from requests_aws4auth import AWS4Auth

from metadata.config.common import ConfigModel
from metadata.data_insight.helper.data_insight_es_index import DataInsightEsIndex
from metadata.generated.schema.analytics.reportData import ReportData
from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.sink import Sink
from metadata.ingestion.models.es_documents import (
    ContainerESDocument,
    DashboardESDocument,
    GlossaryTermESDocument,
    MlModelESDocument,
    PipelineESDocument,
    QueryESDocument,
    TableESDocument,
    TagESDocument,
    TeamESDocument,
    TopicESDocument,
    UserESDocument,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.sink.elasticsearch_mapping.container_search_index_mapping import (
    CONTAINER_ELASTICSEARCH_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.dashboard_search_index_mapping import (
    DASHBOARD_ELASTICSEARCH_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.entity_report_data_index_mapping import (
    ENTITY_REPORT_DATA_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.glossary_term_search_index_mapping import (
    GLOSSARY_TERM_ELASTICSEARCH_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.mlmodel_search_index_mapping import (
    MLMODEL_ELASTICSEARCH_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.pipeline_search_index_mapping import (
    PIPELINE_ELASTICSEARCH_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.query_search_index_mapping import (
    QUERY_ELASTICSEARCH_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.table_search_index_mapping import (
    TABLE_ELASTICSEARCH_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.tag_search_index_mapping import (
    TAG_ELASTICSEARCH_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.team_search_index_mapping import (
    TEAM_ELASTICSEARCH_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.topic_search_index_mapping import (
    TOPIC_ELASTICSEARCH_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.user_search_index_mapping import (
    USER_ELASTICSEARCH_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.web_analytic_entity_view_report_data_index_mapping import (
    WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX_MAPPING,
)
from metadata.ingestion.sink.elasticsearch_mapping.web_analytic_user_activity_report_data_index_mapping import (
    WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX_MAPPING,
)
from metadata.utils.elasticsearch import ES_INDEX_MAP
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ElasticSearchConfig(ConfigModel):
    """
    Representation of the Elasticsearch connection
    to be used as a Sink.
    """

    es_host: str
    es_port: int = 9200
    es_username: Optional[str] = None
    es_password: Optional[str] = None
    index_tables: Optional[bool] = True
    index_topics: Optional[bool] = True
    index_dashboards: Optional[bool] = True
    index_pipelines: Optional[bool] = True
    index_users: Optional[bool] = True
    index_teams: Optional[bool] = True
    index_mlmodels: Optional[bool] = True
    index_glossary_terms: Optional[bool] = True
    index_tags: Optional[bool] = True
    index_containers: Optional[bool] = True
    index_queries: Optional[bool] = True
    index_entity_report_data: Optional[bool] = True
    index_web_analytic_user_activity_report_data: Optional[bool] = True
    index_web_analytic_entity_view_report_data: Optional[bool] = True

    scheme: str = "http"
    use_ssl: bool = False
    verify_certs: bool = False
    timeout: int = 30
    ca_certs: Optional[str] = None
    recreate_indexes: Optional[bool] = False
    use_AWS_credentials: Optional[bool] = False
    region_name: Optional[str] = None


class ElasticsearchSink(Sink[Entity]):
    """
    Class containing the logic to transform OM Entities
    into ES indexes and data. To be used as a Workflow Sink
    """

    DEFAULT_ELASTICSEARCH_INDEX_MAPPING = TABLE_ELASTICSEARCH_INDEX_MAPPING

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = ElasticSearchConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    # to be fix in https://github.com/open-metadata/OpenMetadata/issues/8352
    # pylint: disable=too-many-branches
    def __init__(
        self,
        config: ElasticSearchConfig,
        metadata_config: OpenMetadataConnection,
    ) -> None:
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(self.metadata_config)
        self.elasticsearch_doc_type = "_doc"
        http_auth = None
        if self.config.es_username:
            http_auth = (self.config.es_username, self.config.es_password)

        ssl_context = None
        if self.config.scheme == "https" and not self.config.verify_certs:
            ssl_context = create_ssl_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        self.elasticsearch_client = Elasticsearch(
            [
                {"host": self.config.es_host, "port": self.config.es_port},
            ],
            http_auth=http_auth,
            scheme=self.config.scheme,
            use_ssl=self.config.use_ssl,
            verify_certs=self.config.verify_certs,
            ssl_context=ssl_context,
            ca_certs=self.config.ca_certs,
        )
        if self.config.use_AWS_credentials:
            credentials = boto3.Session().get_credentials()
            # We are initializing the Session() here and letting it pick up host creds.
            region_from_boto3 = boto3.Session().region_name
            http_auth = AWS4Auth(
                region=self.config.region_name
                if self.config.region_name
                else region_from_boto3,
                service="es",
                refreshable_credentials=credentials,
            )
            self.elasticsearch_client.http_auth = http_auth
            self.elasticsearch_client.connection_class = RequestsHttpConnection

        # We'll be able to clean all this up after https://github.com/open-metadata/OpenMetadata/issues/9185
        if self.config.index_tables:
            self._check_or_create_index(
                ES_INDEX_MAP[Table.__name__], TABLE_ELASTICSEARCH_INDEX_MAPPING
            )

        if self.config.index_topics:
            self._check_or_create_index(
                ES_INDEX_MAP[Topic.__name__], TOPIC_ELASTICSEARCH_INDEX_MAPPING
            )
        if self.config.index_dashboards:
            self._check_or_create_index(
                ES_INDEX_MAP[Dashboard.__name__], DASHBOARD_ELASTICSEARCH_INDEX_MAPPING
            )
        if self.config.index_pipelines:
            self._check_or_create_index(
                ES_INDEX_MAP[Pipeline.__name__], PIPELINE_ELASTICSEARCH_INDEX_MAPPING
            )

        if self.config.index_users:
            self._check_or_create_index(
                ES_INDEX_MAP[User.__name__], USER_ELASTICSEARCH_INDEX_MAPPING
            )

        if self.config.index_teams:
            self._check_or_create_index(
                ES_INDEX_MAP[Team.__name__], TEAM_ELASTICSEARCH_INDEX_MAPPING
            )

        if self.config.index_glossary_terms:
            self._check_or_create_index(
                ES_INDEX_MAP[GlossaryTerm.__name__],
                GLOSSARY_TERM_ELASTICSEARCH_INDEX_MAPPING,
            )

        if self.config.index_mlmodels:
            self._check_or_create_index(
                ES_INDEX_MAP[MlModel.__name__],
                MLMODEL_ELASTICSEARCH_INDEX_MAPPING,
            )

        if self.config.index_tags:
            self._check_or_create_index(
                ES_INDEX_MAP[Tag.__name__],
                TAG_ELASTICSEARCH_INDEX_MAPPING,
            )

        if self.config.index_entity_report_data:
            self._check_or_create_index(
                ES_INDEX_MAP[ReportData.__name__],
                ENTITY_REPORT_DATA_INDEX_MAPPING,
            )

        if self.config.index_web_analytic_user_activity_report_data:
            self._check_or_create_index(
                ES_INDEX_MAP["web_analytic_user_activity_report"],
                WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX_MAPPING,
            )

        if self.config.index_web_analytic_entity_view_report_data:
            self._check_or_create_index(
                ES_INDEX_MAP["web_analytic_entity_view_report"],
                WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX_MAPPING,
            )

        if self.config.index_containers:
            self._check_or_create_index(
                ES_INDEX_MAP[Container.__name__],
                CONTAINER_ELASTICSEARCH_INDEX_MAPPING,
            )

        if self.config.index_queries:
            self._check_or_create_index(
                ES_INDEX_MAP[Query.__name__],
                QUERY_ELASTICSEARCH_INDEX_MAPPING,
            )

        # Prepare write record dispatching
        self._write_record = singledispatch(self._write_record)
        self._write_record.register(Classification, self._write_classification)
        self._write_record.register(ReportData, self._write_report_data)
        self._write_record.register(Policy, self._write_policy)

        super().__init__()

    def _check_or_create_index(self, index_name: str, es_mapping: str):
        """
        Retrieve all indices that currently have {elasticsearch_alias} alias
        :return: list of elasticsearch_mapping indices
        """
        if (
            self.elasticsearch_client.indices.exists(index_name)
            and not self.config.recreate_indexes
        ):
            mapping = self.elasticsearch_client.indices.get_mapping()
            if not mapping[index_name]["mappings"]:
                logger.debug(
                    f"There are no mappings for index {index_name}. Updating the mapping"
                )
                es_mapping_dict = json.loads(es_mapping)
                es_mapping_update_dict = {
                    "properties": es_mapping_dict["mappings"]["properties"]
                }
                self.elasticsearch_client.indices.put_mapping(
                    index=index_name,
                    body=json.dumps(es_mapping_update_dict),
                    request_timeout=self.config.timeout,
                )
        else:
            # Show different logs if we are recreating indexes, or we have a possibly unexpected index miss
            if self.config.recreate_indexes:
                logger.info(f"Recreating Elasticsearch index {index_name}...")
            else:
                logger.warning(
                    f"Received index {index_name} not found error from Elasticsearch. "
                    + "The index doesn't exist for a newly created ES. It's OK on first run."
                )
            # create new index with mapping
            if self.elasticsearch_client.indices.exists(index=index_name):
                self.elasticsearch_client.indices.delete(
                    index=index_name, request_timeout=self.config.timeout
                )
            self.elasticsearch_client.indices.create(
                index=index_name, body=es_mapping, request_timeout=self.config.timeout
            )

    def write_record(self, record: Entity) -> None:
        """
        Default implementation for the single dispatch
        """

        try:
            self._write_record(record)
            self.status.records_written(record.name.__root__)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to index due to {exc} - Entity: {record}")

    def _write_record(self, record: Entity) -> None:
        """
        Default implementation for the single dispatch
        """
        es_record = create_record_document(record, self.metadata)
        self.elasticsearch_client.index(
            index=ES_INDEX_MAP[type(record).__name__],
            id=str(es_record.id),
            body=es_record.json(),
            request_timeout=self.config.timeout,
        )
        self.status.records_written(es_record.name)

    def _write_report_data(self, record: ReportData) -> None:
        self.elasticsearch_client.index(
            index=DataInsightEsIndex[record.data.__class__.__name__].value,
            id=record.id,
            body=record.json(),
            request_timeout=self.config.timeout,
        )

    def _write_classification(self, record: Classification) -> None:
        es_record = create_record_document(record, self.metadata)
        for es_record_elem in es_record:
            self.elasticsearch_client.index(
                index=ES_INDEX_MAP[Tag.__name__],
                id=str(es_record_elem.id),
                body=es_record_elem.json(),
                request_timeout=self.config.timeout,
            )
            self.status.records_written(es_record_elem.name)

    @staticmethod
    def _write_policy(_: Policy) -> None:
        logger.debug("Policies are not indexed")

    def read_records(self, index: str, query: dict):
        """Read records from es index

        Args:
            index: elasticsearch index
            query: query to be passed to the request body
        """
        return self.elasticsearch_client.search(
            index=index,
            body=query,
        )

    def bulk_operation(
        self,
        body: List[dict],
    ):
        """Perform bulk operations.

        Args:
            body: https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html
        """
        return self.elasticsearch_client.bulk(body=body)

    def close(self):
        self.elasticsearch_client.close()


# Document creation functions by Entity


def _parse_columns(
    columns: List[Column],
    parent_column: Optional[str],
    column_names: List[str],
    column_descriptions: List[str],
    tags: List[str],
):
    """
    Handle column names, descriptions and tags and recursively
    add the information for its children.
    """
    for column in columns:
        col_name = (
            parent_column + "." + column.name.__root__
            if parent_column
            else column.name.__root__
        )
        column_names.append(col_name)
        if column.description:
            column_descriptions.append(column.description.__root__)
        if len(column.tags) > 0:
            for col_tag in column.tags:
                tags.append(col_tag)
        if column.children:
            _parse_columns(
                column.children,
                column.name.__root__,
                column_names,
                column_descriptions,
                tags,
            )


def get_es_tag_list_and_tier(record: Entity) -> (List[dict], Optional[str]):
    """
    Build ES tag list from any Entity
    """
    tags = []
    tier = None

    for tag in record.tags or []:
        if "Tier" in tag.tagFQN.__root__:
            tier = tag
        else:
            tags.append(tag)

    return tags, tier


def get_es_followers(record: Entity) -> List[str]:
    """
    Build the ES follower list
    """
    if record.followers:

        return [
            follower.id.__root__
            for follower in record.followers.__root__
            if record.followers
        ]

    return []


def get_es_display_name(record: Entity) -> str:
    """
    Build the display name for ES
    """
    return record.displayName if record.displayName else record.name.__root__


def get_es_fqn_suggest(record: Entity) -> List[Dict[str, Any]]:
    """
    Build the ES suggest field
    """

    return _get_es_suggest(
        input_5=record.fullyQualifiedName.__root__, input_10=record.name
    )


def get_es_display_name_suggest(record: Entity) -> List[Dict[str, Any]]:
    """
    Build the ES suggest field
    """

    return _get_es_suggest(input_5=get_es_display_name(record), input_10=record.name)


def _get_es_suggest(input_5: str, input_10: str) -> List[Dict[str, Any]]:
    """
    Build the ES suggest field
    """

    return [
        {"input": [input_5], "weight": 5},
        {"input": [input_10], "weight": 10},
    ]


@singledispatch
def create_record_document(record: Entity, _: OpenMetadata) -> Any:
    """
    Entrypoint to create documents from records
    and get them ready to send to ES
    """
    raise NotImplementedError(f"Record of type {type(record)} not implemented.")


@create_record_document.register
def _(record: Table, metadata: OpenMetadata) -> TableESDocument:

    tags, tier = get_es_tag_list_and_tier(record)
    suggest = get_es_fqn_suggest(record)
    display_name = get_es_display_name(record)
    followers = get_es_followers(record)

    column_names = []
    column_descriptions = []

    _parse_columns(
        columns=record.columns,
        parent_column=None,
        column_names=column_names,
        column_descriptions=column_descriptions,
        tags=tags,
    )

    database_entity = metadata.get_by_id(
        entity=Database, entity_id=str(record.database.id.__root__)
    )
    database_schema_entity = metadata.get_by_id(
        entity=DatabaseSchema, entity_id=str(record.databaseSchema.id.__root__)
    )

    return TableESDocument(
        id=str(record.id.__root__),
        name=record.name.__root__,
        displayName=display_name,
        fullyQualifiedName=record.fullyQualifiedName.__root__,
        version=record.version.__root__,
        updatedAt=record.updatedAt.__root__,
        updatedBy=record.updatedBy,
        href=record.href.__root__,
        columns=record.columns,
        databaseSchema=record.databaseSchema,
        database=record.database,
        service=record.service,
        owner=record.owner,
        location=record.location,
        usageSummary=record.usageSummary,
        deleted=record.deleted,
        serviceType=str(record.serviceType.name),
        suggest=suggest,
        service_suggest=[{"input": [record.service.name], "weight": 5}],
        database_suggest=[{"input": [database_entity.name.__root__], "weight": 5}],
        schema_suggest=[
            {
                "input": [database_schema_entity.name.__root__],
                "weight": 5,
            }
        ],
        column_suggest=[{"input": [column], "weight": 5} for column in column_names],
        description=record.description.__root__ if record.description else "",
        tier=tier,
        tags=tags,
        followers=followers,
    )


@create_record_document.register
def _(record: Topic, _: OpenMetadata) -> TopicESDocument:
    tags, tier = get_es_tag_list_and_tier(record)
    suggest = get_es_fqn_suggest(record)
    display_name = get_es_display_name(record)
    followers = get_es_followers(record)

    return TopicESDocument(
        id=str(record.id.__root__),
        name=record.name.__root__,
        displayName=display_name,
        description=record.description.__root__ if record.description else "",
        fullyQualifiedName=record.fullyQualifiedName.__root__,
        version=record.version.__root__,
        updatedAt=record.updatedAt.__root__,
        updatedBy=record.updatedBy,
        href=record.href.__root__,
        deleted=record.deleted,
        service=record.service,
        serviceType=str(record.serviceType.name),
        schemaText=record.messageSchema.schemaText if record.messageSchema else None,
        schemaType=record.messageSchema.schemaType if record.messageSchema else None,
        cleanupPolicies=[str(policy.name) for policy in record.cleanupPolicies],
        replicationFactor=record.replicationFactor,
        maximumMessageSize=record.maximumMessageSize,
        retentionSize=record.retentionSize,
        suggest=suggest,
        service_suggest=[{"input": [record.service.name], "weight": 5}],
        tier=tier,
        tags=tags,
        owner=record.owner,
        followers=followers,
    )


@create_record_document.register
def _(record: Dashboard, _: OpenMetadata) -> DashboardESDocument:

    tags, tier = get_es_tag_list_and_tier(record)
    suggest = get_es_fqn_suggest(record)
    display_name = get_es_display_name(record)
    followers = get_es_followers(record)

    chart_suggest = []
    for chart in record.charts.__root__:
        chart_display_name = chart.displayName if chart.displayName else chart.name
        chart_suggest.append({"input": [chart_display_name], "weight": 5})

    return DashboardESDocument(
        id=str(record.id.__root__),
        name=display_name,
        displayName=display_name,
        description=record.description.__root__ if record.description else "",
        fullyQualifiedName=record.fullyQualifiedName.__root__,
        version=record.version.__root__,
        updatedAt=record.updatedAt.__root__,
        updatedBy=record.updatedBy,
        dashboardUrl=record.dashboardUrl,
        charts=record.charts.__root__,
        href=record.href.__root__,
        deleted=record.deleted,
        service=record.service,
        serviceType=str(record.serviceType.name),
        usageSummary=record.usageSummary,
        tier=tier,
        tags=tags,
        owner=record.owner,
        followers=followers,
        suggest=suggest,
        chart_suggest=chart_suggest,
        service_suggest=[{"input": [record.service.name], "weight": 5}],
    )


@create_record_document.register
def _create_pipeline_es_doc(record: Pipeline, _: OpenMetadata) -> PipelineESDocument:

    tags, tier = get_es_tag_list_and_tier(record)
    suggest = get_es_fqn_suggest(record)
    display_name = get_es_display_name(record)
    followers = get_es_followers(record)

    task_suggest = []
    for task in record.tasks:
        task_suggest.append({"input": [task.displayName], "weight": 5})
        if tags in task and len(task.tags) > 0:
            tags.extend(task.tags)

    return PipelineESDocument(
        id=str(record.id.__root__),
        name=record.name.__root__,
        displayName=display_name,
        description=record.description.__root__ if record.description else "",
        fullyQualifiedName=record.fullyQualifiedName.__root__,
        version=record.version.__root__,
        updatedAt=record.updatedAt.__root__,
        updatedBy=record.updatedBy,
        pipelineUrl=record.pipelineUrl,
        tasks=record.tasks,
        href=record.href.__root__,
        deleted=record.deleted,
        service=record.service,
        serviceType=str(record.serviceType.name),
        suggest=suggest,
        task_suggest=task_suggest,
        service_suggest=[{"input": [record.service.name], "weight": 5}],
        tier=tier,
        tags=list(tags),
        owner=record.owner,
        followers=followers,
    )


@create_record_document.register
def _create_ml_model_es_doc(record: MlModel, _: OpenMetadata) -> MlModelESDocument:

    tags, tier = get_es_tag_list_and_tier(record)
    suggest = get_es_fqn_suggest(record)
    display_name = get_es_display_name(record)
    followers = get_es_followers(record)

    return MlModelESDocument(
        id=str(record.id.__root__),
        name=record.name.__root__,
        displayName=display_name,
        description=record.description.__root__ if record.description else "",
        fullyQualifiedName=record.fullyQualifiedName.__root__,
        version=record.version.__root__,
        updatedAt=record.updatedAt.__root__,
        updatedBy=record.updatedBy,
        href=record.href.__root__,
        deleted=record.deleted,
        algorithm=record.algorithm if record.algorithm else "",
        mlFeatures=record.mlFeatures,
        mlHyperParameters=record.mlHyperParameters,
        target=record.target.__root__ if record.target else "",
        dashboard=record.dashboard,
        mlStore=record.mlStore,
        server=record.server.__root__ if record.server else "",
        usageSummary=record.usageSummary,
        suggest=suggest,
        tier=tier,
        tags=tags,
        owner=record.owner,
        followers=followers,
        service=record.service,
    )


@create_record_document.register
def _create_container_es_doc(record: Container, _: OpenMetadata) -> ContainerESDocument:

    tags, tier = get_es_tag_list_and_tier(record)
    suggest = get_es_fqn_suggest(record)
    display_name = get_es_display_name(record)
    followers = get_es_followers(record)

    return ContainerESDocument(
        id=str(record.id.__root__),
        name=record.name.__root__,
        displayName=display_name,
        description=record.description.__root__ if record.description else "",
        fullyQualifiedName=record.fullyQualifiedName.__root__,
        version=record.version.__root__,
        updatedAt=record.updatedAt.__root__,
        updatedBy=record.updatedBy,
        href=record.href.__root__,
        deleted=record.deleted,
        suggest=suggest,
        tier=tier,
        tags=tags,
        owner=record.owner,
        followers=followers,
        service=record.service,
        parent=record.parent,
        dataModel=record.dataModel,
        children=record.children,
        prefix=record.prefix,
        numberOfObjects=record.numberOfObjects,
        size=record.size,
        fileFormats=[file_format.value for file_format in record.fileFormats or []],
    )


@create_record_document.register
def _create_query_es_doc(record: Query, _: OpenMetadata) -> QueryESDocument:

    tags, tier = get_es_tag_list_and_tier(record)
    suggest = get_es_fqn_suggest(record)
    display_name = get_es_display_name(record)
    followers = get_es_followers(record)

    return QueryESDocument(
        id=str(record.id.__root__),
        name=record.name.__root__,
        displayName=display_name,
        description=record.description.__root__ if record.description else "",
        fullyQualifiedName=record.fullyQualifiedName.__root__,
        version=record.version.__root__,
        updatedAt=record.updatedAt.__root__,
        updatedBy=record.updatedBy,
        href=record.href.__root__,
        deleted=record.deleted,
        suggest=suggest,
        tier=tier,
        tags=list(tags),
        owner=record.owner,
        followers=followers,
        duration=record.duration,
        users=record.users,
        votes=record.votes,
        query=record.query.__root__,
        queryDate=record.queryDate.__root__,
    )


@create_record_document.register
def _create_user_es_doc(record: User, _: OpenMetadata) -> UserESDocument:

    display_name = get_es_display_name(record)
    suggest = get_es_display_name_suggest(record)

    return UserESDocument(
        id=str(record.id.__root__),
        name=record.name.__root__,
        displayName=display_name,
        description=record.description.__root__ if record.description else "",
        fullyQualifiedName=record.fullyQualifiedName.__root__,
        version=record.version.__root__,
        updatedAt=record.updatedAt.__root__,
        updatedBy=record.updatedBy,
        href=record.href.__root__,
        deleted=record.deleted,
        email=record.email.__root__,
        isAdmin=record.isAdmin if record.isAdmin else False,
        teams=record.teams if record.teams else [],
        roles=record.roles if record.roles else [],
        inheritedRoles=record.inheritedRoles if record.inheritedRoles else [],
        suggest=suggest,
    )


@create_record_document.register
def _create_team_es_doc(record: Team, _: OpenMetadata) -> TeamESDocument:

    display_name = get_es_display_name(record)
    suggest = get_es_display_name_suggest(record)

    return TeamESDocument(
        id=str(record.id.__root__),
        name=record.name.__root__,
        displayName=display_name,
        description=record.description.__root__ if record.description else "",
        teamType=record.teamType.name,
        fullyQualifiedName=record.fullyQualifiedName.__root__,
        version=record.version.__root__,
        updatedAt=record.updatedAt.__root__,
        updatedBy=record.updatedBy,
        href=record.href.__root__,
        deleted=record.deleted,
        suggest=suggest,
        users=record.users if record.users else [],
        defaultRoles=record.defaultRoles if record.defaultRoles else [],
        parents=record.parents if record.parents else [],
        isJoinable=record.isJoinable,
    )


@create_record_document.register
def _create_glossary_term_es_doc(
    record: GlossaryTerm, _: OpenMetadata
) -> GlossaryTermESDocument:

    display_name = get_es_display_name(record)
    suggest = get_es_display_name_suggest(record)

    return GlossaryTermESDocument(
        id=str(record.id.__root__),
        name=str(record.name.__root__),
        displayName=display_name,
        description=record.description.__root__ if record.description else "",
        fullyQualifiedName=record.fullyQualifiedName.__root__,
        version=record.version.__root__,
        updatedAt=record.updatedAt.__root__,
        updatedBy=record.updatedBy,
        href=record.href.__root__,
        synonyms=[str(synonym.__root__) for synonym in record.synonyms],
        glossary=record.glossary,
        children=record.children if record.children else [],
        relatedTerms=record.relatedTerms if record.relatedTerms else [],
        reviewers=record.reviewers if record.reviewers else [],
        usageCount=record.usageCount,
        tags=record.tags if record.tags else [],
        status=record.status.name,
        suggest=suggest,
        deleted=record.deleted,
    )


@create_record_document.register
def _create_tag_es_doc(
    record: Classification, metadata: OpenMetadata
) -> List[TagESDocument]:

    tag_docs = []
    tag_list = metadata.list_entities(
        entity=Tag, params={"parent": record.name.__root__}
    )

    for tag in tag_list.entities or []:
        suggest = [
            {"input": [tag.name.__root__], "weight": 5},
            {"input": [tag.fullyQualifiedName], "weight": 10},
        ]

        tag_doc = TagESDocument(
            id=str(tag.id.__root__),
            name=str(tag.name.__root__),
            description=tag.description.__root__ if tag.description else "",
            suggest=suggest,
            fullyQualifiedName=tag.fullyQualifiedName,
            version=tag.version.__root__,
            updatedAt=tag.updatedAt.__root__,
            updatedBy=tag.updatedBy,
            href=tag.href.__root__,
            deleted=tag.deleted,
            deprecated=tag.deprecated,
        )
        tag_docs.append(tag_doc)

    return tag_docs
