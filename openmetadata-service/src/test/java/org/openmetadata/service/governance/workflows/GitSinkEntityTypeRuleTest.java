package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;

class GitSinkEntityTypeRuleTest {

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
    return GitSinkEntityTypeRule.syncsQueriesToGit(workflow);
  }
}
