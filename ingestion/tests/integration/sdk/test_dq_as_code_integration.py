"""
Integration tests for DQ as Code SDK with a running OpenMetadata server.
Tests that data quality validators are actually executed against real PostgreSQL data.
"""
from dirty_equals import HasAttributes

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import EntityLink
from metadata.sdk.data_quality import (
    ColumnValuesToBeBetween,
    ColumnValuesToBeNotNull,
    ColumnValuesToBeUnique,
    TableColumnCountToBeBetween,
    TableDiff,
    TableRowCountToBeBetween,
    TestRunner,
)


def test_table_row_count_tests(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(
        TableRowCountToBeBetween(min_count=1, max_count=10).with_description(
            "Check users table has between 1-10 rows"
        )
    )

    results = runner.run()

    assert len(results) == 1
    result = results[0]
    assert result.testCaseResult.testCaseStatus == TestCaseStatus.Success

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_table_row_count_failure(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(
        TableRowCountToBeBetween(min_count=100, max_count=1000).with_description(
            "Test that fails - expects 100-1000 rows but has 5"
        )
    )

    results = runner.run()

    assert len(results) == 1
    result = results[0]
    assert result.testCaseResult.testCaseStatus == TestCaseStatus.Failed

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_table_column_count_test(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.products"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(
        TableColumnCountToBeBetween(min_count=2, max_count=5).with_description(
            "Check products table has 2-5 columns"
        )
    )

    results = runner.run()

    assert len(results) == 1
    result = results[0]
    assert result.testCaseResult.testCaseStatus == TestCaseStatus.Success

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_column_unique_test(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(
        ColumnValuesToBeUnique(column="id")
        .with_description("Check user IDs are unique")
        .with_compute_row_count(True)
    )

    results = runner.run()

    assert len(results) == 1
    result = results[0]
    assert result.testCaseResult.testCaseStatus == TestCaseStatus.Success
    assert result.testCaseResult.passedRows == 5
    assert result.testCaseResult.failedRows == 0

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_column_not_null_test(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    test = (
        ColumnValuesToBeNotNull(column="email")
        .with_description("Check email is not null")
        .with_compute_row_count(True)
    )

    runner.add_test(test)

    results = runner.run()

    # Because of parallel tests, the table might contain a TestSuite with other tests already
    test_result = next(
        r
        for r in results
        if r.testCase.testDefinition.name == test.test_definition_name
    )

    assert test_result.testCaseResult.testCaseStatus == TestCaseStatus.Failed
    assert test_result.testCaseResult.passedRows == 4
    assert test_result.testCaseResult.failedRows == 1

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_column_values_between_test(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    test = (
        ColumnValuesToBeBetween(column="age", min_value=20, max_value=40)
        .with_description("Check age is between 20-40")
        .with_compute_row_count(True)
    )

    runner.add_test(test)

    results = runner.run()

    # Because of parallel tests, the table might contain a TestSuite with other tests already
    test_result = next(
        r
        for r in results
        if r.testCase.testDefinition.name == test.test_definition_name
    )

    assert test_result.testCaseResult.testCaseStatus == TestCaseStatus.Success
    assert test_result.testCaseResult.passedRows == 5
    assert test_result.testCaseResult.failedRows == 0

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_multiple_tests_in_single_runner(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    tests = (
        TableRowCountToBeBetween(min_count=1, max_count=10),
        TableColumnCountToBeBetween(min_count=3),
        ColumnValuesToBeUnique(column="username"),
        ColumnValuesToBeNotNull(column="username"),
    )

    runner.add_tests(*tests)

    results = runner.run()

    table_row_count_result = next(
        r
        for r in results
        if r.testCase
        == HasAttributes(
            testDefinition=HasAttributes(name=tests[0].test_definition_name),
            parameterValues=[
                HasAttributes(name="minValue", value="1"),
                HasAttributes(name="maxValue", value="10"),
            ],
        )
    )
    assert (
        table_row_count_result.testCaseResult.testCaseStatus == TestCaseStatus.Success
    )

    test_table_column_count_result = next(
        r
        for r in results
        if r.testCase
        == HasAttributes(
            testDefinition=HasAttributes(name=tests[1].test_definition_name),
            parameterValues=[
                HasAttributes(name="minColValue", value="3"),
            ],
        )
    )
    assert (
        test_table_column_count_result.testCaseResult.testCaseStatus
        == TestCaseStatus.Success
    )

    column_values_unique_result = next(
        r
        for r in results
        if r.testCase
        == HasAttributes(
            testDefinition=HasAttributes(name=tests[2].test_definition_name),
            entityLink=EntityLink(root=f"<#E::table::{table_fqn}::columns::username>"),
        )
    )
    assert (
        column_values_unique_result.testCaseResult.testCaseStatus
        == TestCaseStatus.Success
    )

    column_values_not_null_result = next(
        r
        for r in results
        if r.testCase
        == HasAttributes(
            testDefinition=HasAttributes(name=tests[3].test_definition_name),
            entityLink=EntityLink(root=f"<#E::table::{table_fqn}::columns::username>"),
        )
    )
    assert (
        column_values_not_null_result.testCaseResult.testCaseStatus
        == TestCaseStatus.Success
    )

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_runner_for_table_class_method(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.products"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(TableRowCountToBeBetween(min_count=1, max_count=10))

    results = runner.run()

    assert len(results) == 1
    assert results[0].testCaseResult.testCaseStatus == TestCaseStatus.Success

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_runner_for_table_diff_test(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
) -> None:
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.products"
    table2_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.stg_products"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(
        TableDiff(
            table2=table2_fqn,
            key_columns=["product_id"],
            table2_key_columns=["id"],
        )
    )

    results = runner.run()

    assert len(results) == 1
    assert results[0].testCaseResult.testCaseStatus == TestCaseStatus.Success

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )
