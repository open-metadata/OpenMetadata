package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.PROCESSED_FQNS_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger.HAS_FINISHED_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.impl.FetchChangeEventsImpl.CURRENT_BATCH_OFFSET_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.impl.FetchChangeEventsImpl.MAX_PROCESSED_OFFSET_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.impl.FetchChangeEventsImpl.PROCESSED_FQNS_MAX_SIZE;

import java.lang.reflect.Field;
import java.util.LinkedHashMap;
import java.util.List;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.ChangeEventDAO.ChangeEventRecord;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FetchChangeEventsImplTest {

  @Mock private DelegateExecution execution;
  @Mock private Expression entityTypesExpr;
  @Mock private Expression batchSizeExpr;
  @Mock private Expression workflowFqnExpr;
  @Mock private CollectionDAO collectionDAO;
  @Mock private CollectionDAO.ChangeEventDAO changeEventDAO;
  @Mock private CollectionDAO.EventSubscriptionDAO eventSubscriptionDAO;

  private FetchChangeEventsImpl impl;

  @BeforeEach
  void setUp() throws Exception {
    impl = new FetchChangeEventsImpl();
    injectField(impl, "entityTypesExpr", entityTypesExpr);
    injectField(impl, "batchSizeExpr", batchSizeExpr);
    injectField(impl, "workflowFqnExpr", workflowFqnExpr);

    when(entityTypesExpr.getValue(execution)).thenReturn("table");
    when(batchSizeExpr.getValue(execution)).thenReturn("100");
    when(workflowFqnExpr.getValue(execution)).thenReturn("certificationWorkflow");

    when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    when(collectionDAO.eventSubscriptionDAO()).thenReturn(eventSubscriptionDAO);
    when(eventSubscriptionDAO.getSubscriberExtension(anyString(), anyString())).thenReturn(null);
    when(changeEventDAO.getMinOffsetForEntityTypes(anyList())).thenReturn(0L);
  }

  // -------------------------------------------------------------------------
  // buildConsumerId
  // -------------------------------------------------------------------------

  @Test
  void testBuildConsumerId_normalCase() {
    assertEquals(
        "myWorkflowTrigger-table", FetchChangeEventsImpl.buildConsumerId("myWorkflow", "table"));
  }

  @Test
  void testBuildConsumerId_nullWorkflowFqn_throws() {
    assertThrows(
        IllegalArgumentException.class, () -> FetchChangeEventsImpl.buildConsumerId(null, "table"));
  }

  @Test
  void testBuildConsumerId_blankWorkflowFqn_throws() {
    assertThrows(
        IllegalArgumentException.class, () -> FetchChangeEventsImpl.buildConsumerId("  ", "table"));
  }

  // -------------------------------------------------------------------------
  // extractEntityFilter
  // -------------------------------------------------------------------------

  @Test
  void testExtractEntityFilter_null_returnsNull() {
    assertNull(FetchChangeEventsImpl.extractEntityFilter(null, "table"));
  }

  @Test
  void testExtractEntityFilter_blank_returnsNull() {
    assertNull(FetchChangeEventsImpl.extractEntityFilter("   ", "table"));
  }

  @Test
  void testExtractEntityFilter_entitySpecificFilter_returned() {
    String filter = "{\"table\":\"{\\\"query\\\":{\\\"term\\\":{\\\"deleted\\\":false}}}\"}";
    String result = FetchChangeEventsImpl.extractEntityFilter(filter, "table");
    assertNotNull(result);
    assertTrue(result.contains("deleted"));
  }

  @Test
  void testExtractEntityFilter_defaultFallback_whenNoEntityKey() {
    String filter = "{\"default\":\"{\\\"query\\\":{\\\"match_all\\\":{}}}\"}";
    String result = FetchChangeEventsImpl.extractEntityFilter(filter, "dashboard");
    assertNotNull(result);
    assertTrue(result.contains("match_all"));
  }

  @Test
  void testExtractEntityFilter_noMatchingKey_returnsNull() {
    String filter = "{\"glossaryTerm\":\"{\\\"query\\\":{\\\"match_all\\\":{}}}\"}";
    assertNull(FetchChangeEventsImpl.extractEntityFilter(filter, "table"));
  }

  @Test
  void testExtractEntityFilter_notJsonObject_returnsNull() {
    assertNull(FetchChangeEventsImpl.extractEntityFilter("[\"not\",\"an\",\"object\"]", "table"));
  }

  @Test
  void testExtractEntityFilter_invalidJson_returnsNull() {
    assertNull(FetchChangeEventsImpl.extractEntityFilter("{not valid json", "table"));
  }

  // -------------------------------------------------------------------------
  // execute — no stored offset, no events → hasFinished=true
  // -------------------------------------------------------------------------

  @Test
  void testExecute_noEvents_setsHasFinishedTrue() {
    when(execution.getVariable(CURRENT_BATCH_OFFSET_VARIABLE)).thenReturn(null);
    when(changeEventDAO.listByEntityTypesWithOffset(anyList(), anyLong(), any(int.class)))
        .thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    verify(execution).setVariable(eq(HAS_FINISHED_VARIABLE), eq(true));
    verify(execution).setVariable(eq(ENTITY_LIST_VARIABLE), eq(List.of()));
    verify(execution).setVariable(eq("numberOfEntities"), eq(0));
  }

  // -------------------------------------------------------------------------
  // execute — events present → hasFinished=false, entityList populated
  // -------------------------------------------------------------------------

  @Test
  void testExecute_withEvents_setsHasFinishedFalse() {
    when(execution.getVariable(CURRENT_BATCH_OFFSET_VARIABLE)).thenReturn(null);
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(null);

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityFullyQualifiedName("schema.myTable");
    changeEvent.setEntityType("table");
    ChangeEventRecord record = new ChangeEventRecord(42L, JsonUtils.pojoToJson(changeEvent));

    when(changeEventDAO.listByEntityTypesWithOffset(anyList(), anyLong(), any(int.class)))
        .thenReturn(List.of(record));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    verify(execution).setVariable(eq(HAS_FINISHED_VARIABLE), eq(false));
    verify(execution).setVariable(eq(CURRENT_BATCH_OFFSET_VARIABLE), eq(42L));
    verify(execution).setVariable(eq(MAX_PROCESSED_OFFSET_VARIABLE), eq(42L));
    verify(execution).setVariable(eq("numberOfEntities"), eq(1));
  }

  // -------------------------------------------------------------------------
  // execute — offset stored in execution variable is reused
  // -------------------------------------------------------------------------

  @Test
  void testExecute_usesStoredOffsetFromExecution() {
    when(execution.getVariable(CURRENT_BATCH_OFFSET_VARIABLE)).thenReturn(100L);
    // existingMax == batchMaxOffset (100L == 100L) → inline commit is skipped
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(100L);
    when(changeEventDAO.listByEntityTypesWithOffset(anyList(), eq(100L), any(int.class)))
        .thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    verify(changeEventDAO).listByEntityTypesWithOffset(anyList(), eq(100L), any(int.class));
    verify(eventSubscriptionDAO, never()).getSubscriberExtension(anyString(), anyString());
  }

  // -------------------------------------------------------------------------
  // execute — deduplication: same FQN appears twice, only one entity link emitted
  // -------------------------------------------------------------------------

  @Test
  void testExecute_deduplicatesByFqn() {
    when(execution.getVariable(CURRENT_BATCH_OFFSET_VARIABLE)).thenReturn(null);
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(null);

    ChangeEvent ev1 = new ChangeEvent();
    ev1.setEntityFullyQualifiedName("schema.myTable");
    ev1.setEntityType("table");
    ChangeEvent ev2 = new ChangeEvent();
    ev2.setEntityFullyQualifiedName("schema.myTable");
    ev2.setEntityType("table");

    List<ChangeEventRecord> records =
        List.of(
            new ChangeEventRecord(10L, JsonUtils.pojoToJson(ev1)),
            new ChangeEventRecord(20L, JsonUtils.pojoToJson(ev2)));

    when(changeEventDAO.listByEntityTypesWithOffset(anyList(), anyLong(), any(int.class)))
        .thenReturn(records);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    // One unique FQN → one entity link
    verify(execution).setVariable(eq("numberOfEntities"), eq(1));
    // Max offset across both records is 20
    verify(execution).setVariable(eq(MAX_PROCESSED_OFFSET_VARIABLE), eq(20L));
  }

  // -------------------------------------------------------------------------
  // execute — cross-batch FQN dedup: FQN already in processedFqns is skipped
  // -------------------------------------------------------------------------

  @Test
  void testExecute_skipsFqnAlreadyDispatchedInPriorBatch() {
    LinkedHashMap<String, Boolean> priorBatchCache = new LinkedHashMap<>();
    priorBatchCache.put("schema.myTable", Boolean.TRUE);
    when(execution.getVariable(PROCESSED_FQNS_VARIABLE)).thenReturn(priorBatchCache);
    when(execution.getVariable(CURRENT_BATCH_OFFSET_VARIABLE)).thenReturn(null);
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(null);

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityFullyQualifiedName("schema.myTable");
    changeEvent.setEntityType("table");
    ChangeEventRecord record = new ChangeEventRecord(30L, JsonUtils.pojoToJson(changeEvent));
    when(changeEventDAO.listByEntityTypesWithOffset(anyList(), anyLong(), any(int.class)))
        .thenReturn(List.of(record));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    verify(execution).setVariable(eq("numberOfEntities"), eq(0));
    verify(execution).setVariable(eq(ENTITY_LIST_VARIABLE), eq(List.of()));
  }

  // -------------------------------------------------------------------------
  // execute — bounded LRU: oldest entry evicted when cache exceeds cap
  // -------------------------------------------------------------------------

  @Test
  void testExecute_evictsOldestFqnWhenCacheExceedsCap() {
    LinkedHashMap<String, Boolean> bigCache = new LinkedHashMap<>();
    for (int i = 0; i < PROCESSED_FQNS_MAX_SIZE; i++) {
      bigCache.put("fqn-" + i, Boolean.TRUE);
    }
    when(execution.getVariable(PROCESSED_FQNS_VARIABLE)).thenReturn(bigCache);
    when(execution.getVariable(CURRENT_BATCH_OFFSET_VARIABLE)).thenReturn(0L);
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(null);

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityFullyQualifiedName("fqn-new");
    changeEvent.setEntityType("table");
    ChangeEventRecord record = new ChangeEventRecord(50L, JsonUtils.pojoToJson(changeEvent));
    when(changeEventDAO.listByEntityTypesWithOffset(anyList(), anyLong(), any(int.class)))
        .thenReturn(List.of(record));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
    verify(execution).setVariable(eq(PROCESSED_FQNS_VARIABLE), captor.capture());

    @SuppressWarnings("unchecked")
    LinkedHashMap<String, Boolean> capturedCache =
        (LinkedHashMap<String, Boolean>) captor.getValue();
    assertEquals(PROCESSED_FQNS_MAX_SIZE, capturedCache.size());
    assertFalse(capturedCache.containsKey("fqn-0"));
    assertTrue(capturedCache.containsKey("fqn-new"));
  }

  // -------------------------------------------------------------------------
  // execute — Fix 1: offset is committed inline when max advances
  // -------------------------------------------------------------------------

  @Test
  void testExecute_commitsOffsetInlineWhenBatchAdvancesMax() {
    when(execution.getVariable(CURRENT_BATCH_OFFSET_VARIABLE)).thenReturn(null);
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(null);

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityFullyQualifiedName("schema.myTable");
    changeEvent.setEntityType("table");
    ChangeEventRecord record = new ChangeEventRecord(55L, JsonUtils.pojoToJson(changeEvent));
    when(changeEventDAO.listByEntityTypesWithOffset(anyList(), anyLong(), any(int.class)))
        .thenReturn(List.of(record));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    verify(eventSubscriptionDAO)
        .upsertSubscriberExtension(
            eq("certificationWorkflowTrigger-table"),
            anyString(),
            eq("eventSubscriptionOffset"),
            anyString());
  }

  // -------------------------------------------------------------------------
  // execute — Fix 1: inline commit skipped when offset has not advanced
  // -------------------------------------------------------------------------

  @Test
  void testExecute_skipsInlineCommitWhenBatchDoesNotAdvanceMax() {
    when(execution.getVariable(CURRENT_BATCH_OFFSET_VARIABLE)).thenReturn(42L);
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(42L);

    ChangeEvent changeEvent = new ChangeEvent();
    changeEvent.setEntityFullyQualifiedName("schema.myTable");
    changeEvent.setEntityType("table");
    ChangeEventRecord record = new ChangeEventRecord(42L, JsonUtils.pojoToJson(changeEvent));
    when(changeEventDAO.listByEntityTypesWithOffset(anyList(), anyLong(), any(int.class)))
        .thenReturn(List.of(record));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    verify(eventSubscriptionDAO, never())
        .upsertSubscriberExtension(anyString(), anyString(), anyString(), anyString());
  }

  private void injectField(Object target, String fieldName, Object value) throws Exception {
    Field field = FetchChangeEventsImpl.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
