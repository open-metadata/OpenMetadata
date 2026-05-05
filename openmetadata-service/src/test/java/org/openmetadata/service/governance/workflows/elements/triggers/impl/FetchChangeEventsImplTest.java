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
import static org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger.HAS_FINISHED_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.impl.FetchChangeEventsImpl.CURRENT_BATCH_OFFSET_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.impl.FetchChangeEventsImpl.MAX_PROCESSED_OFFSET_VARIABLE;

import java.lang.reflect.Field;
import java.util.List;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(null);
    when(changeEventDAO.listByEntityTypesWithOffset(anyList(), eq(100L), any(int.class)))
        .thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    // DAO called with the stored offset
    verify(changeEventDAO).listByEntityTypesWithOffset(anyList(), eq(100L), any(int.class));
    // eventSubscriptionDAO never queried when offset already in execution
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

  private void injectField(Object target, String fieldName, Object value) throws Exception {
    Field field = FetchChangeEventsImpl.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
