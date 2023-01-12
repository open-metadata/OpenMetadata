package org.openmetadata.service.alerts;

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
    // Create a change Event
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType("alert");
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(evaluateExpression("matchAnySource('alert')", evaluationContext));
    assertFalse(evaluateExpression("matchAnySource('bot')", evaluationContext));
  }

  @Test
  void test_matchAnyOwnerName(TestInfo test) throws IOException {
    // Create Table
    List<Column> columns = List.of(new Column().withName("c1").withDataType(ColumnDataType.INT));
    CreateTable create =
        tableResourceTest.createRequest(test).withColumns(columns).withOwner(EntityResourceTest.USER1_REF);
    Table createdTable = tableResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    // Create a change Event
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(createdTable);

    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(
        evaluateExpression("matchAnyOwnerName('" + EntityResourceTest.USER1.getName() + "')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyOwnerName('tempName')", evaluationContext));
  }

  @Test
  void test_matchAnyEntityFqn(TestInfo test) throws IOException {
    // Create Table
    List<Column> columns = List.of(new Column().withName("c1").withDataType(ColumnDataType.INT));
    CreateTable create = tableResourceTest.createRequest(test).withColumns(columns);
    Table createdTable = tableResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    // Create a change Event
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(createdTable);

    // Check AlertRuleEvaluator
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    String fqn = createdTable.getFullyQualifiedName();
    assertTrue(evaluateExpression("matchAnyEntityFqn('" + fqn + "')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyEntityFqn('testFQN1')", evaluationContext));
  }

  @Test
  void test_matchAnyEntityId(TestInfo test) throws IOException {
    // Create Table
    List<Column> columns = List.of(new Column().withName("c1").withDataType(ColumnDataType.INT));
    CreateTable create = tableResourceTest.createRequest(test).withColumns(columns);
    Table createdTable = tableResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    // Create a change Event
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(createdTable);

    // Check AlertRuleEvaluator
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    String id = createdTable.getId().toString();
    assertTrue(evaluateExpression("matchAnyEntityId('" + id + "')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyEntityId('" + UUID.randomUUID() + "')", evaluationContext));
  }

  @Test
  void test_matchAnyEventType() {
    // Create a change Event
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEventType(EventType.ENTITY_CREATED);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(evaluateExpression("matchAnyEventType('entityCreated')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyEventType('entityUpdated')", evaluationContext));
  }

  @Test
  void test_matchTestResult() {
    // Create a change Event
    ChangeDescription changeDescription = new ChangeDescription();
    changeDescription.setFieldsUpdated(
        List.of(
            new FieldChange()
                .withName("testCaseResult")
                .withOldValue("test1")
                .withNewValue(new TestCaseResult().withTestCaseStatus(TestCaseStatus.Success))));
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TEST_CASE);
    changeEvent.setChangeDescription(changeDescription);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(evaluateExpression("matchTestResult('Success')", evaluationContext));
    assertFalse(evaluateExpression("matchTestResult('Failed')", evaluationContext));
  }

  @Test
  void test_matchUpdatedBy() {
    // Create a change Event
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setUserName("test");
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(evaluateExpression("matchUpdatedBy('test')", evaluationContext));
    assertFalse(evaluateExpression("matchUpdatedBy('test1')", evaluationContext));
  }

  @Test
  void test_matchAnyFieldChange() {
    // Create a change Event
    ChangeDescription changeDescription = new ChangeDescription();
    changeDescription.setFieldsUpdated(
        List.of(new FieldChange().withName("test").withOldValue("test1").withNewValue("test2")));
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setChangeDescription(changeDescription);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext = new StandardEvaluationContext(alertsRuleEvaluator);
    assertTrue(evaluateExpression("matchAnyFieldChange('test')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyFieldChange('temp')", evaluationContext));
  }

  private Boolean evaluateExpression(String condition, EvaluationContext evaluationContext) {
    return parseExpression(condition).getValue(evaluationContext, Boolean.class);
  }
}
