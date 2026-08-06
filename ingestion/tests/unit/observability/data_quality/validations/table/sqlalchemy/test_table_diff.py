import datetime
from typing import Generator  # noqa: UP035
from unittest.mock import MagicMock, Mock, patch

import dsnparse
import pytest
from data_diff.databases._connect import CustomParseResult
from data_diff.diff_tables import DiffResultWrapper
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
    """The message is the whole point: it names the key columns the user has to change."""

    def test_it_names_a_single_key_column_and_the_table(self) -> None:
        error = DuplicateKeyError(["OrderRef"], "mssql.SalesDB.dbo.OrderEvents_Source")

        assert str(error) == (
            "Key column 'OrderRef' is not unique in mssql.SalesDB.dbo.OrderEvents_Source. "
            "A row-level diff needs a unique key: pick a unique column, or add more columns to the key."
        )

    def test_it_pluralises_for_a_composite_key(self) -> None:
        error = DuplicateKeyError(["OrderRef", "Region"], "db.schema.tbl")

        assert "Key columns ('OrderRef', 'Region') are not unique in db.schema.tbl" in str(error)

    def test_it_hedges_when_the_table_is_unknown(self) -> None:
        """joindiff validates both tables at once and does not say which one failed."""
        error = DuplicateKeyError(["id"])

        assert "Key column 'id' is not unique in one of the compared tables." in str(error)


def build_duplicate_key_validator() -> TableDiffValidator:
    validator = TableDiffValidator(
        runner=[],
        test_case=TestCase.model_construct(parameterValues=[]),
        execution_date=Timestamp(root=int(datetime.datetime.now().timestamp())),
    )
    table1 = build_table_parameter(
        build_column("id", constraint=Constraint.PRIMARY_KEY), key_columns=["id"], extra_columns=["name"]
    )
    table1.fullyQualifiedName = "pg.db.schema.table1"
    table2 = build_table_parameter(
        build_column("id", constraint=Constraint.PRIMARY_KEY), key_columns=["id"], extra_columns=["name"]
    )
    table2.fullyQualifiedName = "pg.db.schema.table2"
    validator.runtime_params = TableDiffRuntimeParameters(
        table1=table1,
        table2=table2,
        table_profile_config=None,
        whereClause=None,
        keyColumns=["id"],
        extraColumns=["name"],
    )
    return validator


def build_diff_result(*rows: tuple[str, tuple[str, ...]]) -> DiffResultWrapper:
    """A wrapper whose rows are already materialised, as they are when `_get_stats` fails."""
    return DiffResultWrapper(diff=iter(()), info_tree=None, stats={}, result_list=list(rows))


class TestDuplicateKeysNamed:
    """data-diff reports a non-unique key opaquely, and only after the diff has already failed.

    See the notes in tableDiff.TableDiffValidator._duplicate_keys_named.
    """

    def test_it_names_the_key_when_joindiff_rejects_it(self) -> None:
        validator = build_duplicate_key_validator()

        with pytest.raises(DuplicateKeyError) as excinfo, validator._duplicate_keys_named(build_diff_result()):
            raise ValueError("Duplicate primary keys")

        assert "Key column 'id' is not unique in one of the compared tables" in str(excinfo.value)

    def test_it_leaves_an_unrelated_value_error_alone(self) -> None:
        validator = build_duplicate_key_validator()

        with (
            pytest.raises(ValueError, match="Cannot apply key types") as excinfo,
            validator._duplicate_keys_named(build_diff_result()),
        ):
            raise ValueError("Cannot apply key types")

        assert not isinstance(excinfo.value, DuplicateKeyError)

    def test_it_blames_table1_for_a_repeated_left_row(self) -> None:
        """hashdiff only trips on the duplicate in `_get_stats`; the rows are already in memory."""
        validator = build_duplicate_key_validator()
        diff_result = build_diff_result(("-", ("7", "alice")), ("+", ("7", "alicia")), ("-", ("7", "alice")))

        with pytest.raises(DuplicateKeyError) as excinfo, validator._duplicate_keys_named(diff_result):
            raise AssertionError

        assert "Key column 'id' is not unique in pg.db.schema.table1" in str(excinfo.value)

    def test_it_blames_table2_for_a_repeated_right_row(self) -> None:
        validator = build_duplicate_key_validator()
        diff_result = build_diff_result(("+", ("7", "alicia")), ("+", ("7", "alicia")))

        with pytest.raises(DuplicateKeyError) as excinfo, validator._duplicate_keys_named(diff_result):
            raise AssertionError

        assert "in pg.db.schema.table2" in str(excinfo.value)

    def test_it_re_raises_an_assertion_that_is_not_about_duplicate_keys(self) -> None:
        """Other data-diff invariants assert too; we must not mislabel them."""
        validator = build_duplicate_key_validator()
        diff_result = build_diff_result(("-", ("7", "alice")), ("+", ("8", "bob")))

        with pytest.raises(AssertionError) as excinfo, validator._duplicate_keys_named(diff_result):
            raise AssertionError("table1.is_bounded")

        assert not isinstance(excinfo.value, DuplicateKeyError)

    def test_the_same_key_on_both_sides_is_an_ordinary_diff(self) -> None:
        """One '-' and one '+' for a key is how every changed row is reported."""
        validator = build_duplicate_key_validator()
        diff_result = build_diff_result(("-", ("7", "alice")), ("+", ("7", "alicia")))

        with pytest.raises(AssertionError), validator._duplicate_keys_named(diff_result):
            raise AssertionError

    def test_it_passes_a_successful_diff_through(self) -> None:
        validator = build_duplicate_key_validator()

        with validator._duplicate_keys_named(build_diff_result()):
            pass
