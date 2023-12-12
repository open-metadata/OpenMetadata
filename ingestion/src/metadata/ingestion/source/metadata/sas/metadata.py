import json
import re
import time

import traceback
from metadata.utils.logger import ingestion_logger
from requests.exceptions import HTTPError
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.dashboard import Dashboard
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
from metadata.generated.schema.entity.services.connections.database.customDatabaseConnection import (
    CustomDatabaseConnection,
    CustomDatabaseType,
)
from metadata.generated.schema.entity.services.connections.metadata.sasConnection import (
    SASConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.metadata.sas.client import SASClient
from metadata.ingestion.source.metadata.sas.extension_attr import (
    TABLE_CUSTOM_ATTR,
)
from metadata.utils import fqn
from metadata.ingestion.api.models import Either, StackTraceError
from typing import Iterable, List

logger = ingestion_logger()


class SasSource(Source):
    config: WorkflowSource
    sas_client: SASClient

    def __init__(
            self,
            config: WorkflowSource,
            metadata: OpenMetadata
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.__root__.config

        self.sas_client = get_connection(self.service_connection)
        self.connection_obj = self.sas_client
        self.test_connection()

        self.db_service_name = None
        self.db_name = None
        self.db_schema_name = None
        self.table_fqns = None

        self.dashboard_service_name = None
        self.chart_names = None

        self.report_description = None
        self.add_table_custom_attributes()

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        logger.info(f"running create {config_dict}")
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SASConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SASConnection):
            raise InvalidSourceException(
                f"Expected SASConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        pass

    def _iter(self) -> Iterable[Either[Entity]]:
        self.table_fqns = []
        # create tables from sas dataTables
        table_entities = self.sas_client.list_datatables()
        # list_of_names = []
        if self.sas_client.enable_datatables:
            for table in table_entities:
                # populate the table entity
                yield from self.create_table_entity(table)

                # also create lineage between the table and its source
                if "sourceName" in table["attributes"]:
                    target_table_entity = self.metadata.get_by_name(
                        entity=Table, fqn=self.table_fqns[-1]
                    )
                    source_name = table["attributes"]["sourceName"]
                    sanitized_source_name = re.sub("[@!#$%^&*]", "", source_name)
                    param = f"filter=contains(name, '{sanitized_source_name}')"
                    get_instances_with_param = (
                        self.sas_client.get_instances_with_param(param)
                    )
                    if get_instances_with_param and len(get_instances_with_param) == 1:
                        source_table = get_instances_with_param[0]
                        yield from self.create_table_entity(source_table)
                        source_name = self.table_fqns.pop()
                        source_table_entity = self.metadata.get_by_name(
                            entity=Table, fqn=source_name
                        )
                        yield from self.create_table_lineage(
                            source_table_entity, target_table_entity
                        )
        if self.sas_client.enable_reports:
            report_entities = self.sas_client.list_reports()
            yield from self.create_dashboard_service("SAS_reports")
            for report in report_entities:
                self.table_fqns = []
                self.chart_names = []

                # There isn't a schema for creating report entities, maybe this will work instead
                logger.info(f"Ingesting report: {report}")
                report_id = report["id"]
                report_instance = self.sas_client.get_instance(report_id)  # get detailed report entity
                report_resource = report_instance["resourceId"]  # get report entity instance
                report_resource_id = report_resource[report_resource.rindex("/") + 1:]  # get report id

                # get the tables that are related to the reports
                report_tables = self.get_report_tables(report_resource_id)
                if not self.report_description:
                    self.report_description = None
                else:
                    self.report_description = str(self.report_description)
                for table in report_tables:
                    yield from self.create_table_entity(table)
                    if "sourceName" in table["attributes"] and table["attributes"]["sourceName"] != "":
                        target_table_entity = self.metadata.get_by_name(
                            entity=Table, fqn=self.table_fqns[-1]
                        )
                        source_name = table["attributes"]["sourceName"]
                        param = f"filter=eq(name, '{source_name}')"
                        get_instances_with_param = (
                            self.sas_client.get_instances_with_param(param)
                        )

                        if get_instances_with_param:
                            source_table = get_instances_with_param[0]
                            yield from self.create_table_entity(source_table)
                            source_name = self.table_fqns.pop()
                            source_table_entity = self.metadata.get_by_name(
                                entity=Table, fqn=source_name
                            )
                            yield from self.create_table_lineage(
                                source_table_entity, target_table_entity
                            )
                yield from self.create_report_entity(report)

    def create_database_service(self, service_name):
        # Create a custom database connection config
        # For custom database connections - we will provide client credentials via the connection options
        self.db_service_name = service_name
        db_service = CreateDatabaseServiceRequest(
            name=service_name,
            serviceType=DatabaseServiceType.CustomDatabase,
            connection=DatabaseConnection(
                config=CustomDatabaseConnection(
                    type=CustomDatabaseType.CustomDatabase,
                    sourcePythonClass="metadata.ingestion.source.database.customdatabase.metadata.SASDB",
                )
            ),
        )

        db_service_entity = self.metadata.create_or_update(data=db_service)
        if db_service_entity is None:
            logger.error(f"Create a service with name {service_name}")
        return db_service_entity

    def create_database_alt(self, db):
        # We find the name of the mock DB service
        # Use the link to the parent of the resourceId of the datastore itself, and use its name
        # Then the db service name will be the provider id
        data_store_endpoint = db["resourceId"][1:]
        logger.info(f"{data_store_endpoint}")
        data_store_resource = self.sas_client.get_data_source(
            data_store_endpoint
        )
        db_service = self.create_database_service(data_store_resource["providerId"])

        data_store_parent_endpoint = ""
        for link in data_store_resource["links"]:
            if link["rel"] == "parent":
                data_store_parent_endpoint = link["uri"][1:]
                break

        data_store_parent = self.sas_client.get_data_source(
            data_store_parent_endpoint
        )
        self.db_name = data_store_parent["id"]
        database = CreateDatabaseRequest(
            name=data_store_parent["id"],
            displayName=data_store_parent["name"],
            service=db_service.fullyQualifiedName,
        )
        database_entity = self.metadata.create_or_update(data=database)
        return database_entity

    def create_database(self, db):
        db_service = self.create_database_service(db["providerId"])
        data_store_parent_endpoint = ""
        for link in db["links"]:
            if link["rel"] == "parent":
                data_store_parent_endpoint = link["uri"][1:]
                break
        data_store_parent = self.sas_client.get_data_source(
            data_store_parent_endpoint
        )
        self.db_name = data_store_parent["id"]
        database = CreateDatabaseRequest(
            name=data_store_parent["id"],
            displayName=data_store_parent["name"],
            service=db_service.fullyQualifiedName,
        )
        database_entity = self.metadata.create_or_update(data=database)
        return database_entity

    def create_database_schema(self, table):
        table_detail = self.sas_client.get_instance(table["id"])

        try:
            table_resource_endpoint = table_detail["resourceId"][1:]
            table_resource = self.sas_client.get_resource(
                table_resource_endpoint
            )
            data_store_endpoint = ""
            for link in table_resource["links"]:
                if link["rel"] == "dataSource":
                    data_store_endpoint = link["uri"][1:]
                    break
            data_store = self.sas_client.get_data_source(data_store_endpoint)
            database = self.create_database(data_store)
            self.db_schema_name = data_store["name"]
            db_schema = CreateDatabaseSchemaRequest(
                name=data_store["name"], database=database.fullyQualifiedName
            )
            db_schema_entity = self.metadata.create_or_update(db_schema)
            return db_schema_entity
        except HTTPError as httperror:
            # We find the "database" entity in Information Catalog
            # We first see if the table is a member of the library through the relationships attribute
            # Or we could use views to query the dataStores
            data_store_data_sets = "4b114f6e-1c2a-4060-9184-6809a612f27b"
            data_store_id = None
            for relation in table_detail["relationships"]:
                if relation["definitionId"] != data_store_data_sets:
                    continue
                data_store_id = relation["endpointId"]
                break

            if data_store_id is None:
                # log error since we are exclusively working with tables in dataTables
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
            if datatype in ["char", "varchar", "binary", "varbinary"]:
                parsed_string["dataLength"] = 0
            col = Column(**parsed_string)
            columns.append(col)
        return columns

    def create_table_entity(self, table) -> Iterable[Either[CreateTableRequest]]:
        # Create database + db service
        # Create database schema
        logger.info(f"Ingesting table: {table}")
        table_id = table["id"]
        table_url = self.sas_client.get_information_catalog_link(table_id)
        table_name = table_id

        try:
            # get all the entities related to table id using views
            views_query = {
                "query": "match (t:dataSet)-[r:dataSetDataFields]->(c:dataField) return t,r,c",
                "parameters": {"t": {"id": f"{table_id}"}},
            }
            views_data = json.dumps(views_query)
            views = self.sas_client.get_views(views_data)
            entities = views['entities']

            # find casTable in entities
            table_entity_instance = list(filter(lambda x: "Table" in x["type"], entities))[0]
            logger.info(f"table entity: {table_entity_instance}")

            creation_timestamp = table_entity_instance["creationTimeStamp"]
            table_name = table_entity_instance["name"]
            table_extension = table_entity_instance["attributes"]

            # find the table entity to see if it already exists
            table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=self.db_service_name,
                database_name=self.db_name,
                schema_name=self.db_schema_name,
                table_name=table_name,
            )
            logger.debug(f"table_fqn is {table_fqn}")
            table_entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn, fields=["extension"])
            logger.debug(table_entity)

            # if the table entity already exists, we don't need to create it again
            # only update it when either the sourceUrl or analysisTimeStamp changed
            if table_entity and table_entity.extension:
                self.table_fqns.append(table_fqn)

                last_analyzed_timestamp = table_entity.extension.__root__.get("analysisTimeStamp")
                if (table_url == table_entity.sourceUrl.__root__ and
                        last_analyzed_timestamp == table_extension.get("analysisTimeStamp")):
                    return

            # create tables in database
            database_schema = self.create_database_schema(table_entity_instance)

            # For now many dataField attributes will be cut since currently there is no functionality for adding custom
            # attributes to columns - luckily this functionality exists for tables so dataSet fields will be included
            columns: List[Column] = []
            col_profile_list = []
            # Creating the columns of the table
            for entity in entities:
                if entity["id"] == table_id:
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
                col_profile_dict = dict()
                for attr in attr_map:
                    if attr in col_attributes:
                        if attr == "uniquenessPercent":
                            col_profile_dict[attr_map[attr]] = col_attributes[attr] / 100
                        else:
                            col_profile_dict[attr_map[attr]] = col_attributes[attr]

                if "rowCount" in table_extension:
                    col_profile_dict["valuesCount"] = table_extension["rowCount"]
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
                timestamp = time.time() - 100000
                col_profile_dict["timestamp"] = timestamp
                col_profile_dict["name"] = parsed_string["name"]
                column_profile = ColumnProfile(**col_profile_dict)
                col_profile_list.append(column_profile)
                parsed_string["profile"] = column_profile

                if datatype in ["char", "varchar", "binary", "varbinary"]:
                    if "charsMaxCount" in col_attributes:
                        parsed_string["dataLength"] = col_attributes["charsMaxCount"]
                    else:
                        parsed_string["dataLength"] = 0
                logger.info(f"This is parsed string: {parsed_string}")
                col = Column(**parsed_string)
                columns.append(col)

            if len(columns) == 0:
                # Create columns alternatively
                table_description = ("Table has not been analyzed. "
                                     f"Head over to <a target=\"_blank\" href=\"{table_url}\">SAS Information Catalog"
                                     f"</a> to analyze the table.")
                try:
                    table_resource_id = self.sas_client.get_instance(table_id)["resourceId"][1:]
                    table_resource = self.sas_client.get_resource(table_resource_id)
                    columns = self.create_columns_alt(table_resource)
                except HTTPError as httperror:
                    table_description = (
                            str(httperror) + " This table does not exist in the file path"
                    )
            else:
                table_description = (f"Last analyzed: <b>{table_extension.get('analysisTimeStamp')}</b>. "
                                     f"Visit <a target=\"_blank\" href=\"{table_url}\">SAS Information Catalog</a>"
                                     f" for more information.")

            # Building table extension attr
            for attr in table_extension:
                if type(table_extension[attr]) == bool:
                    table_extension[attr] = str(table_extension[attr])

            custom_attributes = [custom_attribute["name"] for custom_attribute in TABLE_CUSTOM_ATTR]
            extension_attributes = {attr: value for attr, value in table_extension.items() if attr in custom_attributes}

            table_request = CreateTableRequest(
                name=table_name,
                sourceUrl=table_url,
                description=table_description,
                columns=columns,
                databaseSchema=database_schema.fullyQualifiedName,
                extension=extension_attributes
            )

            yield Either(right=table_request)

            logger.info(f"schema: {table_id}, {self.db_service_name}, {self.db_name}, {self.db_schema_name}")

            if not table_entity:
                # find the table entity to see if it already exists
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.db_service_name,
                    database_name=self.db_name,
                    schema_name=self.db_schema_name,
                    table_name=table_name,
                )
                table_entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
                self.table_fqns.append(table_fqn)

            # update the description
            logger.debug(f"Updating description for {table_entity.id.__root__} with {table_description}")
            patch = [{"op": "add", "path": "/description", "value": table_description}]
            self.metadata.client.patch(
                path=f"/tables/{table_entity.id.__root__}", data=json.dumps(patch)
            )

            # update the custom properties
            logger.debug(f"Updating custom properties for {table_entity.id.__root__} with {extension_attributes}")
            patch = [{"op": "add", "path": "/extension", "value": extension_attributes}]
            self.metadata.client.patch(
                path=f"/tables/{table_entity.id.__root__}", data=json.dumps(patch)
            )

            # quit updating table profile if table doesn't exist
            if table_description and "This table does not exist in the file path" in table_description:
                return

            # update table profile
            table_profile_dict = {}
            timestamp = time.time() - 100000
            table_profile_dict["timestamp"] = timestamp
            table_profile_dict["createDateTime"] = creation_timestamp
            table_profile_dict["rowCount"] = 0 if "rowCount" not in table_extension \
                else table_extension["rowCount"]
            table_profile_dict["columnCount"] = 0 if "columnCount" not in table_extension \
                else table_extension["columnCount"]
            table_profile_dict["sizeInByte"] = 0 if "dataSize" not in extension_attributes \
                else table_extension["dataSize"]
            table_profile = TableProfile(**table_profile_dict)

            # create Profiles & Data Quality Column
            table_profile_request = CreateTableProfileRequest(
                tableProfile=table_profile, columnProfile=col_profile_list
            )
            self.metadata.client.put(
                path=f"{self.metadata.get_suffix(Table)}/{table_entity.id.__root__}/tableProfile",
                data=table_profile_request.json(),
            )

        except Exception as exc:
            logger.error(f"table failed to creat: {table}")
            yield Either(
                left=StackTraceError(
                    name=table_name,
                    error=f"Unexpected exception to create table [{table_name}]: {exc}",
                    stack_trace=traceback.format_exc(),
                )
            )

    def add_table_custom_attributes(self):
        string_type = self.metadata.client.get(path="/metadata/types/name/string")["id"]
        integer_type = self.metadata.client.get(path="/metadata/types/name/integer")["id"]
        for attr in TABLE_CUSTOM_ATTR:
            if attr["propertyType"]["id"] == "9fc463a5-84bc-49c8-84f2-acfdcd3dc705":
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
                    stack_trace=traceback.format_exc(),
                )
            )

    def get_report_tables(self, report_id):
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

            except HTTPError as e:
                # append http error to table description if can't be found
                logger.error(f"table_uri: {table_uri}")
                self.report_description.append(str(e))
                name_index = table_uri.rindex("/")
                table_name = table_uri[name_index + 1:]
                param = f"filter=eq(name,'{table_name}')"

            get_instances_with_param = self.sas_client.get_instances_with_param(param)
            if get_instances_with_param and len(get_instances_with_param) == 1:
                table_instance = get_instances_with_param[0]
                table_instances.append(table_instance)
        return table_instances

    def create_lineage_request(self, from_type, in_type, from_entity, to_entity):
        return Either(right=AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=from_entity.id.__root__, type=from_type),
                toEntity=EntityReference(id=to_entity.id.__root__, type=in_type),
            )
        ))

    def create_report_entity(self, report):
        report_id = report["id"]
        report_name = report["name"]
        try:
            report_instance = self.sas_client.get_instance(report_id)
            logger.info(f"{self.config.type}")
            logger.info(f"{self.service_connection}")
            report_resource = report_instance["resourceId"]
            report_url = self.sas_client.get_report_link("report", report_resource)
            report_request = CreateDashboardRequest(
                name=report_id,
                displayName=report_instance["name"],
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
                table_entity = self.metadata.get_by_name(entity=Table, fqn=table)
                table_entities.append(table_entity)
            for entity in table_entities:
                yield self.create_lineage_request(
                    "table", "dashboard", entity, dashboard_entity
                )
        except Exception as exc:
            logger.error(f"report failed to creat: {report}")
            yield Either(
                left=StackTraceError(
                    name=report_name,
                    error=f"Unexpected exception to create report [{report['id']}]: {exc}",
                    stack_trace=traceback.format_exc(),
                )
            )

    def create_in_out_tables(self, table_ids):
        table_entities = []
        for id in table_ids:
            asset = self.sas_client.get_instance(id)
            table_entities.append(asset)
        return table_entities

    def close(self):
        pass

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.metadata, self.connection_obj, self.service_connection)
