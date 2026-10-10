package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink.SinkProviderRegistry;

/** Git-sink entity-type check of {@link WorkflowDefinitionRepository#validateWorkflow}. */
class WorkflowDefinitionGitSinkValidationTest {

  private static final String WORKFLOW =
      """
      {"name": "gitSyncWorkflow", "fullyQualifiedName": "gitSyncWorkflow",
       "trigger": {"type": "periodicBatchEntity",
                   "config": {"entityTypes": ["%s"], "schedule": {"scheduleTimeline": "None"},
                              "filters": "{}"},
                   "output": ["relatedEntity"]},
       "nodes": [
         {"name": "start", "displayName": "start", "type": "startEvent", "subType": "startEvent"},
         {"name": "sink", "displayName": "sink", "type": "automatedTask", "subType": "sinkTask",
          "config": {"sinkType": "%s",
                     "sinkConfig": {"repositoryUrl": "https://github.com/o/r.git"},
                     "batchMode": true}},
         {"name": "end", "displayName": "end", "type": "endEvent", "subType": "endEvent"}
       ],
       "edges": [{"from": "start", "to": "sink"}, {"from": "sink", "to": "end"}]}""";

  private MockedStatic<Entity> entityStatics;
  private WorkflowDefinitionRepository repository;

  private MockedStatic<SinkProviderRegistry> registryStatic;

  @BeforeEach
  void setUp() {
    SinkProviderRegistry registry = mock(SinkProviderRegistry.class);
    registryStatic = mockStatic(SinkProviderRegistry.class);
    registryStatic.when(SinkProviderRegistry::getInstance).thenReturn(registry);
    when(registry.excludedEntityTypes("git")).thenReturn(Set.of("query"));

    entityStatics = mockStatic(Entity.class, RETURNS_DEEP_STUBS);
    repository = new WorkflowDefinitionRepository();
  }

  @AfterEach
  void tearDown() {
    registryStatic.close();
    entityStatics.close();
  }

  @Test
  void gitSinkWorkflowTriggeredByQueriesIsRejected() {
    WorkflowDefinition workflow = workflow("query", "git");

    BadRequestException rejected =
        assertThrows(BadRequestException.class, () -> repository.validateWorkflow(workflow));

    assertEquals(
        "The workflow's sinks cannot sync entity types [query]. Remove them from the trigger's entity types.",
        rejected.getMessage());
  }

  @Test
  void gitSinkWorkflowTriggeredByTablesIsValid() {
    assertDoesNotThrow(() -> repository.validateWorkflow(workflow("table", "git")));
  }

  @Test
  void webhookSinkWorkflowTriggeredByQueriesIsValid() {
    assertDoesNotThrow(() -> repository.validateWorkflow(workflow("query", "webhook")));
  }

  private static WorkflowDefinition workflow(String entityType, String sinkType) {
    return JsonUtils.readValue(WORKFLOW.formatted(entityType, sinkType), WorkflowDefinition.class);
  }
}
