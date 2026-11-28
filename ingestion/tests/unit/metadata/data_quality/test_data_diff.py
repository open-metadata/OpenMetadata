import logging
from unittest.mock import Mock, patch

import pytest
from sqlalchemy.dialects import registry
from sqlalchemy.engine import make_url
from sqlalchemy.exc import NoSuchModuleError

from metadata.data_quality.validations.models import (
    TableDiffRuntimeParameters,
    TableParameter,
)
from metadata.data_quality.validations.table.sqlalchemy.tableDiff import (
    TableDiffValidator,
    build_sample_where_clause,
    compile_and_clauses,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.samplingConfig import ProfileSampleConfig


@pytest.mark.parametrize(
    "elements, expected",
    [
        ("a", "a"),
        (["a", "b"], "a and b"),
        (["a", ["b", "c"]], "a and (b and c)"),
        (["a", ["b", ["c", "d"]]], "a and (b and (c and d))"),
        (["a", ["b", "c"], "d"], "a and (b and c) and d"),
        ([], ""),
        ("", ""),
        (["a"], "a"),
        ([["a"]], "a"),
        ([["a"]], "a"),
    ],
)
def test_compile_and_clauses(elements, expected):
    assert compile_and_clauses(elements) == expected


@pytest.mark.parametrize(
    "config,expected",
    [
        (
            TableDiffRuntimeParameters.model_construct(
                **{  # noqa: PIE804
                    "database_service_type": "BigQuery",
                    "table_profile_config": TableProfilerConfig(
                        profileSampleConfig=ProfileSampleConfig(
                            sampleConfigType="STATIC",
                            config={
                                "profileSample": 10,
                                "profileSampleType": "PERCENTAGE",
                            },
                        ),
                    ),
                    "table1": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id"],
                        }
                    ),
                    "table2": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id"],
                        }
                    ),
                    "keyColumns": ["id"],
                }
            ),
            ("SUBSTRING(MD5(id || 'a'), 1, 8) < '19999999'",) * 2,
        ),
        (
            TableDiffRuntimeParameters.model_construct(
                **{  # noqa: PIE804
                    "database_service_type": "BigQuery",
                    "table_profile_config": TableProfilerConfig(
                        profileSampleConfig=ProfileSampleConfig(
                            sampleConfigType="STATIC",
                            config={
                                "profileSample": 20,
                                "profileSampleType": "PERCENTAGE",
                            },
                        ),
                    ),
                    "table1": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id"],
                        }
                    ),
                    "table2": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id"],
                        }
                    ),
                    "keyColumns": ["id"],
                }
            ),
            ("SUBSTRING(MD5(id || 'a'), 1, 8) < '33333333'",) * 2,
        ),
        (
            TableDiffRuntimeParameters.model_construct(
                **{  # noqa: PIE804
                    "database_service_type": "BigQuery",
                    "table_profile_config": TableProfilerConfig(
                        profileSampleConfig=ProfileSampleConfig(
                            sampleConfigType="STATIC",
                            config={
                                "profileSample": 10,
                                "profileSampleType": "PERCENTAGE",
                            },
                        ),
                    ),
                    "table1": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id", "name"],
                        }
                    ),
                    "table2": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id", "name"],
                        }
                    ),
                    "keyColumns": ["id", "name"],
                }
            ),
            ("SUBSTRING(MD5(id || name || 'a'), 1, 8) < '19999999'",) * 2,
        ),
        (
            TableDiffRuntimeParameters.model_construct(
                **{  # noqa: PIE804
                    "database_service_type": "BigQuery",
                    "table_profile_config": TableProfilerConfig(
                        profileSampleConfig=ProfileSampleConfig(
                            sampleConfigType="STATIC",
                            config={
                                "profileSample": 20,
                                "profileSampleType": "ROWS",
                            },
                        ),
                    ),
                    "table1": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id", "name"],
                        }
                    ),
                    "table2": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id", "name"],
                        },
                    ),
                    "keyColumns": ["id", "name"],
                }
            ),
            ("SUBSTRING(MD5(id || name || 'a'), 1, 8) < '0083126e'",) * 2,
        ),
        (
            TableDiffRuntimeParameters.model_construct(
                **{  # noqa: PIE804
                    "table_profile_config": TableProfilerConfig(
                        profileSampleConfig=ProfileSampleConfig(
                            sampleConfigType="STATIC",
                            config={
                                "profileSample": 20,
                                "profileSampleType": "ROWS",
                            },
                        ),
                    ),
                    "table1": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id"],
                        }
                    ),
                    "table2": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="ID", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id"],
                        },
                    ),
                    "keyColumns": ["id"],
                }
            ),
            (
                "SUBSTRING(MD5(id || 'a'), 1, 8) < '0083126e'",
                "SUBSTRING(MD5(\"ID\" || 'a'), 1, 8) < '0083126e'",
            ),
        ),
        (
            TableDiffRuntimeParameters.model_construct(
                **{  # noqa: PIE804
                    "table_profile_config": None,
                    "table1": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id"],
                        }
                    ),
                    "table2": TableParameter.model_construct(
                        **{  # noqa: PIE804
                            "database_service_type": DatabaseServiceType.Postgres,
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ],
                            "key_columns": ["id"],
                        },
                    ),
                    "keyColumns": ["id"],
                }
            ),
            (None, None),
        ),
    ],
)
def test_sample_where_clauses(config, expected):
    validator = TableDiffValidator(
        None,
        TestCase.model_construct(parameterValues=[TestCaseParameterValue(name="caseSensitiveColumns", value="false")]),
        None,
    )
    validator.runtime_params = config
    table_profile_config = config.table_profile_config if config else None
    profile_sample_config = table_profile_config.profileSampleConfig.root if table_profile_config else None
    sample_config = profile_sample_config.config if profile_sample_config else None
    if sample_config and sample_config.profileSampleType == ProfileSampleType.ROWS:
        validator.get_total_row_count = Mock(return_value=10_000)
    with patch("random.choices", Mock(return_value=["a"])):
        assert validator.sample_where_clause() == expected


