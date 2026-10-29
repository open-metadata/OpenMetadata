package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

class TestCaseDefinitionConformanceTest {

  private static final Table TABLE =
      new Table()
          .withColumns(
              List.of(
                  new Column().withName("Amount").withDataType(ColumnDataType.NUMERIC),
                  new Column().withName("note").withDataType(ColumnDataType.VARCHAR),
                  new Column().withName("untyped")));

  private static final TestDefinition CUSTOM_SQL =
      new TestDefinition()
          .withName("tableCustomSQLQuery")
          .withEntityType(TestDefinitionEntityType.TABLE)
          .withParameterDefinition(
              List.of(
                  new TestCaseParameter()
                      .withName("strategy")
                      .withOptionValues(List.of("ROWS", "COUNT"))));

  private static final TestDefinition LENGTHS =
      new TestDefinition()
          .withName("columnValueLengthsToBeBetween")
          .withEntityType(TestDefinitionEntityType.COLUMN)
          .withSupportedDataTypes(List.of(ColumnDataType.VARCHAR, ColumnDataType.STRING))
          .withSupportsDynamicAssertion(true);

  private static EntityLink table() {
    return EntityLink.parse("<#E::table::svc.db.sch.orders>");
  }

  private static EntityLink column(String name) {
    return EntityLink.parse("<#E::table::svc.db.sch.orders::columns::" + name + ">");
  }

  private static TestCase withParameter(String name, String value) {
    return new TestCase()
        .withParameterValues(List.of(new TestCaseParameterValue().withName(name).withValue(value)));
  }

  @Test
  void anOptionValueIsAccepted() {
    assertDoesNotThrow(
        () ->
            TestCaseDefinitionConformance.validate(
                withParameter("strategy", "COUNT"), CUSTOM_SQL, TABLE, table()));
  }

  @Test
  void anOptionValueInAnotherCaseIsAcceptedAsThresholdUnitAlreadyIs() {
    assertDoesNotThrow(
        () ->
            TestCaseDefinitionConformance.validate(
                withParameter("strategy", "count"), CUSTOM_SQL, TABLE, table()));
  }

