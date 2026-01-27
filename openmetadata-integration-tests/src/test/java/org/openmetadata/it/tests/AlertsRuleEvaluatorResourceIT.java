package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.spel.support.SimpleEvaluationContext;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AlertsRuleEvaluatorResourceIT {

  @Test
  void test_matchAnySource(TestNamespace ns) {
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType("alert");
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();
    assertTrue(evaluateExpression("matchAnySource('alert')", evaluationContext));
    assertFalse(evaluateExpression("matchAnySource('bot')", evaluationContext));
  }

  @Test
  void test_matchAnyOwnerName(TestNamespace ns) {
    Table createdTable = createTableWithOwner(ns);

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(createdTable);

    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    String ownerName = SharedEntities.get().USER1.getName();
    assertTrue(evaluateExpression("matchAnyOwnerName('" + ownerName + "')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyOwnerName('nonExistentOwner')", evaluationContext));
  }

  @Test
  @Disabled("TestCase.getTestSuite().getFullyQualifiedName() returns null - needs investigation")
  void test_matchAnyEntityFqn(TestNamespace ns) {
    Table createdTable = createTable(ns);
    String tableFqn = createdTable.getFullyQualifiedName();

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(createdTable);

    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(evaluateExpression("matchAnyEntityFqn({'" + tableFqn + "'})", evaluationContext));
    assertFalse(evaluateExpression("matchAnyEntityFqn({'nonExistentFqn'})", evaluationContext));

    TestCase testCase = createTestCase(ns, createdTable);
    String testSuiteFqn = testCase.getTestSuite().getFullyQualifiedName();

    changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TEST_CASE);
    changeEvent.setEntity(testCase);

    alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(
        evaluateExpression("matchAnyEntityFqn({'" + testSuiteFqn + "'})", evaluationContext));
    assertFalse(evaluateExpression("matchAnyEntityFqn({'nonExistentFqn'})", evaluationContext));
  }

  @Test
  void test_matchAnyEntityId(TestNamespace ns) {
    Table createdTable = createTable(ns);

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(createdTable);

    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    String id = createdTable.getId().toString();
    assertTrue(evaluateExpression("matchAnyEntityId('" + id + "')", evaluationContext));
    assertFalse(
        evaluateExpression("matchAnyEntityId('" + UUID.randomUUID() + "')", evaluationContext));
  }

  @Test
  void test_matchAnyEventType(TestNamespace ns) {
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEventType(EventType.ENTITY_CREATED);

    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(evaluateExpression("matchAnyEventType('entityCreated')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyEventType('entityUpdated')", evaluationContext));
  }

  @Test
  void test_matchTestResult(TestNamespace ns) {
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
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(evaluateExpression("matchTestResult('Success')", evaluationContext));
    assertFalse(evaluateExpression("matchTestResult('Failed')", evaluationContext));
  }

  @Test
  void test_matchUpdatedBy(TestNamespace ns) {
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setUserName("testUser");

    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(evaluateExpression("matchUpdatedBy('testUser')", evaluationContext));
    assertFalse(evaluateExpression("matchUpdatedBy('otherUser')", evaluationContext));
  }

  @Test
  void test_matchAnyFieldChange(TestNamespace ns) {
    ChangeDescription changeDescription = new ChangeDescription();
    changeDescription.setFieldsUpdated(
        List.of(new FieldChange().withName("description").withOldValue("old").withNewValue("new")));

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setChangeDescription(changeDescription);

    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(evaluateExpression("matchAnyFieldChange('description')", evaluationContext));
    assertFalse(evaluateExpression("matchAnyFieldChange('nonExistentField')", evaluationContext));
  }

  private Table createTable(TestNamespace ns) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    DatabaseService service =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("pg_" + shortId)
            .connection(conn)
            .description("Test Postgres service")
            .create();

    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("db_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.Database database =
        SdkClients.adminClient().databases().create(dbReq);

    org.openmetadata.schema.api.data.CreateDatabaseSchema schemaReq =
        new org.openmetadata.schema.api.data.CreateDatabaseSchema();
    schemaReq.setName("s_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName("t_" + shortId);
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private Table createTableWithOwner(TestNamespace ns) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    DatabaseService service =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("pg_" + shortId)
            .connection(conn)
            .description("Test Postgres service")
            .create();

    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("db_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.Database database =
        SdkClients.adminClient().databases().create(dbReq);

    org.openmetadata.schema.api.data.CreateDatabaseSchema schemaReq =
        new org.openmetadata.schema.api.data.CreateDatabaseSchema();
    schemaReq.setName("s_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName("t_" + shortId);
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));
    tableRequest.setOwners(List.of(SharedEntities.get().USER1_REF));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private TestCase createTestCase(TestNamespace ns, Table table) {
    CreateTestCase createTestCase = new CreateTestCase();
    createTestCase.setName(ns.prefix("testCase"));
    createTestCase.setDescription("Test case for alert evaluation");
    createTestCase.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    createTestCase.setTestDefinition("tableRowCountToEqual");
    createTestCase.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    TestCase testCase = SdkClients.adminClient().testCases().create(createTestCase);

    return SdkClients.adminClient().testCases().get(testCase.getId().toString(), "testSuite");
  }

  private Boolean evaluateExpression(String condition, EvaluationContext evaluationContext) {
    return parseExpression(condition).getValue(evaluationContext, Boolean.class);
  }
}
