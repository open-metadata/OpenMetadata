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
"""Glue test-connection: its checks match its shipped definition (non-Engine: boto3 client)."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection as GlueConnectionConfig,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.glue.connection import (
    GLUE_ERRORS,
    MAX_DATABASES_TO_PROBE,
    MAX_DATABASES_TO_SCAN,
    MAX_TABLES_TO_SCAN,
    TABLE_NAME_MAX_LENGTH,
    GlueChecks,
    GlueConnection,
    GlueFilters,
    list_databases,
)
from metadata.ingestion.source.database.glue.metadata import GlueSource

CONNECTION_MODULE = "metadata.ingestion.source.database.glue.connection"
SOURCE_MODULE = "metadata.ingestion.source.database.glue.metadata"

_SEED = (
    Path(__file__).parents[6]
    / "openmetadata-service/src/main/resources/json/data"
    / "testConnections/database/glue.json"
)


def _config() -> GlueConnectionConfig:
    return GlueConnectionConfig(awsConfig=AWSCredentials(awsRegion="us-east-1"))


def _client(pages: dict[str, list[dict]] | None = None) -> MagicMock:
    """A Glue client whose paginators yield one page per operation."""
    responses = pages or {}
    client = MagicMock()
    client.get_paginator.side_effect = lambda operation: _paginator(responses.get(operation, [{}]))
    return client


def _paginator(pages: list[dict]) -> MagicMock:
    paginator = MagicMock()
    paginator.paginate.return_value = pages
    return paginator


def _checks(client=None, **filters: FilterPattern) -> GlueChecks:
    return GlueChecks(catalog=Borrowed.of(client), filters=GlueFilters(**filters))


def _check_names() -> set[str]:
    return {step.value for step in collect_checks(_checks())}


def _client_error(code: str, operation: str = "GetDatabases") -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": "denied"}}, operation)


def test_glue_connection_is_base_connection():
    assert issubclass(GlueConnection, BaseConnection)


def test_get_client_builds_the_glue_client():
    with patch(f"{CONNECTION_MODULE}.AWSClient") as mock_aws:
        client = GlueConnection(_config()).client

    mock_aws.return_value.get_glue_client.assert_called_once_with()
    assert client is mock_aws.return_value.get_glue_client.return_value


def test_glue_checks_cover_expected_steps():
    assert _check_names() == {"GetDatabases", "GetTables"}


def test_glue_checks_match_definition_seed():
    definition_steps = {step["name"] for step in json.loads(_SEED.read_text())["steps"]}
    assert _check_names() == definition_steps


def test_get_databases_is_the_connection_gate():
    steps = json.loads(_SEED.read_text())["steps"]
    assert steps[0]["name"] == "GetDatabases"
    assert steps[0]["category"] == "ConnectionGate"


def test_building_checks_does_not_build_the_client():
    with patch.object(GlueConnection, "_get_client") as mock_build:
        GlueConnection(_config()).checks()

    mock_build.assert_not_called()


def test_get_databases_enumerates_the_catalog():
    client = _client({"get_databases": [{"DatabaseList": [{"Name": "a"}, {"Name": "b"}]}]})

    evidence = _checks(client).get_databases()

    assert evidence.summary == "2 databases enumerated"
    assert evidence.command == "glue:GetDatabases"
    assert evidence.caveat is None


def test_get_databases_caps_reported_count_and_flags_more():
    paginator = _paginator([{"DatabaseList": [{"Name": "a"}, {"Name": "b"}, {"Name": "c"}]}])
    client = MagicMock()
    client.get_paginator.return_value = paginator

    evidence = list_databases(client, limit=2)

    assert evidence.summary == "2 databases enumerated (showing first 2; more exist)"
    client.get_paginator.assert_called_once_with("get_databases")
    paginator.paginate.assert_called_once_with(PaginationConfig={"MaxItems": 3})


def test_get_databases_warns_when_catalog_is_empty():
    client = _client({"get_databases": [{"DatabaseList": []}]})

    evidence = _checks(client).get_databases()

    assert evidence.summary == "no databases enumerated"
    assert evidence.caveat is not None
    assert "No databases visible" in evidence.caveat.title


def test_get_databases_failure_reports_the_command_it_ran():
    client = _client()
    cause = _client_error("AccessDeniedException")
    client.get_paginator.side_effect = cause

    with pytest.raises(CheckError) as failure:
        _checks(client).get_databases()

    assert failure.value.cause is cause
    assert failure.value.evidence.command == "glue:GetDatabases"


def test_get_tables_probes_the_first_database():
    client = _client(
        {
            "get_databases": [{"DatabaseList": [{"Name": "sales"}]}],
            "get_tables": [{"TableList": [{"Name": "orders"}]}],
        }
    )

    evidence = _checks(client).get_tables()

    assert evidence.summary == "1 table in database 'sales'"
    assert evidence.command == "glue:GetTables (DatabaseName=sales)"


def test_get_tables_reports_a_caveat_when_no_database_can_be_probed():
    client = _client({"get_databases": [{"DatabaseList": []}]})

    evidence = _checks(client).get_tables()

    assert evidence.command == "glue:GetDatabases"
    assert evidence.caveat is not None
    assert evidence.caveat.title == "No tables visible"


def test_get_tables_skips_an_empty_leading_database():
    # A catalog commonly leads with an empty 'default'; the probe must not stop there.
    client = MagicMock()
    tables = {"default": [{"TableList": []}], "ecommerce": [{"TableList": [{"Name": "orders"}]}]}
    calls = {"n": 0}

    def paginator(operation):
        if operation == "get_databases":
            return _paginator([{"DatabaseList": [{"Name": "default"}, {"Name": "ecommerce"}]}])
        calls["n"] += 1
        return _paginator(tables["default" if calls["n"] == 1 else "ecommerce"])

    client.get_paginator.side_effect = paginator

    evidence = _checks(client).get_tables()

    assert evidence.summary == "1 table in database 'ecommerce'"
    assert evidence.command == "glue:GetTables (DatabaseName=ecommerce)"
    assert evidence.caveat is None


def test_get_tables_warns_when_no_database_exposes_a_table():
    client = _client(
        {
            "get_databases": [{"DatabaseList": [{"Name": "a"}, {"Name": "b"}]}],
            "get_tables": [{"TableList": []}],
        }
    )

    evidence = _checks(client).get_tables()

    assert evidence.summary == "no tables in the first 2 databases"
    assert evidence.caveat is not None
    assert evidence.caveat.title == "No tables visible"


def test_get_tables_failure_names_the_database_it_probed():
    cause = _client_error("EntityNotFoundException", "GetTables")
    client = _client({"get_databases": [{"DatabaseList": [{"Name": "sales"}]}]})
    tables_paginator = MagicMock()
    tables_paginator.paginate.side_effect = cause
    client.get_paginator.side_effect = lambda operation: (
        tables_paginator if operation == "get_tables" else _paginator([{"DatabaseList": [{"Name": "sales"}]}])
    )

    with pytest.raises(CheckError) as failure:
        _checks(client).get_tables()

    assert failure.value.cause is cause
    assert failure.value.evidence.command == "glue:GetTables (DatabaseName=sales)"


def _client_denying(denied: str, databases: list[dict], tables: dict[str, list[dict]]) -> MagicMock:
    """GetTables on ``denied`` raises AccessDenied, as a cross-account resource link does."""
    client = MagicMock()

    def get_tables(**kwargs):
        if kwargs["DatabaseName"] == denied:
            raise _client_error("AccessDeniedException", "GetTables")
        return [{"TableList": tables.get(kwargs["DatabaseName"], [])}]

    tables_paginator = MagicMock()
    tables_paginator.paginate.side_effect = get_tables
    client.get_paginator.side_effect = lambda operation: (
        tables_paginator if operation == "get_tables" else _paginator([{"DatabaseList": databases}])
    )
    return client


def test_get_tables_never_probes_a_database_the_schema_filter_excludes():
    # The excluded database sorts first and the identity may not read it.
    client = _client_denying(
        denied="linked_db",
        databases=[{"Name": "linked_db", "CatalogId": "111"}, {"Name": "sales", "CatalogId": "111"}],
        tables={"sales": [{"Name": "orders"}]},
    )

    evidence = _checks(client, schema=FilterPattern(includes=["^sales$"])).get_tables()

    assert evidence.summary == "1 table in database 'sales'"
    assert evidence.command == "glue:GetTables (DatabaseName=sales)"


def test_get_tables_without_a_filter_still_surfaces_a_denied_database():
    client = _client_denying(
        denied="linked_db",
        databases=[{"Name": "linked_db"}, {"Name": "sales"}],
        tables={"sales": [{"Name": "orders"}]},
    )

    with pytest.raises(CheckError) as failure:
        _checks(client).get_tables()

    assert failure.value.evidence.command == "glue:GetTables (DatabaseName=linked_db)"


def test_get_tables_reaches_a_targeted_database_past_the_probe_cap():
    excluded = [{"Name": f"other_{i:02d}"} for i in range(MAX_DATABASES_TO_PROBE + 5)]
    client = _client_denying(
        denied="other_00",
        databases=[*excluded, {"Name": "sales"}],
        tables={"sales": [{"Name": "orders"}]},
    )

    evidence = _checks(client, schema=FilterPattern(excludes=["^other_"])).get_tables()

    assert evidence.summary == "1 table in database 'sales'"


def test_get_tables_names_the_database_catalog():
    client = MagicMock()
    tables_paginator = _paginator([{"TableList": [{"Name": "orders"}]}])
    databases_paginator = _paginator([{"DatabaseList": [{"Name": "sales", "CatalogId": "111"}]}])
    client.get_paginator.side_effect = lambda operation: (
        tables_paginator if operation == "get_tables" else databases_paginator
    )

    _checks(client).get_tables()

    tables_paginator.paginate.assert_called_once_with(
        DatabaseName="sales", CatalogId="111", PaginationConfig={"MaxItems": MAX_TABLES_TO_SCAN}
    )


def test_get_tables_warns_when_the_schema_filter_excludes_every_database():
    client = _client({"get_databases": [{"DatabaseList": [{"Name": "a"}, {"Name": "b"}]}]})

    evidence = _checks(client, schema=FilterPattern(includes=["^missing$"])).get_tables()

    assert evidence.summary == "no databases available to probe"
    assert evidence.caveat is not None
    assert "schemaFilterPattern" in evidence.caveat.remediation


def test_get_tables_never_probes_a_catalog_the_database_filter_excludes():
    # Glue's database level is the catalog ID; the excluded catalog's database is denied.
    client = _client_denying(
        denied="linked_db",
        databases=[{"Name": "linked_db", "CatalogId": "222"}, {"Name": "sales", "CatalogId": "111"}],
        tables={"sales": [{"Name": "orders"}]},
    )

    evidence = _checks(client, database=FilterPattern(includes=["^111$"])).get_tables()

    assert evidence.summary == "1 table in database 'sales'"


def test_get_tables_counts_only_tables_the_table_filter_keeps():
    client = _client_denying(
        denied="",
        databases=[{"Name": "sales"}],
        tables={"sales": [{"Name": "orders"}, {"Name": "tmp_orders"}, {"Name": "customers"}]},
    )

    evidence = _checks(client, table=FilterPattern(excludes=["^tmp_"])).get_tables()

    assert evidence.summary == "2 tables in database 'sales'"


def test_get_tables_moves_past_a_database_whose_tables_are_all_filtered_out():
    client = _client_denying(
        denied="",
        databases=[{"Name": "staging"}, {"Name": "sales"}],
        tables={"staging": [{"Name": "tmp_load"}], "sales": [{"Name": "orders"}]},
    )

    evidence = _checks(client, table=FilterPattern(excludes=["^tmp_"])).get_tables()

    assert evidence.summary == "1 table in database 'sales'"


def test_get_tables_warns_when_the_table_filter_excludes_every_table():
    client = _client_denying(denied="", databases=[{"Name": "sales"}], tables={"sales": [{"Name": "orders"}]})

    evidence = _checks(client, table=FilterPattern(includes=["^missing$"])).get_tables()

    assert evidence.summary == "no tables in the first 1 database"
    assert evidence.caveat is not None
    assert "tableFilterPattern" in evidence.caveat.remediation


def test_glue_filters_take_the_connection_patterns():
    database, schema, table = (FilterPattern(includes=[f"^{name}$"]) for name in ("111", "sales", "orders"))
    config = GlueConnectionConfig(
        awsConfig=AWSCredentials(awsRegion="us-east-1"),
        databaseFilterPattern=database,
        schemaFilterPattern=schema,
        tableFilterPattern=table,
    )

    assert GlueFilters.of(config) == GlueFilters(database=database, schema=schema, table=table)


def test_glue_filters_skip_the_database_filter_when_database_name_is_set():
    # Ingestion labels every catalog with databaseName and does not filter by catalog ID then.
    config = GlueConnectionConfig(
        awsConfig=AWSCredentials(awsRegion="us-east-1"),
        databaseName="analytics",
        databaseFilterPattern=FilterPattern(includes=["^111$"]),
    )

    assert GlueFilters.of(config).database is None


def test_get_tables_finds_a_targeted_database_on_a_later_page():
    client = MagicMock()
    pages = [{"DatabaseList": [{"Name": "linked_db"}, {"Name": "other"}]}, {"DatabaseList": [{"Name": "sales"}]}]
    tables_paginator = MagicMock()
    tables_paginator.paginate.side_effect = lambda **kwargs: [{"TableList": [{"Name": "orders"}]}]
    client.get_paginator.side_effect = lambda operation: (
        tables_paginator if operation == "get_tables" else _paginator(pages)
    )

    evidence = _checks(client, schema=FilterPattern(includes=["^sales$"])).get_tables()

    assert evidence.summary == "1 table in database 'sales'"
    tables_paginator.paginate.assert_called_once()


def test_get_tables_stops_after_the_probe_cap():
    databases = [{"Name": f"empty_{i:02d}"} for i in range(MAX_DATABASES_TO_PROBE + 5)]
    client = _client({"get_databases": [{"DatabaseList": databases}], "get_tables": [{"TableList": []}]})

    evidence = _checks(client).get_tables()

    assert evidence.summary == f"no tables in the first {MAX_DATABASES_TO_PROBE} databases"
    get_tables_calls = [c for c in client.get_paginator.call_args_list if c.args == ("get_tables",)]
    assert len(get_tables_calls) == MAX_DATABASES_TO_PROBE


def test_get_tables_stops_once_the_table_scan_budget_is_spent():
    # A filter that keeps nothing must not read a large catalog to the end.
    filtered_out = [{"Name": f"tmp_{i}"} for i in range(MAX_TABLES_TO_SCAN)]
    client = _client_denying(
        denied="",
        databases=[{"Name": "big"}, {"Name": "sales"}],
        tables={"big": filtered_out, "sales": [{"Name": "orders"}]},
    )

    evidence = _checks(client, table=FilterPattern(excludes=["^tmp_"])).get_tables()

    # Running out of reads is not evidence that ingestion would collect nothing.
    assert evidence.summary == f"no kept table in the first {MAX_TABLES_TO_SCAN} tables read"
    assert evidence.caveat is not None
    assert evidence.caveat.title == "Table probe stopped early"
    assert "does not mean ingestion would collect nothing" in evidence.caveat.remediation


def test_get_tables_stops_once_the_database_scan_budget_is_spent():
    # A schema filter that matches nothing must not page through a large catalog to the end.
    excluded = [{"Name": f"other_{i}"} for i in range(MAX_DATABASES_TO_SCAN)]
    client = _client_denying(
        denied="", databases=[*excluded, {"Name": "sales"}], tables={"sales": [{"Name": "orders"}]}
    )

    evidence = _checks(client, schema=FilterPattern(includes=["^sales$"])).get_tables()

    assert evidence.summary == f"no kept table in the first {MAX_DATABASES_TO_SCAN} databases read"
    assert evidence.caveat is not None
    assert evidence.caveat.title == "Table probe stopped early"
    assert "does not mean ingestion would collect nothing" in evidence.caveat.remediation
    assert [c for c in client.get_paginator.call_args_list if c.args == ("get_tables",)] == []


def test_get_tables_caps_the_databases_glue_returns():
    client = MagicMock()
    databases_paginator = _paginator([{"DatabaseList": [{"Name": "sales"}]}])
    tables_paginator = _paginator([{"TableList": []}])
    client.get_paginator.side_effect = lambda operation: (
        tables_paginator if operation == "get_tables" else databases_paginator
    )

    _checks(client).get_tables()

    databases_paginator.paginate.assert_called_once_with(PaginationConfig={"MaxItems": MAX_DATABASES_TO_SCAN})


def test_get_tables_matches_the_table_filter_on_the_name_ingestion_keeps():
    # Ingestion truncates a long Glue table name before filtering; an anchored pattern must agree.
    long_name = "t" * TABLE_NAME_MAX_LENGTH + "_suffix"
    client = _client_denying(denied="", databases=[{"Name": "sales"}], tables={"sales": [{"Name": long_name}]})

    evidence = _checks(client, table=FilterPattern(includes=[f"^t{{{TABLE_NAME_MAX_LENGTH}}}$"])).get_tables()

    assert evidence.summary == "1 table in database 'sales'"


def test_get_tables_flags_a_count_cut_short_by_the_scan_budget():
    # Kept tables found before the budget ran out are a floor, not the database's total.
    read = [{"Name": f"tmp_{i}"} for i in range(MAX_TABLES_TO_SCAN - 2)] + [{"Name": "orders"}, {"Name": "customers"}]
    client = _client_denying(denied="", databases=[{"Name": "sales"}], tables={"sales": read})

    evidence = _checks(client, table=FilterPattern(excludes=["^tmp_"])).get_tables()

    assert evidence.summary == (
        f"2 tables in database 'sales' (scan stopped after {MAX_TABLES_TO_SCAN} tables read; more may exist)"
    )


def test_get_tables_count_is_unflagged_when_the_budget_is_not_spent():
    client = _client_denying(denied="", databases=[{"Name": "sales"}], tables={"sales": [{"Name": "orders"}]})

    assert _checks(client).get_tables().summary == "1 table in database 'sales'"


def test_pipeline_filters_match_fully_qualified_names_with_use_fqn_for_filtering():
    pipeline = DatabaseServiceMetadataPipeline(
        useFqnForFiltering=True,
        schemaFilterPattern=FilterPattern(includes=[r"^svc\.111\.sales$"]),
        tableFilterPattern=FilterPattern(excludes=[r"^svc\.111\.sales\.tmp_"]),
    )
    filters = GlueFilters.of_pipeline(_config(), pipeline, service_name="svc")
    client = _client_denying(
        denied="linked_db",
        databases=[{"Name": "linked_db", "CatalogId": "111"}, {"Name": "sales", "CatalogId": "111"}],
        tables={"sales": [{"Name": "tmp_orders"}, {"Name": "orders"}]},
    )

    evidence = GlueChecks(catalog=Borrowed.of(client), filters=filters).get_tables()

    assert evidence.summary == "1 table in database 'sales'"


def test_pipeline_filters_use_the_pipeline_patterns_not_the_connection_defaults():
    config = GlueConnectionConfig(
        awsConfig=AWSCredentials(awsRegion="us-east-1"),
        schemaFilterPattern=FilterPattern(includes=["^linked_db$"]),
    )
    pipeline = DatabaseServiceMetadataPipeline(schemaFilterPattern=FilterPattern(includes=["^sales$"]))

    filters = GlueFilters.of_pipeline(config, pipeline, service_name="svc")

    assert filters.schema == pipeline.schemaFilterPattern
    assert filters.service_name is None


def test_glue_source_probes_with_a_pipeline_only_schema_filter():
    # The filter is set on the ingestion pipeline only; the connection has none.
    client = _client_denying(
        denied="linked_db",
        databases=[{"Name": "linked_db", "CatalogId": "111"}, {"Name": "sales", "CatalogId": "111"}],
        tables={"sales": [{"Name": "orders"}]},
    )
    source_config = {
        "type": "glue",
        "serviceName": "svc",
        "serviceConnection": {"config": {"type": "Glue", "awsConfig": {"awsRegion": "us-east-1"}}},
        "sourceConfig": {"config": {"type": "DatabaseMetadata", "schemaFilterPattern": {"includes": ["^sales$"]}}},
    }
    with (
        patch.object(GlueConnection, "_get_client", return_value=client),
        patch(f"{SOURCE_MODULE}.GlueSource.test_connection"),
    ):
        source = GlueSource.create(source_config, MagicMock())

    evidence = source._connection.checks().get_tables()

    assert evidence.summary == "1 table in database 'sales'"


def test_error_pack_access_denied():
    diagnosis = GLUE_ERRORS.classify(
        ClientError(
            {
                "Error": {
                    "Code": "AccessDeniedException",
                    "Message": "User is not authorized to perform: glue:GetDatabases",
                }
            },
            "GetDatabases",
        )
    )
    assert diagnosis is not None
    assert "authorized" in diagnosis.title.lower()


def test_error_pack_entity_not_found():
    diagnosis = GLUE_ERRORS.classify(_client_error("EntityNotFoundException", "GetTables"))
    assert diagnosis is not None
    assert diagnosis.title == "Glue database not found"


def test_error_pack_inherits_the_shared_aws_diagnoses():
    # Glue is json-protocol: expired creds arrive as ExpiredTokenException.
    diagnosis = GLUE_ERRORS.classify(_client_error("ExpiredTokenException"))
    assert diagnosis is not None
    assert diagnosis.title == "AWS session token expired"


def test_error_pack_classifies_an_unknown_access_key():
    diagnosis = GLUE_ERRORS.classify(_client_error("UnrecognizedClientException"))
    assert diagnosis is not None
    assert diagnosis.title == "AWS access key not recognized"


def test_error_pack_classifies_a_wrong_secret():
    diagnosis = GLUE_ERRORS.classify(_client_error("InvalidSignatureException"))
    assert diagnosis is not None
    assert diagnosis.title == "AWS secret key does not match"


def test_error_pack_classifies_an_sts_assume_role_denial():
    # The assume-role leg denies with the suffix-less code.
    diagnosis = GLUE_ERRORS.classify(_client_error("AccessDenied", "AssumeRole"))
    assert diagnosis is not None
    assert diagnosis.title == "Not authorized"


def test_error_pack_inherits_the_network_pack_through_aws_errors():
    diagnosis = GLUE_ERRORS.classify(ConnectionRefusedError("refused"))
    assert diagnosis is not None
    assert "refused" in diagnosis.title.lower()


def test_error_pack_unmatched_returns_none():
    assert GLUE_ERRORS.classify(Exception("novel error")) is None
