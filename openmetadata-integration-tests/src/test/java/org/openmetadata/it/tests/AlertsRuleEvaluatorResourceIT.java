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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
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

  /**
   * Regression: matchAnyEntityFqn must compare FQNs literally, not as Java regex. FQNs in
   * OpenMetadata can contain characters that are regex metacharacters (e.g. test suites named like
   * "[TML] Fraud Mart Test Suite"). Customer-reported via openmetadata-collate#4019.
   */
  @ParameterizedTest
  @ValueSource(
      strings = {
        "[TML] Fraud Mart Test Suite",
        "service.db.schema.name+plus",
        "service.db.schema.name?question",
        "service.db.schema.name|pipe",
        "service.db.schema.name*star",
        "service.db.schema.[bracketed].table",
        "AENG - CSP work item bug checks (duration exceeded)",
      })
  void test_matchAnyEntityFqn_treatsRegexMetacharsAsLiteral(String fqn) {
    Table table = new Table().withName("t").withFullyQualifiedName(fqn);
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(table);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    // Single-element list: matching FQN returns true.
    assertTrue(evaluateExpression("matchAnyEntityFqn({'" + fqn + "'})", evaluationContext));
    // Multi-element list with the matching FQN at the tail: ensures SpEL passes the full
    // comma-separated list and the matcher iterates past the first element.
    assertTrue(
        evaluateExpression(
            "matchAnyEntityFqn({'irrelevant.first', '" + fqn + "', 'irrelevant.last'})",
            evaluationContext));
    // Multi-element list without the matching FQN: returns false (no false positives).
    assertFalse(
        evaluateExpression(
            "matchAnyEntityFqn({'unrelated.first', 'unrelated.second'})", evaluationContext));
  }

  @Test
  void test_matchAnyEntityFqn_testSuiteFallback_treatsInputAsLiteral() {
    String testSuiteFqn = "[TML] Fraud Mart Test Suite";
    TestSuite testSuite = new TestSuite().withFullyQualifiedName(testSuiteFqn);
    TestCase testCase =
        new TestCase()
            .withName("tc")
            .withFullyQualifiedName("table.tc")
            .withTestSuites(List.of(testSuite));

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TEST_CASE);
    changeEvent.setEntity(testCase);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(
        evaluateExpression("matchAnyEntityFqn({'" + testSuiteFqn + "'})", evaluationContext));
    assertFalse(evaluateExpression("matchAnyEntityFqn({'unrelated.fqn'})", evaluationContext));
  }

  // matchAnyEntityFqn matches the entity FQN exactly or any ancestor (service/database scope).
  @ParameterizedTest
  @ValueSource(
      strings = {
        "Snowflake Integration", // service ancestor
        "Snowflake Integration.BRONZE_DEV", // database ancestor
        "Snowflake Integration.BRONZE_DEV.MITELEPLUS", // exact
      })
  void test_matchAnyEntityFqn_matchesEntityOrAncestor(String listedFqn) {
    Table table =
        new Table()
            .withName("MITELEPLUS")
            .withFullyQualifiedName("Snowflake Integration.BRONZE_DEV.MITELEPLUS");
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(table);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(evaluateExpression("matchAnyEntityFqn({'" + listedFqn + "'})", evaluationContext));
  }

  @Test
  void test_matchAnyEntityFqn_rejectsSiblingAndPrefixCollision() {
    Table table =
        new Table().withName("X").withFullyQualifiedName("Snowflake Integration 2.BRONZE_DEV.X");
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(table);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    // Sibling service sharing a name prefix must not match.
    assertFalse(
        evaluateExpression("matchAnyEntityFqn({'Snowflake Integration'})", evaluationContext));

    Table sibling = new Table().withName("t").withFullyQualifiedName("service.db.schema2.t");
    changeEvent.setEntity(sibling);
    alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();
    // Prefix collision: schema2 is not under schema.
    assertFalse(evaluateExpression("matchAnyEntityFqn({'service.db.schema'})", evaluationContext));
  }

  @Test
  void test_matchAnyEntityFqn_childFqnDoesNotMatchParentEntity() {
    Table schema = new Table().withName("schema").withFullyQualifiedName("service.db.schema");
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(schema);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertFalse(
        evaluateExpression("matchAnyEntityFqn({'service.db.schema.table'})", evaluationContext));
  }

  @Test
  void test_filterByTableNameTestCaseBelongsTo_happyPath() {
    String tableFqn = "service.db.schema.orders";
    TestCase testCase = new TestCase().withName("tc").withEntityFQN(tableFqn);

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TEST_CASE);
    changeEvent.setEntity(testCase);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(
        evaluateExpression(
            "filterByTableNameTestCaseBelongsTo({'" + tableFqn + "'})", evaluationContext));
    assertFalse(
        evaluateExpression(
            "filterByTableNameTestCaseBelongsTo({'unrelated.fqn'})", evaluationContext));
  }

  @Test
  void test_filterByTableNameTestCaseBelongsTo_rejectsPrefixCollision() {
    TestCase testCase =
        new TestCase().withName("tc").withEntityFQN("service.db.schema.customer_archive");

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TEST_CASE);
    changeEvent.setEntity(testCase);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertFalse(
        evaluateExpression(
            "filterByTableNameTestCaseBelongsTo({'service.db.schema.customer'})",
            evaluationContext));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "service.db.schema.[bracketed].t",
        "service.db.schema.t+plus",
        "service.db.schema.t?question",
        "service.db.schema.t|pipe",
        "service.db.schema.t*star",
        "service.db.schema.t(paren)",
      })
  void test_filterByTableNameTestCaseBelongsTo_treatsRegexMetacharsAsLiteral(String tableFqn) {
    TestCase testCase = new TestCase().withName("tc").withEntityFQN(tableFqn);

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TEST_CASE);
    changeEvent.setEntity(testCase);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(
        evaluateExpression(
            "filterByTableNameTestCaseBelongsTo({'" + tableFqn + "'})", evaluationContext));
    assertFalse(
        evaluateExpression(
            "filterByTableNameTestCaseBelongsTo({'unrelated.fqn'})", evaluationContext));
  }

  @Test
  void test_filterByTableNameTestCaseBelongsTo_fallbackToEntityLink() {
    String tableFqn = "service.db.schema.fallback";
    TestCase testCase =
        new TestCase().withName("tc").withEntityLink("<#E::table::" + tableFqn + ">");

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TEST_CASE);
    changeEvent.setEntity(testCase);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(
        evaluateExpression(
            "filterByTableNameTestCaseBelongsTo({'" + tableFqn + "'})", evaluationContext));
  }

  @Test
  void test_filterByTableNameTestCaseBelongsTo_nonTestCaseEntityPassesThrough() {
    Table table = new Table().withName("t").withFullyQualifiedName("service.db.schema.t");

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(table);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(
        evaluateExpression(
            "filterByTableNameTestCaseBelongsTo({'unrelated.fqn'})", evaluationContext));
  }

  @Test
  void test_filterByEntityNameDataContractBelongsTo_happyPath() {
    String entityFqn = "service.db.schema.orders";
    ChangeEvent changeEvent = dataContractChangeEvent(entityFqn);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(
        evaluateExpression(
            "filterByEntityNameDataContractBelongsTo({'" + entityFqn + "'})", evaluationContext));
    assertFalse(
        evaluateExpression(
            "filterByEntityNameDataContractBelongsTo({'unrelated.fqn'})", evaluationContext));
  }

  /**
   * Regression: previous implementation used String.contains, so a filter on a substring of the
   * target entity's FQN would return true (false positive). The fix uses literal equality.
   */
  @Test
  void test_filterByEntityNameDataContractBelongsTo_rejectsSubstring() {
    ChangeEvent changeEvent = dataContractChangeEvent("service.db.schema.customer");
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertFalse(
        evaluateExpression(
            "filterByEntityNameDataContractBelongsTo({'service.db.schema'})", evaluationContext));
    assertFalse(
        evaluateExpression(
            "filterByEntityNameDataContractBelongsTo({'customer'})", evaluationContext));
  }

  @Test
  void test_filterByEntityNameDataContractBelongsTo_rejectsPrefixCollision() {
    ChangeEvent changeEvent = dataContractChangeEvent("service.db.schema.customer_archive");
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertFalse(
        evaluateExpression(
            "filterByEntityNameDataContractBelongsTo({'service.db.schema.customer'})",
            evaluationContext));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "service.db.schema.[bracketed]",
        "service.db.schema.t+plus",
        "service.db.schema.t?question",
        "service.db.schema.t|pipe",
        "service.db.schema.t*star",
      })
  void test_filterByEntityNameDataContractBelongsTo_treatsRegexMetacharsAsLiteral(
      String entityFqn) {
    ChangeEvent changeEvent = dataContractChangeEvent(entityFqn);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertTrue(
        evaluateExpression(
            "filterByEntityNameDataContractBelongsTo({'" + entityFqn + "'})", evaluationContext));
  }

  @Test
  void test_filterByEntityNameDataContractBelongsTo_nonDataContractEntityReturnsFalse() {
    Table table = new Table().withName("t").withFullyQualifiedName("service.db.schema.t");

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.TABLE);
    changeEvent.setEntity(table);
    AlertsRuleEvaluator alertsRuleEvaluator = new AlertsRuleEvaluator(changeEvent);
    EvaluationContext evaluationContext =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(alertsRuleEvaluator)
            .build();

    assertFalse(
        evaluateExpression(
            "filterByEntityNameDataContractBelongsTo({'unrelated.fqn'})", evaluationContext));
  }

  private ChangeEvent dataContractChangeEvent(String targetEntityFqn) {
    DataContract dataContract = new DataContract();
    dataContract.setEntity(new EntityReference().withFullyQualifiedName(targetEntityFqn));
    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityType(Entity.DATA_CONTRACT);
    changeEvent.setEntity(JsonUtils.pojoToJson(dataContract));
    return changeEvent;
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
