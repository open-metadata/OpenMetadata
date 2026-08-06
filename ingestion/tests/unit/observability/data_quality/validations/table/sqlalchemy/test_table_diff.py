import datetime
from typing import Generator  # noqa: UP035
from unittest.mock import MagicMock, Mock, patch

import dsnparse
import pytest
from data_diff.databases._connect import CustomParseResult
from dirty_equals import Contains, DirtyEquals, HasAttributes, IsList

from metadata.data_quality.validations.models import (
    TableDiffRuntimeParameters,
    TableParameter,
)
from metadata.data_quality.validations.table.sqlalchemy.tableDiff import (
    DuplicateKeyError,
    TableDiffValidator,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    Constraint,
    DataType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import Timestamp


def build_column(
    name: str,
    data_type: DataType = DataType.STRING,
    constraint: Constraint = Constraint.NULL,
) -> Column:
    """Helper to create Column with all required fields for tests."""
    return Column.model_construct(
        name=ColumnName(root=name),
        dataType=data_type,
        dataTypeDisplay=data_type.value,
        constraint=constraint,
    )


def build_table_parameter(
    *columns: Column,
    key_columns: list[str],
    extra_columns: list[str],
    service_url: str = "postgresql://postgres:postgres@service:5432/postgres",
) -> TableParameter:
    return TableParameter.model_construct(
        serviceUrl=service_url,
        path="test_schema.test_table",
        database_service_type=DatabaseServiceType.Postgres,
        columns=columns,
        privateKey=None,
        passPhrase=None,
        key_columns=key_columns,
        extra_columns=extra_columns,
    )


@pytest.fixture
def table1_parameter() -> TableParameter:
    return build_table_parameter(
        build_column("id", constraint=Constraint.PRIMARY_KEY),
        build_column("first_name"),
        build_column("last_name"),
        key_columns=["id"],
        extra_columns=["first_name", "last_name"],
        service_url="postgresql://postgres:postgres@service1:5432/postgres",
    )


@pytest.fixture
def table2_parameter() -> TableParameter:
    return build_table_parameter(
        build_column("table_id", constraint=Constraint.PRIMARY_KEY),
        build_column("first_name"),
        build_column("last_name"),
        key_columns=["table_id"],
        extra_columns=["first_name", "last_name"],
        service_url="postgresql://postgres:postgres@service2:5432/postgres",
    )


@pytest.fixture
def parameters(table1_parameter: TableParameter, table2_parameter: TableParameter) -> TableDiffRuntimeParameters:
    return TableDiffRuntimeParameters(
        table1=table1_parameter,
        table2=table2_parameter,
        table_profile_config=None,
        whereClause=None,
        keyColumns=None,
        extraColumns=None,
    )


@pytest.fixture
def validator(
    parameters: TableDiffRuntimeParameters,
) -> Generator[TableDiffValidator, None, None]:
    with patch("metadata.data_quality.validations.table.sqlalchemy.tableDiff.data_diff") as data_diff:
        mock_table = MagicMock()
        mock_table.key_columns = []
        mock_table.extra_columns = []
        data_diff.connect_to_table = Mock(return_value=mock_table)

        validator = TableDiffValidator(
            runner=[],
            test_case=TestCase.model_construct(parameterValues=[]),
            execution_date=Timestamp(root=int(datetime.datetime.now().timestamp())),
        )
        validator.runtime_params = parameters
        yield validator


class TestGetColumnDiff:
    def test_it_returns_none_when_no_diff(
        self, validator: TableDiffValidator, parameters: TableDiffRuntimeParameters
    ) -> None:
        assert validator.get_column_diff() is None

    @pytest.mark.parametrize(
        "table1_parameter, table2_parameter, expected",
        (
            (
                build_table_parameter(
                    build_column("id", constraint=Constraint.PRIMARY_KEY),
                    build_column("last_name"),
                    key_columns=["id"],
                    extra_columns=["last_name"],
                ),
                build_table_parameter(
                    build_column("id", constraint=Constraint.PRIMARY_KEY),
                    build_column("first_name"),
                    key_columns=["id"],
                    extra_columns=["first_name"],
                ),
                HasAttributes(
                    removed=IsList(Contains("last_name")),
                    added=IsList(Contains("first_name")),
                    changed=[],
                ),
            ),
            (
                build_table_parameter(
                    build_column("id", constraint=Constraint.PRIMARY_KEY),
                    build_column("last_name"),
                    key_columns=["id"],
                    extra_columns=["last_name"],
                ),
                build_table_parameter(
                    build_column("table_id", constraint=Constraint.PRIMARY_KEY),
                    build_column("first_name"),
                    key_columns=["table_id"],
                    extra_columns=["first_name"],
                ),
                HasAttributes(
                    removed=IsList(Contains("last_name")),
                    added=IsList(Contains("first_name")),
                    changed=[],
                ),
            ),
            (
                build_table_parameter(
                    build_column("id", constraint=Constraint.PRIMARY_KEY),
                    build_column("last_name"),
                    key_columns=["id"],
                    extra_columns=["last_name"],
                ),
                build_table_parameter(
                    build_column("table_id", constraint=Constraint.PRIMARY_KEY),
                    build_column("first_name"),
                    key_columns=["id"],  # The error trying to solve in #22302
                    extra_columns=["first_name"],
                ),
                HasAttributes(
                    removed=IsList(Contains("last_name")),
                    added=IsList(Contains("table_id"), Contains("first_name")),
                    changed=[],
                ),
            ),
        ),
    )
    def test_it_returns_the_expected_result(
        self,
        validator: TableDiffValidator,
        parameters: TableDiffRuntimeParameters,
        expected: DirtyEquals,
    ) -> None:
        assert validator.get_column_diff() == expected


ENCODED_SERVICE_URL = "postgresql://svc_user%40corp.com:p%40ssw0rd@service{n}:5432/my_db"


@pytest.fixture
def encoded_credentials_validator() -> Generator[tuple[TableDiffValidator, Mock], None, None]:
    """A validator whose two service urls carry percent-encoded credentials."""
    runtime_params = TableDiffRuntimeParameters(
        table1=build_table_parameter(
            build_column("id", constraint=Constraint.PRIMARY_KEY),
            key_columns=["id"],
            extra_columns=[],
            service_url=ENCODED_SERVICE_URL.format(n=1),
        ),
        table2=build_table_parameter(
            build_column("id", constraint=Constraint.PRIMARY_KEY),
            key_columns=["id"],
            extra_columns=[],
            service_url=ENCODED_SERVICE_URL.format(n=2),
        ),
        table_profile_config=None,
        whereClause=None,
        keyColumns=["id"],
        extraColumns=[],
    )
    with patch("metadata.data_quality.validations.table.sqlalchemy.tableDiff.data_diff") as data_diff:
        mock_table = MagicMock()
        mock_table.key_columns = []
        mock_table.extra_columns = []
        data_diff.connect_to_table = Mock(return_value=mock_table)

        validator = TableDiffValidator(
            runner=[],
            test_case=TestCase.model_construct(parameterValues=[]),
            execution_date=Timestamp(root=int(datetime.datetime.now().timestamp())),
        )
        validator.runtime_params = runtime_params
        yield validator, data_diff.connect_to_table


class TestServiceUrlHandedToDataDiff:
    """data-diff never decodes the username, so it must not receive a percent-encoded one.

    See https://github.com/open-metadata/OpenMetadata/issues/31124.
    """

    @staticmethod
    def assert_credentials_are_decoded(connect_to_table: Mock) -> None:
        urls = [call.args[0] for call in connect_to_table.call_args_list]
        assert len(urls) == 2

        for url, host in zip(urls, ["service1", "service2"], strict=True):
            parsed = dsnparse.parse(url, parse_class=CustomParseResult)
            assert parsed.username == "svc_user@corp.com"
            # the password stays encoded on the wire: data-diff decodes that one itself
            assert parsed.password == "p@ssw0rd"
            assert parsed.host == host
            assert parsed.paths == ["my_db"]

    def test_get_table_diff_passes_a_decoded_username(
        self, encoded_credentials_validator: tuple[TableDiffValidator, Mock]
    ) -> None:
        validator, connect_to_table = encoded_credentials_validator

        validator.get_table_diff()

        self.assert_credentials_are_decoded(connect_to_table)

    def test_get_incomparable_columns_passes_a_decoded_username(
        self, encoded_credentials_validator: tuple[TableDiffValidator, Mock]
    ) -> None:
        validator, connect_to_table = encoded_credentials_validator

        validator.get_incomparable_columns()

        self.assert_credentials_are_decoded(connect_to_table)

    def test_it_does_not_mutate_the_stored_service_url(
        self, encoded_credentials_validator: tuple[TableDiffValidator, Mock]
    ) -> None:
        """`serviceUrl` is reported and re-parsed elsewhere, so it stays a canonical SQLAlchemy url."""
        validator, _ = encoded_credentials_validator

        validator.get_table_diff()

        assert validator.runtime_params.table1.serviceUrl == ENCODED_SERVICE_URL.format(n=1)
        assert validator.runtime_params.table2.serviceUrl == ENCODED_SERVICE_URL.format(n=2)


class TestDuplicateKeyErrorMessage:
    """The message is the whole point of the check: it must name the table, the column and the values."""

    def test_it_names_a_single_key_column_and_its_duplicates(self) -> None:
        error = DuplicateKeyError(
            "mssql.SalesDB.dbo.OrderEvents_Source", ["OrderRef"], 69, 60, ["ORD-0003 (x2)", "ORD-0007 (x3)"]
        )

        assert str(error) == (
            "Key column 'OrderRef' is not unique in mssql.SalesDB.dbo.OrderEvents_Source: "
            "69 rows over 60 distinct key values. Duplicated: ORD-0003 (x2), ORD-0007 (x3). "
            "A row-level diff needs a unique key: pick a unique column, or add more columns to the key."
        )

    def test_it_pluralises_for_a_composite_key(self) -> None:
        error = DuplicateKeyError("db.schema.tbl", ["OrderRef", "Region"], 10, 8, [])

        assert "Key columns ('OrderRef', 'Region') are not unique in db.schema.tbl" in str(error)

    def test_it_omits_the_sample_clause_when_sampling_failed(self) -> None:
        error = DuplicateKeyError("db.schema.tbl", ["id"], 10, 8, [])

        assert "Duplicated:" not in str(error)
        assert "10 rows over 8 distinct key values." in str(error)


class TestValidateKeyUniqueness:
    """data-diff's own errors name neither the table nor the column, so we check first.

    See the duplicate-key notes in tableDiff._validate_key_uniqueness.
    """

    @staticmethod
    def build_validator(counts_by_path: dict[str, tuple[int, int] | None]) -> TableDiffValidator:
        validator = TableDiffValidator(
            runner=[],
            test_case=TestCase.model_construct(parameterValues=[]),
            execution_date=Timestamp(root=int(datetime.datetime.now().timestamp())),
        )
        validator.runtime_params = TableDiffRuntimeParameters(
            table1=build_table_parameter(
                build_column("id", constraint=Constraint.PRIMARY_KEY), key_columns=["id"], extra_columns=[]
            ),
            table2=build_table_parameter(
                build_column("id", constraint=Constraint.PRIMARY_KEY), key_columns=["id"], extra_columns=[]
            ),
            table_profile_config=None,
            whereClause=None,
            keyColumns=["id"],
            extraColumns=[],
        )
        validator.runtime_params.table1.path = "schema.table1"
        validator.runtime_params.table2.path = "schema.table2"
        validator._count_keys = lambda table_param: counts_by_path[table_param.path]  # type: ignore[method-assign]
        validator._sample_duplicate_keys = lambda table_param: ["a (x2)"]  # type: ignore[method-assign]
        return validator

    def test_it_passes_when_every_key_is_unique(self) -> None:
        validator = self.build_validator({"schema.table1": (100, 100), "schema.table2": (99, 99)})

        validator._validate_key_uniqueness()

    def test_it_raises_naming_the_offending_table(self) -> None:
        validator = self.build_validator({"schema.table1": (100, 100), "schema.table2": (100, 97)})

        with pytest.raises(DuplicateKeyError) as excinfo:
            validator._validate_key_uniqueness()

        assert "schema.table2" in str(excinfo.value)
        assert "100 rows over 97 distinct key values" in str(excinfo.value)

    def test_it_checks_table1_before_table2(self) -> None:
        validator = self.build_validator({"schema.table1": (10, 8), "schema.table2": (10, 7)})

        with pytest.raises(DuplicateKeyError) as excinfo:
            validator._validate_key_uniqueness()

        assert "schema.table1" in str(excinfo.value)

    def test_it_does_not_fail_the_test_when_the_check_could_not_run(self) -> None:
        """A degraded check must not abort a diff that data-diff would still guard itself."""
        validator = self.build_validator({"schema.table1": None, "schema.table2": None})

        validator._validate_key_uniqueness()

    def test_it_skips_tables_without_key_columns(self) -> None:
        validator = self.build_validator({"schema.table1": (10, 8), "schema.table2": (10, 8)})
        validator.runtime_params.table1.key_columns = []
        validator.runtime_params.table2.key_columns = None

        validator._validate_key_uniqueness()


class TestCountKeysFailsOpen:
    def test_it_returns_none_and_warns_when_the_query_raises(self, caplog: pytest.LogCaptureFixture) -> None:
        validator = TableDiffValidator(
            runner=[],
            test_case=TestCase.model_construct(parameterValues=[]),
            execution_date=Timestamp(root=int(datetime.datetime.now().timestamp())),
        )
        table_param = build_table_parameter(
            build_column("id", constraint=Constraint.PRIMARY_KEY), key_columns=["id"], extra_columns=[]
        )
        with (
            patch.object(TableDiffValidator, "_key_check_segment", side_effect=OSError("no route to host")),
            caplog.at_level("WARNING"),
        ):
            assert validator._count_keys(table_param) is None

        assert "Could not validate key uniqueness" in caplog.text

    def test_sampling_failure_degrades_to_an_empty_list(self) -> None:
        validator = TableDiffValidator(
            runner=[],
            test_case=TestCase.model_construct(parameterValues=[]),
            execution_date=Timestamp(root=int(datetime.datetime.now().timestamp())),
        )
        table_param = build_table_parameter(
            build_column("id", constraint=Constraint.PRIMARY_KEY), key_columns=["id"], extra_columns=[]
        )
        with patch.object(TableDiffValidator, "_key_check_segment", side_effect=OSError("no route to host")):
            assert validator._sample_duplicate_keys(table_param) == []
