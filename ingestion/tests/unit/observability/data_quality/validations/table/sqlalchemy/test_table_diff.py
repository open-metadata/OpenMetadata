import datetime
import inspect
from typing import Generator
from unittest.mock import MagicMock, Mock, patch

import dsnparse
import pytest
from data_diff.databases._connect import CustomParseResult
from data_diff.diff_tables import DiffResultWrapper
from data_diff.errors import DataDiffDuplicateKeyError
from data_diff.info_tree import InfoTree, SegmentInfo
from dirty_equals import Contains, DirtyEquals, HasAttributes, IsList

from metadata.data_quality.validations.models import (
    TableDiffRuntimeParameters,
    TableParameter,
)
from metadata.data_quality.validations.table.sqlalchemy import tableDiff
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
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
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
def parameters(
    table1_parameter: TableParameter, table2_parameter: TableParameter
) -> TableDiffRuntimeParameters:
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
    with patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableDiff.data_diff"
    ) as data_diff:
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


ENCODED_SERVICE_URL = (
    "postgresql://svc_user%40corp.com:p%40ssw0rd@service{n}:5432/my_db"
)


@pytest.fixture
def encoded_credentials_validator() -> Generator[
    tuple[TableDiffValidator, Mock], None, None
]:
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
    with patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableDiff.data_diff"
    ) as data_diff:
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

        assert validator.runtime_params.table1.serviceUrl == ENCODED_SERVICE_URL.format(
            n=1
        )
        assert validator.runtime_params.table2.serviceUrl == ENCODED_SERVICE_URL.format(
            n=2
        )


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

        assert (
            "Key columns ('OrderRef', 'Region') are not unique in db.schema.tbl"
            in str(error)
        )

    def test_it_hedges_when_the_table_is_unknown(self) -> None:
        """joindiff validates both tables at once and does not say which one failed."""
        error = DuplicateKeyError(["id"])

        assert "Key column 'id' is not unique in one of the compared tables." in str(
            error
        )


def build_duplicate_key_validator() -> TableDiffValidator:
    validator = TableDiffValidator(
        runner=[],
        test_case=TestCase.model_construct(parameterValues=[]),
        execution_date=Timestamp(root=int(datetime.datetime.now().timestamp())),
    )
    table1 = build_table_parameter(
        build_column("id", constraint=Constraint.PRIMARY_KEY),
        key_columns=["id"],
        extra_columns=["name"],
    )
    table1.fullyQualifiedName = "pg.db.schema.table1"
    table2 = build_table_parameter(
        build_column("id", constraint=Constraint.PRIMARY_KEY),
        key_columns=["id"],
        extra_columns=["name"],
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


class TestDuplicateKeysNamed:
    """data-diff reports a non-unique key opaquely, and only after the diff has already failed.

    See the notes in tableDiff.TableDiffValidator._duplicate_keys_named.
    """

    def test_it_names_the_key_when_joindiff_rejects_it(self) -> None:
        validator = build_duplicate_key_validator()

        with pytest.raises(
            DuplicateKeyError
        ) as excinfo, validator._duplicate_keys_named():
            raise ValueError("Duplicate primary keys")

        assert "Key column 'id' is not unique in one of the compared tables" in str(
            excinfo.value
        )

    def test_it_leaves_an_unrelated_value_error_alone(self) -> None:
        validator = build_duplicate_key_validator()

        with (
            pytest.raises(ValueError, match="Cannot apply key types") as excinfo,
            validator._duplicate_keys_named(),
        ):
            raise ValueError("Cannot apply key types")

        assert not isinstance(excinfo.value, DuplicateKeyError)

    @pytest.mark.parametrize(
        "table_index, table",
        ((1, "pg.db.schema.table1"), (2, "pg.db.schema.table2")),
    )
    def test_it_blames_the_table_data_diff_names(
        self, table_index: int, table: str
    ) -> None:
        """hashdiff trips on the duplicate while counting stats, and says which table it is in."""
        validator = build_duplicate_key_validator()

        with pytest.raises(
            DuplicateKeyError
        ) as excinfo, validator._duplicate_keys_named():
            raise DataDiffDuplicateKeyError(
                "Key (id) is not unique in table test_schema.test_table.", table_index
            )

        assert f"Key column 'id' is not unique in {table}" in str(excinfo.value)

    def test_it_re_raises_an_assertion_that_is_not_about_duplicate_keys(self) -> None:
        """Other data-diff invariants assert too; we must not mislabel them."""
        validator = build_duplicate_key_validator()

        with pytest.raises(
            AssertionError
        ) as excinfo, validator._duplicate_keys_named():
            raise AssertionError("table1.is_bounded")

        assert not isinstance(excinfo.value, DuplicateKeyError)

    def test_it_passes_a_successful_diff_through(self) -> None:
        validator = build_duplicate_key_validator()

        with validator._duplicate_keys_named():
            pass


# Keys 1, 2 and 3 differ: 1 changed, 2 is only in table1 and 3 only in table2
THREE_DIFFERING_KEYS = (
    ("-", ("1", "alice")),
    ("+", ("1", "alicia")),
    ("-", ("2", "bob")),
    ("+", ("3", "carol")),
)


def diff_rows(
    *rows: tuple[str, tuple[str, ...]]
) -> Generator[tuple[str, tuple[str, ...]], None, None]:
    """The diff of a table too large to diff whole: the test fails if it is read past `rows`."""
    yield from rows
    pytest.fail("The rest of the diff was read")


class TestCalculateDiffsWithLimit:
    """Past the threshold the test fails whatever the exact count, so the rest of the diff is not worth running."""

    def test_it_stops_reading_the_diff_once_over_the_limit(self) -> None:
        validator = build_duplicate_key_validator()

        assert (
            validator.calculate_diffs_with_limit(diff_rows(*THREE_DIFFERING_KEYS), 2)
            == 3
        )

    @pytest.mark.parametrize("limit", (3, 10))
    def test_it_counts_every_differing_key_up_to_the_limit(self, limit: int) -> None:
        """A changed row comes as a '-' and a '+' row, but it is one diff."""
        validator = build_duplicate_key_validator()

        assert (
            validator.calculate_diffs_with_limit(iter(THREE_DIFFERING_KEYS), limit) == 3
        )


def build_table_diff(
    diff: Generator[tuple[str, tuple[str, ...]], None, None],
    table1_rows: int,
    table2_rows: int,
) -> DiffResultWrapper:
    """What data_diff.diff_tables returns: the tables are diffed only as `diff` is read."""
    tables = [
        Mock(key_columns=("id",), table_path=("test_schema", name))
        for name in ("table1", "table2")
    ]
    info_tree = InfoTree(
        SegmentInfo(tables, rowcounts={1: table1_rows, 2: table2_rows})
    )
    return DiffResultWrapper(diff=diff, info_tree=info_tree, stats={})


def build_run_validator(threshold: int = 0) -> TableDiffValidator:
    validator = build_duplicate_key_validator()
    validator.test_case = TestCase.model_construct(
        parameterValues=[
            TestCaseParameterValue(name="threshold", value=str(threshold))
        ],
        computePassedFailedRowCount=False,
    )
    return validator


@pytest.fixture
def diff_tables() -> Generator[Mock, None, None]:
    """data-diff's entry point: `_run` diffs whatever this returns."""
    with patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableDiff.data_diff"
    ) as data_diff:
        yield data_diff.diff_tables