def build_table(service: DatabaseServiceType, *columns: tuple[str, DataType], key_columns: list[str]) -> TableParameter:
    return TableParameter.model_construct(
        database_service_type=service,
        columns=[Column(name=name, dataType=data_type) for name, data_type in columns],
        key_columns=key_columns,
    )


SQL_SERVER_INT_KEY = (
    "SUBSTRING(LOWER(CONVERT(VARCHAR(32), HASHBYTES('MD5', CAST(id AS VARCHAR(max)) + 'salt'), 2)), 1, 8) < '19999999'"
)
VERTICA_INT_KEY = "SUBSTRING(MD5(CAST(id AS VARCHAR) || 'salt'), 1, 8) < '19999999'"


class TestBuildSampleWhereClause:
    """Both tables keep the rows whose hashed key falls under the nonce: each database must hash the same text."""

    @pytest.mark.parametrize(
        "table, expected",
        (
            (
                build_table(DatabaseServiceType.Postgres, ("id", DataType.INT), key_columns=["id"]),
                "SUBSTRING(MD5(id || 'salt'), 1, 8) < '19999999'",
            ),
            (
                build_table(
                    DatabaseServiceType.Snowflake,
                    ("ID", DataType.NUMBER),
                    ("REGION", DataType.VARCHAR),
                    key_columns=["ID", "REGION"],
                ),
                "SUBSTRING(MD5(\"ID\" || \"REGION\" || 'salt'), 1, 8) < '19999999'",
            ),
            (
                build_table(DatabaseServiceType.Oracle, ("id", DataType.INT), key_columns=["id"]),
                "SUBSTR(LOWER(RAWTOHEX(STANDARD_HASH(TO_CHAR(id || 'salt'), 'MD5'))), 1, 8) < '19999999'",
            ),
            (
                build_table(
                    DatabaseServiceType.Oracle,
                    ("id", DataType.INT),
                    ("name", DataType.VARCHAR),
                    key_columns=["name"],
                ),
                "SUBSTR(LOWER(RAWTOHEX(STANDARD_HASH(TO_CHAR(name || 'salt'), 'MD5'))), 1, 8) < '19999999'",
            ),
            (
                build_table(
                    DatabaseServiceType.Oracle,
                    ("id", DataType.INT),
                    ("name", DataType.VARCHAR),
                    ("payload", DataType.VARCHAR),
                    key_columns=["name", "id"],
                ),
                "SUBSTR(LOWER(RAWTOHEX(STANDARD_HASH(TO_CHAR(id || name || 'salt'), 'MD5'))), 1, 8) < '19999999'",
            ),
            (
                build_table(DatabaseServiceType.Oracle, ("CustomerId", DataType.INT), key_columns=["CustomerId"]),
                "SUBSTR(LOWER(RAWTOHEX(STANDARD_HASH(TO_CHAR(\"CustomerId\" || 'salt'), 'MD5'))), 1, 8) < '19999999'",
            ),
            # SQL Server's + would add an integer key to the salt: the key is cast to text first
            (
                build_table(
                    DatabaseServiceType.Mssql, ("id", DataType.INT), ("name", DataType.VARCHAR), key_columns=["id"]
                ),
                SQL_SERVER_INT_KEY,
            ),
            (
                build_table(DatabaseServiceType.AzureSQL, ("id", DataType.INT), key_columns=["id"]),
                SQL_SERVER_INT_KEY,
            ),
            (
                build_table(
                    DatabaseServiceType.Mssql,
                    ("id", DataType.BIGINT),
                    ("Region", DataType.SMALLINT),
                    key_columns=["id", "Region"],
                ),
                "SUBSTRING(LOWER(CONVERT(VARCHAR(32), HASHBYTES('MD5', CAST(id AS VARCHAR(max))"
                " + CAST([Region] AS VARCHAR(max)) + 'salt'), 2)), 1, 8) < '19999999'",
            ),
            # Vertica casts every key column to VARCHAR so it hashes the same key text as the other databases
            (
                build_table(DatabaseServiceType.Vertica, ("id", DataType.INT), key_columns=["id"]),
                VERTICA_INT_KEY,
            ),
            (
                build_table(
                    DatabaseServiceType.Vertica,
                    ("id", DataType.INT),
                    ("Region", DataType.VARCHAR),
                    key_columns=["id", "Region"],
                ),
                "SUBSTRING(MD5(CAST(id AS VARCHAR) || CAST(\"Region\" AS VARCHAR) || 'salt'), 1, 8) < '19999999'",
            ),
            (
                build_table(
                    DatabaseServiceType.Vertica,
                    ("CustomerId", DataType.BIGINT),
                    key_columns=["CustomerId"],
                ),
                "SUBSTRING(MD5(CAST(\"CustomerId\" AS VARCHAR) || 'salt'), 1, 8) < '19999999'",
            ),
        ),
        ids=(
            "postgres",
            "snowflake",
            "oracle-int",
            "oracle-string",
            "oracle-composite",
            "oracle-quoted",
            "sql-server-int",
            "azure-sql",
            "composite",
            "vertica-int",
            "vertica-composite",
            "vertica-quoted",
        ),
    )
    def test_it_hashes_the_key_as_the_same_text_in_every_database(self, table: TableParameter, expected: str) -> None:
        assert build_sample_where_clause(table, table.key_columns, "salt", "19999999") == expected


