package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink.SinkProviderRegistry;

class SinkEntityTypeRuleTest {

  private final SinkProviderRegistry registry = mock(SinkProviderRegistry.class);
  private MockedStatic<SinkProviderRegistry> registryStatic;

  @BeforeEach
  void setUp() {
    registryStatic = mockStatic(SinkProviderRegistry.class);
    registryStatic.when(SinkProviderRegistry::getInstance).thenReturn(registry);
    when(registry.excludedEntityTypes("git")).thenReturn(Set.of("query"));
  }

  @AfterEach
  void tearDown() {
    registryStatic.close();
  }

  @Test
  void exclusionsApplyToAnyProviderAndEntityType() {
    when(registry.excludedEntityTypes("webhook")).thenReturn(Set.of("table"));
    WorkflowDefinition workflow =
        JsonUtils.readValue(
            WORKFLOW.formatted(PERIODIC_TRIGGER.formatted("[\"table\", \"query\"]"), "webhook"),
            WorkflowDefinition.class);
    assertEquals(Set.of("table"), SinkEntityTypeRule.unsupportedTriggerEntityTypes(workflow));
    assertEquals(Set.of("table"), SinkEntityTypeRule.excludedTriggerEntityTypes(workflow));
  }

  @Test
  void aWorkflowCombinesTheRestrictionsOfAllItsSinks() {
    when(registry.excludedEntityTypes("webhook")).thenReturn(Set.of("table"));
    String trigger = PERIODIC_TRIGGER.formatted("[\"table\", \"query\"]");
    WorkflowDefinition workflow =
        JsonUtils.readValue(WORKFLOW.formatted(trigger, "git"), WorkflowDefinition.class);
    WorkflowDefinition webhook =
        JsonUtils.readValue(WORKFLOW.formatted(trigger, "webhook"), WorkflowDefinition.class);
    workflow.getNodes().add(webhook.getNodes().get(1));

    assertEquals(Set.of("table", "query"), SinkEntityTypeRule.excludedTriggerEntityTypes(workflow));
    assertEquals(
        Set.of("table", "query"), SinkEntityTypeRule.unsupportedTriggerEntityTypes(workflow));
  }

  @Test
  void deprecatedPeriodicEntityTypeIsAlsoChecked() {
    String trigger =
        PERIODIC_TRIGGER
            .formatted("[]")
            .replace("\"entityTypes\": []", "\"entityType\": \"query\"");
    assertTrue(syncsQueriesToGit(trigger, "git"));
  }

  private static final String WORKFLOW =
      """
      {"name": "sinkWorkflow", "fullyQualifiedName": "sinkWorkflow",
       "trigger": %s,
       "nodes": [
         {"name": "start", "displayName": "start", "type": "startEvent", "subType": "startEvent"},
         {"name": "sink", "displayName": "sink", "type": "automatedTask", "subType": "sinkTask",
          "config": {"sinkType": "%s", "sinkConfig": {"repositoryUrl": "https://github.com/o/r.git"}}},
         {"name": "end", "displayName": "end", "type": "endEvent", "subType": "endEvent"}
       ],
       "edges": [{"from": "start", "to": "sink"}, {"from": "sink", "to": "end"}]}""";

  private static final String PERIODIC_TRIGGER =
      """
      {"type": "periodicBatchEntity",
       "config": {"entityTypes": %s, "schedule": {"scheduleTimeline": "None"}, "filters": "{}"}}""";

  private static final String EVENT_TRIGGER =
      """
      {"type": "eventBasedEntity", "config": {"entityTypes": %s, "events": ["Created"]}}""";

  private static final String DEPRECATED_EVENT_TRIGGER =
      """
      {"type": "eventBasedEntity", "config": {"entityType": "%s", "events": ["Created"]}}""";

  private static final String NO_OP_TRIGGER = """
      {"type": "noOp", "config": {}}""";

  @Test
  void anUnregisteredProviderDoesNotSupplyEntityTypeRestrictions() {
    when(registry.excludedEntityTypes("git")).thenReturn(Set.of());
    assertFalse(syncsQueriesToGit(PERIODIC_TRIGGER.formatted("[\"query\"]"), "git"));
  }

  @Test
  void gitSinkWithAPeriodicQueryTriggerSyncsQueries() {
    assertTrue(syncsQueriesToGit(PERIODIC_TRIGGER.formatted("[\"table\", \"query\"]"), "git"));
  }

  @Test
  void gitSinkWithAnEventBasedQueryTriggerSyncsQueries() {
    assertTrue(syncsQueriesToGit(EVENT_TRIGGER.formatted("[\"query\"]"), "git"));
  }

  @Test
  void gitSinkWithTheDeprecatedSingleQueryEntityTypeSyncsQueries() {
    assertTrue(syncsQueriesToGit(DEPRECATED_EVENT_TRIGGER.formatted("query"), "git"));
  }

  @Test
  void gitSinkWithoutQueryInTheTriggerDoesNotSyncQueries() {
    assertFalse(syncsQueriesToGit(PERIODIC_TRIGGER.formatted("[\"table\"]"), "git"));
    assertFalse(syncsQueriesToGit(DEPRECATED_EVENT_TRIGGER.formatted("table"), "git"));
  }

  @Test
  void webhookSinkWithAQueryTriggerIsNotAGitSync() {
    assertFalse(syncsQueriesToGit(PERIODIC_TRIGGER.formatted("[\"query\"]"), "webhook"));
  }

  @Test
  void triggerWithoutEntityTypesDoesNotSyncQueries() {
    assertFalse(syncsQueriesToGit(NO_OP_TRIGGER, "git"));
  }

  private static boolean syncsQueriesToGit(String trigger, String sinkType) {
    WorkflowDefinition workflow =
        JsonUtils.readValue(WORKFLOW.formatted(trigger, sinkType), WorkflowDefinition.class);
    return SinkEntityTypeRule.unsupportedTriggerEntityTypes(workflow).contains("query");
  }
}
