/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.spel.support.SimpleEvaluationContext;

/**
 * Regression tests for open-metadata/OpenMetadata#29674.
 *
 * <p>{@code matchAnyDomain}, {@code matchAnyOwnerName} and {@code getTestCaseStatusIfInTestSuite}
 * re-read the change-event entity from the store to reach fields the serialized payload does not
 * carry. Alerts are evaluated asynchronously, so a delete event routinely reaches the evaluator
 * after the entity is gone — the re-read then threw {@code EntityNotFoundException} and aborted the
 * whole subscription instead of simply not matching. The re-read also used {@code NON_DELETED},
 * which made every soft-delete event throw as well.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AlertsRuleEvaluatorDeletedEntityIT {

  private static final Map<String, String> HARD_DELETE =
      Map.of("hardDelete", "true", "recursive", "true");
  private static final String UNRELATED_FQN = "unrelated.fqn";

  @Test
  void matchAnyDomain_hardDeletedEntity_fallsBackToChangeEventPayload(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = createDomain(ns);
    Table table = createTable(ns, createDomainAssignment(domain), null);

    ChangeEvent changeEvent =
        deleteEvent(Entity.TABLE, client.tables().get(table.getId().toString(), "domains"));
    client.tables().delete(table.getId().toString(), HARD_DELETE);

    EvaluationContext context = contextFor(changeEvent);
    assertTrue(
        evaluate("matchAnyDomain({'" + domain.getFullyQualifiedName() + "'})", context),
        "domain carried by the delete event payload must still match once the row is gone");
    assertFalse(evaluate("matchAnyDomain({'" + UNRELATED_FQN + "'})", context));
  }

  @Test
  void matchAnyDomain_softDeletedEntity_resolvesDomainFromStore(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = createDomain(ns);
    Table table = createTable(ns, createDomainAssignment(domain), null);

    ChangeEvent changeEvent = deleteEvent(Entity.TABLE, payloadWithoutRelationships(table));
    client.tables().delete(table.getId().toString());

    EvaluationContext context = contextFor(changeEvent);
    assertTrue(
        evaluate("matchAnyDomain({'" + domain.getFullyQualifiedName() + "'})", context),
        "a soft-deleted entity must still resolve its domains from the store");
    assertFalse(evaluate("matchAnyDomain({'" + UNRELATED_FQN + "'})", context));
  }

  @Test
  void matchAnyDomain_liveEntity_resolvesDomainFromStore(TestNamespace ns) {
    Domain domain = createDomain(ns);
    Table table = createTable(ns, createDomainAssignment(domain), null);

    EvaluationContext context =
        contextFor(updateEvent(Entity.TABLE, payloadWithoutRelationships(table)));
    assertTrue(evaluate("matchAnyDomain({'" + domain.getFullyQualifiedName() + "'})", context));
    assertFalse(evaluate("matchAnyDomain({'" + UNRELATED_FQN + "'})", context));
  }

  /**
   * The observable the ticket is actually about: one un-evaluatable event must not take the rest of
   * the batch with it. {@code AlertUtil.getFilteredEvents} streams every event through
   * {@code checkIfChangeEventIsAllowed}, so a throw anywhere in the stream drops the whole batch —
   * which is what {@code AbstractEventConsumer.publishEvents} hands to the destinations.
   */
  @Test
  void getFilteredEvents_deletedEntityInBatch_stillDeliversTheLiveEvent(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = createDomain(ns);
    Table liveTable = createTable(ns, createDomainAssignment(domain), null);
    Table deletedTable = createTable(ns, createDomainAssignment(domain), null);

    ChangeEvent liveEvent =
        updateEvent(Entity.TABLE, payloadWithoutRelationships(liveTable)).withId(UUID.randomUUID());
    ChangeEvent deletedEvent =
        deleteEvent(Entity.TABLE, payloadWithoutRelationships(deletedTable))
            .withId(UUID.randomUUID());
    client.tables().delete(deletedTable.getId().toString(), HARD_DELETE);

    Map<ChangeEvent, Set<UUID>> batch = new LinkedHashMap<>();
    batch.put(deletedEvent, Set.of(UUID.randomUUID()));
    batch.put(liveEvent, Set.of(UUID.randomUUID()));

    Map<ChangeEvent, Set<UUID>> delivered =
        AlertUtil.getFilteredEvents(
            subscriptionFilteringOnDomain(domain.getFullyQualifiedName()), batch);

    assertTrue(
        delivered.containsKey(liveEvent),
        "the live event must survive a batch that also contains a hard-deleted entity");
    assertFalse(
        delivered.containsKey(deletedEvent),
        "the hard-deleted entity no longer resolves a domain, so its event must not match");
  }

  private EventSubscription subscriptionFilteringOnDomain(String domainFqn) {
    EventFilterRule rule =
        new EventFilterRule()
            .withName("matchAnyDomain")
            .withEffect(ArgumentsInput.Effect.INCLUDE)
            .withCondition("matchAnyDomain({'" + domainFqn + "'})");
    return new EventSubscription()
        .withName("alertDomainSubscription")
        .withFilteringRules(
            new FilteringRules().withResources(List.of(Entity.TABLE)).withRules(List.of(rule)));
  }

  @Test
  void matchAnyOwnerName_hardDeletedEntity_doesNotAbortEvaluation(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, null, List.of(SharedEntities.get().USER1_REF));

    ChangeEvent changeEvent = deleteEvent(Entity.TABLE, payloadWithoutRelationships(table));
    client.tables().delete(table.getId().toString(), HARD_DELETE);

    EvaluationContext context = contextFor(changeEvent);
    assertFalse(
        evaluate("matchAnyOwnerName({'" + SharedEntities.get().USER1.getName() + "'})", context),
        "a hard-deleted entity has no resolvable owner, so the filter must not match");
  }

  @Test
  void matchAnyOwnerName_softDeletedEntity_resolvesOwnerFromStore(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, null, List.of(SharedEntities.get().USER1_REF));

    ChangeEvent changeEvent = deleteEvent(Entity.TABLE, payloadWithoutRelationships(table));
    client.tables().delete(table.getId().toString());

    EvaluationContext context = contextFor(changeEvent);
    assertTrue(
        evaluate("matchAnyOwnerName({'" + SharedEntities.get().USER1.getName() + "'})", context),
        "a soft-deleted entity must still resolve its owners from the store");
    assertFalse(evaluate("matchAnyOwnerName({'nonExistentOwner'})", context));
  }

  @Test
  void matchAnyOwnerName_hardDeletedOwner_doesNotAbortEvaluation(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    User owner = createUser(ns);
    Table table = createTable(ns, null, List.of(ownerReference(owner)));

    ChangeEvent changeEvent =
        updateEvent(Entity.TABLE, client.tables().get(table.getId().toString(), "owners"));
    client.users().delete(owner.getId().toString(), HARD_DELETE);

    assertFalse(
        evaluate("matchAnyOwnerName({'" + owner.getName() + "'})", contextFor(changeEvent)),
        "an owner reference pointing at a deleted user must not match");
  }

  @Test
  void getTestCaseStatusIfInTestSuite_hardDeletedTestCase_fallsBackToChangeEventPayload(
      TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, null, null);
    TestCase testCase = createTestCase(ns, table);
    String testSuiteFqn = testCase.getTestSuites().getFirst().getFullyQualifiedName();

    ChangeEvent changeEvent = deleteEvent(Entity.TEST_CASE, testCase);
    changeEvent.setChangeDescription(successResultChange());
    client.testCases().delete(testCase.getId().toString(), HARD_DELETE);

    EvaluationContext context = contextFor(changeEvent);
    assertTrue(
        evaluate("getTestCaseStatusIfInTestSuite({'Success'}, {'" + testSuiteFqn + "'})", context),
        "test suites carried by the delete event payload must still match once the row is gone");
    assertFalse(
        evaluate(
            "getTestCaseStatusIfInTestSuite({'Success'}, {'" + UNRELATED_FQN + "'})", context));
  }

  @Test
  void getTestCaseStatusIfInTestSuite_softDeletedTestCase_resolvesTestSuiteFromStore(
      TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, null, null);
    TestCase testCase = createTestCase(ns, table);
    String testSuiteFqn = testCase.getTestSuites().getFirst().getFullyQualifiedName();

    ChangeEvent changeEvent =
        deleteEvent(
            Entity.TEST_CASE,
            new TestCase()
                .withId(testCase.getId())
                .withName(testCase.getName())
                .withFullyQualifiedName(testCase.getFullyQualifiedName()));
    changeEvent.setChangeDescription(successResultChange());
    client.testCases().delete(testCase.getId().toString());

    EvaluationContext context = contextFor(changeEvent);
    assertTrue(
        evaluate("getTestCaseStatusIfInTestSuite({'Success'}, {'" + testSuiteFqn + "'})", context),
        "a soft-deleted test case must still resolve its test suites from the store");
    assertFalse(
        evaluate("getTestCaseStatusIfInTestSuite({'Failed'}, {'" + testSuiteFqn + "'})", context));
  }

  private Domain createDomain(TestNamespace ns) {
    return SdkClients.adminClient()
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.prefix("alertDomain"))
                .withDomainType(DomainType.AGGREGATE)
                .withDescription("Domain for deleted-entity alert filtering"));
  }

  private List<String> createDomainAssignment(Domain domain) {
    return List.of(domain.getFullyQualifiedName());
  }

  private User createUser(TestNamespace ns) {
    String name = "alertOwner" + ns.uniqueShortId();
    return SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(name).withEmail(name + "@test.openmetadata.org"));
  }

  private EntityReference ownerReference(User user) {
    return new EntityReference().withId(user.getId()).withType(Entity.USER);
  }

  private Table createTable(
      TestNamespace ns, List<String> domainFqns, List<EntityReference> owners) {
    OpenMetadataClient client = SdkClients.adminClient();
    String id = ns.uniqueShortId();
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName("alertDb_" + id)
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName("alertSc_" + id)
                    .withDatabase(database.getFullyQualifiedName()));
    return client
        .tables()
        .create(
            new CreateTable()
                .withName("alertTb_" + id)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withDomains(domainFqns)
                .withOwners(owners)
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private TestCase createTestCase(TestNamespace ns, Table table) {
    OpenMetadataClient client = SdkClients.adminClient();
    TestCase created =
        client
            .testCases()
            .create(
                new CreateTestCase()
                    .withName("alertTc_" + ns.uniqueShortId())
                    .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">")
                    .withTestDefinition("tableRowCountToEqual")
                    .withParameterValues(
                        List.of(new TestCaseParameterValue().withName("value").withValue("100"))));
    return client.testCases().get(created.getId().toString(), "testSuites");
  }

  /**
   * Mirrors the shape of a change-event payload that carries only core fields: relationship fields
   * such as owners and domains are absent, forcing the evaluator down the store re-read path.
   */
  private Table payloadWithoutRelationships(Table table) {
    return new Table()
        .withId(table.getId())
        .withName(table.getName())
        .withFullyQualifiedName(table.getFullyQualifiedName());
  }

  private ChangeEvent deleteEvent(String entityType, Object entity) {
    return new ChangeEvent()
        .withEventType(EventType.ENTITY_DELETED)
        .withEntityType(entityType)
        .withEntity(entity);
  }

  private ChangeEvent updateEvent(String entityType, Object entity) {
    return new ChangeEvent()
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntity(entity);
  }

  private ChangeDescription successResultChange() {
    return new ChangeDescription()
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName("testCaseResult")
                    .withNewValue(
                        new TestCaseResult().withTestCaseStatus(TestCaseStatus.Success))));
  }

  private EvaluationContext contextFor(ChangeEvent changeEvent) {
    return SimpleEvaluationContext.forReadOnlyDataBinding()
        .withInstanceMethods()
        .withRootObject(new AlertsRuleEvaluator(changeEvent))
        .build();
  }

  private Boolean evaluate(String condition, EvaluationContext evaluationContext) {
    return parseExpression(condition).getValue(evaluationContext, Boolean.class);
  }
}