  @Test
  void aValueThatIsNoneOfTheOptionsIsRejected() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                TestCaseDefinitionConformance.validate(
                    withParameter("strategy", "[\"ROWS\"]"), CUSTOM_SQL, TABLE, table()));
    assertTrue(error.getMessage().contains("must be one of [ROWS, COUNT]"), error.getMessage());
  }

  @Test
  void aBlankOptionalValueIsTreatedAsUnset() {
    assertDoesNotThrow(
        () ->
            TestCaseDefinitionConformance.validate(
                withParameter("strategy", ""), CUSTOM_SQL, TABLE, table()));
  }

  @Test
  void aWhitespaceValueIsTreatedAsUnsetAsTheGeneratorReadsIt() {
    assertDoesNotThrow(
        () ->
            TestCaseDefinitionConformance.validate(
                withParameter("strategy", "  "), CUSTOM_SQL, TABLE, table()));
  }

  @Test
  void aParameterTheDefinitionGivesNoOptionsIsNotChecked() {
    assertDoesNotThrow(
        () ->
            TestCaseDefinitionConformance.validate(
                withParameter("sqlExpression", "SELECT 1"), CUSTOM_SQL, TABLE, table()));
  }

  @Test
  void aColumnOfAnUnsupportedTypeIsRejectedWhateverTheNameCase() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                TestCaseDefinitionConformance.validate(
                    new TestCase(), LENGTHS, TABLE, column("amount")));
    assertTrue(error.getMessage().contains("NUMERIC"), error.getMessage());
  }

  @Test
  void aColumnOfASupportedTypeIsAccepted() {
    assertDoesNotThrow(
        () ->
            TestCaseDefinitionConformance.validate(new TestCase(), LENGTHS, TABLE, column("note")));
  }

  @Test
  void aColumnOfUnknownTypeIsAccepted() {
    assertDoesNotThrow(
        () ->
            TestCaseDefinitionConformance.validate(
                new TestCase(), LENGTHS, TABLE, column("untyped")));
  }

  @Test
  void anEmptySupportedTypeListAcceptsEveryColumn() {
    TestDefinition anyType =
        new TestDefinition()
            .withName("columnValuesToBeNotNull")
            .withEntityType(TestDefinitionEntityType.COLUMN);
    assertDoesNotThrow(
        () ->
            TestCaseDefinitionConformance.validate(
                new TestCase(), anyType, TABLE, column("Amount")));
  }

  @Test
  void aTableTestIsNotCheckedAgainstColumnTypes() {
    assertDoesNotThrow(
        () -> TestCaseDefinitionConformance.validate(new TestCase(), LENGTHS, TABLE, table()));
  }

  @Test
  void anUpdateThatChangesAnOptionToOneNotOfferedIsRejected() {
    TestCase stored = withParameter("strategy", "ROWS").withEntityLink(table().getLinkString());
    TestCase updated = withParameter("strategy", "SUM").withEntityLink(table().getLinkString());
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                TestCaseDefinitionConformance.validateUpdate(
                    stored, updated, () -> CUSTOM_SQL, () -> TABLE));
    assertTrue(error.getMessage().contains("must be one of [ROWS, COUNT]"), error.getMessage());
  }

  @Test
  void anUpdateKeepsAStoredValueOutsideTheOptionsEditable() {
    TestCase stored = withParameter("strategy", "SUM").withEntityLink(table().getLinkString());
    TestCase updated =
        withParameter("strategy", "SUM")
            .withEntityLink(table().getLinkString())
            .withDescription("edited");
    assertDoesNotThrow(
        () ->
            TestCaseDefinitionConformance.validateUpdate(
                stored, updated, () -> CUSTOM_SQL, () -> TABLE));
  }

  @Test
  void anUpdateKeepsATestOnAColumnRetypedSinceEditable() {
    TestCase stored = new TestCase().withEntityLink(column("Amount").getLinkString());
    TestCase updated =
        new TestCase().withEntityLink(column("Amount").getLinkString()).withDescription("edited");
    assertDoesNotThrow(
        () ->
            TestCaseDefinitionConformance.validateUpdate(
                stored, updated, () -> LENGTHS, () -> TABLE));
  }

  /** An inspection query is stored by an update that changes no parameter. */
  @Test
  void anUpdateThatChangesNoParameterDoesNotLoadTheDefinition() {
    TestCase stored = withParameter("strategy", "ROWS").withEntityLink(table().getLinkString());
    TestCase updated =
        withParameter("strategy", "ROWS")
            .withEntityLink(table().getLinkString())
            .withInspectionQuery("SELECT 1");
    assertDoesNotThrow(
        () ->
            TestCaseDefinitionConformance.validateUpdate(
                stored,
                updated,
                () -> {
                  throw new AssertionError("the definition was loaded");
                },
                () -> TABLE));
  }

  @Test
  void anUpdateThatMovesTheTestToAnUnsupportedColumnIsRejected() {
    TestCase stored = new TestCase().withEntityLink(column("note").getLinkString());
    TestCase updated = new TestCase().withEntityLink(column("Amount").getLinkString());
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                TestCaseDefinitionConformance.validateUpdate(
                    stored, updated, () -> LENGTHS, () -> TABLE));
    assertTrue(error.getMessage().contains("NUMERIC"), error.getMessage());
  }

  @Test
  void anUpdateThatChangesTheDefinitionChecksEveryValueAgainstIt() {
    TestCase stored =
        withParameter("strategy", "SUM")
            .withEntityLink(table().getLinkString())
            .withTestDefinition(new EntityReference().withId(UUID.randomUUID()));
    TestCase updated =
        withParameter("strategy", "SUM")
            .withEntityLink(table().getLinkString())
            .withTestDefinition(new EntityReference().withId(UUID.randomUUID()));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            TestCaseDefinitionConformance.validateUpdate(
                stored, updated, () -> CUSTOM_SQL, () -> TABLE));
  }

  /**
   * ai-platform reads a bound as a parameter with a validationRule; every dynamic seed must mark
   * its bounds so.
   */
  @Test
  void everySeededDynamicDefinitionMarksItsBoundsWithAValidationRule() throws IOException {
    for (TestDefinition definition : SeededTestDefinitions.all()) {
      if (Boolean.TRUE.equals(definition.getSupportsDynamicAssertion())) {
        long bounds =
            definition.getParameterDefinition().stream()
                .filter(parameter -> parameter.getValidationRule() != null)
                .count();
        assertTrue(bounds >= 2, definition.getName() + " has " + bounds + " ruled bounds");
      }
    }
  }
}
