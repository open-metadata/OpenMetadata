package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.Workflow.FALSE_ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.HAS_FALSE_ENTITIES_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.HAS_TRUE_ENTITIES_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.TRUE_ENTITY_LIST_VARIABLE;

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

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CheckEntityAttributesImplTest {

  @Mock private DelegateExecution execution;
  @Mock private Expression rulesExpr;
  @Mock private Expression inputNamespaceMapExpr;

  private CheckEntityAttributesImpl impl;

  @BeforeEach
  void setUp() throws Exception {
    impl = new CheckEntityAttributesImpl();
    injectExpression(impl, "rulesExpr", rulesExpr);
    injectExpression(impl, "inputNamespaceMapExpr", inputNamespaceMapExpr);

    when(execution.getProcessDefinitionId()).thenReturn("process:1:test");
    when(execution.getCurrentActivityId()).thenReturn("process.checkEntityAttributes");
    when(execution.getParent()).thenReturn(null);
  }

  @Test
  void testExecute_EntityMatchesRule() {
    String namespaceMap = "{\"entityList\":\"global\"}";
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(namespaceMap);
    when(rulesExpr.getValue(execution)).thenReturn("{\"==\":[1,1]}");

    List<String> entityList = List.of("<#E::table::test.db.table>");
    when(execution.getVariable("global_entityList")).thenReturn(entityList);

    Table table = new Table();
    table.setName("testTable");
    table.setFullyQualifiedName("test.db.table");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntitiesByLinks(anyList(), eq("*"), eq(Include.ALL)))
          .thenReturn(Map.of("<#E::table::test.db.table>", table));

      impl.execute(execution);
    }

    verify(execution).setVariable(eq("process_" + TRUE_ENTITY_LIST_VARIABLE), eq(entityList));
    verify(execution).setVariable(eq("process_" + HAS_TRUE_ENTITIES_VARIABLE), eq(true));
    verify(execution).setVariable(eq("process_" + HAS_FALSE_ENTITIES_VARIABLE), eq(false));
  }

  @Test
  void testExecute_EntityDoesNotMatchRule() {
    String namespaceMap = "{\"entityList\":\"global\"}";
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(namespaceMap);
    when(rulesExpr.getValue(execution)).thenReturn("{\"==\":[1,2]}");

    List<String> entityList = List.of("<#E::table::test.db.table>");
    when(execution.getVariable("global_entityList")).thenReturn(entityList);

    Table table = new Table();
    table.setName("testTable");
    table.setFullyQualifiedName("test.db.table");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntitiesByLinks(anyList(), eq("*"), eq(Include.ALL)))
          .thenReturn(Map.of("<#E::table::test.db.table>", table));

      impl.execute(execution);
    }

    verify(execution).setVariable(eq("process_" + FALSE_ENTITY_LIST_VARIABLE), eq(entityList));
    verify(execution).setVariable(eq("process_" + HAS_TRUE_ENTITIES_VARIABLE), eq(false));
    verify(execution).setVariable(eq("process_" + HAS_FALSE_ENTITIES_VARIABLE), eq(true));
  }

  @Test
  void testExecute_EmptyEntityList() {
    String namespaceMap = "{\"entityList\":\"global\"}";
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(namespaceMap);
    when(rulesExpr.getValue(execution)).thenReturn("{\"==\":[1,1]}");

    when(execution.getVariable("global_entityList")).thenReturn(List.of());

    impl.execute(execution);

    verify(execution).setVariable(eq("process_" + HAS_TRUE_ENTITIES_VARIABLE), eq(false));
    verify(execution).setVariable(eq("process_" + HAS_FALSE_ENTITIES_VARIABLE), eq(true));
  }

  @Test
  void testExecute_ExceptionThrowsBpmnError() {
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn("invalid json {{{");

    Assertions.assertThrows(BpmnError.class, () -> impl.execute(execution));
  }

  @Test
  void testExecute_MultipleEntities_PartialMatch() {
    String namespaceMap = "{\"entityList\":\"global\"}";
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(namespaceMap);
    String rules = "{\"==\":[{\"var\":\"name\"},\"matchingTable\"]}";
    when(rulesExpr.getValue(execution)).thenReturn(rules);

    List<String> entityList = List.of("<#E::table::test.db.table1>", "<#E::table::test.db.table2>");
    when(execution.getVariable("global_entityList")).thenReturn(entityList);

    Table matchingTable = new Table();
    matchingTable.setName("matchingTable");
    matchingTable.setFullyQualifiedName("test.db.table1");

    Table nonMatchingTable = new Table();
    nonMatchingTable.setName("otherTable");
    nonMatchingTable.setFullyQualifiedName("test.db.table2");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntitiesByLinks(anyList(), anyString(), eq(Include.ALL)))
          .thenReturn(
              Map.of(
                  "<#E::table::test.db.table1>", matchingTable,
                  "<#E::table::test.db.table2>", nonMatchingTable));

      impl.execute(execution);
    }

    verify(execution).setVariable(eq("process_" + HAS_TRUE_ENTITIES_VARIABLE), eq(true));
    verify(execution).setVariable(eq("process_" + HAS_FALSE_ENTITIES_VARIABLE), eq(true));
  }

  private void injectExpression(Object target, String fieldName, Expression value)
      throws Exception {
    Field field = CheckEntityAttributesImpl.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
