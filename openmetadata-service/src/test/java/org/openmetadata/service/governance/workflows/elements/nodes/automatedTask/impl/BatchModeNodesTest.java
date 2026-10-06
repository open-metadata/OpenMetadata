package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.json.JsonPatch;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityFieldUtils;

/**
 * The per-entity nodes of a workflow that runs once per batch: each evaluates or acts on every
 * entity of {@code global_entityList}, and a node deployed without the batch field still handles
 * {@code global_relatedEntity} alone, even when the trigger also hands it the batch.
 */
class BatchModeNodesTest {
  private static final String NODE = "node";
  private static final String ENTITY_LIST = "global_entityList";
  private static final String RESULT = "node_result";
  private static final String GOLD_RULE = "{\"==\":[{\"var\":\"description\"},\"gold\"]}";

  private final Map<String, Object> variables = new HashMap<>();
  private final Map<String, EntityInterface> entities = new LinkedHashMap<>();
  private final List<String> missing = new ArrayList<>();
  private DelegateExecution execution;
  private MockedStatic<Entity> entityStatics;

  @BeforeEach
  void setUp() {
    execution = mock(DelegateExecution.class);
    when(execution.getProcessDefinitionId()).thenReturn("batchWorkflow:1:1");
    when(execution.getCurrentActivityId()).thenReturn("%s.task".formatted(NODE));
    when(execution.getVariable(anyString()))
        .thenAnswer(invocation -> variables.get(invocation.<String>getArgument(0)));
    doAnswer(invocation -> variables.put(invocation.getArgument(0), invocation.getArgument(1)))
        .when(execution)
        .setVariable(anyString(), any());
    entityStatics = mockStatic(Entity.class);
    entityStatics
        .when(() -> Entity.getEntity(any(MessageParser.EntityLink.class), anyString(), any()))
        .thenAnswer(invocation -> entityFor(invocation.getArgument(0)));
  }

  @AfterEach
  void tearDown() {
    entityStatics.close();
  }

  @Test
  void conditionKeepsTheEntitiesThatTakeItsContinuingBranch() {
    List<String> batch = givenTables("gold", "silver", "gold");
    JavaDelegate check = checkEntityAttributes(true, "true");

    check.execute(execution);

    assertEquals(Boolean.TRUE, variables.get(RESULT));
    assertEquals(List.of(batch.get(0), batch.get(2)), variables.get(ENTITY_LIST));
    assertNull(variables.get("global_failure"));
  }

  @Test
  void conditionContinuingOnFalseKeepsTheEntitiesThatFail() {
    List<String> batch = givenTables("gold", "silver", "gold");
    JavaDelegate check = checkEntityAttributes(true, "false");

    check.execute(execution);

    assertEquals(Boolean.FALSE, variables.get(RESULT));
    assertEquals(List.of(batch.get(1)), variables.get(ENTITY_LIST));
  }

  @Test
  void conditionMatchingNoEntityLeavesOnTheOtherBranch() {
    givenTables("silver", "bronze");
    JavaDelegate check = checkEntityAttributes(true, "true");

    check.execute(execution);

    assertEquals(Boolean.FALSE, variables.get(RESULT));
    assertEquals(List.of(), variables.get(ENTITY_LIST));
  }

  @Test
  void conditionWithoutContinuingOutcomeKeepsTheBatch() {
    List<String> batch = givenTables("silver", "gold");
    JavaDelegate check = checkEntityAttributes(true, null);

    check.execute(execution);

    assertEquals(Boolean.TRUE, variables.get(RESULT));
    assertEquals(batch, variables.get(ENTITY_LIST));
  }

  @Test
  void entityAConditionFailsOnLeavesTheBatchAndIsRecorded() {
    List<String> batch = givenTables("gold", "gold", "gold");
    missing.add(fqnOf(1));
    JavaDelegate check = checkEntityAttributes(true, "true");

    check.execute(execution);

    assertEquals(Boolean.TRUE, variables.get(RESULT));
    assertEquals(List.of(batch.get(0), batch.get(2)), variables.get(ENTITY_LIST));
    assertEquals(Boolean.TRUE, variables.get("global_failure"));
    String exception = (String) variables.get("global_exception");
    assertTrue(exception.startsWith("Node 'node.task' failed for 1 of 3 entities"), exception);
    assertTrue(exception.contains(batch.get(1)), exception);
  }

  /**
   * A periodic trigger hands {@code global_entityList} to every per-entity child as well, so a node
   * deployed without the batch field must keep reading {@code global_relatedEntity} alone.
   */
  @Test
  void conditionWithoutBatchFieldEvaluatesOnlyTheRelatedEntity() {
    List<String> batch = givenTables("gold", "silver", "gold");
    variables.put("global_relatedEntity", batch.get(1));
    JavaDelegate check = checkEntityAttributes(false, null);

    check.execute(execution);

    assertEquals(Boolean.FALSE, variables.get(RESULT));
    assertEquals(batch, variables.get(ENTITY_LIST));
    entityStatics.verify(
        () ->
            Entity.getEntity(
                argThat(
                    (MessageParser.EntityLink link) ->
                        link != null && fqnOf(0).equals(link.getEntityFQN())),
                anyString(),
                any()),
        never());
  }