def build_sampling_validator(table1: TableParameter, table2: TableParameter) -> TableDiffValidator:
    validator = TableDiffValidator(
        None,
        TestCase.model_construct(parameterValues=[TestCaseParameterValue(name="caseSensitiveColumns", value="false")]),
        None,
    )
    validator.runtime_params = TableDiffRuntimeParameters.model_construct(
        table1=table1,
        table2=table2,
        table_profile_config=TableProfilerConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType="STATIC",
                config={"profileSample": 10, "profileSampleType": "PERCENTAGE"},
            ),
        ),
    )
    validator.get_total_row_count = Mock(return_value=10_000)
    return validator


class TestSamplingWithSqlServer:
    def test_both_tables_are_sampled_with_the_same_salt_and_nonce(self) -> None:
        validator = build_sampling_validator(
            build_table(DatabaseServiceType.Mssql, ("id", DataType.INT), key_columns=["id"]),
            build_table(DatabaseServiceType.Postgres, ("id", DataType.INT), key_columns=["id"]),
        )

        with patch("random.choices", Mock(return_value=["salt"])):
            assert validator.sample_where_clause() == (
                SQL_SERVER_INT_KEY,
                "SUBSTRING(MD5(id || 'salt'), 1, 8) < '19999999'",
            )

    # A string key hashes as UTF-8 elsewhere but in a code page, or as UTF-16, in SQL Server: accents would differ
    @pytest.mark.parametrize(
        "key_type",
        (DataType.VARCHAR, DataType.CHAR, DataType.DATETIME, DataType.DATE, DataType.DECIMAL, DataType.UUID),
    )
    def test_it_compares_every_row_when_the_key_text_differs_between_databases(
        self, key_type: DataType, caplog: pytest.LogCaptureFixture
    ) -> None:
        validator = build_sampling_validator(
            build_table(DatabaseServiceType.Snowflake, ("ID", key_type), key_columns=["ID"]),
            build_table(DatabaseServiceType.Mssql, ("Id", key_type), ("name", DataType.VARCHAR), key_columns=["id"]),
        )

        with caplog.at_level(logging.WARNING, logger="TestSuite"):
            assert validator.sample_where_clause() == (None, None)

        assert f"Not supported: Id ({key_type.value})." in caplog.text

    def test_other_databases_still_sample_on_any_key(self) -> None:
        validator = build_sampling_validator(
            build_table(DatabaseServiceType.Postgres, ("day", DataType.DATE), key_columns=["day"]),
            build_table(DatabaseServiceType.Postgres, ("day", DataType.DATE), key_columns=["day"]),
        )

        with patch("random.choices", Mock(return_value=["salt"])):
            assert validator.sample_where_clause() == ("SUBSTRING(MD5(day || 'salt'), 1, 8) < '19999999'",) * 2


