package org.openmetadata.service.alerts;

import java.net.URI;
import java.util.ArrayList;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.util.ChangeEventParser;

public class AlertsURLFormattingTest {

  private static ChangeEvent testCaseChangeEvent;
  private static ChangeEvent tableChangeEvent;

  @BeforeAll
  static void setUp() {
    UUID testCaseId = UUID.randomUUID();
    UUID tableId = UUID.randomUUID();
    testCaseChangeEvent =
        new ChangeEvent()
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType("TestCase")
            .withEntityId(UUID.randomUUID())
            .withEntityFullyQualifiedName("UnitTest.TestCase")
            .withUserName("UnitTestUser")
            .withTimestamp(System.currentTimeMillis())
            .withEntity(
                new TestCase()
                    .withName("TestCaseForUnitTest")
                    .withId(testCaseId)
                    .withFullyQualifiedName("UnitTest.TestCase")
                    .withEntityLink("<#E::table::Table.For.UnitTest>")
                    .withEntityFQN("Table.For.UnitTest")
                    .withHref(URI.create(String.format("http://localhost:8080/api/v1/testCase/%s", testCaseId)))
                    .withTestSuite(
                        new EntityReference()
                            .withId(UUID.randomUUID())
                            .withName("TestSuiteForUnitTest")
                            .withFullyQualifiedName("UnitTest.TestSuite")));

    ArrayList<Column> columns = new ArrayList<>();

    for (int i = 0; i < 3; i++) {
      columns.add(
          new Column()
              .withName("col" + i)
              .withDataType(ColumnDataType.INT)
              .withFullyQualifiedName("database.TableForUnitTest.col" + i));
    }
    columns.add(
        new Column()
            .withName("col1")
            .withDataType(ColumnDataType.INT)
            .withFullyQualifiedName("database.TableForUnitTest.col1"));

    tableChangeEvent =
        new ChangeEvent()
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType("table")
            .withEntityId(UUID.randomUUID())
            .withEntityFullyQualifiedName("UnitTestService.database.TableForUnitTest")
            .withUserName("UnitTestUser")
            .withTimestamp(System.currentTimeMillis())
            .withEntity(
                new Table()
                    .withId(tableId)
                    .withName("database.TableForUnitTest")
                    .withFullyQualifiedName("UnitTestService.database.TableForUnitTest")
                    .withHref(URI.create(String.format("http://localhost:8080/api/v1/table/%s", tableId)))
                    .withColumns(columns)
                    .withDatabase(
                        new EntityReference()
                            .withId(UUID.randomUUID())
                            .withName("database")
                            .withFullyQualifiedName("UnitTestService.database")));
  }

  @Test
  void testAlertsSlackURLFormatting() {
    String testCaseUrl = ChangeEventParser.getEntityUrl(ChangeEventParser.PUBLISH_TO.SLACK, testCaseChangeEvent);
    assert testCaseUrl.equals("<http://localhost/test-suites/UnitTest.TestSuite|UnitTest.TestSuite>");
    String tableUrl = ChangeEventParser.getEntityUrl(ChangeEventParser.PUBLISH_TO.SLACK, tableChangeEvent);
    assert tableUrl.equals(
        "<http://localhost/table/UnitTestService.database.TableForUnitTest|UnitTestService.database.TableForUnitTest>");
  }
}
