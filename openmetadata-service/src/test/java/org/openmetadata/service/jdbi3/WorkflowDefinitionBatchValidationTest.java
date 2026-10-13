package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mockStatic;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;

/** Batch-execution checks of {@link WorkflowDefinitionRepository#validateWorkflow}. */
class WorkflowDefinitionBatchValidationTest {

  private static final String WORKFLOW =
      """
      {"name": "batchWorkflow", "fullyQualifiedName": "batchWorkflow",
       "trigger": %s,
       "nodes": [
         {"name": "start", "displayName": "start", "type": "startEvent", "subType": "startEvent"},
         {"name": "checkTier", "displayName": "checkTier", "type": "automatedTask",
          "subType": "checkEntityAttributesTask",
          "config": {"rules": "{\\"==\\":[{\\"var\\":\\"description\\"},\\"gold\\"]}"},
          "inputNamespaceMap": {"relatedEntity": "global"}},
         {"name": "setDescription", "displayName": "setDescription", "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {"fieldName": "description", "fieldValue": "synced"},
          "inputNamespaceMap": {"relatedEntity": "global"}},
         {"name": "sink", "displayName": "sink", "type": "automatedTask", "subType": "sinkTask",
          "config": {"sinkType": "webhook", "sinkConfig": {"endpoint": "http://127.0.0.1:9/x"},
                     "batchMode": true}},
         {"name": "end", "displayName": "end", "type": "endEvent", "subType": "endEvent"},
         {"name": "skipped", "displayName": "skipped", "type": "endEvent", "subType": "endEvent"}
       ],
       "edges": [%s]}""";

  private static final String PERIODIC_TRIGGER =
      """
      {"type": "periodicBatchEntity",
       "config": {"entityTypes": ["table"], "schedule": {"scheduleTimeline": "None"},
                  "filters": {"table": "{}"}},
       "output": ["relatedEntity", "updatedBy"]}""";

  private static final String EVENT_TRIGGER =
      """
      {"type": "eventBasedEntity",
       "config": {"entityTypes": ["table"], "events": ["Created"]},
       "output": ["relatedEntity", "updatedBy"]}""";

  private static final String TRUE_TO_SINK =
      """
      {"from": "start", "to": "checkTier"},
      {"from": "checkTier", "to": "setDescription", "condition": "true"},
      {"from": "checkTier", "to": "skipped", "condition": "false"},
      {"from": "setDescription", "to": "sink"},
      {"from": "sink", "to": "end"}""";

  private static final String FALSE_TO_ACTION =
      """
      {"from": "start", "to": "checkTier"},
      {"from": "checkTier", "to": "sink", "condition": "true"},
      {"from": "checkTier", "to": "setDescription", "condition": "false"},
      {"from": "setDescription", "to": "end"},
      {"from": "sink", "to": "skipped"}""";

  private MockedStatic<Entity> entityStatics;
  private WorkflowDefinitionRepository repository;

  @BeforeEach
  void setUp() {
    entityStatics = mockStatic(Entity.class, RETURNS_DEEP_STUBS);
    repository = new WorkflowDefinitionRepository();
  }

  @AfterEach
  void tearDown() {
    entityStatics.close();
  }

  @Test
  void batchWorkflowOnASinglePathIsValid() {
    assertDoesNotThrow(() -> repository.validateWorkflow(workflow(PERIODIC_TRIGGER, TRUE_TO_SINK)));
  }

  @Test
  void batchWorkflowWhoseFalseBranchContinuesIsRejected() {
    WorkflowDefinition workflow = workflow(PERIODIC_TRIGGER, FALSE_TO_ACTION);

    BadRequestException rejected =
        assertThrows(BadRequestException.class, () -> repository.validateWorkflow(workflow));

    assertTrue(
        rejected
            .getMessage()
            .startsWith(
                "Workflow 'batchWorkflow' writes its entities with a batch sink, so it runs once per batch"),
        rejected.getMessage());
    assertTrue(
        rejected.getMessage().contains("node 'checkTier' continues to [sink, setDescription]"),
        rejected.getMessage());
  }

  @Test
  void eventBasedWorkflowWithTheSameShapeIsValid() {
    assertDoesNotThrow(() -> repository.validateWorkflow(workflow(EVENT_TRIGGER, FALSE_TO_ACTION)));
  }

  private static WorkflowDefinition workflow(String trigger, String edges) {
    return JsonUtils.readValue(WORKFLOW.formatted(trigger, edges), WorkflowDefinition.class);
  }
}