class TestSamplingWithOracle:
    @pytest.mark.parametrize("other_service", (DatabaseServiceType.Oracle, DatabaseServiceType.Postgres))
    @pytest.mark.parametrize(
        "sample_type, sample, nonce",
        (
            (ProfileSampleType.PERCENTAGE, 10, "19999999"),
            (ProfileSampleType.PERCENTAGE, 75, "bfffffff"),
            (ProfileSampleType.ROWS, 1000, "19999999"),
        ),
    )
    def test_both_tables_use_the_same_salt_and_threshold(
        self, other_service: DatabaseServiceType, sample_type: ProfileSampleType, sample: int, nonce: str
    ) -> None:
        validator = build_sampling_validator(
            build_table(DatabaseServiceType.Oracle, ("id", DataType.INT), key_columns=["id"]),
            build_table(other_service, ("id", DataType.INT), key_columns=["id"]),
        )
        validator.runtime_params.table_profile_config = TableProfilerConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType="STATIC",
                config={"profileSample": sample, "profileSampleType": sample_type},
            ),
        )
        oracle_clause = f"SUBSTR(LOWER(RAWTOHEX(STANDARD_HASH(TO_CHAR(id || 'salt'), 'MD5'))), 1, 8) < '{nonce}'"
        other_clause = (
            oracle_clause
            if other_service == DatabaseServiceType.Oracle
            else f"SUBSTRING(MD5(id || 'salt'), 1, 8) < '{nonce}'"
        )

        with patch("random.choices", Mock(return_value=["salt"])):
            assert validator.sample_where_clause() == (oracle_clause, other_clause)

    @pytest.mark.parametrize("configured", (False, True), ids=("no-config", "full-percentage"))
    def test_full_comparison_does_not_add_a_sampling_predicate(self, configured: bool) -> None:
        validator = build_sampling_validator(
            build_table(DatabaseServiceType.Oracle, ("id", DataType.INT), key_columns=["id"]),
            build_table(DatabaseServiceType.Oracle, ("id", DataType.INT), key_columns=["id"]),
        )
        validator.runtime_params.table_profile_config = (
            TableProfilerConfig(
                profileSampleConfig=ProfileSampleConfig(
                    sampleConfigType="STATIC",
                    config={"profileSample": 100, "profileSampleType": "PERCENTAGE"},
                ),
            )
            if configured
            else None
        )

        assert validator.sample_where_clause() == (None, None)