  @Test
  void changeDescriptionConditionEvaluatesEveryEntity() {
    List<String> batch = givenTables("created", "updated");
    ((Table) entities.get(fqnOf(1)))
        .withChangeDescription(
            new ChangeDescription()
                .withFieldsUpdated(
                    List.of(new FieldChange().withName("owners").withNewValue("[]"))));
    CheckChangeDescriptionTaskImpl check = new CheckChangeDescriptionTaskImpl();
    inject(check, "rulesExpr", expression("{\"description\": [\"gold\"]}"));
    injectBatchFields(check, true, "true");

    check.execute(execution);

    assertEquals(Boolean.TRUE, variables.get(RESULT));
    assertEquals(List.of(batch.get(0)), variables.get(ENTITY_LIST));
  }

  @Test
  void setAttributeAppliesToEveryEntityAndDropsTheOnesItFailsOn() {
    List<String> batch = givenTables("a", "b", "c");
    SetEntityAttributeImpl setAttribute = new SetEntityAttributeImpl();
    inject(setAttribute, "fieldNameExpr", expression("description"));
    inject(setAttribute, "fieldValueExpr", expression("synced"));
    injectBatchFields(setAttribute, true, null);
    List<String> updated = new ArrayList<>();

    try (MockedStatic<EntityFieldUtils> fieldUtils = mockStatic(EntityFieldUtils.class)) {
      fieldUtils
          .when(
              () ->
                  EntityFieldUtils.setEntityField(
                      any(), anyString(), anyString(), anyString(), any(), eq(true), isNull()))
          .thenAnswer(
              invocation -> {
                EntityInterface entity = invocation.getArgument(0);
                if (fqnOf(1).equals(entity.getFullyQualifiedName())) {
                  throw new IllegalStateException("patch rejected");
                }
                return updated.add(entity.getFullyQualifiedName());
              });

      setAttribute.execute(execution);
    }

    assertEquals(List.of(fqnOf(0), fqnOf(2)), updated);
    assertEquals(List.of(batch.get(0), batch.get(2)), variables.get(ENTITY_LIST));
    assertEquals(Boolean.TRUE, variables.get("global_failure"));
  }

  @Test
  void actionFailingOnEveryEntityRaisesTheRuntimeError() {
    givenTables("a", "b");
    missing.addAll(List.of(fqnOf(0), fqnOf(1)));
    SetEntityAttributeImpl setAttribute = new SetEntityAttributeImpl();
    inject(setAttribute, "fieldNameExpr", expression("description"));
    injectBatchFields(setAttribute, true, null);

    BpmnError error = assertThrows(BpmnError.class, () -> setAttribute.execute(execution));

    assertTrue(error.getMessage().contains("failed for 2 of 2 entities"), error.getMessage());
    assertEquals(Boolean.TRUE, variables.get("global_failure"));
  }

  @Test
  void setCertificationPatchesEveryEntity() {
    givenTables("a", "b");
    EntityRepository<?> repository = mock(EntityRepository.class);
    entityStatics.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
    SetEntityCertificationImpl certify = new SetEntityCertificationImpl();
    inject(certify, "certificationExpr", expression("Certification.Gold"));
    injectBatchFields(certify, true, null);

    certify.execute(execution);

    for (EntityInterface table : entities.values()) {
      verify(repository).patch(isNull(), eq(table.getId()), eq("governance-bot"), any());
    }
    assertNull(variables.get("global_failure"));
  }

  @Test
  void setGlossaryTermStatusPatchesEveryTermAndFailsOnOtherEntities() {
    GlossaryTerm first = glossaryTerm("first");
    GlossaryTerm second = glossaryTerm("second");
    List<String> batch =
        new ArrayList<>(List.of(linkOf("glossaryTerm", first), linkOf("glossaryTerm", second)));
    batch.addAll(givenTables("notATerm"));
    entities.put(first.getFullyQualifiedName(), first);
    entities.put(second.getFullyQualifiedName(), second);
    variables.put(ENTITY_LIST, batch);
    GlossaryTermRepository repository = mock(GlossaryTermRepository.class);
    entityStatics
        .when(() -> Entity.getEntityRepository(Entity.GLOSSARY_TERM))
        .thenReturn(repository);
    SetGlossaryTermStatusImpl setStatus = new SetGlossaryTermStatusImpl();
    inject(setStatus, "statusExpr", expression(EntityStatus.APPROVED.value()));
    injectBatchFields(setStatus, true, null);

    setStatus.execute(execution);

    verify(repository)
        .patch(
            isNull(),
            eq(first.getId()),
            eq("governance-bot"),
            any(JsonPatch.class),
            isNull(),
            eq("governance-bot"));
    verify(repository)
        .patch(
            isNull(),
            eq(second.getId()),
            eq("governance-bot"),
            any(JsonPatch.class),
            isNull(),
            eq("governance-bot"));
    assertEquals(batch.subList(0, 2), variables.get(ENTITY_LIST));
    assertEquals(Boolean.TRUE, variables.get("global_failure"));
  }

