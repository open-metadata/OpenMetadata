package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DataCompletenessImplTest {

  @Mock private DelegateExecution execution;
  @Mock private Expression fieldsToCheckExpr;
  @Mock private Expression qualityBandsExpr;
  @Mock private Expression inputNamespaceMapExpr;

  private DataCompletenessImpl impl;

  private static final String QUALITY_BANDS_JSON =
      "[{\"name\":\"gold\",\"minimumScore\":0.8},{\"name\":\"silver\",\"minimumScore\":0.5}]";

  @BeforeEach
  void setUp() throws Exception {
    impl = new DataCompletenessImpl();
    injectExpression(impl, "fieldsToCheckExpr", fieldsToCheckExpr);
    injectExpression(impl, "qualityBandsExpr", qualityBandsExpr);
    injectExpression(impl, "inputNamespaceMapExpr", inputNamespaceMapExpr);

    when(execution.getProcessDefinitionId()).thenReturn("process:1:test");
    when(execution.getCurrentActivityId()).thenReturn("process.dataCompletenessTask");
    when(execution.getParent()).thenReturn(null);

    when(inputNamespaceMapExpr.getValue(execution)).thenReturn("{\"entityList\":\"global\"}");
    when(fieldsToCheckExpr.getValue(execution)).thenReturn("[\"description\"]");
    when(qualityBandsExpr.getValue(execution)).thenReturn(QUALITY_BANDS_JSON);
  }

  @Test
  void testExecute_EmptyEntityList_SetsAllFlagsToFalse() {
    when(execution.getVariable("global_entityList")).thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntitiesByLinks(anyList(), eq("*"), eq(Include.ALL)))
          .thenReturn(Map.of());

      impl.execute(execution);
    }

    // All band flags must be false — the split gateway's defaultFlow handles the empty case
    verify(execution).setVariable(eq("process_has_gold_entities"), eq(false));
    verify(execution).setVariable(eq("process_has_silver_entities"), eq(false));
  }

  @Test
  void testExecute_AllEntitiesFailProcessing_SetsAllFlagsToFalse() {
    List<String> entityList = List.of("<#E::table::test.db.table>");
    when(execution.getVariable("global_entityList")).thenReturn(entityList);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      // Entity not found in map → goes to failedEntities, no band assignment
      entityMock
          .when(() -> Entity.getEntitiesByLinks(anyList(), eq("*"), eq(Include.ALL)))
          .thenReturn(Map.of());

      impl.execute(execution);
    }

    // All band flags must be false — the split gateway's defaultFlow handles the empty case
    verify(execution).setVariable(eq("process_has_gold_entities"), eq(false));
    verify(execution).setVariable(eq("process_has_silver_entities"), eq(false));
  }

  private void injectExpression(Object target, String fieldName, Expression value)
      throws Exception {
    Field field = DataCompletenessImpl.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
