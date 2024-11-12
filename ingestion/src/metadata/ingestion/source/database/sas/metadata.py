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
SAS source to extract metadata
"""

# pylint: disable=protected-access,too-many-branches,too-many-locals
import copy
import json
import re
import traceback
from datetime import datetime, timezone
from typing import Any, Iterable, Optional, Tuple

from requests.exceptions import HTTPError

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnProfile,
    Table,
    TableProfile,
)
from metadata.generated.schema.entity.services.connections.dashboard.customDashboardConnection import (
    CustomDashboardConnection,
    CustomDashboardType,
)
from metadata.generated.schema.entity.services.connections.database.sasConnection import (
    SASConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, Timestamp
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.connections.test_connections import (
    raise_test_connection_exception,
)
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.sas.client import SASClient
from metadata.ingestion.source.database.sas.extension_attr import TABLE_CUSTOM_ATTR
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SasSource(
    DatabaseServiceSource
):  # pylint: disable=too-many-instance-attributes,too-many-public-methods
    """
    Implements the necessary methods to extract
    Database metadata from SAS Database Source
    """

    config: WorkflowSource
    sas_client: SASClient

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.service_connection = self.config.serviceConnection.root.config

        self.sas_client = get_connection(self.service_connection)
        self.connection_obj = self.sas_client
        self.test_connection()

        self.db_service_name = self.config.serviceName
        self.db_name = None
        self.db_schema_name = None
        self.table_fqns = []

        self.dashboard_service_name = None
        self.chart_names = None
        self.report_description = None

        self.add_table_custom_attributes()

        self.databases = None
        self.database_schemas = None

        self.timestamp = Timestamp(int(datetime.now().timestamp() * 1000))

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        logger.info(f"running create {config_dict}")
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SASConnection = config.serviceConnection.root.config
        if not isinstance(connection, SASConnection):
            raise InvalidSourceException(
                f"Expected SASConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _iter(self) -> Iterable[Either[Entity]]:
        # For debug purpose (when ingesting locally)
        # yield Either(
        #     right=self.metadata.get_create_service_from_source(
        #         entity=DatabaseService, config=self.config
        #     )
        # )

        # create tables from sas dataSets
        if self.sas_client.enable_datatables:
            for table in self.sas_client.list_assets("datasets"):
                yield from self.create_table_entity(table)

        if self.sas_client.enable_reports:
            yield from self.create_dashboard_service("SAS_reports")
            for report in self.sas_client.list_assets("reports"):
                yield from self.process_report(report)

        if self.sas_client.enable_dataflows:
            yield from self.create_dashboard_service("SAS_dataFlows")
            for data_flow in self.sas_client.list_assets("dataflows"):
                yield from self.process_dataflow(data_flow)

    def process_report(self, report):
        self.table_fqns = []
        logger.info(f"Ingesting report: {report}")
        report_instance = self.sas_client.get_instance(report["id"])
        for table in self.get_report_tables(
            report_instance["resourceId"].split("/")[-1]
        ):
            yield from self.create_table_entity(table)
        yield from self.create_report_entity(report_instance)

    def process_dataflow(self, data_flow):
        """
        Process dataflow assets
        """
        self.table_fqns = []
        logger.info(f"Ingesting dataflow: {data_flow}")
        data_flow_instance = self.sas_client.get_instance(data_flow["id"])
        if not data_flow_instance.get("relationships"):
            logger.warning(f"No relationships are found for {data_flow['name']}")
            return
        input_asset_ids = [
            rel["endpointId"]
            for rel in data_flow_instance["relationships"]
            if rel["definitionId"] == "6179884b-91ec-4236-ad6b-52c7f454f217"
        ]
        output_asset_ids = [
            rel["endpointId"]
            for rel in data_flow_instance["relationships"]
            if rel["definitionId"] == "e1349270-fdbb-4231-9841-79917a307471"
        ]
        for input_asset in (self.sas_client.get_instance(id) for id in input_asset_ids):
            yield from self.create_table_entity(input_asset)
        input_fqns = copy.deepcopy(self.table_fqns)
        self.table_fqns = []
        for output_asset in (
            self.sas_client.get_instance(id) for id in output_asset_ids
        ):
            yield from self.create_table_entity(output_asset)
        yield from self.create_data_flow_entity(
            data_flow_instance, input_fqns, copy.deepcopy(self.table_fqns)
        )

    def create_database_alt(self, db):
        """
        Find the name of the mock DB service
        Use the link to the parent of the resourceId of the datastore itself, and use its name
        Then the db service name will be the provider id
        """
        data_store_endpoint = db["resourceId"][1:]
        logger.info(f"{data_store_endpoint}")
        data_store_resource = self.sas_client.get_data_source(data_store_endpoint)

        data_store_parent_endpoint = ""
        for link in data_store_resource["links"]:
            if link["rel"] == "parent":
                data_store_parent_endpoint = link["uri"][1:]
                break

        data_store_parent = self.sas_client.get_data_source(data_store_parent_endpoint)
        self.db_name = data_store_parent["id"]
        database = CreateDatabaseRequest(
            name=data_store_parent["id"],
            displayName=data_store_parent["name"],
            service=self.db_service_name,
        )
        database_entity = self.metadata.create_or_update(data=database)
        return database_entity

    def create_database_schema(self, table):
        """
        create database schema
        """
        try:
            context = table["resourceId"].split("/")[3]

            provider = context.split("~")[0]
            self.db_name = provider + "." + context.split("~")[2]
            self.db_schema_name = context.split("~")[4]

            database = CreateDatabaseRequest(
                name=self.db_name,
                displayName=self.db_name,
                service=self.config.serviceName,
            )
            database = self.metadata.create_or_update(data=database)

            db_schema = CreateDatabaseSchemaRequest(
                name=self.db_schema_name, database=database.fullyQualifiedName
            )
            db_schema_entity = self.metadata.create_or_update(db_schema)
            return db_schema_entity

        except HTTPError as _:
            # Find the "database" entity in Information Catalog
            # First see if the table is a member of the library through the relationships attribute
            # Or we could use views to query the dataStores
            data_store_data_sets = "4b114f6e-1c2a-4060-9184-6809a612f27b"
            data_store_id = None
            for relation in table["relationships"]:
                if relation["definitionId"] != data_store_data_sets:
                    continue
                data_store_id = relation["endpointId"]
                break

            if data_store_id is None:
                # log error due to exclude amount of work with tables in dataTables
                logger.error("Data store id should not be none")
                return None

            data_store = self.sas_client.get_instance(data_store_id)
            database = self.create_database_alt(data_store)
            self.db_schema_name = data_store["name"]
            db_schema = CreateDatabaseSchemaRequest(
                name=data_store["name"], database=database.fullyQualifiedName
            )
            db_schema_entity = self.metadata.create_or_update(db_schema)
            return db_schema_entity

    def create_columns_alt(self, table):
        """
        Create columns by loading the table when they are not already loaded
        """
        columns_endpoint = ""
        load_endpoint = ""
        for link in table["links"]:
            if link["rel"] == "columns":
                columns_endpoint = link["uri"][1:] + "?limit=1000"
            if link["rel"] == "load":
                load_endpoint = link["uri"][1:]
        if load_endpoint:
            self.sas_client.load_table(load_endpoint)
        columns_resource = self.sas_client.get_resource(columns_endpoint)
        columns = []
        for item in columns_resource["items"]:
            datatype = item["type"]
            if datatype == "num":
                datatype = "numeric"
            parsed_string = ColumnTypeParser._parse_datatype_string(datatype)
            col_name = item["name"]
            parsed_string["name"] = col_name.replace('"', "'")
            parsed_string["ordinalPosition"] = item["index"]
            if datatype.lower() in ["char", "varchar", "binary", "varbinary"]:
                parsed_string["dataLength"] = 0
            col = Column(**parsed_string)
            columns.append(col)
        return columns

    def get_entities_using_view(self, table_id):
        """
        Get all the col_entity_instances related to table using views
        """
        views_query = {
            "query": "match (t:dataSet)-[r:dataSetDataFields]->(c:dataField) return t,r,c",
            "parameters": {"t": {"id": f"{table_id}"}},
        }
        views_data = json.dumps(views_query)
        views = self.sas_client.get_views(views_data)
        if not views.get("entities"):  # if the resource is not a table
            return None, None

        col_entity_instances = views["entities"]
        # find datatables in col_entity_instances
        table_entity_instance = list(
            filter(lambda x: "Table" in x["type"], col_entity_instances)
        )
        if len(table_entity_instance) == 1:
            table_entity_instance = table_entity_instance[0]

        return col_entity_instances, table_entity_instance

    def get_table_fqn(self, table_name):
        return fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.db_service_name,
            database_name=self.db_name,
            schema_name=self.db_schema_name,
            table_name=table_name,
        )

    def create_columns_and_profiles(self, entities, table_entity_instance):
        """
        Create columns and profiles
        """
        columns = []
        col_profile_list = []
        for entity in entities:
            if entity["id"] == table_entity_instance["id"]:
                continue
            if "Column" not in entity["type"]:
                continue
            col_attributes = entity["attributes"]
            if "casDataType" in col_attributes:
                datatype = col_attributes["casDataType"]
            else:
                datatype = col_attributes["dataType"]
            if datatype == "num":
                datatype = "numeric"
            parsed_string = ColumnTypeParser._parse_datatype_string(datatype)
            col_name = entity["name"]
            parsed_string["name"] = col_name.replace('"', "'")
            parsed_string["ordinalPosition"] = col_attributes["ordinalPosition"]
            # Column profile to be added
            attr_map = {
                "mean": "mean",
                "median": "sum",
                "min": "min",
                "max": "max",
                "standardDeviation": "stddev",
                "missingCount": "nullCount",
                "completenessPercent": "valuesPercentage",
                "uniquenessPercent": "uniqueProportion",
                "cardinalityCount": "distinctCount",
                "skewness": "nonParametricSkew",
                "quantiles25": "firstQuartile",
                "quantiles50": "median",
                "quantiles75": "thirdQuartile",
                "mismatchedCount": "missingCount",
                "charsMinCount": "minLength",
                "charsMaxCount": "maxLength",
            }
            col_profile_dict = {}
            for attr, mapped_attr in attr_map.items():
                if attr in col_attributes:
                    if attr == "uniquenessPercent":
                        col_profile_dict[mapped_attr] = col_attributes[attr] / 100
                    else:
                        col_profile_dict[mapped_attr] = col_attributes[attr]
            if "rowCount" in table_entity_instance["attributes"]:
                col_profile_dict["valuesCount"] = table_entity_instance["attributes"][
                    "rowCount"
                ]
            if "valuesCount" in col_profile_dict:
                if "distinctCount" in col_profile_dict:
                    col_profile_dict["distinctProportion"] = (
                        col_profile_dict["distinctCount"]
                        / col_profile_dict["valuesCount"]
                    )
                    col_profile_dict["uniqueCount"] = col_profile_dict["distinctCount"]
                if "nullCount" in col_profile_dict:
                    col_profile_dict["nullProportion"] = (
                        col_profile_dict["nullCount"] / col_profile_dict["valuesCount"]
                    )
                if "missingCount" in col_profile_dict:
                    col_profile_dict["missingPercentage"] = (
                        col_profile_dict["missingCount"]
                        / col_profile_dict["valuesCount"]
                    )
                    col_profile_dict["validCount"] = (
                        col_profile_dict["valuesCount"]
                        - col_profile_dict["missingCount"]
                    )
            col_profile_dict["timestamp"] = self.timestamp
            col_profile_dict["name"] = parsed_string["name"]
            column_profile = ColumnProfile(**col_profile_dict)
            col_profile_list.append(column_profile)
            parsed_string["profile"] = column_profile
            if datatype.lower() in ["char", "varchar", "binary", "varbinary"]:
                if "charsMaxCount" in col_attributes:
                    parsed_string["dataLength"] = col_attributes["charsMaxCount"]
                else:
                    parsed_string["dataLength"] = 0
            logger.info(f"This is parsed string: {parsed_string}")
            col = Column(**parsed_string)
            columns.append(col)
        return columns, col_profile_list

    def create_table_entity(self, table) -> Iterable[Either[CreateTableRequest]]:
        # pylint: disable=global-variable-undefined
        """
        Create database + db service & Create database schema
        """
        logger.info(f"Ingesting table: {table}")
        global table_entity
        global table_fqn

        table_entity, table_fqn = None, None

        try:
            table_url = self.sas_client.get_information_catalog_link(table["id"])
            col_entity_instances, table_entity_instance = self.get_entities_using_view(
                table["id"]
            )
            logger.info(f"table entity: {table_entity_instance}")

            if not table_entity_instance:
                return

            table_name = table_entity_instance["name"]
            table_extension = table_entity_instance["attributes"]

            # create tables in database
            database_schema = self.create_database_schema(table_entity_instance)

            # find the table entity to see if it already exists
            table_fqn = self.get_table_fqn(table_name)
            table_entity = self.metadata.get_by_name(
                entity=Table, fqn=table_fqn, fields=["extension"]
            )

            logger.debug(table_entity)

            # if the table entity already exists, we don't need to create it again
            # only update it when either the sourceUrl or analysisTimeStamp changed
            if not table_entity or (
                table_url != table_entity.sourceUrl.root
                or table_entity.extension.root.get("analysisTimeStamp")
                != table_extension.get("analysisTimeStamp")
            ):
                # create the columns of the table
                columns, col_profile_list = self.create_columns_and_profiles(
                    col_entity_instances, table_entity_instance
                )

                # set description based on col counts
                if len(columns) == 0:
                    table_description = (
                        "Table has not been analyzed. "
                        f'Head over to <a target="_blank" href="{table_url}">'
                        f"SAS Information Catalog</a> to analyze the table."
                    )
                    try:
                        # Create columns alternatively
                        table_resource = self.sas_client.get_resource(
                            table_entity_instance["resourceId"][1:]
                        )
                        columns = self.create_columns_alt(table_resource)
                    except HTTPError as http_err:
                        table_description = f"{str(http_err)} This table does not exist in the file path"
                else:
                    table_description = (
                        f"Last analyzed: <b>{table_extension.get('analysisTimeStamp')}</b>. "
                        f'Visit <a target="_blank" href="{table_url}">SAS Information Catalog</a>'
                        f" for more information."
                    )

                # build table extension attr
                for attr in table_extension:
                    if isinstance(table_extension[attr], bool):
                        table_extension[attr] = str(table_extension[attr])

                custom_attributes = [
                    custom_attribute["name"] for custom_attribute in TABLE_CUSTOM_ATTR
                ]
                extension_attributes = {
                    attr: value
                    for attr, value in table_extension.items()
                    if attr in custom_attributes
                }

                table_request = CreateTableRequest(
                    name=table_name,
                    sourceUrl=table_url,
                    description=table_description,
                    columns=columns,
                    databaseSchema=database_schema.fullyQualifiedName,
                    extension=extension_attributes,
                )

                yield Either(right=table_request)

                # find the table entity to see if it already exists
                yield from self.create_lineage_table_source(table_extension, table_name)

                table_entity = self.metadata.get_by_name(
                    entity=Table, fqn=self.get_table_fqn(table_name)
                )
                # update the description
                logger.debug(
                    f"Updating description for {table_entity.id.root} with {table_description}"
                )
                self.metadata.client.patch(
                    path=f"/tables/{table_entity.id.root}",
                    data=json.dumps(
                        [
                            {
                                "op": "add",
                                "path": "/description",
                                "value": table_description,
                            }
                        ]
                    ),
                )

                # update the custom properties
                logger.debug(
                    f"Updating custom properties for {table_entity.id.root} with {extension_attributes}"
                )
                self.metadata.client.patch(
                    path=f"/tables/{table_entity.id.root}",
                    data=json.dumps(
                        [
                            {
                                "op": "add",
                                "path": "/extension",
                                "value": extension_attributes,
                            }
                        ]
                    ),
                )

                # quit updating table profile if table doesn't exist
                if (
                    table_description
                    and "This table does not exist in the file path"
                    in table_description
                ):
                    return

                raw_create_date: Optional[datetime] = table_entity_instance.get(
                    "creationTimeStamp"
                )
                if raw_create_date:
                    raw_create_date = raw_create_date.replace(tzinfo=timezone.utc)

                # create Profiles & Data Quality Column
                table_profile_request = CreateTableProfileRequest(
                    tableProfile=TableProfile(
                        timestamp=self.timestamp,
                        createDateTime=raw_create_date,
                        rowCount=int(table_extension.get("rowCount", 0)),
                        columnCount=int(table_extension.get("columnCount", 0)),
                        sizeInByte=int(table_extension.get("dataSize", 0)),
                    ),
                    columnProfile=col_profile_list,
                )
                self.metadata.client.put(
                    path=f"{self.metadata.get_suffix(Table)}/{table_entity.id.root}/tableProfile",
                    data=table_profile_request.model_dump_json(),
                )

        except Exception as exc:
            logger.error(f"table failed to create: {table}")
            yield Either(
                left=StackTraceError(
                    name=table_name,
                    error=f"Unexpected exception to create table [{table_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
        finally:
            if table_entity:
                self.table_fqns.append(table_fqn)

    def create_lineage_table_source(self, table_extension, table_name):
        """
        create lineage between the table and its source
        """
        if "sourceName" in table_extension and table_extension["sourceName"] != "":
            source_name = table_extension["sourceName"]
            # see if the source table already exists
            source_table_fqn = self.get_table_fqn(source_name)
            logger.debug(f"source_table_fqn for sourceTable is {source_table_fqn}")
            source_table_entity = self.metadata.get_by_name(
                entity=Table, fqn=source_table_fqn
            )
            target_table_entity = self.metadata.get_by_name(
                entity=Table, fqn=self.get_table_fqn(table_name)
            )

            # process to create lineage if source table doesn't exist
            if not source_table_entity:
                sanitized_source_name = re.sub("[@!#$%^&*]", "", source_name)
                param = f"filter=contains(name, '{sanitized_source_name}')"
                get_instances_with_param = self.sas_client.get_instances_with_param(
                    param
                )
                if get_instances_with_param and len(get_instances_with_param) == 1:
                    source_table = get_instances_with_param[0]
                    yield from self.create_table_entity(source_table)

            source_table_entity = self.metadata.get_by_name(
                entity=Table, fqn=source_table_fqn
            )

            if source_table_entity:
                yield from self.create_table_lineage(
                    source_table_entity, target_table_entity
                )

    def add_table_custom_attributes(self):
        """
        Adding custom attribute from extension_attr.py
        """
        string_type = self.metadata.client.get(path="/metadata/types/name/string")["id"]
        integer_type = self.metadata.client.get(path="/metadata/types/name/integer")[
            "id"
        ]
        for attr in TABLE_CUSTOM_ATTR:
            if attr["propertyType"]["id"] == "STRING_TYPE":
                attr["propertyType"]["id"] = string_type
            else:
                attr["propertyType"]["id"] = integer_type
        table_type = self.metadata.client.get(path="/metadata/types/name/table")
        table_id = table_type["id"]
        for attr in TABLE_CUSTOM_ATTR:
            self.metadata.client.put(
                path=f"/metadata/types/{table_id}", data=json.dumps(attr)
            )

    def create_table_lineage(self, from_entity, to_entity):
        yield self.create_lineage_request("table", "table", from_entity, to_entity)

    def create_dashboard_service(self, dashboard_service_name):
        self.dashboard_service_name = dashboard_service_name

        try:
            dashboard_service_request = CreateDashboardServiceRequest(
                name=dashboard_service_name,
                serviceType=DashboardServiceType.CustomDashboard,
                connection=DashboardConnection(
                    config=CustomDashboardConnection(
                        type=CustomDashboardType.CustomDashboard,
                        sourcePythonClass="metadata.ingestion.source.database.customdatabase.metadata.SASDB",
                    )
                ),
            )
            yield Either(right=dashboard_service_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=dashboard_service_name,
                    error=f"Unexpected exception to create dashboard service for [{dashboard_service_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_report_tables(self, report_id):
        """
        Get datasets related to the report
        """
        report_tables = self.sas_client.get_report_relationship(report_id)
        table_instances = []
        self.report_description = []
        # loop through each relatedResourceUri from relationships
        for table in report_tables:
            table_uri = table["relatedResourceUri"][1:]
            try:
                # load the table if it can be found
                table_resource = self.sas_client.get_resource(table_uri)
                table_data_resource = table_resource["tableReference"]["tableUri"]
                param = f"filter=eq(resourceId,'{table_data_resource}')"
                if "state" in table_resource and table_resource["state"] == "unloaded":
                    self.sas_client.load_table(table_uri + "/state?value=loaded")

            except HTTPError as exc:
                # append http error to table description if it can't be found
                logger.error(f"table_uri: {table_uri}")
                self.report_description.append(str(exc))
                name_index = table_uri.rindex("/")
                table_name = table_uri[name_index + 1 :]
                param = f"filter=eq(name,'{table_name}')"

            get_instances_with_param = self.sas_client.get_instances_with_param(param)
            if get_instances_with_param and len(get_instances_with_param) == 1:
                table_instance = get_instances_with_param[0]
                table_instances.append(table_instance)
        return table_instances

    def create_lineage_request(self, from_type, in_type, from_entity, to_entity):
        return Either(
            right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=from_entity.id.root, type=from_type),
                    toEntity=EntityReference(id=to_entity.id.root, type=in_type),
                )
            )
        )

    def create_report_entity(self, report):
        """
        Create report entity and its corresponding lineage to the datasets
        """
        report_id = report["id"]
        report_name = report["name"]
        try:
            report_resource = report["resourceId"]
            report_url = self.sas_client.get_report_link("report", report_resource)
            self.report_description = (
                str(self.report_description) if self.report_description else None
            )
            report_request = CreateDashboardRequest(
                name=report_id,
                displayName=report_name,
                sourceUrl=report_url,
                charts=self.chart_names,
                service=self.dashboard_service_name,
                description=self.report_description,
            )
            yield Either(right=report_request)

            dashboard_fqn = fqn.build(
                self.metadata,
                entity_type=Dashboard,
                service_name=self.dashboard_service_name,
                dashboard_name=report_id,
            )

            dashboard_entity = self.metadata.get_by_name(
                entity=Dashboard, fqn=dashboard_fqn
            )
            table_entities = []
            for table in self.table_fqns:
                entity_instance = self.metadata.get_by_name(entity=Table, fqn=table)
                table_entities.append(entity_instance)
            for entity in table_entities:
                yield self.create_lineage_request(
                    "table", "dashboard", entity, dashboard_entity
                )
        except Exception as exc:
            logger.error(f"report failed to create: {report}")
            yield Either(
                left=StackTraceError(
                    name=report_name,
                    error=f"Unexpected exception to create report [{report['id']}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def create_data_flow_entity(self, data_flow, input_fqns, output_fqns):
        """
        Create data flow and its corresponding lineage with the input & output table
        """
        data_flow_id = data_flow["id"]
        data_flow_resource = data_flow["resourceId"]

        try:
            data_flow_url = self.sas_client.get_report_link(
                "dataFlow", data_flow_resource
            )
            data_flow_request = CreateDashboardRequest(
                name=data_flow_id,
                displayName=data_flow["name"],
                service=self.dashboard_service_name,
                sourceUrl=data_flow_url,
            )
            yield Either(right=data_flow_request)

            dashboard_fqn = fqn.build(
                self.metadata,
                entity_type=Dashboard,
                service_name=self.dashboard_service_name,
                dashboard_name=data_flow_id,
            )

            dashboard_entity = self.metadata.get_by_name(
                entity=Dashboard, fqn=dashboard_fqn
            )

            input_entities = [
                self.metadata.get_by_name(entity=Table, fqn=input_entity)
                for input_entity in input_fqns
            ]
            output_entities = [
                self.metadata.get_by_name(entity=Table, fqn=output_entity)
                for output_entity in output_fqns
            ]

            for entity in input_entities:
                yield self.create_lineage_request(
                    "table", "dashboard", entity, dashboard_entity
                )
            for entity in output_entities:
                yield self.create_lineage_request(
                    "dashboard", "table", dashboard_entity, entity
                )
        except Exception as exc:
            logger.error(f"dataflow failed to create: {data_flow}")
            yield Either(
                left=StackTraceError(
                    name=data_flow_id,
                    error=f"Unexpected exception to create data flow [{data_flow_id}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_database_names(self) -> Iterable[str]:
        for database in self.databases:
            yield database

    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        yield Either(
            right=CreateDatabaseRequest(
                name=EntityName(database_name),
                service=self.context.get().database_service,
            )
        )

    def get_database_schema_names(self) -> Iterable[Tuple[str, str]]:
        for database, database_schemas in self.database_schemas.items():
            for database_schema in database_schemas:
                yield database, database_schema

    def yield_database_schema(
        self, schema_name: Tuple[str, str]
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        yield Either(
            right=CreateDatabaseSchemaRequest(
                name=schema_name[1],
                database=fqn.build(
                    metadata=self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=schema_name[0],
                ),
            )
        )

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """No tags to send"""

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, list]]]:
        """Not implemented"""

    def yield_table(
        self, table_name_and_type: Tuple[str, list]
    ) -> Iterable[Either[Entity]]:
        """Not implemented"""

    def get_stored_procedures(self) -> Iterable[Any]:
        """Not implemented"""

    def yield_stored_procedure(
        self, stored_procedure: Any
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Not implemented"""

    def close(self) -> None:
        pass

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        result = test_connection_fn(
            self.metadata, self.connection_obj, self.service_connection
        )
        raise_test_connection_exception(result)
