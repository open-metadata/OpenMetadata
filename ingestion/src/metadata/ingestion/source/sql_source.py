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
Generic source to build SQL connectors.
"""
import json
import logging
import re
import traceback
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session

from metadata.config.common import FQDN_SEPARATOR
from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    ConstraintType,
    DataModel,
    DataType,
    ModelType,
    Table,
    TableConstraint,
    TableData,
    TableProfile,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataServerConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import DeleteTable
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.orm_profiler.orm.converter import ometa_to_orm
from metadata.orm_profiler.profiler.default import DefaultProfiler
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.engines import create_and_bind_session, get_engine
from metadata.utils.helpers import get_database_service_or_create, ingest_lineage

logger: logging.Logger = logging.getLogger(__name__)


@dataclass
class SQLSourceStatus(SourceStatus):
    """
    Reports the source status after ingestion
    """

    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    filtered: List[str] = field(default_factory=list)

    def scanned(self, record: str) -> None:
        self.success.append(record)
        logger.info(f"Table Scanned: {record}")

    def filter(self, record: str, err: str) -> None:
        self.filtered.append(record)
        logger.warning(f"Filtered Table {record} due to {err}")


def _get_table_description(schema: str, table: str, inspector: Inspector) -> str:
    description = None
    try:
        table_info: dict = inspector.get_table_comment(table, schema)
    # Catch any exception without breaking the ingestion
    except Exception as err:  # pylint: disable=broad-except
        logger.error(f"Table Description Error : {err}")
    else:
        description = table_info["text"]
    return description


class SQLSource(Source[OMetaDatabaseAndTable]):
    """
    Source Connector implementation to extract
    Database & Table information and convert it
    to OpenMetadata Entities
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataServerConfig,
    ):
        super().__init__()

        self.config = config

        # It will be one of the Unions. We don't know the specific type here.
        self.service_connection = self.config.serviceConnection.__root__.config

        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )

        self.metadata_config = metadata_config
        self.service = get_database_service_or_create(config, metadata_config)
        self.metadata = OpenMetadata(metadata_config)
        self.status = SQLSourceStatus()
        self.engine = get_engine(workflow_source=self.config)
        self._session = None  # We will instantiate this just if needed
        self.connection = self.engine.connect()
        self.data_profiler = None
        self.data_models = {}
        self.table_constraints = None
        self.database_source_state = set()
        if self.source_config.dbtCatalogFilePath:
            with open(
                self.source_config.dbtCatalogFilePath, "r", encoding="utf-8"
            ) as catalog:
                self.dbt_catalog = json.load(catalog)
        if self.source_config.dbtManifestFilePath:
            with open(
                self.source_config.dbtManifestFilePath, "r", encoding="utf-8"
            ) as manifest:
                self.dbt_manifest = json.load(manifest)
        self.profile_date = datetime.now()

    def run_profiler(self, table: Table, schema: str) -> Optional[TableProfile]:
        """
        Convert the table to an ORM object and run the ORM
        profiler.

        :param table: Table Entity to be ingested
        :param schema: Table schema
        :return: TableProfile
        """
        try:
            orm = ometa_to_orm(table=table, database=schema)
            profiler = DefaultProfiler(
                session=self.session, table=orm, profile_date=self.profile_date
            )
            profiler.execute()
            return profiler.get_profile()

        # Catch any errors during profiling init and continue ingestion
        except ModuleNotFoundError as err:
            logger.error(
                f"Profiling not available for this databaseService: {str(err)}"
            )
            self.source_config.enableDataProfiler = False

        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.print_exc())
            logger.debug(f"Error running ingestion profiler {repr(exc)}")

        return None

    @property
    def session(self) -> Session:
        """
        Return the SQLAlchemy session from the engine
        """
        if not self._session:
            self._session = create_and_bind_session(self.engine)

        return self._session

    def prepare(self):
        self._parse_data_model()

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataServerConfig):
        pass

    @staticmethod
    def standardize_schema_table_names(schema: str, table: str) -> Tuple[str, str]:
        return schema, table

    def fetch_sample_data(self, schema: str, table: str) -> Optional[TableData]:
        """
        Get some sample data from the source to be added
        to the Table Entities
        """
        try:
            query = self.source_config.sampleDataQuery.format(schema, table)
            logger.info(query)
            results = self.connection.execute(query)
            cols = []
            for col in results.keys():
                cols.append(col)
            rows = []
            for res in results:
                row = list(res)
                rows.append(row)
            return TableData(columns=cols, rows=rows)
        # Catch any errors and continue the ingestion
        except Exception as err:  # pylint: disable=broad-except
            logger.debug(traceback.print_exc())
            logger.error(f"Failed to generate sample data for {table} - {err}")
        return None

    def get_databases(self) -> Iterable[Inspector]:
        yield inspect(self.engine)

    def get_table_fqn(self, service_name, schema, table_name) -> str:
        return f"{service_name}{FQDN_SEPARATOR}{schema}{FQDN_SEPARATOR}{table_name}"

    def next_record(self) -> Iterable[Entity]:
        inspectors = self.get_databases()
        for inspector in inspectors:
            schema_names = inspector.get_schema_names()
            for schema in schema_names:
                # clear any previous source database state
                self.database_source_state.clear()
                if (
                    self.source_config.schemaFilterPattern
                    and self.source_config.schemaFilterPattern.includes
                    and schema not in self.source_config.schemaFilterPattern.includes
                ):
                    self.status.filter(schema, "Schema pattern not allowed")
                    continue
                # Fetch tables by default
                yield from self.fetch_tables(inspector, schema)
                if self.source_config.includeViews:
                    yield from self.fetch_views(inspector, schema)
                if self.source_config.markDeletedTables:
                    schema_fqdn = f"{self.config.serviceName}.{schema}"
                    yield from self.delete_tables(schema_fqdn)

    def fetch_tables(
        self, inspector: Inspector, schema: str
    ) -> Iterable[OMetaDatabaseAndTable]:
        """
        Scrape an SQL schema and prepare Database and Table
        OpenMetadata Entities
        """
        tables = inspector.get_table_names(schema)
        for table_name in tables:
            try:
                schema, table_name = self.standardize_schema_table_names(
                    schema, table_name
                )
                if (
                    self.source_config.tableFilterPattern
                    and table_name not in self.source_config.tableFilterPattern.includes
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{table_name}",
                        "Table pattern not allowed",
                    )
                    continue
                if self._is_partition(table_name, schema, inspector):
                    self.status.filter(
                        f"{self.config.serviceName}.{table_name}",
                        "Table is partition",
                    )
                    continue
                description = _get_table_description(schema, table_name, inspector)
                fqn = self.get_table_fqn(self.config.serviceName, schema, table_name)
                self.database_source_state.add(fqn)
                self.table_constraints = None
                table_columns = self._get_columns(schema, table_name, inspector)
                table_entity = Table(
                    id=uuid.uuid4(),
                    name=table_name,
                    tableType="Regular",
                    description=description if description is not None else " ",
                    columns=table_columns,
                )
                if self.table_constraints:
                    table_entity.tableConstraints = self.table_constraints
                try:
                    if self.source_config.generateSampleData:
                        table_data = self.fetch_sample_data(schema, table_name)
                        if table_data:
                            table_entity.sampleData = table_data
                # Catch any errors during the ingestion and continue
                except Exception as err:  # pylint: disable=broad-except
                    logger.error(repr(err))
                    logger.error(err)

                try:
                    if self.source_config.enableDataProfiler:
                        profile = self.run_profiler(table=table_entity, schema=schema)
                        table_entity.tableProfile = [profile] if profile else None
                # Catch any errors during the profile runner and continue
                except Exception as err:
                    logger.error(err)

                # check if we have any model to associate with
                table_entity.dataModel = self._get_data_model(schema, table_name)
                database = self._get_database(self.service_connection.database)
                table_schema_and_db = OMetaDatabaseAndTable(
                    table=table_entity,
                    database=database,
                    database_schema=self._get_schema(schema, database),
                )
                yield table_schema_and_db
                self.status.scanned("{}.{}".format(self.config.serviceName, table_name))
            except Exception as err:
                logger.debug(traceback.print_exc())
                logger.error(err)
                self.status.failures.append(
                    "{}.{}".format(self.config.serviceName, table_name)
                )
                continue

    def fetch_views(
        self, inspector: Inspector, schema: str
    ) -> Iterable[OMetaDatabaseAndTable]:
        """
        Get all views in the SQL schema and prepare
        Database & Table OpenMetadata Entities
        """
        for view_name in inspector.get_view_names(schema):
            try:
                if self.service_connection.scheme == "bigquery":
                    schema, view_name = self.standardize_schema_table_names(
                        schema, view_name
                    )
                if (
                    self.source_config.tableFilterPattern
                    and view_name not in self.source_config.tableFilterPattern.includes
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{view_name}",
                        "View pattern not allowed",
                    )
                    continue
                try:
                    if self.service_connection.scheme == "bigquery":
                        view_definition = inspector.get_view_definition(
                            f"{self.service_connection.projectId}.{schema}.{view_name}"
                        )
                    else:
                        view_definition = inspector.get_view_definition(
                            view_name, schema
                        )
                    view_definition = (
                        "" if view_definition is None else str(view_definition)
                    )
                except NotImplementedError:
                    view_definition = ""
                fqn = self.get_table_fqn(self.config.serviceName, schema, view_name)
                self.database_source_state.add(fqn)
                table = Table(
                    id=uuid.uuid4(),
                    name=view_name,
                    tableType="View",
                    description=_get_table_description(schema, view_name, inspector)
                    or "",
                    # This will be generated in the backend!! #1673
                    columns=self._get_columns(schema, view_name, inspector),
                    viewDefinition=view_definition,
                )
                if table.viewDefinition:
                    query_info = {
                        "sql": table.viewDefinition.__root__,
                        "from_type": "table",
                        "to_type": "table",
                        "service_name": self.config.serviceName,
                    }
                    ingest_lineage(
                        query_info=query_info, metadata_config=self.metadata_config
                    )
                if self.source_config.generateSampleData:
                    table_data = self.fetch_sample_data(schema, view_name)
                    table.sampleData = table_data
                # table.dataModel = self._get_data_model(schema, view_name)
                database = self._get_database(self.service_connection.database)
                table_schema_and_db = OMetaDatabaseAndTable(
                    table=table,
                    database=database,
                    database_schema=self._get_schema(schema, database),
                )
                yield table_schema_and_db
            # Catch any errors and continue the ingestion
            except Exception as err:  # pylint: disable=broad-except
                logger.error(err)
                self.status.warnings.append(f"{self.config.serviceName}.{view_name}")
                continue

    def delete_tables(self, schema_fqdn: str) -> DeleteTable:
        database_state = self._build_database_state(schema_fqdn)
        for table in database_state:
            if str(table.fullyQualifiedName.__root__) not in self.database_source_state:
                yield DeleteTable(table=table)

    def _is_partition(self, table_name: str, schema: str, inspector) -> bool:
        self.inspector = inspector
        return False

    def _parse_data_model(self):
        """
        Get all the DBT information and feed it to the Table Entity
        """
        if (
            self.source_config.dbtManifestFilePath
            and self.source_config.dbtCatalogFilePath
        ):
            logger.info("Parsing Data Models")
            manifest_entities = {
                **self.dbt_manifest["nodes"],
                **self.dbt_manifest["sources"],
            }
            catalog_entities = {
                **self.dbt_catalog["nodes"],
                **self.dbt_catalog["sources"],
            }

            for key, mnode in manifest_entities.items():
                try:
                    name = mnode["alias"] if "alias" in mnode.keys() else mnode["name"]
                    cnode = catalog_entities.get(key)
                    columns = (
                        self._parse_data_model_columns(name, mnode, cnode)
                        if cnode
                        else []
                    )

                    if mnode["resource_type"] == "test":
                        continue
                    upstream_nodes = self._parse_data_model_upstream(mnode)
                    model_name = (
                        mnode["alias"] if "alias" in mnode.keys() else mnode["name"]
                    )
                    schema = mnode["schema"]
                    raw_sql = mnode.get("raw_sql", "")
                    model = DataModel(
                        modelType=ModelType.DBT,
                        description=mnode.get("description", ""),
                        path=f"{mnode['root_path']}/{mnode['original_file_path']}",
                        rawSql=raw_sql,
                        sql=mnode.get("compiled_sql", raw_sql),
                        columns=columns,
                        upstream=upstream_nodes,
                    )
                    model_fqdn = f"{schema}.{model_name}".lower()
                except Exception as err:
                    logger.debug(traceback.print_exc())
                    logger.error(err)
                self.data_models[model_fqdn] = model

    def _parse_data_model_upstream(self, mnode):
        upstream_nodes = []
        if "depends_on" in mnode and "nodes" in mnode["depends_on"]:
            for node in mnode["depends_on"]["nodes"]:
                try:
                    _, database, table = node.split(".", 2)
                    table_fqn = self.get_table_fqn(
                        self.config.serviceName, database, table
                    ).lower()
                    upstream_nodes.append(table_fqn)
                except Exception as err:  # pylint: disable=broad-except
                    logger.error(
                        f"Failed to parse the node {node} to capture lineage {err}"
                    )
                    continue
        return upstream_nodes

    def _get_data_model(self, schema, table_name):
        table_fqn = f"{schema}{FQDN_SEPARATOR}{table_name}".lower()
        if table_fqn in self.data_models:
            model = self.data_models[table_fqn]
            return model
        return None

    def _parse_data_model_columns(
        self, model_name: str, mnode: Dict, cnode: Dict
    ) -> [Column]:
        columns = []
        ccolumns = cnode.get("columns")
        manifest_columns = mnode.get("columns", {})
        for key in ccolumns:
            ccolumn = ccolumns[key]
            col_name = ccolumn["name"].lower()
            try:
                ctype = ccolumn["type"]
                col_type = ColumnTypeParser.get_column_type(ctype)
                description = manifest_columns.get(key.lower(), {}).get(
                    "description", None
                )
                if description is None:
                    description = ccolumn.get("comment", None)
                col = Column(
                    name=col_name,
                    description=description,
                    dataType=col_type,
                    dataLength=1,
                    ordinalPosition=ccolumn["index"],
                )
                columns.append(col)
            except Exception as err:  # pylint: disable=broad-except
                logger.error(f"Failed to parse column {col_name} due to {err}")

        return columns

    def _get_database(self, database: str) -> Database:
        return Database(
            name=database,
            service=EntityReference(
                id=self.service.id, type=self.service_connection.type.value
            ),
        )

    def _get_schema(self, schema: str, database: Database) -> DatabaseSchema:
        return DatabaseSchema(
            name=schema,
            database=database.service,
            service=EntityReference(
                id=self.service.id, type=self.service_connection.type.value
            ),
        )

    @staticmethod
    def _get_column_constraints(
        column, pk_columns, unique_columns
    ) -> Optional[Constraint]:
        """
        Prepare column constraints for the Table Entity
        """
        constraint = None
        if column["nullable"]:
            constraint = Constraint.NULL
        elif not column["nullable"]:
            constraint = Constraint.NOT_NULL

        if column["name"] in pk_columns:
            if len(pk_columns) > 1:
                return None
            constraint = Constraint.PRIMARY_KEY
        elif column["name"] in unique_columns:
            constraint = Constraint.UNIQUE
        return constraint

    def _get_columns(
        self, schema: str, table: str, inspector: Inspector
    ) -> Optional[List[Column]]:
        """
        Get columns types and constraints information
        """

        # Get inspector information:
        pk_constraints = inspector.get_pk_constraint(table, schema)
        try:
            unique_constraints = inspector.get_unique_constraints(table, schema)
        except NotImplementedError:
            logger.warning("Cannot obtain constraints - NotImplementedError")
            unique_constraints = []

        pk_columns = (
            pk_constraints.get("constrained_columns")
            if len(pk_constraints) > 0 and pk_constraints.get("constrained_columns")
            else {}
        )

        unique_columns = []
        for constraint in unique_constraints:
            if constraint.get("column_names"):
                unique_columns.extend(constraint.get("column_names"))

        table_columns = []
        columns = inspector.get_columns(table, schema)
        try:
            for column in columns:
                try:
                    if "." in column["name"]:
                        column["name"] = column["name"]
                    children = None
                    data_type_display = None
                    arr_data_type = None
                    parsed_string = None
                    if (
                        "raw_data_type" in column
                        and column["raw_data_type"] is not None
                    ):

                        column["raw_data_type"] = self.parse_raw_data_type(
                            column["raw_data_type"]
                        )
                        if not column["raw_data_type"].startswith(schema):
                            parsed_string = ColumnTypeParser._parse_datatype_string(
                                column["raw_data_type"]
                            )
                            parsed_string["name"] = column["name"]
                    else:
                        col_type = ColumnTypeParser.get_column_type(column["type"])
                        if col_type == "ARRAY" and re.match(
                            r"(?:\w*)(?:\()(\w*)(?:.*)", str(column["type"])
                        ):
                            arr_data_type = re.match(
                                r"(?:\w*)(?:[(]*)(\w*)(?:.*)", str(column["type"])
                            ).groups()
                            if isinstance(arr_data_type, list) or isinstance(
                                arr_data_type, tuple
                            ):
                                arr_data_type = ColumnTypeParser.get_column_type(
                                    arr_data_type[0]
                                )
                            data_type_display = column["type"]
                    if parsed_string is None:
                        col_type = ColumnTypeParser.get_column_type(column["type"])

                        col_constraint = self._get_column_constraints(
                            column, pk_columns, unique_columns
                        )
                        if not col_constraint and len(pk_columns) > 1:
                            self.table_constraints = [
                                TableConstraint(
                                    constraintType=ConstraintType.PRIMARY_KEY,
                                    columns=pk_columns,
                                )
                            ]
                        col_data_length = self._check_col_length(
                            col_type, column["type"]
                        )
                        if col_type == "NULL" or col_type is None:
                            col_type = DataType.VARCHAR.name
                            data_type_display = col_type.lower()
                            logger.warning(
                                "Unknown type {} mapped to VARCHAR: {}".format(
                                    repr(column["type"]), column["name"]
                                )
                            )
                        dataTypeDisplay = (
                            f"{data_type_display}"
                            if data_type_display
                            else "{}({})".format(col_type, col_data_length)
                            if col_data_length
                            else col_type
                        )
                        col_data_length = (
                            1 if col_data_length is None else col_data_length
                        )
                        if col_type == "ARRAY":
                            if arr_data_type is None:
                                arr_data_type = DataType.VARCHAR.name
                            dataTypeDisplay = f"array<{arr_data_type}>"

                        om_column = Column(
                            name=column["name"],
                            description=column.get("comment", None),
                            dataType=col_type,
                            dataTypeDisplay=dataTypeDisplay,
                            dataLength=col_data_length,
                            constraint=col_constraint,
                            children=children if children else None,
                            arrayDataType=arr_data_type,
                        )
                    else:
                        parsed_string["dataLength"] = self._check_col_length(
                            parsed_string["dataType"], column["type"]
                        )
                        if column["raw_data_type"] == "array":
                            array_data_type_display = (
                                repr(column["type"])
                                .replace("(", "<")
                                .replace(")", ">")
                                .replace("=", ":")
                                .replace("<>", "")
                                .lower()
                            )
                            parsed_string[
                                "dataTypeDisplay"
                            ] = f"{array_data_type_display}"
                            parsed_string[
                                "arrayDataType"
                            ] = ColumnTypeParser._parse_primitive_datatype_string(
                                array_data_type_display[6:-1]
                            )[
                                "dataType"
                            ]
                        col_dict = Column(**parsed_string)
                        try:
                            if (
                                hasattr(self.config, "enable_policy_tags")
                                and "policy_tags" in column
                                and column["policy_tags"]
                            ):
                                self.metadata.create_primary_tag(
                                    category_name=self.config.tag_category_name,
                                    primary_tag_body=CreateTagRequest(
                                        name=column["policy_tags"],
                                        description="Bigquery Policy Tag",
                                    ),
                                )
                        except APIError:
                            if column["policy_tags"] and self.config.enable_policy_tags:
                                col_dict.tags = [
                                    TagLabel(
                                        tagFQN=f"{self.config.tag_category_name}{FQDN_SEPARATOR}{column['policy_tags']}",
                                        labelType="Automated",
                                        state="Suggested",
                                        source="Tag",
                                    )
                                ]
                        except Exception as err:
                            logger.debug(traceback.print_exc())
                            logger.error(err)

                        om_column = col_dict
                except Exception as err:
                    logger.debug(traceback.print_exc())
                    logger.error(f"{err} : {column}")
                    continue
                table_columns.append(om_column)
            return table_columns
        except Exception as err:
            logger.error(f"{repr(err)}: {table} {err}")
            return None

    @staticmethod
    def _check_col_length(datatype, col_raw_type):
        if datatype and datatype.upper() in {"CHAR", "VARCHAR", "BINARY", "VARBINARY"}:
            try:
                return col_raw_type.length if col_raw_type.length else 1
            except AttributeError:
                return 1

    def parse_raw_data_type(self, raw_data_type):
        return raw_data_type

    def _build_database_state(self, schema_fqdn: str) -> [EntityReference]:
        after = None
        tables = []
        while True:
            table_entities = self.metadata.list_entities(
                entity=Table, after=after, limit=100, params={"database": schema_fqdn}
            )
            tables.extend(table_entities.entities)
            if table_entities.after is None:
                break
            after = table_entities.after
        return tables

    def close(self):
        if self.connection is not None:
            self.connection.close()

    def get_status(self) -> SourceStatus:
        return self.status
