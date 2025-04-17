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
Define constants useful for the metadata ingestion
"""
from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.apiEndpoint import APIEndpoint
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.metric import Metric
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.searchIndex import SearchIndex
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.domains.dataProduct import DataProduct
from metadata.generated.schema.entity.domains.domain import Domain
from metadata.generated.schema.entity.services.apiService import ApiService
from metadata.generated.schema.entity.services.connections.database.bigTableConnection import (
    BigtableType,
)
from metadata.generated.schema.entity.services.connections.database.couchbaseConnection import (
    CouchbaseType,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeType,
)
from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeType,
)
from metadata.generated.schema.entity.services.connections.database.domoDatabaseConnection import (
    DomoDatabaseType,
)
from metadata.generated.schema.entity.services.connections.database.dynamoDBConnection import (
    DynamoDBType,
)
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueType,
)
from metadata.generated.schema.entity.services.connections.database.icebergConnection import (
    IcebergType,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBType,
)
from metadata.generated.schema.entity.services.connections.database.salesforceConnection import (
    SalesforceType,
)
from metadata.generated.schema.entity.services.connections.database.sapErpConnection import (
    SapErpType,
)
from metadata.generated.schema.entity.services.connections.database.sasConnection import (
    SasType,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.metadataService import MetadataService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.services.searchService import SearchService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User

DOT = "_DOT_"
TEN_MIN = 10 * 60
THREE_MIN = 3 * 60
UTF_8 = "utf-8"
CHUNKSIZE = 200000
DEFAULT_DATABASE = "default"
DEFAULT_DASHBAORD = "default"
BUILDER_PASSWORD_ATTR = "password"
TIMEDELTA = "timedelta"
COMPLEX_COLUMN_SEPARATOR = "_##"

ES_SOURCE_TO_ES_OBJ_ARGS = {
    "caCerts": "ca_certs",
    "regionName": "region_name",
    "timeout": "timeout",
    "useAwsCredentials": "use_AWS_credentials",
    "useSSL": "use_ssl",
    "verifyCerts": "verify_certs",
}

ES_SOURCE_IGNORE_KEYS = {
    "searchIndexMappingLanguage",
    "batchSize",
    "recreateIndex",
    "type",
}

QUERY_WITH_OM_VERSION = '/* {"app": "OpenMetadata"'

QUERY_WITH_DBT = '/* {"app": "dbt"'

AUTHORIZATION_HEADER = "Authorization"

NO_ACCESS_TOKEN = "no_token"

SAMPLE_DATA_DEFAULT_COUNT = 50

ENTITY_REFERENCE_CLASS_MAP = {
    # Service Entities
    "databaseService": DatabaseService,
    "messagingService": MessagingService,
    "apiService": ApiService,
    "dashboardService": DashboardService,
    "pipelineService": PipelineService,
    "storageService": StorageService,
    "mlmodelService": MlModelService,
    "metadataService": MetadataService,
    "searchService": SearchService,
    # Data Asset Entities
    "apiCollection": APICollection,
    "apiEndpoint": APIEndpoint,
    "table": Table,
    "storedProcedure": StoredProcedure,
    "database": Database,
    "databaseSchema": DatabaseSchema,
    "dashboard": Dashboard,
    "dashboardDataModel": DashboardDataModel,
    "pipeline": Pipeline,
    "chart": Chart,
    "topic": Topic,
    "searchIndex": SearchIndex,
    "mlmodel": MlModel,
    "container": Container,
    # User Entities
    "user": User,
    "team": Team,
    # Domain
    "domain": Domain,
    "dataProduct": DataProduct,
    # Governance
    "metric": Metric,
    "glossary": Glossary,
    "glossaryTerm": GlossaryTerm,
}

ENTITY_REFERENCE_TYPE_MAP = {
    value.__name__: key for key, value in ENTITY_REFERENCE_CLASS_MAP.items()
}

CUSTOM_CONNECTOR_PREFIX = "custom"

NON_SQA_DATABASE_CONNECTIONS = (
    DatalakeType.Datalake.value,
    BigtableType.BigTable.value,
    CouchbaseType.Couchbase.value,
    DeltaLakeType.DeltaLake.value,
    DomoDatabaseType.DomoDatabase.value,
    DynamoDBType.DynamoDB.value,
    GlueType.Glue.value,
    IcebergType.Iceberg.value,
    MongoDBType.MongoDB.value,
    SalesforceType.Salesforce.value,
    SapErpType.SapErp.value,
    SasType.SAS.value,
)