class TestSamplingWithVertica:
    def test_vertica_sampling_compiles_without_connector_metadata_registration(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """sqlalchemy-vertica only registers `vertica.vertica_python`, not bare `vertica`."""
        monkeypatch.delitem(registry.impls, "vertica", raising=False)
        with pytest.raises(NoSuchModuleError):
            make_url("vertica://").get_dialect()

        table = build_table(DatabaseServiceType.Vertica, ("id", DataType.INT), key_columns=["id"])

        assert build_sample_where_clause(table, ["id"], "salt", "19999999") == VERTICA_INT_KEY

    @pytest.mark.parametrize(
        "left_service, right_service, expected",
        (
            (
                DatabaseServiceType.Vertica,
                DatabaseServiceType.Vertica,
                (VERTICA_INT_KEY, VERTICA_INT_KEY),
            ),
            (
                DatabaseServiceType.Vertica,
                DatabaseServiceType.Postgres,
                (VERTICA_INT_KEY, "SUBSTRING(MD5(id || 'salt'), 1, 8) < '19999999'"),
            ),
            (
                DatabaseServiceType.Postgres,
                DatabaseServiceType.Vertica,
                ("SUBSTRING(MD5(id || 'salt'), 1, 8) < '19999999'", VERTICA_INT_KEY),
            ),
            (
                DatabaseServiceType.Vertica,
                DatabaseServiceType.Mssql,
                (VERTICA_INT_KEY, SQL_SERVER_INT_KEY),
            ),
            (
                DatabaseServiceType.Mssql,
                DatabaseServiceType.Vertica,
                (SQL_SERVER_INT_KEY, VERTICA_INT_KEY),
            ),
        ),
        ids=("vertica-vertica", "vertica-postgres", "postgres-vertica", "vertica-mssql", "mssql-vertica"),
    )
    def test_cross_database_sampling_uses_matching_salt_and_nonce(
        self,
        left_service: DatabaseServiceType,
        right_service: DatabaseServiceType,
        expected: tuple[str, str],
    ) -> None:
        validator = build_sampling_validator(
            build_table(left_service, ("id", DataType.INT), key_columns=["id"]),
            build_table(right_service, ("id", DataType.INT), key_columns=["id"]),
        )

        with patch("random.choices", Mock(return_value=["salt"])):
            assert validator.sample_where_clause() == expected

    @pytest.mark.parametrize(
        "left_service, right_service",
        (
            (DatabaseServiceType.Vertica, DatabaseServiceType.Mssql),
            (DatabaseServiceType.Mssql, DatabaseServiceType.Vertica),
        ),
        ids=("vertica-mssql", "mssql-vertica"),
    )
    @pytest.mark.parametrize("key_type", (DataType.VARCHAR, DataType.DATE))
    def test_cross_database_mssql_non_integer_key_skips_sampling(
        self,
        left_service: DatabaseServiceType,
        right_service: DatabaseServiceType,
        key_type: DataType,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        validator = build_sampling_validator(
            build_table(left_service, ("id", key_type), key_columns=["id"]),
            build_table(right_service, ("id", key_type), key_columns=["id"]),
        )

        with caplog.at_level(logging.WARNING, logger="TestSuite"):
            assert validator.sample_where_clause() == (None, None)

        assert f"Not supported: id ({key_type.value})." in caplog.text
