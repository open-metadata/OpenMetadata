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
Doris view lineage: the `internal` catalog in the names of view and materialized view definitions, and
the view DDL Doris prints that the MySQL dialect cannot parse.

The DDL below is what SHOW CREATE MATERIALIZED VIEW and SHOW CREATE VIEW print on Doris master, with
the PROPERTIES list shortened; Doris 4.1 prints the column list without backquotes.
"""

import pickle
from fnmatch import fnmatchcase
from urllib.parse import parse_qs, unquote, urlsplit
from uuid import uuid4

import pytest

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.table_binding import TableLookup, alias_resolution_cache, load_table_binding_resolution
from metadata.generated.schema.entity.data.table import Column, DataType, Table, TableType
from metadata.generated.schema.entity.services.connections.database.dorisConnection import DorisConnection
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import QueryParserType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import database_service_type_cache, search_cache, search_table_entities
from metadata.ingestion.models.ometa_lineage import OMetaFQNLineageRequest
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.doris import lineage_utils
from metadata.ingestion.source.database.doris.lineage import DorisLineageSource
from metadata.ingestion.source.database.doris.lineage_utils import get_view_lineage_parser
from metadata.ingestion.source.database.doris.resolution import internal_database_cache
from metadata.ingestion.source.models import TableView
from metadata.utils.db_utils import get_view_lineage

SERVICE = "doris_svc"

PROPERTIES = """PROPERTIES (
"replication_allocation" = "tag.location.default: 1",
"storage_format" = "V2",
"light_schema_change" = "true"
)"""

REGION_TOTALS = f"""CREATE MATERIALIZED VIEW region_totals
(`region` comment 'sales region',`manager`,`total` comment 'sum of amount')
BUILD DEFERRED REFRESH AUTO ON SCHEDULE EVERY 1 DAY STARTS "2030-01-01 00:00:00"
DUPLICATE KEY(`region`)
COMMENT 'daily totals'
DISTRIBUTED BY HASH(`region`) BUCKETS 2
{PROPERTIES}
AS SELECT `internal`.`sales`.`o`.`region`, `internal`.`sales`.`r`.`manager`, SUM(`internal`.`sales`.`o`.`amount`) AS `total`
FROM `internal`.`sales`.`orders` `o` JOIN `internal`.`sales`.`regions` `r` ON `internal`.`sales`.`o`.`region` = `internal`.`sales`.`r`.`region` GROUP BY `internal`.`sales`.`o`.`region`, `internal`.`sales`.`r`.`manager`"""

MONTHLY_ORDERS = f"""CREATE MATERIALIZED VIEW monthly_orders
(`dt`,`region`,`amount`)
BUILD IMMEDIATE REFRESH AUTO ON COMMIT
DUPLICATE KEY(`dt`, `region`)
PARTITION BY (date_trunc(`dt`, 'month'))
DISTRIBUTED BY RANDOM BUCKETS 1
{PROPERTIES}
AS SELECT `internal`.`sales`.`orders`.`dt`, `internal`.`sales`.`orders`.`region`, `internal`.`sales`.`orders`.`amount` FROM `internal`.`sales`.`orders`"""

REGION_PAYMENTS = f"""CREATE MATERIALIZED VIEW region_payments
(`region`,`total`,`cnt`)
BUILD DEFERRED REFRESH INCREMENTAL FALLBACK ON MANUAL
KEY(`region`)
DISTRIBUTED BY HASH(`region`) BUCKETS 1
{PROPERTIES}
AS SELECT `internal`.`sales`.`payments`.`region`, SUM(`internal`.`sales`.`payments`.`amount`) AS `total`, COUNT(*) AS `cnt` FROM `internal`.`sales`.`payments` GROUP BY `internal`.`sales`.`payments`.`region`"""

EAST_AND_REGIONS = f"""CREATE MATERIALIZED VIEW east_and_regions
(`region`,`amount`)
BUILD IMMEDIATE REFRESH COMPLETE ON MANUAL
DUPLICATE KEY(`region`)
DISTRIBUTED BY RANDOM BUCKETS 1
{PROPERTIES}
AS WITH `east` AS (SELECT `internal`.`sales`.`orders`.`region`, `internal`.`sales`.`orders`.`amount` FROM `internal`.`sales`.`orders` WHERE `internal`.`sales`.`orders`.`region` = 'east')
SELECT `east`.`region`, `east`.`amount` FROM east UNION ALL SELECT `internal`.`sales`.`regions`.`region`, 0 AS `amount` FROM `internal`.`sales`.`regions`"""

# The name is printed without quotes, so the DDL is no valid statement
ORDER_IDS = f"""CREATE MATERIALIZED VIEW order-ids
(`id`,`dt`)
BUILD IMMEDIATE REFRESH COMPLETE ON MANUAL
DUPLICATE KEY(`id`, `dt`)
DISTRIBUTED BY RANDOM BUCKETS 1
{PROPERTIES}
AS SELECT `internal`.`sales`.`orders`.`id`, `internal`.`sales`.`orders`.`dt` FROM `internal`.`sales`.`orders`"""

REGION_TOTALS_VIEW = """CREATE VIEW `region_totals_view`
(`region` comment 'sales region',`manager`,`total` comment 'sum of amount')
 COMMENT 'region totals' AS SELECT `internal`.`sales`.`o`.`region` AS `region`, `internal`.`sales`.`r`.`manager` AS `manager`, SUM(`internal`.`sales`.`o`.`amount`) AS `total`