  @Test
  void rollbackRejectsEveryEntityWithoutPerEntityOutcomeVariables() {
    Metric first = metric("first");
    Metric second = metric("second");
    entities.put(first.getFullyQualifiedName(), first);
    entities.put(second.getFullyQualifiedName(), second);
    variables.put(ENTITY_LIST, List.of(linkOf("metric", first), linkOf("metric", second)));
    @SuppressWarnings("unchecked")
    EntityRepository<Metric> repository = mock(EntityRepository.class);
    for (Metric metric : List.of(first, second)) {
      when(repository.listVersions(metric.getId()))
          .thenReturn(new EntityHistory().withVersions(List.of()));
      when(repository.getVersion(metric.getId(), metric.getVersion().toString()))
          .thenReturn(metric);
    }
    entityStatics.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
    RollbackEntityImpl rollback = new RollbackEntityImpl();
    injectBatchFields(rollback, true, null);

    rollback.execute(execution);

    verify(repository)
        .patch(
            isNull(),
            eq(first.getFullyQualifiedName()),
            eq("governance-bot"),
            any(JsonPatch.class),
            isNull(),
            isNull(),
            eq("governance-bot"));
    verify(repository)
        .patch(
            isNull(),
            eq(second.getFullyQualifiedName()),
            eq("governance-bot"),
            any(JsonPatch.class),
            isNull(),
            isNull(),
            eq("governance-bot"));
    assertFalse(variables.containsKey("rollbackAction"));
    assertNull(variables.get("global_failure"));
  }

  private JavaDelegate checkEntityAttributes(boolean batch, String continuingOutcome) {
    CheckEntityAttributesImpl check = new CheckEntityAttributesImpl();
    inject(check, "rulesExpr", expression(GOLD_RULE));
    injectBatchFields(check, batch, continuingOutcome);
    return check;
  }

  private void injectBatchFields(JavaDelegate delegate, boolean batch, String continuingOutcome) {
    inject(delegate, "inputNamespaceMapExpr", expression("{\"relatedEntity\":\"global\"}"));
    if (batch) {
      inject(delegate, "batchExecutionExpr", expression("true"));
    }
    if (continuingOutcome != null) {
      inject(delegate, "batchContinuingOutcomeExpr", expression(continuingOutcome));
    }
  }

  private List<String> givenTables(String... descriptions) {
    List<String> links = new ArrayList<>();
    for (String description : descriptions) {
      Table table =
          new Table()
              .withId(UUID.randomUUID())
              .withName("t%d".formatted(entities.size()))
              .withFullyQualifiedName(fqnOf(entities.size()))
              .withDescription(description)
              .withVersion(0.1);
      entities.put(table.getFullyQualifiedName(), table);
      links.add(linkOf(Entity.TABLE, table));
    }
    List<String> batch = new ArrayList<>(listOrEmpty(variables.get(ENTITY_LIST)));
    batch.addAll(links);
    variables.put(ENTITY_LIST, batch);
    return links;
  }

  private static List<String> listOrEmpty(Object value) {
    List<String> list = new ArrayList<>();
    // The fake execution stores the batch the way Flowable hands it back: an untyped Object.
    if (value instanceof List<?> stored) {
      stored.forEach(link -> list.add((String) link));
    }
    return list;
  }

  private static String fqnOf(int index) {
    return "svc.db.schema.t%d".formatted(index);
  }

  private static String linkOf(String entityType, EntityInterface entity) {
    return "<#E::%s::%s>".formatted(entityType, entity.getFullyQualifiedName());
  }

  private EntityInterface entityFor(MessageParser.EntityLink link) {
    if (missing.contains(link.getEntityFQN())) {
      throw EntityNotFoundException.byName(link.getEntityFQN());
    }
    return entities.get(link.getEntityFQN());
  }

  private static GlossaryTerm glossaryTerm(String name) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("glossary.%s".formatted(name))
        .withEntityStatus(EntityStatus.DRAFT);
  }

  private static Metric metric(String name) {
    return new Metric()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("metric.%s".formatted(name))
        .withVersion(0.2)
        .withEntityStatus(EntityStatus.IN_REVIEW);
  }

  private static Expression expression(String value) {
    Expression expression = mock(Expression.class);
    when(expression.getValue(any())).thenReturn(value);
    return expression;
  }

  private static void inject(Object target, String fieldName, Object value) {
    try {
      Field field = target.getClass().getDeclaredField(fieldName);
      field.setAccessible(true);
      field.set(target, value);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException("Cannot inject %s".formatted(fieldName), e);
    }
  }
}
