package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;

class DataCompletenessImplTest {
  @ParameterizedTest
  @ValueSource(strings = {"0", "false", "\"finance\"", "\"\"", "[]", "{}", "null"})
  void evaluatesDottedCustomPropertiesWithoutConfusingNestedPaths(String json) throws Exception {
    final DataCompletenessImpl delegate = new DataCompletenessImpl();
    final DelegateExecution execution = mock(DelegateExecution.class);
    expression(delegate, execution, "fieldsToCheckExpr", "[\"extension.cost.centre\"]");
    expression(
        delegate,
        execution,
        "qualityBandsExpr",
        "[{\"name\":\"pass\",\"minimumScore\":100},{\"name\":\"fail\",\"minimumScore\":0}]");
    expression(delegate, execution, "inputNamespaceMapExpr", "{\"relatedEntity\":\"global\"}");
    when(execution.getVariable("global_relatedEntity")).thenReturn("<#E::domain::finance>");
    when(execution.getCurrentActivityId()).thenReturn("Completeness.calculate");
    final Domain domain =
        new Domain()
            .withExtension(
                JsonUtils.readValue(
                    "{\"cost.centre\":" + json + ",\"cost\":{\"centre\":\"should-not-use\"}}",
                    Map.class));
    try (var entities = mockStatic(Entity.class)) {
      entities
          .when(
              () -> Entity.getEntity(any(MessageParser.EntityLink.class), eq("*"), eq(Include.ALL)))
          .thenReturn(domain);
      delegate.execute(execution);
    }
    final boolean present = List.of("0", "false", "\"finance\"").contains(json);
    verify(execution).setVariable("Completeness_completenessScore", present ? 100.0 : 0.0);
    verify(execution).setVariable("Completeness_result", present ? "pass" : "fail");
  }

  private void expression(
      DataCompletenessImpl delegate, DelegateExecution execution, String name, String value)
      throws Exception {
    final Expression expression = mock(Expression.class);
    when(expression.getValue(execution)).thenReturn(value);
    final Field field = DataCompletenessImpl.class.getDeclaredField(name);
    field.setAccessible(true);
    field.set(delegate, expression);
  }
}
