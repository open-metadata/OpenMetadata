package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;

class WorkflowDefinitionRepositoryReadableTest {
  private static final String WORKFLOW =
      """
      {"name":"%s","trigger":{"type":"noOp","output":[]},
       "nodes":[{"name":"start","type":"startEvent","subType":"startEvent"}],"edges":[]}
      """;
  private static final String FROM_ANOTHER_VERSION =
      """
      {"name":"newerWorkflow","trigger":{"type":"noOp","output":[]},
       "nodes":[{"name":"step","type":"automatedTask","subType":"taskFromANewerRelease"}],"edges":[]}
      """;

  @Test
  void aDefinitionThisServerCannotReadDoesNotHideTheOthers() {
    final List<WorkflowDefinition> readable =
        WorkflowDefinitionRepository.readable(
            List.of(
                WORKFLOW.formatted("firstWorkflow"),
                FROM_ANOTHER_VERSION,
                WORKFLOW.formatted("secondWorkflow")));

    assertEquals(
        List.of("firstWorkflow", "secondWorkflow"),
        readable.stream().map(WorkflowDefinition::getName).toList());
  }
}