FROM `internal`.`sales`.`orders` `o` JOIN `internal`.`sales`.`regions` `r` ON `internal`.`sales`.`o`.`region` = `internal`.`sales`.`r`.`region` GROUP BY `internal`.`sales`.`o`.`region`, `internal`.`sales`.`r`.`manager`;"""

EAST_ORDERS = """CREATE VIEW `east_orders`
(`id`,`dt`,`amount`)
 AS SELECT `internal`.`sales`.`orders`.`id`, `internal`.`sales`.`orders`.`dt`, `internal`.`sales`.`orders`.`amount` FROM `internal`.`sales`.`orders` WHERE `internal`.`sales`.`orders`.`region` = 'east';"""


def lineage_of(parser: LineageParser) -> tuple[list[str], list[str], list[str]]:
    return (
        sorted(str(table) for table in parser.source_tables),
        sorted(str(table) for table in parser.target_tables),
        sorted("->".join(map(str, path)) for path in parser.column_lineage),
    )


@pytest.mark.parametrize(
    ("ddl", "target", "sources", "columns"),
    [
        pytest.param(
            REGION_TOTALS,
            "<default>.region_totals",
            ["internal.sales.orders", "internal.sales.regions"],
            [
                "internal.sales.orders.amount-><default>.region_totals.total",
                "internal.sales.orders.region-><default>.region_totals.region",
                "internal.sales.regions.manager-><default>.region_totals.manager",
            ],
            id="schedule-comments-join",
        ),
        pytest.param(
            MONTHLY_ORDERS,
            "<default>.monthly_orders",
            ["internal.sales.orders"],
            [
                "internal.sales.orders.amount-><default>.monthly_orders.amount",
                "internal.sales.orders.dt-><default>.monthly_orders.dt",
                "internal.sales.orders.region-><default>.monthly_orders.region",
            ],
            id="commit-partitioned",
        ),
        pytest.param(
            REGION_PAYMENTS,
            "<default>.region_payments",
            ["internal.sales.payments"],
            [
                "internal.sales.payments.*-><default>.region_payments.cnt",
                "internal.sales.payments.amount-><default>.region_payments.total",
                "internal.sales.payments.region-><default>.region_payments.region",
            ],
            id="incremental-fallback",
        ),
        pytest.param(
            EAST_AND_REGIONS,
            "<default>.east_and_regions",
            ["internal.sales.orders", "internal.sales.regions"],
            [
                "internal.sales.orders.amount-><default>.east_and_regions.amount",
                "internal.sales.orders.region-><default>.east_and_regions.region",
                "internal.sales.regions.region-><default>.east_and_regions.region",
            ],
            id="cte-union",
        ),
        pytest.param(
            MONTHLY_ORDERS.replace("(`dt`,`region`,`amount`)", "(dt,region,amount)"),
            "<default>.monthly_orders",
            ["internal.sales.orders"],
            [
                "internal.sales.orders.amount-><default>.monthly_orders.amount",
                "internal.sales.orders.dt-><default>.monthly_orders.dt",
                "internal.sales.orders.region-><default>.monthly_orders.region",
            ],
            id="doris-4.1-column-list",
        ),
        pytest.param(
            REGION_TOTALS.replace(
                "(`region` comment 'sales region',`manager`,`total` comment 'sum of amount')",
                "(region comment 'sales region',manager,total comment 'sum of amount')",
            ),
            "<default>.region_totals",
            ["internal.sales.orders", "internal.sales.regions"],
            [
                "internal.sales.orders.amount-><default>.region_totals.total",
                "internal.sales.orders.region-><default>.region_totals.region",
                "internal.sales.regions.manager-><default>.region_totals.manager",
            ],
            id="doris-4.1-column-comments",
        ),
        pytest.param(
            REGION_TOTALS_VIEW,
            "<default>.region_totals_view",
            ["internal.sales.orders", "internal.sales.regions"],
            [
                "internal.sales.orders.amount-><default>.region_totals_view.total",
                "internal.sales.orders.region-><default>.region_totals_view.region",
                "internal.sales.regions.manager-><default>.region_totals_view.manager",
            ],
            id="view-column-comments",
        ),
    ],
)
def test_doris_view_ddl_is_parsed_as_the_view_it_defines(ddl, target, sources, columns):
    parser = get_view_lineage_parser(ddl, Dialect.MYSQL, timeout_seconds=10)
    assert lineage_of(parser) == (sources, [target], columns)
    original = LineageParser(ddl, Dialect.MYSQL, timeout_seconds=10)
    assert lineage_of(original) != lineage_of(parser)
    # Lineage consumers see the definition Doris printed
    assert parser.query == ddl
    assert parser.query_hash == original.query_hash
    assert parser.masked_query == original.masked_query


@pytest.mark.parametrize(
    "query",
    [
        pytest.param(EAST_ORDERS, id="view-without-comments"),
        pytest.param(ORDER_IDS, id="unquoted-name"),
        pytest.param(ORDER_IDS.replace("order-ids", "select"), id="unquoted-reserved-name"),
        pytest.param("SELECT `id` FROM `internal`.`sales`.`orders`", id="query"),
        pytest.param("CREATE TABLE `orders_copy` AS SELECT `id` FROM `internal`.`sales`.`orders`", id="ctas"),
    ],
)
def test_other_definitions_are_parsed_as_they_are(query):
    expected = LineageParser(query, Dialect.MYSQL, timeout_seconds=10)
    parser = get_view_lineage_parser(query, Dialect.MYSQL, timeout_seconds=10)
    assert lineage_of(parser) == lineage_of(expected)
    assert parser.query == expected.query
    assert parser.query_hash == expected.query_hash
    assert parser.masked_query == expected.masked_query


def test_ddl_sqlglot_cannot_read_is_parsed_as_it_is(monkeypatch):
    def fail(*_args, **_kwargs):
        raise ValueError("unreadable")

    monkeypatch.setattr(lineage_utils.sqlglot, "parse_one", fail)
    expected = LineageParser(REGION_TOTALS, Dialect.MYSQL, timeout_seconds=10)
    parser = get_view_lineage_parser(REGION_TOTALS, Dialect.MYSQL, timeout_seconds=10)
    assert lineage_of(parser) == lineage_of(expected)
    assert parser.masked_query == expected.masked_query


def test_doris_lineage_source_uses_the_picklable_parser_factory():
    factory = DorisLineageSource.get_view_lineage_parser_factory(object())
    assert factory is get_view_lineage_parser
    assert pickle.loads(pickle.dumps(factory)) is get_view_lineage_parser


class Transport:
    """The REST calls of table resolution, answered from the given entities"""

    def __init__(self, *entities):
        self.entities = {model_str(entity.fullyQualifiedName): entity for entity in entities}
        self.error: APIError | None = None
        self.paths: list[str] = []

    def get(self, path):
        parsed = urlsplit(path)
        params = parse_qs(parsed.query)
        self.paths.append(unquote(parsed.path))
        if parsed.path.startswith("/services/") and self.error:
            raise self.error
        if parsed.path == "/search/fieldQuery":
            kind = DatabaseService if params["index"] == ["database_service_search_index"] else Table
            pattern = params["fieldValue"][0].lower()
            names = [
                name
                for name, entity in self.entities.items()
                if isinstance(entity, kind) and fnmatchcase(name.lower(), pattern)
            ]
            return {
                "hits": {
                    "total": {"value": len(names), "relation": "eq"},
                    "hits": [{"_source": {"fullyQualifiedName": name}} for name in names],
                }
            }
        entity = self.entities.get(unquote(parsed.path.split("/name/", 1)[1]))
        if entity is None:
            raise APIError({"code": 404, "message": "not found"})
        return entity.model_dump(mode="json")

    def close(self):
        pass


def doris_service(database_name: str | None = None) -> DatabaseService:
    return DatabaseService(
        id=uuid4(),
        name=SERVICE,
        fullyQualifiedName=SERVICE,
        serviceType=DatabaseServiceType.Doris,
        connection=DatabaseConnection(
            config=DorisConnection(hostPort="doris:9030", username="om", databaseName=database_name)
        ),
    )


def doris_table(fqn: str, columns: tuple[str, ...] = (), table_type: TableType = TableType.Regular) -> Table:
    _, database, schema, name = fqn.split(".")
    return Table(
        id=uuid4(),
        name=name,
        fullyQualifiedName=fqn,
        tableType=table_type,
        serviceType=DatabaseServiceType.Doris,
        columns=[
            Column(name=column, dataType=DataType.VARCHAR, fullyQualifiedName=f"{fqn}.{column}") for column in columns
        ],
        service=EntityReference(id=uuid4(), type="databaseService", name=SERVICE),
        database=EntityReference(id=uuid4(), type="database", name=database),
        databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name=schema),
    )


def connect(*entities) -> tuple[OpenMetadata, Transport]:
    metadata = OpenMetadata(
        OpenMetadataConnection(
            hostPort="http://localhost:8585/api", authProvider="openmetadata", securityConfig={"jwtToken": "test-token"}
        )
    )
    transport = Transport(*entities)
    metadata.client = transport
    return metadata, transport


@pytest.fixture(autouse=True)
def clear_resolution_caches():
    caches = (alias_resolution_cache, database_service_type_cache, search_cache, internal_database_cache)
    for cache in caches:
        cache.clear()
    yield
    for cache in caches:
        cache.clear()


@pytest.mark.parametrize(("database_name", "database"), [(None, "default"), ("doris_prod", "doris_prod")])
def test_internal_catalog_is_the_database_the_service_ingests(database_name, database):
    orders = doris_table(f"{SERVICE}.{database}.sales.orders")
    metadata, transport = connect(doris_service(database_name), orders, doris_table(f"{SERVICE}.hive.sales.orders"))
    assert search_table_entities(metadata, SERVICE, "internal", "sales", "orders") == [orders]
    # The database name is read once per service
    search_cache.clear()
    transport.paths.clear()
    assert search_table_entities(metadata, SERVICE, "internal", "sales", "orders") == [orders]
    assert not any(path.startswith("/services/") for path in transport.paths)


def test_other_catalogs_keep_their_name():
    hive_orders = doris_table(f"{SERVICE}.hive.sales.orders")
    metadata, _ = connect(doris_service(), doris_table(f"{SERVICE}.default.sales.orders"), hive_orders)
    assert search_table_entities(metadata, SERVICE, "hive", "sales", "orders") == [hive_orders]


@pytest.mark.parametrize("service_name", [None, "*"])
def test_unscoped_references_keep_the_internal_catalog(service_name):
    metadata, transport = connect(doris_service(), doris_table(f"{SERVICE}.default.sales.orders"))
    resolution = load_table_binding_resolution("doris", metadata)
    reference = TableReference("internal", "sales", "orders")
    assert resolution.resolve(reference, service_name=service_name, lookup=TableLookup.LINEAGE) == ()
    assert not any(path.startswith("/services/") for path in transport.paths)


def test_unreadable_service_leaves_internal_references_unresolved(caplog):
    orders = doris_table(f"{SERVICE}.default.sales.orders")
    metadata, transport = connect(doris_service(), orders)
    resolution = load_table_binding_resolution("doris", metadata)
    reference = TableReference("internal", "sales", "orders")
    transport.error = APIError({"code": 503, "message": "unavailable"})
    assert resolution.resolve(reference, service_name=SERVICE, lookup=TableLookup.LINEAGE) == ()
    assert f"Could not read the database name of Doris service '{SERVICE}'" in caplog.text
    # The failure is not cached
    transport.error = None
    assert resolution.resolve(reference, service_name=SERVICE, lookup=TableLookup.LINEAGE) == (orders,)


@pytest.mark.parametrize(("database_name", "database"), [(None, "default"), ("doris_prod", "doris_prod")])
def test_view_lineage_links_doris_views_and_materialized_views(database_name, database):
    def fqn(name):
        return f"{SERVICE}.{database}.sales.{name}"

    region_totals = doris_table(fqn("region_totals"), ("region", "manager", "total"), TableType.MaterializedView)
    view = doris_table(fqn("region_totals_view"), ("region", "manager", "total"), TableType.View)
    metadata, _ = connect(
        doris_service(database_name),
        doris_table(fqn("orders"), ("id", "dt", "region", "amount")),
        doris_table(fqn("regions"), ("region", "manager")),
        region_totals,
        view,
    )
    for entity, definition in ((region_totals, REGION_TOTALS), (view, REGION_TOTALS_VIEW)):
        edges = {}
        for either in get_view_lineage(
            view=TableView(
                table_name=model_str(entity.name), schema_name="sales", db_name=database, view_definition=definition
            ),
            metadata=metadata,
            service_names=[SERVICE],
            connection_type="Doris",
            timeout_seconds=10,
            parser_type=QueryParserType.Auto,
            parser_factory=DorisLineageSource.get_view_lineage_parser_factory(object()),
        ):
            assert either.left is None, either.left
            request = either.right
            assert isinstance(request, OMetaFQNLineageRequest)
            assert request.to_entity_fqn == model_str(entity.fullyQualifiedName)
            edges[request.from_entity_fqn] = sorted(
                f"{model_str(column.fromColumns[0]).rsplit('.', 1)[-1]}->{model_str(column.toColumn).rsplit('.', 1)[-1]}"
                for column in request.lineage_details.columnsLineage
            )
        assert edges == {fqn("orders"): ["amount->total", "region->region"], fqn("regions"): ["manager->manager"]}
