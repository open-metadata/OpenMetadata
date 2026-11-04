/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;

class WorkflowRedeployMigrationTest {

  @Test
  void everyWorkflowIsRedeployedAndOneThatFailsDoesNotStopTheRest() {
    WorkflowHandler handler = mock(WorkflowHandler.class);
    List<WorkflowDefinition> workflows =
        List.of(
            new WorkflowDefinition().withName("first").withFullyQualifiedName("first"),
            new WorkflowDefinition().withName("broken").withFullyQualifiedName("broken"),
            new WorkflowDefinition().withName("last").withFullyQualifiedName("last"));

    try (MockedConstruction<Workflow> built = mockConstruction(Workflow.class)) {
      doNothing()
          .doThrow(new IllegalStateException("cannot deploy"))
          .doNothing()
          .when(handler)
          .deploy(any(Workflow.class));

      int redeployed = WorkflowRedeployMigration.redeployEach(handler, workflows);

      assertEquals(2, redeployed);
      assertEquals(3, built.constructed().size());
      verify(handler, times(3)).deploy(any(Workflow.class));
    }
  }
}
