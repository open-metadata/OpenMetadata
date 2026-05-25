package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.mockito.ArgumentMatchers.anyList;
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
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CheckChangeDescriptionTaskImplTest {

  @Mock private DelegateExecution execution;
  @Mock private Expression conditionExpr;
  @Mock private Expression rulesExpr;
  @Mock private Expression inputNamespaceMapExpr;

  private CheckChangeDescriptionTaskImpl impl;

  @BeforeEach
  void setUp() throws Exception {
    impl = new CheckChangeDescriptionTaskImpl();
    injectExpression(impl, "conditionExpr", conditionExpr);
    injectExpression(impl, "rulesExpr", rulesExpr);
    injectExpression(impl, "inputNamespaceMapExpr", inputNamespaceMapExpr);

    when(execution.getProcessDefinitionId()).thenReturn("process:1:test");
    when(execution.getCurrentActivityId()).thenReturn("process.checkChangeDescriptionTask");
    when(execution.getParent()).thenReturn(null);
  }

  @Test
  void testExecute_NoChangeDescription_ReturnsTrueForCreate() {
    String namespaceMap = "{\"entityList\":\"global\"}";
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(namespaceMap);
    when(conditionExpr.getValue(execution)).thenReturn("OR");
    when(rulesExpr.getValue(execution)).thenReturn("{\"owner\":[\"newOwner\"]}");

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
  void testExecute_WithMatchingChangeDescription() {
    String namespaceMap = "{\"entityList\":\"global\"}";
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(namespaceMap);
    when(conditionExpr.getValue(execution)).thenReturn("OR");
    when(rulesExpr.getValue(execution)).thenReturn("{\"description\":[\"new desc\"]}");

    List<String> entityList = List.of("<#E::table::test.db.table>");
    when(execution.getVariable("global_entityList")).thenReturn(entityList);

    FieldChange fieldChange = new FieldChange();
    fieldChange.setName("description");
    fieldChange.setNewValue("new desc added");

    ChangeDescription changeDescription = new ChangeDescription();
    changeDescription.setFieldsUpdated(List.of(fieldChange));
    changeDescription.setFieldsAdded(List.of());
    changeDescription.setFieldsDeleted(List.of());

    Table table = new Table();
    table.setName("testTable");
    table.setFullyQualifiedName("test.db.table");
    table.setChangeDescription(changeDescription);

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
  void testExecute_WithNonMatchingChangeDescription() {
    String namespaceMap = "{\"entityList\":\"global\"}";
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(namespaceMap);
    when(conditionExpr.getValue(execution)).thenReturn("OR");
    when(rulesExpr.getValue(execution)).thenReturn("{\"owner\":[\"expectedOwner\"]}");

    List<String> entityList = List.of("<#E::table::test.db.table>");
    when(execution.getVariable("global_entityList")).thenReturn(entityList);

    FieldChange fieldChange = new FieldChange();
    fieldChange.setName("description");
    fieldChange.setNewValue("changed description");

    ChangeDescription changeDescription = new ChangeDescription();
    changeDescription.setFieldsUpdated(List.of(fieldChange));
    changeDescription.setFieldsAdded(List.of());
    changeDescription.setFieldsDeleted(List.of());

    Table table = new Table();
    table.setName("testTable");
    table.setFullyQualifiedName("test.db.table");
    table.setChangeDescription(changeDescription);

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
  void testExecute_AndConditionAllMatch() {
    String namespaceMap = "{\"entityList\":\"global\"}";
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn(namespaceMap);
    when(conditionExpr.getValue(execution)).thenReturn("AND");
    when(rulesExpr.getValue(execution)).thenReturn("{\"description\":[\"new\"]}");

    List<String> entityList = List.of("<#E::table::test.db.table>");
    when(execution.getVariable("global_entityList")).thenReturn(entityList);

    FieldChange fieldChange = new FieldChange();
    fieldChange.setName("description");
    fieldChange.setNewValue("new description text");

    ChangeDescription changeDescription = new ChangeDescription();
    changeDescription.setFieldsUpdated(List.of(fieldChange));
    changeDescription.setFieldsAdded(List.of());
    changeDescription.setFieldsDeleted(List.of());

    Table table = new Table();
    table.setName("testTable");
    table.setFullyQualifiedName("test.db.table");
    table.setChangeDescription(changeDescription);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntitiesByLinks(anyList(), eq("*"), eq(Include.ALL)))
          .thenReturn(Map.of("<#E::table::test.db.table>", table));

      impl.execute(execution);
    }

    verify(execution).setVariable(eq("process_" + HAS_TRUE_ENTITIES_VARIABLE), eq(true));
    verify(execution).setVariable(eq("process_" + HAS_FALSE_ENTITIES_VARIABLE), eq(false));
  }

  @Test
  void testExecute_ExceptionThrowsBpmnError() {
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn("invalid json {{{");

    Assertions.assertThrows(BpmnError.class, () -> impl.execute(execution));
  }

  private void injectExpression(Object target, String fieldName, Expression value)
      throws Exception {
    Field field = CheckChangeDescriptionTaskImpl.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
