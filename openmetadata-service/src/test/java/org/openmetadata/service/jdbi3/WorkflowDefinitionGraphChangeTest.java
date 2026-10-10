package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;

/** Which updates of a workflow definition the batch and sink rules have to check again. */
class WorkflowDefinitionGraphChangeTest {

  private static final String WORKFLOW =
      """
      {"name": "graphChange", "fullyQualifiedName": "graphChange",
       "trigger": {"type": "periodicBatchEntity",
                   "config": {"entityTypes": [%s], "schedule": {"scheduleTimeline": "None"}},
                   "output": ["relatedEntity", "updatedBy"]},
       "nodes": [
         {"name": "start", "type": "startEvent", "subType": "startEvent"},
         {"name": "gitSink", "type": "automatedTask", "subType": "sinkTask",
          "config": {"sinkType": "git",
                     "sinkConfig": {"repositoryUrl": "https://github.com/o/r.git",
                                    "credentials": {"type": "token", "token": "%s"}}}},
         {"name": "end", "type": "endEvent", "subType": "endEvent"}
       ],
       "edges": [{"from": "start", "to": "gitSink"}, {"from": "gitSink", "to": "end"}]}""";

  @Test
  void aSecretEncryptedOrReplacedIsNotAGraphChange() {
    WorkflowDefinition storedPlaintext = workflow("\"table\"", "ghp_storedAsPlaintext");
    WorkflowDefinition encrypted = workflow("\"table\"", "fernet:gAAAAABencryptedValue");
    WorkflowDefinition replaced = workflow("\"table\"", "ghp_anotherToken");

    assertFalse(WorkflowDefinitionRepository.changesWorkflowGraph(storedPlaintext, encrypted));
    assertFalse(WorkflowDefinitionRepository.changesWorkflowGraph(storedPlaintext, replaced));
  }

  @Test
  void aTriggerChangeIsAGraphChange() {
    WorkflowDefinition stored = workflow("\"table\"", "ghp_token");
    WorkflowDefinition retriggered = workflow("\"table\", \"query\"", "ghp_token");

    assertTrue(WorkflowDefinitionRepository.changesWorkflowGraph(stored, retriggered));
  }

  private static WorkflowDefinition workflow(String entityTypes, String token) {
    return JsonUtils.readValue(WORKFLOW.formatted(entityTypes, token), WorkflowDefinition.class);
  }
}
