package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.spel.support.StandardEvaluationContext;

class AlertsRuleEvaluatorTest extends OpenMetadataApplicationTest {
  private static TableResourceTest tableResourceTest;

  @BeforeAll
  public static void setup(TestInfo test) throws URISyntaxException, IOException {
    tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test);
  }

  @Test
  void test_matchAnySource() {
    // Create a change Event with Entity Type and test for source in list and not in list
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType("alert");
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(evaluateExpression("matchAnySource('alert')", evaluationContext));
    assertFalse(evaluateExpression("matchAnySource('bot')", evaluationContext));
  }

  @Test
  void test_matchAnyOwnerName(TestInfo test) throws IOException {
    // Create Table Entity
    List<Column> columns = List.of(TableResourceTest.getColumn("c1", ColumnDataType.INT, null));
    CreateTable create =
        tableResourceTest.createRequest(test).withColumns(columns).withOwner(EntityResourceTest.USER1_REF);
    Table createdTable = tableResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Create a change Event with the Entity Table
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(createdTable);

    // Test Owner Name Present in list and not present in list
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(
        evaluateExpression("matchAnyOwnerName('" + EntityResourceTest.USER1.getName() + "')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyOwnerName('tempName')", evaluationContext));
  }

  @Test
  void test_matchAnyEntityFqn(TestInfo test) throws IOException {
    // Create Table Entity
    List<Column> columns = List.of(TableResourceTest.getColumn("c1", ColumnDataType.INT, null));
    CreateTable create = tableResourceTest.createRequest(test).withColumns(columns);
    Table createdTable = tableResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Create a change Event with the Entity Table
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(createdTable);

    // Test Entity Fqn in List of match and not present in list
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    String fqn = createdTable.getFullyQualifiedName();
    assertTrue(evaluateExpression("matchAnyEntityFqn('" + fqn + "')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyEntityFqn('testFQN1')", evaluationContext));
  }

  @Test
  void test_matchAnyEntityId(TestInfo test) throws IOException {
    // Create Table Entity
    List<Column> columns = List.of(TableResourceTest.getColumn("c1", ColumnDataType.INT, null));
    CreateTable create = tableResourceTest.createRequest(test).withColumns(columns);
    Table createdTable = tableResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Create a change Event with Table Entity and Type
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(createdTable);

    // Test Entity Id in List of match and not present in list
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    String id = createdTable.getId().toString();
    assertTrue(evaluateExpression("matchAnyEntityId('" + id + "')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyEntityId('" + UUID.randomUUID() + "')", evaluationContext));
  }

  @Test
  void test_matchAnyEventType() {
    // Create a change Event with EventType
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEventType(EventType.ENTITY_CREATED);

    // Check if eventType present in list or absent from the list
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(evaluateExpression("matchAnyEventType('entityCreated')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyEventType('entityUpdated')", evaluationContext));
  }

  @Test
  void test_matchTestResult() {
    // Create a change Description with Test Result Field
    ChangeDescription changeDescription = new ChangeDescription();
    changeDescription.setFieldsUpdated(
        List.of(
            new FieldChange()
                .withName("testCaseResult")
                .withOldValue("test1")
                .withNewValue(new TestCaseResult().withTestCaseStatus(TestCaseStatus.Success))));

    // Create a change event with Test Case and Test Result Change Description
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TEST_CASE);
    changeEvent.setChangeDescription(changeDescription);

    // Test If Test Result status matches in list and if status not matches
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(evaluateExpression("matchTestResult('Success')", evaluationContext));
    assertFalse(evaluateExpression("matchTestResult('Failed')", evaluationContext));
  }

  @Test
  void test_matchUpdatedBy() {
    // Create a change Event with updatedBy username
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setUserName("test");

    // Test if the username is in list or not
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(evaluateExpression("matchUpdatedBy('test')", evaluationContext));
    assertFalse(evaluateExpression("matchUpdatedBy('test1')", evaluationContext));
  }

  @Test
  void test_matchAnyFieldChange() {
    // Create a change Event with some Change Description and Field Change
    ChangeDescription changeDescription = new ChangeDescription();
    changeDescription.setFieldsUpdated(
        List.of(new FieldChange().withName("test").withOldValue("test1").withNewValue("test2")));

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setChangeDescription(changeDescription);

    // Test if the updated field matches from the list or not
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(evaluateExpression("matchAnyFieldChange('test')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyFieldChange('temp')", evaluationContext));
  }

  private Boolean evaluateExpression(String condition, EvaluationContext evaluationContext) {
    return parseExpression(condition).getValue(evaluationContext, Boolean.class);
  }
}