class TestRun:
    """Only counts are needed: a large diff must not be held in memory, nor run on past the threshold."""

    def test_it_counts_the_diff_without_keeping_its_rows(
        self, diff_tables: Mock
    ) -> None:
        validator = build_run_validator()
        table_diff = build_table_diff(
            (row for row in THREE_DIFFERING_KEYS), table1_rows=4, table2_rows=4
        )
        diff_tables.return_value = table_diff

        with patch.object(validator, "_compute_row_count", return_value=4):
            result = validator._run()

        assert result == HasAttributes(
            testCaseStatus=TestCaseStatus.Failed, failedRows=3, passedRows=2
        )
        assert table_diff.result_list == []

    @pytest.mark.parametrize("debug, diffs_run", ((False, 1), (True, 2)))
    def test_only_debug_logging_diffs_again_for_a_sample(
        self, diff_tables: Mock, debug: bool, diffs_run: int
    ) -> None:
        """The sample of failed rows is a second diff of the tables, logged only at debug level."""
        validator = build_run_validator()
        diff_tables.side_effect = lambda *_, **__: build_table_diff(
            (row for row in THREE_DIFFERING_KEYS), table1_rows=4, table2_rows=4
        )

        with (
            patch.object(validator, "_compute_row_count", return_value=4),
            patch.object(tableDiff.logger, "isEnabledFor", return_value=debug),
        ):
            validator._run()

        assert diff_tables.call_count == diffs_run

    def test_a_repeated_key_is_still_blamed_on_its_table(
        self, diff_tables: Mock
    ) -> None:
        """data-diff finds the duplicate while counting and names the table: no rows are kept to look at."""
        validator = build_run_validator()
        diff_tables.return_value = build_table_diff(
            (row for row in (("+", ("7", "alicia")), ("+", ("7", "alicia")))),
            table1_rows=1,
            table2_rows=2,
        )

        with pytest.raises(DuplicateKeyError) as excinfo:
            validator._run()

        assert "Key column 'id' is not unique in pg.db.schema.table2" in str(
            excinfo.value
        )

    def test_over_the_threshold_it_stops_reading_the_diff_and_closes_it(
        self, diff_tables: Mock
    ) -> None:
        validator = build_run_validator(threshold=2)
        table_diff = build_table_diff(
            diff_rows(*THREE_DIFFERING_KEYS), table1_rows=4, table2_rows=4
        )
        diff_tables.return_value = table_diff

        result = validator._run()

        assert result == HasAttributes(
            testCaseStatus=TestCaseStatus.Failed, failedRows=3
        )
        # Read off the raw diff: the wrapper keeps every row it yields in result_list
        assert table_diff.result_list == []
        # Closing the diff is what stops data-diff's worker pool
        assert inspect.getgeneratorstate(table_diff.diff) == inspect.GEN_CLOSED
