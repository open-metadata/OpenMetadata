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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;

class WorkflowVariableHandlerInputNamespacesTest {

  @Test
  void readAcceptsJsonFieldExtension() {
    InputNamespaces namespaces =
        InputNamespaces.read(
            JsonUtils.pojoToJson(Map.of("relatedEntity", "global", "updatedBy", "task")));

    assertEquals("global", namespaces.namespaceFor("relatedEntity"));
    assertEquals("task", namespaces.namespaceFor("updatedBy"));
  }

  @Test
  void readAcceptsConvertedMapFieldExtension() {
    InputNamespaces namespaces = InputNamespaces.read(Map.of("relatedEntity", "global"));

    assertEquals("global", namespaces.namespaceFor("relatedEntity"));
    assertNull(namespaces.namespaceFor("updatedBy"));
  }

  @Test
  void readTreatsMissingExtensionAsEmpty() {
    InputNamespaces namespaces = InputNamespaces.read(null);

    assertNull(namespaces.namespaceFor("relatedEntity"));
  }

  @Test
  void fromReadsExpressionValue() {
    Expression expression = mock(Expression.class);
    DelegateExecution execution = mock(DelegateExecution.class);
    when(expression.getValue(execution)).thenReturn(Map.of("relatedEntity", "global"));

    InputNamespaces namespaces = InputNamespaces.from(expression, execution);

    assertEquals("global", namespaces.namespaceFor("relatedEntity"));
  }
}
