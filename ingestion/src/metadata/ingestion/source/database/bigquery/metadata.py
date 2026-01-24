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
# pylint: disable=too-many-lines
"""
Bigquery source module
"""
import os
import traceback
from typing import Dict, Iterable, List, Optional, Tuple

from google import auth
from google.cloud.datacatalog_v1 import PolicyTagManagerClient
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.sql.sqltypes import Interval
from sqlalchemy.types import String
from sqlalchemy_bigquery import BigQueryDialect, _types
from sqlalchemy_bigquery._types import _get_sqla_column_type

from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureCode
from metadata.generated.schema.entity.data.table import (
    ConstraintType,
    PartitionColumnDetails,
    PartitionIntervalTypes,
    Table,
    TableConstraint,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.security.credentials.gcpExternalAccount import (
    GcpExternalAccount,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
)
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.delete import delete_entity_by_name
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_test_connection_fn
from metadata.ingestion.source.database.bigquery.helper import (
    clear_constraint_cache,
    clear_constraint_cache_for_schema,
    get_foreign_keys,
    get_inspector_details,
    get_pk_constraint,
)
from metadata.ingestion.source.database.bigquery.incremental_table_processor import (
    BigQueryIncrementalTableProcessor,
)
from metadata.ingestion.source.database.bigquery.models import (
    STORED_PROC_LANGUAGE_MAP,
    BigQueryStoredProcedure,
)
from metadata.ingestion.source.database.bigquery.queries import (
    BIGQUERY_GET_STORED_PROCEDURES,
    BIGQUERY_GET_TABLE_DDLS,
    BIGQUERY_LIFE_CYCLE_QUERY,
)
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.incremental_metadata_extraction import (
    IncrementalConfig,
)
from metadata.ingestion.source.database.life_cycle_query_mixin import (
    LifeCycleQueryMixin,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.utils import fqn
from metadata.utils.credentials import GOOGLE_CREDENTIALS
from metadata.utils.execution_time_tracker import calculate_execution_time
from metadata.utils.filters import filter_by_database, filter_by_schema
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import is_complex_type
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_label
from metadata.utils.tag_utils import get_tag_labels as fetch_tag_labels_om

_bigquery_table_types = {
    "BASE TABLE": TableType.Regular,
    "EXTERNAL": TableType.External,
    "MATERIALIZED_VIEW": TableType.MaterializedView,
    "VIEW": TableType.View,
}


class BQJSON(String):
    """The SQL JSON type."""

    def get_col_spec(self, **kw):  # pylint: disable=unused-argument
        return "JSON"


logger = ingestion_logger()
# pylint: disable=protected-access
_types._type_map.update(
    {
        "GEOGRAPHY": create_sqlalchemy_type("GEOGRAPHY"),
        "JSON": BQJSON,
        "INTERVAL": Interval,
    }
)


def _array_sys_data_type_repr(col_type):
    """clean up the repr of the array data type

    Args:
        col_type (_type_): column type
    """
    return (
        repr(col_type)
        .replace("(", "<")
        .replace(")", ">")
        .replace("=", ":")
        .replace("<>", "")
        .lower()
    )


def get_system_data_type(col_type):
    """
    Get the system data type for the column type
    """
    if isinstance(col_type, String):
        return "string"
    if str(col_type) == "ARRAY":
        return _array_sys_data_type_repr(col_type)

    return str(col_type)


def get_columns(bq_schema):
    """
    get_columns method overwritten to include tag details
    """
    col_list = []
    for field in bq_schema:
        col_type = _get_sqla_column_type(field)
        col_obj = {
            "name": field.name,
            "type": col_type,
            "nullable": field.mode in ("NULLABLE", "REPEATED"),
            "comment": field.description,
            "default": None,
            "precision": field.precision,
            "scale": field.scale,
            "max_length": field.max_length,
            "system_data_type": get_system_data_type(col_type),
            "is_complex": is_complex_type(str(col_type)),
            "policy_tags": field.policy_tags,
        }
        if getattr(field, "fields", None):
            # Nested Columns available
            col_obj["children"] = get_columns(field.fields)

        col_list.append(col_obj)
    return col_list


_types.get_columns = get_columns


@staticmethod
def _build_formatted_table_id(table):
    """We overide the methid as it returns both schema and table name if dataset_id is None. From our
    investigation, this method seems to be used only in `_get_table_or_view_names()` of bigquery sqalchemy
    https://github.com/googleapis/python-bigquery-sqlalchemy/blob/2b1f5c464ad2576e4512a0407bb044da4287c65e/sqlalchemy_bigquery/base.py
    """
    return f"{table.table_id}"


BigQueryDialect._build_formatted_table_id = (  # pylint: disable=protected-access
    _build_formatted_table_id
)
BigQueryDialect.get_pk_constraint = get_pk_constraint
BigQueryDialect.get_foreign_keys = get_foreign_keys


# pylint: disable=too-many-public-methods
class BigquerySource(LifeCycleQueryMixin, CommonDbSourceService, MultiDBSource):
    """
    Implements the necessary methods to extract
    Database metadata from Bigquery Source
    """

    @retry_with_docker_host()
    def __init__(self, config, metadata, incremental_configuration: IncrementalConfig):
        # Check if the engine is established before setting project IDs
        # This ensures that we don't try to set project IDs when there is no engine
        # as per service connection config, which would result in an error.
        self.test_connection = lambda: None
        super().__init__(config, metadata)
        self.client = None
        # Used to delete temp json file created while initializing bigquery client
        self.temp_credentials_file_path = []
        # Upon invoking the set_project_id method, we retrieve a comprehensive
        # list of all project IDs. Subsequently, after the invokation,
        # we proceed to test the connections for each of these project IDs
        self.project_ids = self.set_project_id(self.service_connection)
        self.life_cycle_query = BIGQUERY_LIFE_CYCLE_QUERY
        self.test_connection = self._test_connection
        self.test_connection()

        self.context.get_global().deleted_tables = []
        self.incremental = incremental_configuration
        self.incremental_table_processor: Optional[
            BigQueryIncrementalTableProcessor
        ] = None

        self._current_schema_tables = {}
        self._current_dataset_obj = None
        self._policy_tag_cache = {}
        self._taxonomy_cache = {}
        self._taxonomy_to_tags = {}
        self._table_ddl_cache = {}
        self._policy_tag_client = None

        if self.service_connection.includePolicyTags:
            try:
                self._policy_tag_client = PolicyTagManagerClient()
            except Exception as exc:
                logger.warning(f"Failed to initialize PolicyTagManagerClient: {exc}")

        if self.incremental.enabled:
            logger.info(
                "Starting Incremental Metadata Extraction.\n\t Considering Table changes from %s",
                self.incremental.start_datetime_utc,
            )

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: BigQueryConnection = config.serviceConnection.root.config
        if not isinstance(connection, BigQueryConnection):
            raise InvalidSourceException(
                f"Expected BigQueryConnection, but got {connection}"
            )
        incremental_config = IncrementalConfig.create(
            config.sourceConfig.config.incremental, pipeline_name, metadata
        )
        return cls(config, metadata, incremental_config)

    @staticmethod
    def set_project_id(
        service_connection: Optional[BigQueryConnection] = None,
    ) -> List[str]:
        """
        Get the project ID from the service connection or ADC.

        Args:
            service_connection: Optional BigQuery connection config

        Returns:
            List of project IDs to scan

        Raises:
            InvalidSourceException: If unable to get project IDs from either config or ADC
        """
        try:

            # TODO: Add support for fetching project ids from resource manager
            # Bigquery resource manager for fetching project ids
            # "google-cloud-resource-manager~=1.14.1",
            # "grpc-google-iam-v1~=0.14.0",

            # First check if project ID is configured in service connection
            if (
                service_connection
                and hasattr(service_connection, "credentials")
                and hasattr(service_connection.credentials, "gcpConfig")
            ):
                gcp_config = service_connection.credentials.gcpConfig
                try:
                    # Allow for multiple project IDs in the service connection
                    if not isinstance(gcp_config, GcpExternalAccount) and getattr(
                        gcp_config, "projectId", None
                    ):
                        if isinstance(gcp_config.projectId.root, list):
                            return gcp_config.projectId.root
                        return [gcp_config.projectId.root]
                except Exception as exc:
                    logger.warning(f"Error getting project ID, falling back: {exc}")

            # Fallback to ADC default project
            try:
                _, project_id = auth.default()
                if project_id:
                    return [project_id] if isinstance(project_id, str) else project_id
            except Exception as exc:
                logger.warning(f"Error getting default project from ADC: {exc}")

            raise InvalidSourceException(
                "Unable to get project IDs. Either configure project IDs in the connection or "
                "ensure Application Default Credentials are set up correctly."
            )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            raise InvalidSourceException(f"Error setting BigQuery project IDs: {exc}")

    # pylint: disable=arguments-differ
    def _get_columns_with_constraints(
        self, schema_name: str, table_name: str, inspector: Inspector
    ) -> Tuple[List, List, List]:
        database_name = self.context.get().database
        schema_name = f"{database_name}.{schema_name}"
        return super()._get_columns_with_constraints(schema_name, table_name, inspector)

    def _get_columns_internal(
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: TableType = None,
    ):
        """
        Get columns list from cached table object instead of making additional API call
        """
        table_obj = self.get_table_obj(table_name)
        return get_columns(table_obj.schema)

    def _test_connection(self) -> None:
        for project_id in self.project_ids:
            inspector_details = get_inspector_details(
                database_name=project_id, service_connection=self.service_connection
            )
            test_connection_fn = get_test_connection_fn(self.service_connection)
            test_connection_fn(
                self.metadata, inspector_details.engine, self.service_connection
            )
            # GOOGLE_CREDENTIALS may not have been set,
            # to avoid key error, we use `get` for dict
            if os.environ.get(GOOGLE_CREDENTIALS):
                self.temp_credentials_file_path.append(os.environ[GOOGLE_CREDENTIALS])

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Use client.list_tables() API to get the table names and types and also fetching table DDLs if includeDDL is set to true.
        """
        database = self.context.get().database
        dataset_ref = f"{database}.{schema_name}"

        self._current_schema_tables.clear()
        self._current_dataset_obj = None
        self._prefetch_table_ddls(schema_name)
        clear_constraint_cache_for_schema(database, schema_name)

        try:
            tables = self.client.list_tables(dataset_ref)

            for table in tables:
                if not self.source_config.includeViews and table.table_type in (
                    "VIEW",
                    "MATERIALIZED_VIEW",
                ):
                    continue

                if self.incremental.enabled:
                    if (
                        table.table_id
                        not in self.incremental_table_processor.get_not_deleted(
                            schema_name
                        )
                    ):
                        continue

                yield TableNameAndType(
                    name=table.table_id,
                    type_=_bigquery_table_types.get(
                        table.table_type, TableType.Regular
                    ),
                )

        except Exception as exc:
            logger.error(f"Error listing tables for {dataset_ref}: {exc}")
            raise

    def query_view_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Connect to the source database to get the view
        name and type. By default, use the inspector method
        to get the names and pass the View type.

        This is useful for sources where we need fine-grained
        logic on how to handle table types, e.g., material views,...
        """
        return []

    # pylint: disable=arguments-differ
    @calculate_execution_time()
    def get_table_description(
        self, schema_name: str, table_name: str, inspector: Inspector
    ) -> str:
        schema_name = f"{self.context.get().database}.{schema_name}"
        return super().get_table_description(
            schema_name=schema_name, table_name=table_name, inspector=inspector
        )

    def get_dataset_obj(self, schema_name: str):
        """Get dataset object with per-schema caching"""
        if self._current_dataset_obj is None:
            database = self.context.get().database
            self._current_dataset_obj = self.client.get_dataset(
                f"{database}.{schema_name}"
            )
        return self._current_dataset_obj

    def _prefetch_policy_tags(self):
        """Pre-fetch all policy tags at schema level to avoid per-column API calls"""
        if not self.service_connection.includePolicyTags:
            return

        self._policy_tag_cache.clear()
        self._taxonomy_cache.clear()
        self._taxonomy_to_tags.clear()

        if not self._policy_tag_client:
            logger.warning(
                "PolicyTagManagerClient not initialized, skipping policy tag fetch"
            )
            return

        list_project_ids = [self.context.get().database]
        if self.service_connection.taxonomyProjectID:
            list_project_ids.extend(self.service_connection.taxonomyProjectID)

        for project_id in list_project_ids:
            try:
                parent = f"projects/{project_id}/locations/{self.service_connection.taxonomyLocation}"
                taxonomies = list(
                    self._policy_tag_client.list_taxonomies(parent=parent)
                )

                for taxonomy in taxonomies:
                    self._taxonomy_cache[taxonomy.name] = taxonomy.display_name

                    if taxonomy.display_name not in self._taxonomy_to_tags:
                        self._taxonomy_to_tags[taxonomy.display_name] = []

                    policy_tags = list(
                        self._policy_tag_client.list_policy_tags(parent=taxonomy.name)
                    )

                    for tag in policy_tags:
                        self._policy_tag_cache[tag.name] = {
                            "display_name": tag.display_name,
                            "taxonomy": taxonomy.display_name,
                        }
                        self._taxonomy_to_tags[taxonomy.display_name].append(
                            tag.display_name
                        )
            except Exception as exc:
                logger.warning(
                    f"Error pre-fetching policy tags for {project_id}: {exc}"
                )

    def _prefetch_table_ddls(self, schema_name: str):
        """Pre-fetch all table DDLs at schema level using INFORMATION_SCHEMA"""
        if not self.source_config.includeDDL:
            return

        self._table_ddl_cache.clear()

        try:
            database = self.context.get().database
            query = BIGQUERY_GET_TABLE_DDLS.format(
                database_name=database,
                schema_name=schema_name,
            )
            results = self.engine.execute(query).all()
            for row in results:
                self._table_ddl_cache[row.table_name] = row.ddl
        except Exception as exc:
            logger.warning(f"Error pre-fetching table DDLs for {schema_name}: {exc}")
            logger.debug(traceback.format_exc())

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Build tag context"""
        try:
            dataset_obj = self.get_dataset_obj(schema_name)
            if dataset_obj.labels:
                for key, value in dataset_obj.labels.items():
                    yield from get_ometa_tag_and_classification(
                        tags=[value],
                        classification_name=key,
                        tag_description="Bigquery Dataset Label",
                        classification_description="BigQuery Dataset Classification",
                        include_tags=self.source_config.includeTags,
                        metadata=self.metadata,
                        system_tags=True,
                    )

            if not self.service_connection.includePolicyTags:
                logger.info(
                    "'includePolicyTags' is set to false so skipping policy tag ingestion"
                )
                return

            self._prefetch_policy_tags()

            for taxonomy_name, classification_name in self._taxonomy_cache.items():
                tags = self._taxonomy_to_tags.get(classification_name, [])
                if tags:
                    yield from get_ometa_tag_and_classification(
                        tags=tags,
                        classification_name=classification_name,
                        tag_description="Bigquery Policy Tag",
                        classification_description="BigQuery Policy Classification",
                        include_tags=self.source_config.includeTags,
                        metadata=self.metadata,
                        system_tags=True,
                    )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Tags and Classifications",
                    error=f"Skipping Policy Tag ingestion due to: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_schema_description(self, schema_name: str) -> Optional[str]:
        """Use cached dataset object instead of SQL query"""
        try:
            dataset_obj = self.get_dataset_obj(schema_name)
            return dataset_obj.description or ""
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.debug(
                f"Failed to fetch dataset description for [{schema_name}]: {err}"
            )
        return ""

    def _prepare_schema_incremental_data(self, schema_name: str):
        """Prepares the data for Incremental Extraction.

        1. Queries Cloud Logging for the changes
        2. Sets the table map with the changes within the BigQueryIncrementalTableProcessor
        3. Adds the Deleted Tables to the context
        """
        self.incremental_table_processor.set_changed_tables_map(
            project=self.context.get().database,
            dataset=schema_name,
            start_date=self.incremental.start_datetime_utc,
        )

        self.context.get_global().deleted_tables.extend(
            [
                fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=schema_name,
                    table_name=table_name,
                )
                for table_name in self.incremental_table_processor.get_deleted(
                    schema_name
                )
            ]
        )

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema
        else:
            project = self.context.get().database
            datasets = self.client.list_datasets(project)
            for dataset in datasets:
                yield dataset.dataset_id

    def _get_filtered_schema_names(
        self, return_fqn: bool = False, add_to_status: bool = True
    ) -> Iterable[str]:
        for schema_name in self.get_raw_database_schema_names():
            schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.get().database_service,
                database_name=self.context.get().database,
                schema_name=schema_name,
            )
            if filter_by_schema(
                self.source_config.schemaFilterPattern,
                schema_fqn if self.source_config.useFqnForFiltering else schema_name,
            ):
                if add_to_status:
                    self.status.filter(schema_fqn, "Schema Filtered Out")
                continue

            if self.incremental.enabled:
                self._prepare_schema_incremental_data(schema_name)

            yield schema_fqn if return_fqn else schema_name

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[CreateDatabaseSchemaRequest]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """

        database_schema_request_obj = CreateDatabaseSchemaRequest(
            name=EntityName(schema_name),
            database=FullyQualifiedEntityName(
                fqn.build(
                    metadata=self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                )
            ),
            description=self.get_schema_description(schema_name),
            sourceUrl=self.get_source_url(
                database_name=self.context.get().database,
                schema_name=schema_name,
            ),
        )
        if self.source_config.includeTags:
            dataset_obj = self.get_dataset_obj(schema_name)
            if dataset_obj.labels:
                database_schema_request_obj.tags = []
                for label_classification, label_tag_name in dataset_obj.labels.items():
                    tag_label = get_tag_label(
                        metadata=self.metadata,
                        tag_name=label_tag_name,
                        classification_name=label_classification,
                    )
                    if tag_label:
                        database_schema_request_obj.tags.append(tag_label)
        yield Either(right=database_schema_request_obj)

    def get_table_obj(self, table_name: str):
        if table_name in self._current_schema_tables:
            return self._current_schema_tables[table_name]

        schema_name = self.context.get().database_schema
        database = self.context.get().database
        logger.debug(
            f"Fetching table object for {database}.{schema_name}.{table_name} using BigQuery API"
        )
        bq_table_fqn = fqn._build(database, schema_name, table_name)
        table_obj = self.client.get_table(bq_table_fqn)

        self._current_schema_tables[table_name] = table_obj
        return table_obj

    def yield_table_tags(self, table_name_and_type: Tuple[str, str]):
        table_name, _ = table_name_and_type
        table_obj = self.get_table_obj(table_name=table_name)
        if table_obj.labels:
            for key, value in table_obj.labels.items():
                yield from get_ometa_tag_and_classification(
                    tags=[value],
                    classification_name=key,
                    tag_description="Bigquery Table Label",
                    classification_description="BigQuery Table Classification",
                    include_tags=self.source_config.includeTags,
                    metadata=self.metadata,
                    system_tags=True,
                )

    def get_tag_labels(self, table_name: str) -> Optional[List[TagLabel]]:
        """
        This will only get executed if the tags context
        is properly informed
        """
        table_tag_labels = super().get_tag_labels(table_name) or []
        table_obj = self.get_table_obj(table_name=table_name)
        if table_obj.labels:
            for key, value in table_obj.labels.items():
                tag_label = get_tag_label(
                    metadata=self.metadata,
                    tag_name=value,
                    classification_name=key,
                )
                if tag_label:
                    table_tag_labels.append(tag_label)
        return table_tag_labels

    def get_policy_tags_for_column(self, column: dict) -> dict:
        try:
            if column.get("policy_tags"):
                policy_tag_name = column["policy_tags"].names[0]

                if policy_tag_name in self._policy_tag_cache:
                    cached = self._policy_tag_cache[policy_tag_name]
                    column["taxonomy"] = cached["taxonomy"]
                    column["policy_tags"] = cached["display_name"]
                    return column

                logger.debug(
                    f"Policy tag {policy_tag_name} not in cache, fetching from API"
                )

                if not self._policy_tag_client:
                    logger.warning(
                        "PolicyTagManagerClient not available for fallback fetch"
                    )
                    return column

                taxonomy_name = (
                    policy_tag_name.split("/policyTags/")[0] if policy_tag_name else ""
                )
                if not taxonomy_name:
                    raise NotImplementedError(
                        f"Taxonomy Name not present for {column['name']}"
                    )
                column["taxonomy"] = self._policy_tag_client.get_taxonomy(
                    name=taxonomy_name
                ).display_name
                column["policy_tags"] = self._policy_tag_client.get_policy_tag(
                    name=policy_tag_name
                ).display_name
                return column
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Skipping Policy Tag: {exc}")

    def get_column_tag_labels(
        self, table_name: str, column: dict
    ) -> Optional[List[TagLabel]]:
        """
        This will only get executed if the tags context
        is properly informed
        """
        if self.service_connection.includePolicyTags and column.get("policy_tags"):
            self.get_policy_tags_for_column(column)
            return fetch_tag_labels_om(
                metadata=self.metadata,
                tags=[column["policy_tags"]],
                classification_name=column["taxonomy"],
                include_tags=self.source_config.includeTags
                and self.service_connection.includePolicyTags,
            )
        return None

    def set_inspector(self, database_name: str):
        inspector_details = get_inspector_details(
            database_name=database_name, service_connection=self.service_connection
        )
        if os.environ.get(GOOGLE_CREDENTIALS):
            self.temp_credentials_file_path.append(os.environ[GOOGLE_CREDENTIALS])
        self.client = inspector_details.client
        self.engine = inspector_details.engine
        thread_id = self.context.get_current_thread_id()
        self._inspector_map[thread_id] = inspector_details.inspector

    def get_configured_database(self) -> Optional[str]:
        return None

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self.project_ids

    def get_database_names(self) -> Iterable[str]:
        for project_id in self.project_ids:
            database_fqn = fqn.build(
                self.metadata,
                entity_type=Database,
                service_name=self.context.get().database_service,
                database_name=project_id,
            )
            if filter_by_database(
                self.source_config.databaseFilterPattern,
                database_fqn if self.source_config.useFqnForFiltering else project_id,
            ):
                self.status.filter(database_fqn, "Database Filtered out")
            else:
                try:
                    self.set_inspector(database_name=project_id)
                    if self.incremental.enabled:
                        self.incremental_table_processor = (
                            BigQueryIncrementalTableProcessor.from_project(project_id)
                        )
                    yield project_id
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error trying to connect to database {project_id}: {exc}"
                    )

    def get_schema_definition(
        self, table_type: str, table_name: str, schema_name: str, inspector: Inspector
    ) -> Optional[str]:
        """
        Get the DDL statement or View Definition for a table
        """
        try:
            if table_type in (TableType.View, TableType.MaterializedView):
                table_obj = self.get_table_obj(table_name)

                if getattr(table_obj, "view_query", None):
                    return f"CREATE VIEW {schema_name}.{table_name} AS {table_obj.view_query}"
                elif getattr(table_obj, "mview_query", None):
                    return f"CREATE MATERIALIZED VIEW {schema_name}.{table_name} AS {table_obj.mview_query}"

                logger.debug(
                    f"Falling back to inspector for view definition as view_query not found for {table_obj.table_id}"
                )
                view_definition = inspector.get_view_definition(
                    fqn._build(self.context.get().database, schema_name, table_name)
                )
                view_definition = (
                    f"CREATE VIEW {schema_name}.{table_name} AS {str(view_definition)}"
                    if view_definition is not None
                    else None
                )
                return view_definition

            if self.source_config.includeDDL:
                return self._table_ddl_cache.get(table_name)
        except NotImplementedError:
            logger.warning(
                f"Schema definition not implemented for {schema_name}.{table_name}"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error getting schema definition for {schema_name}.{table_name}: {exc}"
            )
        return None

    def _get_partition_column_name(
        self, columns: List[Dict], partition_field_name: str
    ):
        """
        Method to get the correct partition column name
        """
        try:
            for column in columns or []:
                column_name = column.get("name")
                if column_name and (
                    column_name.lower() == partition_field_name.lower()
                ):
                    return column_name
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error getting partition column name for {partition_field_name}: {exc}"
            )
        return None

    @calculate_execution_time()
    def update_table_constraints(
        self,
        table_name,
        schema_name,
        db_name,
        table_constraints,
        foreign_columns,
        columns,
    ) -> List[TableConstraint]:
        """
        From topology.
        process the table constraints of all tables
        """
        table_constraints = super().update_table_constraints(
            table_name,
            schema_name,
            db_name,
            table_constraints,
            foreign_columns,
            columns,
        )
        try:
            table = self.get_table_obj(table_name)
            if hasattr(table, "clustering_fields") and table.clustering_fields:
                table_constraints.append(
                    TableConstraint(
                        constraintType=ConstraintType.CLUSTER_KEY,
                        columns=table.clustering_fields,
                    )
                )
        except Exception as exc:
            logger.warning(f"Error getting clustering fields for {table_name}: {exc}")
            logger.debug(traceback.format_exc())
        return table_constraints

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> Tuple[bool, Optional[TablePartition]]:
        """
        check if the table is partitioned table and return the partition details
        """
        try:
            table = self.get_table_obj(table_name)
            columns = get_columns(table.schema)
            if (
                hasattr(table, "external_data_configuration")
                and hasattr(table.external_data_configuration, "hive_partitioning")
                and table.external_data_configuration.hive_partitioning
            ):
                # Ingesting External Hive Partitioned Tables
                from google.cloud.bigquery.external_config import (  # pylint: disable=import-outside-toplevel
                    HivePartitioningOptions,
                )

                partition_details: HivePartitioningOptions = (
                    table.external_data_configuration.hive_partitioning
                )
                return True, TablePartition(
                    columns=[
                        PartitionColumnDetails(
                            columnName=self._get_partition_column_name(
                                columns=columns,
                                partition_field_name=field,
                            ),
                            interval=str(partition_details._properties.get("mode")),
                            intervalType=PartitionIntervalTypes.OTHER,
                        )
                        for field in partition_details._properties.get("fields")
                    ]
                )

            if table.time_partitioning is not None:
                if table.time_partitioning.field:
                    table_partition = TablePartition(
                        columns=[
                            PartitionColumnDetails(
                                columnName=self._get_partition_column_name(
                                    columns=columns,
                                    partition_field_name=table.time_partitioning.field,
                                ),
                                interval=str(table.time_partitioning.type_),
                                intervalType=PartitionIntervalTypes.TIME_UNIT,
                            )
                        ]
                    )
                    return True, table_partition
                return True, TablePartition(
                    columns=[
                        PartitionColumnDetails(
                            columnName=(
                                "_PARTITIONTIME"
                                if table.time_partitioning.type_ == "HOUR"
                                else "_PARTITIONDATE"
                            ),
                            interval=str(table.time_partitioning.type_),
                            intervalType=PartitionIntervalTypes.INGESTION_TIME,
                        )
                    ]
                )
            if table.range_partitioning:
                table_partition = PartitionColumnDetails(
                    columnName=self._get_partition_column_name(
                        columns=columns,
                        partition_field_name=table.range_partitioning.field,
                    ),
                    intervalType=PartitionIntervalTypes.INTEGER_RANGE,
                    interval=None,
                )
                if hasattr(table.range_partitioning, "range_") and hasattr(
                    table.range_partitioning.range_, "interval"
                ):
                    table_partition.interval = table.range_partitioning.range_.interval
                table_partition.columnName = table.range_partitioning.field
                return True, TablePartition(columns=[table_partition])
            if (
                hasattr(table, "_properties")
                and table._properties.get("partitionDefinition")
                and table._properties.get("partitionDefinition").get(
                    "partitionedColumn"
                )
            ):

                return True, TablePartition(
                    columns=[
                        PartitionColumnDetails(
                            columnName=self._get_partition_column_name(
                                columns=columns,
                                partition_field_name=field.get("field"),
                            ),
                            intervalType=PartitionIntervalTypes.OTHER,
                        )
                        for field in table._properties.get("partitionDefinition").get(
                            "partitionedColumn"
                        )
                        if field and field.get("field")
                    ]
                )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error getting table partition details for {table_name}: {exc}"
            )
        return False, None

    def clean_raw_data_type(self, raw_data_type):
        return raw_data_type.replace(", ", ",").replace(" ", ":").lower()

    def close(self):
        super().close()

        if self._policy_tag_client:
            try:
                self._policy_tag_client.transport.close()
            except Exception as exc:
                logger.debug(f"Error closing PolicyTagManagerClient: {exc}")

        clear_constraint_cache()

        os.environ.pop("GOOGLE_CLOUD_PROJECT", "")
        if isinstance(
            self.service_connection.credentials.gcpConfig, GcpCredentialsValues
        ) and (GOOGLE_CREDENTIALS in os.environ):
            del os.environ[GOOGLE_CREDENTIALS]
            for temp_file_path in self.temp_credentials_file_path:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)

    def _get_source_url(
        self,
        database_name: Optional[str] = None,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
        type_infix: str = "4m3",
    ) -> Optional[str]:
        """
        Method to get the source url for bigquery
        """
        try:
            bigquery_host = "https://console.cloud.google.com/"
            database_url = f"{bigquery_host}bigquery?project={database_name}"

            schema_table_url = None
            if schema_name:
                schema_table_url = f"&ws=!1m4!1m3!3m2!1s{database_name}!2s{schema_name}"
            if table_name:
                schema_table_url = (
                    f"&ws=!1m5!1m4!{type_infix}!1s{database_name}"
                    f"!2s{schema_name}!3s{table_name}"
                )
            if schema_table_url:
                return f"{database_url}{schema_table_url}"
            return database_url
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get source url: {exc}")
        return None

    def get_source_url(
        self,
        database_name: Optional[str] = None,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
        table_type: Optional[TableType] = None,
    ) -> Optional[str]:
        return self._get_source_url(
            database_name=database_name,
            schema_name=schema_name,
            table_name=table_name,
            # This infix identifies tables in the URL
            type_infix="4m3",
        )

    def get_stored_procedure_url(
        self,
        database_name: Optional[str] = None,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
    ) -> Optional[str]:
        return self._get_source_url(
            database_name=database_name,
            schema_name=schema_name,
            table_name=table_name,
            # This infix identifies Stored Procedures in the URL
            type_infix="6m3",
        )

    def get_stored_procedures(self) -> Iterable[BigQueryStoredProcedure]:
        """List BigQuery Stored Procedures"""
        if self.source_config.includeStoredProcedures:
            results = self.engine.execute(
                BIGQUERY_GET_STORED_PROCEDURES.format(
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                )
            ).all()
            for row in results:
                stored_procedure = BigQueryStoredProcedure.model_validate(dict(row))
                yield stored_procedure

    def yield_stored_procedure(
        self, stored_procedure: BigQueryStoredProcedure
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Prepare the stored procedure payload"""

        try:
            stored_procedure_request = CreateStoredProcedureRequest(
                name=EntityName(stored_procedure.name),
                storedProcedureCode=StoredProcedureCode(
                    language=STORED_PROC_LANGUAGE_MAP.get(
                        stored_procedure.language or "SQL",
                    ),
                    code=stored_procedure.definition,
                ),
                databaseSchema=fqn.build(
                    metadata=self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                ),
                sourceUrl=SourceUrl(
                    self.get_stored_procedure_url(
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                        # Follow the same building strategy as tables
                        table_name=stored_procedure.name,
                    )
                ),
            )
            yield Either(right=stored_procedure_request)
            self.register_record_stored_proc_request(stored_procedure_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=stored_procedure.name,
                    error=f"Error yielding Stored Procedure [{stored_procedure.name}] due to [{exc}]",
                    stackTrace=traceback.format_exc(),
                )
            )

    def mark_tables_as_deleted(self):
        """
        Use the current inspector to mark tables as deleted
        """
        if self.incremental.enabled:
            if not self.context.get().__dict__.get("database"):
                raise ValueError(
                    "No Database found in the context. We cannot run the table deletion."
                )

            if self.source_config.markDeletedTables:
                logger.info(
                    f"Mark Deleted Tables set to True. Processing database [{self.context.get().database}]"
                )
                yield from delete_entity_by_name(
                    self.metadata,
                    entity_type=Table,
                    entity_names=self.context.get_global().deleted_tables,
                    mark_deleted_entity=self.source_config.markDeletedTables,
                )
        else:
            yield from super().mark_tables_as_deleted()
