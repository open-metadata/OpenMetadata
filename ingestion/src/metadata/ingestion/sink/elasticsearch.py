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
from typing import List, Optional

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
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.models.es_documents import (
    DashboardESDocument,
    ESEntityReference,
    GlossaryTermESDocument,
    MlModelESDocument,
    PipelineESDocument,
    TableESDocument,
    TagESDocument,
    TeamESDocument,
    TopicESDocument,
    UserESDocument,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
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
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_es_entity_ref(entity_ref: EntityReference) -> ESEntityReference:
    return ESEntityReference(
        id=str(entity_ref.id.__root__),
        name=entity_ref.name,
        displayName=entity_ref.displayName if entity_ref.displayName else "",
        description=entity_ref.description.__root__ if entity_ref.description else "",
        type=entity_ref.type,
        fullyQualifiedName=entity_ref.fullyQualifiedName,
        deleted=entity_ref.deleted,
        href=entity_ref.href.__root__,
    )


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
    index_entity_report_data: Optional[bool] = True
    index_web_analytic_user_activity_report_data: Optional[bool] = True
    index_web_analytic_entity_view_report_data: Optional[bool] = True
    table_index_name: str = "table_search_index"
    topic_index_name: str = "topic_search_index"
    dashboard_index_name: str = "dashboard_search_index"
    pipeline_index_name: str = "pipeline_search_index"
    user_index_name: str = "user_search_index"
    team_index_name: str = "team_search_index"
    glossary_term_index_name: str = "glossary_search_index"
    mlmodel_index_name: str = "mlmodel_search_index"
    tag_index_name: str = "tag_search_index"
    entity_report_data_index_name: str = "entity_report_data_index"
    web_analytic_user_activity_report_data_index_name: str = (
        "web_analytic_user_activity_report_data_index"
    )
    web_analytic_entity_view_report_data_name: str = (
        "web_analytic_entity_view_report_data_index"
    )
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
        self.config = config
        self.metadata_config = metadata_config

        self.status = SinkStatus()
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

        if self.config.index_tables:
            self._check_or_create_index(
                self.config.table_index_name, TABLE_ELASTICSEARCH_INDEX_MAPPING
            )

        if self.config.index_topics:
            self._check_or_create_index(
                self.config.topic_index_name, TOPIC_ELASTICSEARCH_INDEX_MAPPING
            )
        if self.config.index_dashboards:
            self._check_or_create_index(
                self.config.dashboard_index_name, DASHBOARD_ELASTICSEARCH_INDEX_MAPPING
            )
        if self.config.index_pipelines:
            self._check_or_create_index(
                self.config.pipeline_index_name, PIPELINE_ELASTICSEARCH_INDEX_MAPPING
            )

        if self.config.index_users:
            self._check_or_create_index(
                self.config.user_index_name, USER_ELASTICSEARCH_INDEX_MAPPING
            )

        if self.config.index_teams:
            self._check_or_create_index(
                self.config.team_index_name, TEAM_ELASTICSEARCH_INDEX_MAPPING
            )

        if self.config.index_glossary_terms:
            self._check_or_create_index(
                self.config.glossary_term_index_name,
                GLOSSARY_TERM_ELASTICSEARCH_INDEX_MAPPING,
            )

        if self.config.index_mlmodels:
            self._check_or_create_index(
                self.config.mlmodel_index_name,
                MLMODEL_ELASTICSEARCH_INDEX_MAPPING,
            )

        if self.config.index_tags:
            self._check_or_create_index(
                self.config.tag_index_name,
                TAG_ELASTICSEARCH_INDEX_MAPPING,
            )

        if self.config.index_entity_report_data:
            self._check_or_create_index(
                self.config.entity_report_data_index_name,
                ENTITY_REPORT_DATA_INDEX_MAPPING,
            )

        if self.config.index_web_analytic_user_activity_report_data:
            self._check_or_create_index(
                self.config.web_analytic_user_activity_report_data_index_name,
                WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX_MAPPING,
            )

        if self.config.index_web_analytic_entity_view_report_data:
            self._check_or_create_index(
                self.config.web_analytic_entity_view_report_data_name,
                WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX_MAPPING,
            )

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
        try:
            if isinstance(record, Table):
                table_doc = self._create_table_es_doc(record)
                self.elasticsearch_client.index(
                    index=self.config.table_index_name,
                    id=str(table_doc.id),
                    body=table_doc.json(),
                    request_timeout=self.config.timeout,
                )
            if isinstance(record, Topic):
                topic_doc = self._create_topic_es_doc(record)
                self.elasticsearch_client.index(
                    index=self.config.topic_index_name,
                    id=str(topic_doc.id),
                    body=topic_doc.json(),
                    request_timeout=self.config.timeout,
                )
            if isinstance(record, Dashboard):
                dashboard_doc = self._create_dashboard_es_doc(record)
                self.elasticsearch_client.index(
                    index=self.config.dashboard_index_name,
                    id=str(dashboard_doc.id),
                    body=dashboard_doc.json(),
                    request_timeout=self.config.timeout,
                )
            if isinstance(record, Pipeline):
                pipeline_doc = self._create_pipeline_es_doc(record)
                self.elasticsearch_client.index(
                    index=self.config.pipeline_index_name,
                    id=str(pipeline_doc.id),
                    body=pipeline_doc.json(),
                    request_timeout=self.config.timeout,
                )

            if isinstance(record, User):
                user_doc = self._create_user_es_doc(record)
                self.elasticsearch_client.index(
                    index=self.config.user_index_name,
                    id=str(user_doc.id),
                    body=user_doc.json(),
                    request_timeout=self.config.timeout,
                )

            if isinstance(record, Team):
                team_doc = self._create_team_es_doc(record)
                self.elasticsearch_client.index(
                    index=self.config.team_index_name,
                    id=str(team_doc.id),
                    body=team_doc.json(),
                    request_timeout=self.config.timeout,
                )

            if isinstance(record, GlossaryTerm):
                glossary_term_doc = self._create_glossary_term_es_doc(record)
                self.elasticsearch_client.index(
                    index=self.config.glossary_term_index_name,
                    id=str(glossary_term_doc.id),
                    body=glossary_term_doc.json(),
                    request_timeout=self.config.timeout,
                )

            if isinstance(record, MlModel):
                ml_model_doc = self._create_ml_model_es_doc(record)
                self.elasticsearch_client.index(
                    index=self.config.mlmodel_index_name,
                    id=str(ml_model_doc.id),
                    body=ml_model_doc.json(),
                    request_timeout=self.config.timeout,
                )

            if isinstance(record, Classification):
                tag_docs = self._create_tag_es_doc(record)
                for tag_doc in tag_docs:
                    self.elasticsearch_client.index(
                        index=self.config.tag_index_name,
                        id=str(tag_doc.id),
                        body=tag_doc.json(),
                        request_timeout=self.config.timeout,
                    )
                    self.status.records_written(tag_doc.name)

            if isinstance(record, ReportData):
                self.elasticsearch_client.index(
                    index=DataInsightEsIndex[record.data.__class__.__name__].value,
                    id=record.id,
                    body=record.json(),
                    request_timeout=self.config.timeout,
                )
                self.status.records_written(
                    f"Event written for record type {record.data.__class__.__name__}"
                )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to index entity {record}: {exc}")

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

    def _create_table_es_doc(self, table: Table):
        suggest = [
            {"input": [table.fullyQualifiedName.__root__], "weight": 5},
            {"input": [table.name], "weight": 10},
        ]
        tags = []
        tier = None
        column_names = []
        column_descriptions = []

        for table_tag in table.tags:
            if "Tier" in table_tag.tagFQN.__root__:
                tier = table_tag
            else:
                tags.append(table_tag)

        database_entity = self.metadata.get_by_id(
            entity=Database, entity_id=str(table.database.id.__root__)
        )
        database_schema_entity = self.metadata.get_by_id(
            entity=DatabaseSchema, entity_id=str(table.databaseSchema.id.__root__)
        )

        self._parse_columns(
            columns=table.columns,
            parent_column=None,
            column_names=column_names,
            column_descriptions=column_descriptions,
            tags=tags,
        )

        return TableESDocument(
            id=str(table.id.__root__),
            name=table.name.__root__,
            displayName=table.displayName if table.displayName else table.name.__root__,
            fullyQualifiedName=table.fullyQualifiedName.__root__,
            version=table.version.__root__,
            updatedAt=table.updatedAt.__root__,
            updatedBy=table.updatedBy,
            href=table.href.__root__,
            columns=table.columns,
            databaseSchema=table.databaseSchema,
            database=table.database,
            service=table.service,
            owner=table.owner,
            location=table.location,
            usageSummary=table.usageSummary,
            deleted=table.deleted,
            serviceType=str(table.serviceType.name),
            suggest=suggest,
            service_suggest=[{"input": [table.service.name], "weight": 5}],
            database_suggest=[{"input": [database_entity.name.__root__], "weight": 5}],
            schema_suggest=[
                {
                    "input": [database_schema_entity.name.__root__],
                    "weight": 5,
                }
            ],
            column_suggest=[
                {"input": [column], "weight": 5} for column in column_names
            ],
            description=table.description.__root__ if table.description else "",
            tier=tier,
            tags=list(tags),
            followers=[
                str(follower.id.__root__) for follower in table.followers.__root__
            ]
            if table.followers
            else [],
        )

    def _create_topic_es_doc(self, topic: Topic):
        service_suggest = []
        suggest = [
            {"input": [topic.name], "weight": 5},
            {"input": [topic.fullyQualifiedName.__root__], "weight": 10},
        ]
        tags = []
        topic_followers = []
        if topic.followers:
            for follower in topic.followers.__root__:
                topic_followers.append(str(follower.id.__root__))
        tier = None
        for topic_tag in topic.tags:
            if "Tier" in topic_tag.tagFQN.__root__:
                tier = topic_tag
            else:
                tags.append(topic_tag)
        service_suggest.append({"input": [topic.service.name], "weight": 5})
        topic_doc = TopicESDocument(
            id=str(topic.id.__root__),
            name=topic.name.__root__,
            displayName=topic.displayName if topic.displayName else topic.name.__root__,
            description=topic.description.__root__ if topic.description else "",
            fullyQualifiedName=topic.fullyQualifiedName.__root__,
            version=topic.version.__root__,
            updatedAt=topic.updatedAt.__root__,
            updatedBy=topic.updatedBy,
            href=topic.href.__root__,
            deleted=topic.deleted,
            service=topic.service,
            serviceType=str(topic.serviceType.name),
            schemaText=topic.messageSchema.schemaText if topic.messageSchema else None,
            schemaType=topic.messageSchema.schemaType if topic.messageSchema else None,
            cleanupPolicies=[str(policy.name) for policy in topic.cleanupPolicies],
            replicationFactor=topic.replicationFactor,
            maximumMessageSize=topic.maximumMessageSize,
            retentionSize=topic.retentionSize,
            suggest=suggest,
            service_suggest=service_suggest,
            tier=tier,
            tags=list(tags),
            owner=topic.owner,
            followers=topic_followers,
        )
        return topic_doc

    def _create_dashboard_es_doc(self, dashboard: Dashboard):
        display_name = (
            dashboard.displayName if dashboard.displayName else dashboard.name.__root__
        )
        suggest = [
            {"input": [dashboard.fullyQualifiedName.__root__], "weight": 10},
            {"input": [display_name], "weight": 5},
        ]
        service_suggest = []
        chart_suggest = []
        tags = []
        dashboard_followers = []
        if dashboard.followers:
            for follower in dashboard.followers.__root__:
                dashboard_followers.append(str(follower.id.__root__))
        tier = None
        for dashboard_tag in dashboard.tags:
            if "Tier" in dashboard_tag.tagFQN.__root__:
                tier = dashboard_tag
            else:
                tags.append(dashboard_tag)

        for chart in dashboard.charts:
            chart_display_name = chart.displayName if chart.displayName else chart.name
            chart_suggest.append({"input": [chart_display_name], "weight": 5})

        service_suggest.append({"input": [dashboard.service.name], "weight": 5})

        dashboard_doc = DashboardESDocument(
            id=str(dashboard.id.__root__),
            name=display_name,
            displayName=display_name,
            description=dashboard.description.__root__ if dashboard.description else "",
            fullyQualifiedName=dashboard.fullyQualifiedName.__root__,
            version=dashboard.version.__root__,
            updatedAt=dashboard.updatedAt.__root__,
            updatedBy=dashboard.updatedBy,
            dashboardUrl=dashboard.dashboardUrl,
            charts=dashboard.charts,
            href=dashboard.href.__root__,
            deleted=dashboard.deleted,
            service=dashboard.service,
            serviceType=str(dashboard.serviceType.name),
            usageSummary=dashboard.usageSummary,
            tier=tier,
            tags=list(tags),
            owner=dashboard.owner,
            followers=dashboard_followers,
            suggest=suggest,
            chart_suggest=chart_suggest,
            service_suggest=service_suggest,
        )

        return dashboard_doc

    def _create_pipeline_es_doc(self, pipeline: Pipeline):
        display_name = (
            pipeline.displayName if pipeline.displayName else pipeline.name.__root__
        )
        suggest = [
            {"input": [pipeline.fullyQualifiedName.__root__], "weight": 10},
            {"input": [display_name], "weight": 5},
        ]
        service_suggest = []
        task_suggest = []
        tags = []
        service_suggest.append({"input": [pipeline.service.name], "weight": 5})
        pipeline_followers = []
        if pipeline.followers:
            for follower in pipeline.followers.__root__:
                pipeline_followers.append(str(follower.id.__root__))
        tier = None
        for pipeline_tag in pipeline.tags:
            if "Tier" in pipeline_tag.tagFQN.__root__:
                tier = pipeline_tag
            else:
                tags.append(pipeline_tag)

        for task in pipeline.tasks:
            task_suggest.append({"input": [task.displayName], "weight": 5})
            if tags in task and len(task.tags) > 0:
                tags.extend(task.tags)

        pipeline_doc = PipelineESDocument(
            id=str(pipeline.id.__root__),
            name=pipeline.name.__root__,
            displayName=display_name,
            description=pipeline.description.__root__ if pipeline.description else "",
            fullyQualifiedName=pipeline.fullyQualifiedName.__root__,
            version=pipeline.version.__root__,
            updatedAt=pipeline.updatedAt.__root__,
            updatedBy=pipeline.updatedBy,
            pipelineUrl=pipeline.pipelineUrl,
            tasks=pipeline.tasks,
            href=pipeline.href.__root__,
            deleted=pipeline.deleted,
            service=pipeline.service,
            serviceType=str(pipeline.serviceType.name),
            suggest=suggest,
            task_suggest=task_suggest,
            service_suggest=service_suggest,
            tier=tier,
            tags=list(tags),
            owner=pipeline.owner,
            followers=pipeline_followers,
        )

        return pipeline_doc

    def _create_ml_model_es_doc(self, ml_model: MlModel):
        display_name = (
            ml_model.displayName if ml_model.displayName else ml_model.name.__root__
        )
        suggest = [{"input": [display_name], "weight": 10}]
        tags = []
        ml_model_followers = []
        if ml_model.followers:
            for follower in ml_model.followers.__root__:
                ml_model_followers.append(str(follower.id.__root__))
        tier = None
        for ml_model_tag in ml_model.tags:
            if "Tier" in ml_model_tag.tagFQN.__root__:
                tier = ml_model_tag
            else:
                tags.append(ml_model_tag)

        service_entity = ESEntityReference(
            id=str(ml_model.service.id.__root__),
            name=ml_model.service.name,
            displayName=ml_model.service.displayName
            if ml_model.service.displayName
            else "",
            description=ml_model.service.description.__root__
            if ml_model.service.description
            else "",
            type=ml_model.service.type,
            fullyQualifiedName=ml_model.service.fullyQualifiedName,
            deleted=ml_model.service.deleted,
            href=ml_model.service.href.__root__,
        )

        ml_model_doc = MlModelESDocument(
            id=str(ml_model.id.__root__),
            name=ml_model.name.__root__,
            displayName=display_name,
            description=ml_model.description.__root__ if ml_model.description else "",
            fullyQualifiedName=ml_model.fullyQualifiedName.__root__,
            version=ml_model.version.__root__,
            updatedAt=ml_model.updatedAt.__root__,
            updatedBy=ml_model.updatedBy,
            href=ml_model.href.__root__,
            deleted=ml_model.deleted,
            algorithm=ml_model.algorithm if ml_model.algorithm else "",
            mlFeatures=ml_model.mlFeatures,
            mlHyperParameters=ml_model.mlHyperParameters,
            target=ml_model.target.__root__ if ml_model.target else "",
            dashboard=ml_model.dashboard,
            mlStore=ml_model.mlStore,
            server=ml_model.server.__root__ if ml_model.server else "",
            usageSummary=ml_model.usageSummary,
            suggest=suggest,
            tier=tier,
            tags=list(tags),
            owner=ml_model.owner,
            followers=ml_model_followers,
            service=service_entity,
        )

        return ml_model_doc

    def _create_user_es_doc(self, user: User):
        display_name = user.displayName if user.displayName else user.name.__root__
        suggest = [
            {"input": [display_name], "weight": 5},
            {"input": [user.name], "weight": 10},
        ]
        user_doc = UserESDocument(
            id=str(user.id.__root__),
            name=user.name.__root__,
            displayName=display_name,
            description=user.description.__root__ if user.description else "",
            fullyQualifiedName=user.fullyQualifiedName.__root__,
            version=user.version.__root__,
            updatedAt=user.updatedAt.__root__,
            updatedBy=user.updatedBy,
            href=user.href.__root__,
            deleted=user.deleted,
            email=user.email.__root__,
            isAdmin=user.isAdmin if user.isAdmin else False,
            teams=user.teams if user.teams else [],
            roles=user.roles if user.roles else [],
            inheritedRoles=user.inheritedRoles if user.inheritedRoles else [],
            suggest=suggest,
        )

        return user_doc

    def _create_team_es_doc(self, team: Team):
        display_name = team.displayName if team.displayName else team.name.__root__
        suggest = [
            {"input": [display_name], "weight": 5},
            {"input": [team.name], "weight": 10},
        ]
        team_doc = TeamESDocument(
            id=str(team.id.__root__),
            name=team.name.__root__,
            displayName=display_name,
            description=team.description.__root__ if team.description else "",
            teamType=team.teamType.name,
            fullyQualifiedName=team.fullyQualifiedName.__root__,
            version=team.version.__root__,
            updatedAt=team.updatedAt.__root__,
            updatedBy=team.updatedBy,
            href=team.href.__root__,
            deleted=team.deleted,
            suggest=suggest,
            users=team.users if team.users else [],
            defaultRoles=team.defaultRoles if team.defaultRoles else [],
            parents=team.parents if team.parents else [],
            isJoinable=team.isJoinable,
        )

        return team_doc

    def _create_glossary_term_es_doc(self, glossary_term: GlossaryTerm):
        display_name = (
            glossary_term.displayName
            if glossary_term.displayName
            else glossary_term.name.__root__
        )
        suggest = [
            {"input": [display_name], "weight": 5},
            {"input": [glossary_term.name], "weight": 10},
        ]
        glossary_term_doc = GlossaryTermESDocument(
            id=str(glossary_term.id.__root__),
            name=str(glossary_term.name.__root__),
            displayName=display_name,
            description=glossary_term.description.__root__
            if glossary_term.description
            else "",
            fullyQualifiedName=glossary_term.fullyQualifiedName.__root__,
            version=glossary_term.version.__root__,
            updatedAt=glossary_term.updatedAt.__root__,
            updatedBy=glossary_term.updatedBy,
            href=glossary_term.href.__root__,
            synonyms=[str(synonym.__root__) for synonym in glossary_term.synonyms],
            glossary=glossary_term.glossary,
            children=glossary_term.children if glossary_term.children else [],
            relatedTerms=glossary_term.relatedTerms
            if glossary_term.relatedTerms
            else [],
            reviewers=glossary_term.reviewers if glossary_term.reviewers else [],
            usageCount=glossary_term.usageCount,
            tags=glossary_term.tags if glossary_term.tags else [],
            status=glossary_term.status.name,
            suggest=suggest,
            deleted=glossary_term.deleted,
        )

        return glossary_term_doc

    def _create_tag_es_doc(self, classification: Classification):
        tag_docs = []

        tag_list = self.metadata.list_entities(
            entity=Tag, params={"parent": classification.name.__root__}
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

    def _parse_columns(
        self,
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
                self._parse_columns(
                    column.children,
                    column.name.__root__,
                    column_names,
                    column_descriptions,
                    tags,
                )

    def get_status(self):
        return self.status

    def close(self):
        self.elasticsearch_client.close()
