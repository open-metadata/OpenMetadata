package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityFieldUtils;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SetEntityAttributeImplTest {

  @Mock private DelegateExecution execution;
  @Mock private Expression fieldNameExpr;
  @Mock private Expression fieldValueExpr;
  @Mock private Expression inputNamespaceMapExpr;

  @SuppressWarnings("rawtypes")
  @Mock
  private EntityRepository mockRepo;

  private SetEntityAttributeImpl impl;

  @BeforeEach
  void setUp() throws Exception {
    impl = new SetEntityAttributeImpl();
    injectExpression(impl, "fieldNameExpr", fieldNameExpr);
    injectExpression(impl, "fieldValueExpr", fieldValueExpr);
    injectExpression(impl, "inputNamespaceMapExpr", inputNamespaceMapExpr);

    when(execution.getProcessDefinitionId()).thenReturn("process:1:test");
    when(execution.getCurrentActivityId()).thenReturn("process.setEntityAttribute");
    when(execution.getParent()).thenReturn(null);
  }

  @Test
  void testExecute_SetsFieldWithGovernanceBot() {
    String namespaceMap = "{\"entityList\":\"global\"}";
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(namespaceMap);
    when(fieldNameExpr.getValue(execution)).thenReturn("tier");
    when(fieldValueExpr.getValue(execution)).thenReturn("Gold");

    List<String> entityList = List.of("<#E::table::test.db.table>");
    when(execution.getVariable("global_entityList")).thenReturn(entityList);

    Table table = new Table();
    table.setName("testTable");
    table.setFullyQualifiedName("test.db.table");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<EntityFieldUtils> fieldUtilsMock = mockStatic(EntityFieldUtils.class)) {
      entityMock
          .when(() -> Entity.getEntitiesByLinks(anyList(), eq("*"), eq(Include.ALL)))
          .thenReturn(Map.of("<#E::table::test.db.table>", table));
      entityMock.when(() -> Entity.getEntityRepository(anyString())).thenReturn(mockRepo);

      fieldUtilsMock
          .when(
              () ->
                  EntityFieldUtils.setEntityField(
                      any(), anyString(), anyString(), anyString(), any(), anyBoolean(), any()))
          .thenAnswer(invocation -> null);

      impl.execute(execution);

      fieldUtilsMock.verify(
          () ->
              EntityFieldUtils.setEntityField(
                  any(),
                  eq("table"),
                  eq("governance-bot"),
                  eq("tier"),
                  eq("Gold"),
                  eq(false),
                  eq(null)));
      verify(mockRepo)
          .bulkUpdateEntitiesForGovernanceWorkflow(anyList(), anyMap(), eq("governance-bot"));
    }
  }

  @Test
  void testExecute_SetsFieldWithActualUser() {
    String namespaceMap = "{\"entityList\":\"global\",\"updatedBy\":\"global\"}";
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(namespaceMap);
    when(fieldNameExpr.getValue(execution)).thenReturn("owner");
    when(fieldValueExpr.getValue(execution)).thenReturn("admin");

    List<String> entityList = List.of("<#E::table::test.db.table>");
    when(execution.getVariable("global_entityList")).thenReturn(entityList);
    when(execution.getVariable("global_updatedBy")).thenReturn("actualUser");

    Table table = new Table();
    table.setName("testTable");
    table.setFullyQualifiedName("test.db.table");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<EntityFieldUtils> fieldUtilsMock = mockStatic(EntityFieldUtils.class)) {
      entityMock
          .when(() -> Entity.getEntitiesByLinks(anyList(), eq("*"), eq(Include.ALL)))
          .thenReturn(Map.of("<#E::table::test.db.table>", table));
      entityMock.when(() -> Entity.getEntityRepository(anyString())).thenReturn(mockRepo);

      fieldUtilsMock
          .when(
              () ->
                  EntityFieldUtils.setEntityField(
                      any(), anyString(), anyString(), anyString(), any(), anyBoolean(), any()))
          .thenAnswer(invocation -> null);

      impl.execute(execution);

      fieldUtilsMock.verify(
          () ->
              EntityFieldUtils.setEntityField(
                  any(),
                  eq("table"),
                  eq("actualUser"),
                  eq("owner"),
                  eq("admin"),
                  eq(false),
                  eq("governance-bot")));
      verify(mockRepo)
          .bulkUpdateEntitiesForGovernanceWorkflow(anyList(), anyMap(), eq("actualUser"));
    }
  }

  @Test
  void testExecute_EmptyEntityList_NoFieldSet() {
    String namespaceMap = "{\"entityList\":\"global\"}";
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(namespaceMap);
    when(fieldNameExpr.getValue(execution)).thenReturn("tier");
    when(fieldValueExpr.getValue(execution)).thenReturn("Gold");

    when(execution.getVariable("global_entityList")).thenReturn(List.of());

    try (MockedStatic<EntityFieldUtils> fieldUtilsMock = mockStatic(EntityFieldUtils.class)) {
      impl.execute(execution);

      fieldUtilsMock.verifyNoInteractions();
    }
  }

  @Test
  void testExecute_ExceptionThrowsBpmnError() {
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn("invalid json {{{");

    Assertions.assertThrows(BpmnError.class, () -> impl.execute(execution));
  }

  private void injectExpression(Object target, String fieldName, Expression value)
      throws Exception {
    Field field = SetEntityAttributeImpl.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
