package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.elements.triggers.impl.FetchChangeEventsImpl.MAX_PROCESSED_OFFSET_VARIABLE;

import java.lang.reflect.Field;
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
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CommitChangeEventOffsetImplTest {

  @Mock private DelegateExecution execution;
  @Mock private Expression workflowFqnExpr;
  @Mock private Expression entityTypeExpr;
  @Mock private CollectionDAO collectionDAO;
  @Mock private CollectionDAO.EventSubscriptionDAO eventSubscriptionDAO;

  private CommitChangeEventOffsetImpl impl;

  @BeforeEach
  void setUp() throws Exception {
    impl = new CommitChangeEventOffsetImpl();
    injectField(impl, "workflowFqnExpr", workflowFqnExpr);
    injectField(impl, "entityTypeExpr", entityTypeExpr);

    when(workflowFqnExpr.getValue(execution)).thenReturn("certificationWorkflow");
    when(entityTypeExpr.getValue(execution)).thenReturn("table");
    when(collectionDAO.eventSubscriptionDAO()).thenReturn(eventSubscriptionDAO);
  }

  @Test
  void testExecute_noMaxOffset_skipsCommit() {
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(null);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    verify(eventSubscriptionDAO, never())
        .upsertSubscriberExtension(anyString(), anyString(), anyString(), anyString());
  }

  @Test
  void testExecute_noExistingOffset_commitsNewOffset() {
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(500L);
    when(eventSubscriptionDAO.getSubscriberExtension(anyString(), anyString())).thenReturn(null);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
    verify(eventSubscriptionDAO)
        .upsertSubscriberExtension(
            eq("certificationWorkflowTrigger-table"),
            anyString(),
            anyString(),
            jsonCaptor.capture());

    EventSubscriptionOffset committed =
        JsonUtils.readValue(jsonCaptor.getValue(), EventSubscriptionOffset.class);
    assertEquals(500L, committed.getCurrentOffset());
    assertEquals(500L, committed.getStartingOffset());
  }

  @Test
  void testExecute_existingOffsetLower_commitsNewOffset() {
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(500L);

    EventSubscriptionOffset existing =
        new EventSubscriptionOffset().withCurrentOffset(200L).withStartingOffset(200L);
    when(eventSubscriptionDAO.getSubscriberExtension(anyString(), anyString()))
        .thenReturn(JsonUtils.pojoToJson(existing));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    verify(eventSubscriptionDAO)
        .upsertSubscriberExtension(anyString(), anyString(), anyString(), anyString());
  }

  @Test
  void testExecute_existingOffsetHigher_skipsCommit() {
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(300L);

    EventSubscriptionOffset existing =
        new EventSubscriptionOffset().withCurrentOffset(500L).withStartingOffset(500L);
    when(eventSubscriptionDAO.getSubscriberExtension(anyString(), anyString()))
        .thenReturn(JsonUtils.pojoToJson(existing));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    verify(eventSubscriptionDAO, never())
        .upsertSubscriberExtension(anyString(), anyString(), anyString(), anyString());
  }

  @Test
  void testExecute_existingOffsetEqual_skipsCommit() {
    when(execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE)).thenReturn(500L);

    EventSubscriptionOffset existing =
        new EventSubscriptionOffset().withCurrentOffset(500L).withStartingOffset(500L);
    when(eventSubscriptionDAO.getSubscriberExtension(anyString(), anyString()))
        .thenReturn(JsonUtils.pojoToJson(existing));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      impl.execute(execution);
    }

    verify(eventSubscriptionDAO, never())
        .upsertSubscriberExtension(anyString(), anyString(), anyString(), anyString());
  }

  // -------------------------------------------------------------------------
  // ChangeEventOffsetUtils.commitOffset — null offset → no-op
  // -------------------------------------------------------------------------

  @Test
  void testCommitOffset_nullOffset_isNoOp() {
    ChangeEventOffsetUtils.commitOffset("wf", "table", null);

    verify(eventSubscriptionDAO, never()).getSubscriberExtension(anyString(), anyString());
    verify(eventSubscriptionDAO, never())
        .upsertSubscriberExtension(anyString(), anyString(), anyString(), anyString());
  }

  // -------------------------------------------------------------------------
  // ChangeEventOffsetUtils.commitOffset — stored offset >= processed → skip
  // -------------------------------------------------------------------------

  @Test
  void testCommitOffset_storedOffsetHigher_skipsUpsert() {
    EventSubscriptionOffset existing =
        new EventSubscriptionOffset().withCurrentOffset(100L).withStartingOffset(100L);
    when(eventSubscriptionDAO.getSubscriberExtension(anyString(), anyString()))
        .thenReturn(JsonUtils.pojoToJson(existing));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      ChangeEventOffsetUtils.commitOffset("certificationWorkflow", "table", 50L);
    }

    verify(eventSubscriptionDAO, never())
        .upsertSubscriberExtension(anyString(), anyString(), anyString(), anyString());
  }

  private void injectField(Object target, String fieldName, Object value) throws Exception {
    Field field = CommitChangeEventOffsetImpl.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
