package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;
import org.flowable.bpmn.model.BpmnModel;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.PeriodicBatchEntityTriggerDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
import org.openmetadata.service.governance.workflows.elements.triggers.EventBasedEntityTrigger;
import org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger;
import org.openmetadata.service.governance.workflows.flowable.MainWorkflow;
import org.openmetadata.service.governance.workflows.flowable.TriggerWorkflow;
import org.openmetadata.service.migration.utils.v210.SinkWorkflowDeployments.DeployedProcess;
import org.openmetadata.service.migration.utils.v210.WorkflowSinkSecretsMigration.StoredRow;

/**
 * Which stored sink workflows the v2.1.0 migration redeploys for batch execution and for a Git-sink
 * trigger without query entities. Deployments are kept in memory: a redeploy replaces a
 * definition's deployed models with the ones the current code builds, as Flowable would.
 */
class SinkWorkflowDeploymentsTest {

  private static final String WORKFLOW =
      """
      {"id": "%s", "name": "%s", "fullyQualifiedName": "%2$s",
       "trigger": %s,
       "nodes": [%s
         {"name": "sink", "displayName": "sink", "type": "automatedTask", "subType": "sinkTask",
          "config": {"sinkType": "%s", "sinkConfig": {"repositoryUrl": "https://github.com/o/r.git"},
                     "batchMode": %s}},
         {"name": "start", "displayName": "start", "type": "startEvent", "subType": "startEvent"},
         {"name": "end", "displayName": "end", "type": "endEvent", "subType": "endEvent"},
         {"name": "skipped", "displayName": "skipped", "type": "endEvent", "subType": "endEvent"}
       ],
       "edges": [%s],
       "config": {"storeStageStatus": false}}""";

  private static final String CHECK_NODE =
      """
      {"name": "checkTier", "displayName": "checkTier", "type": "automatedTask",
       "subType": "checkEntityAttributesTask",
       "config": {"rules": "{\\"==\\":[{\\"var\\":\\"description\\"},\\"gold\\"]}"},
       "inputNamespaceMap": {"relatedEntity": "global"}},""";

  private static final String CHECK_EDGES =
      """
      {"from": "start", "to": "checkTier"},
      {"from": "checkTier", "to": "sink", "condition": "true"},
      {"from": "checkTier", "to": "skipped", "condition": "false"},
      {"from": "sink", "to": "end"}""";

  private static final String SINK_ONLY_EDGES =
      """
      {"from": "start", "to": "sink"}, {"from": "sink", "to": "end"}""";

  private static final String PERIODIC_TRIGGER =
      """
      {"type": "periodicBatchEntity",
       "config": {"entityTypes": %s, "schedule": {"scheduleTimeline": "None"}, "filters": "{}"},
       "output": ["relatedEntity", "updatedBy"]}""";

  private static final String EVENT_TRIGGER =
      """
      {"type": "eventBasedEntity", "config": {"entityTypes": %s, "events": ["Created"]},
       "output": ["relatedEntity", "updatedBy"]}""";

  private static final String TABLES = "[\"table\"]";
  private static final String TABLES_AND_QUERIES = "[\"table\", \"query\"]";
  private static final String QUERIES = "[\"query\"]";

  private final Map<String, BpmnModel> deployedMainModels = new HashMap<>();
  private final Map<String, List<DeployedProcess>> deployedTriggers = new HashMap<>();
  private final List<String> deploys = new ArrayList<>();

  @Test
  void aBatchSinkWorkflowDeployedWithoutBatchFieldsIsRedeployedOnceAndThenLeftAlone() {
    WorkflowDefinition batch =
        workflow("batchSync", PERIODIC_TRIGGER.formatted(TABLES), CHECK_NODE, "webhook", true);
    deployMainAsBefore(batch);

    runMigration(List.of(batch));
    runMigration(List.of(batch));

    assertEquals(List.of("batchSync"), deploys);
    assertTrue(
        SinkWorkflowDeployments.hasBatchExecutionFields(deployedMainModels.get("batchSync")));
  }

  @Test
  void workflowsThatDoNotRunTheirNodesOnTheWholeBatchAreNeverRedeployed() {
    WorkflowDefinition perEntitySink =
        workflow("perEntity", PERIODIC_TRIGGER.formatted(TABLES), CHECK_NODE, "webhook", false);
    WorkflowDefinition eventBased =
        workflow("eventBased", EVENT_TRIGGER.formatted(TABLES), CHECK_NODE, "webhook", true);
    WorkflowDefinition sinkOnly =
        workflow("sinkOnly", PERIODIC_TRIGGER.formatted(TABLES), "", "webhook", true);
    List.of(perEntitySink, eventBased, sinkOnly).forEach(this::deployMainAsBefore);

    runMigration(List.of(perEntitySink, eventBased, sinkOnly));

    assertEquals(List.of(), deploys);
    assertFalse(SinkWorkflowDeployments.expectsBatchExecutionFields(sinkOnly));
  }

  @Test
  void aGitSinkPeriodicTriggerWithAQueryProcessIsRedeployedOnceWithoutIt() {
    WorkflowDefinition gitSync =
        workflow("gitSync", PERIODIC_TRIGGER.formatted(TABLES_AND_QUERIES), "", "git", true);
    deployTriggerAsBefore(gitSync);
    assertEquals(
        List.of("gitSyncTrigger-table", "gitSyncTrigger-query"), deployedTriggerKeys(gitSync));

    runMigration(List.of(gitSync));
    runMigration(List.of(gitSync));

    assertEquals(List.of("gitSync"), deploys);
    assertEquals(List.of("gitSyncTrigger-table"), deployedTriggerKeys(gitSync));
  }

  @Test
  void aGitSinkTriggerOverQueriesOnlyIsRedeployedOnceAsAnIdleTrigger() {
    WorkflowDefinition queriesOnly =
        workflow("gitQueries", PERIODIC_TRIGGER.formatted(QUERIES), "", "git", true);
    deployTriggerAsBefore(queriesOnly);

    runMigration(List.of(queriesOnly));
    runMigration(List.of(queriesOnly));

    assertEquals(List.of("gitQueries"), deploys);
    assertEquals(List.of("gitQueriesTrigger"), deployedTriggerKeys(queriesOnly));
  }

  @Test
  void aGitSinkEventTriggerWithAQuerySignalIsRedeployedOnceWithoutIt() {
    WorkflowDefinition gitEvents =
        workflow("gitEvents", EVENT_TRIGGER.formatted(TABLES_AND_QUERIES), "", "git", true);
    deployTriggerAsBefore(gitEvents);

    runMigration(List.of(gitEvents));
    runMigration(List.of(gitEvents));

    assertEquals(List.of("gitEvents"), deploys);
  }

  @Test
  void aWebhookSinkWithAQueryTriggerIsNotRedeployed() {
    WorkflowDefinition webhook =
        workflow(
            "webhookSync", PERIODIC_TRIGGER.formatted(TABLES_AND_QUERIES), "", "webhook", true);
    deployTriggerAsBefore(webhook);

    runMigration(List.of(webhook));

    assertEquals(List.of(), deploys);
  }

  @Test
  void aWorkflowNeedingBothChangesIsRedeployedOnce() {
    WorkflowDefinition both =
        workflow(
            "bothChanges", PERIODIC_TRIGGER.formatted(TABLES_AND_QUERIES), CHECK_NODE, "git", true);
    deployMainAsBefore(both);
    deployTriggerAsBefore(both);

    runMigration(List.of(both));
    runMigration(List.of(both));

    assertEquals(List.of("bothChanges"), deploys);
  }

  private void runMigration(List<WorkflowDefinition> definitions) {
    List<StoredRow> rows =
        definitions.stream()
            .map(
                definition ->
                    new StoredRow(
                        definition.getId().toString(), null, JsonUtils.pojoToJson(definition)))
            .toList();
    List<String> failed =
        WorkflowSinkSecretsMigration.redeploySinkWorkflows(
            cursor -> rows,
            () -> {},
            List.of(
                SinkWorkflowDeployments.batchExecution(
                    name -> Optional.ofNullable(deployedMainModels.get(name))),
                SinkWorkflowDeployments.queryTrigger(
                    triggerId -> deployedTriggers.getOrDefault(triggerId, List.of()))),
            redeploy());
    assertEquals(List.of(), failed);
  }

  private Consumer<WorkflowDefinition> redeploy() {
    return definition -> {
      deploys.add(definition.getName());
      deployedMainModels.put(definition.getName(), new MainWorkflow(definition).getModel());
      deployedTriggers.put(
          triggerId(definition), processes(new TriggerWorkflow(definition).getModel()));
    };
  }

  /** Deploys the main process with per-entity nodes, as before batch execution existed. */
  private void deployMainAsBefore(WorkflowDefinition definition) {
    deployedMainModels.put(
        definition.getName(), new MainWorkflow(withBatchMode(definition, false)).getModel());
  }

  /** Deploys the trigger for every configured entity type, as before queries were excluded. */
  private void deployTriggerAsBefore(WorkflowDefinition definition) {
    String triggerId = triggerId(definition);
    BpmnModel model = new BpmnModel();
    // The trigger is held as WorkflowTriggerInterface; each trigger type is built from its own
    // definition class.
    if (definition.getTrigger() instanceof PeriodicBatchEntityTriggerDefinition periodic) {
      new PeriodicBatchEntityTrigger(definition.getName(), triggerId, periodic, true)
          .addToWorkflow(model);
    }
    // Same untyped trigger interface, for the event-based definition.
    if (definition.getTrigger() instanceof EventBasedEntityTriggerDefinition eventBased) {
      new EventBasedEntityTrigger(definition.getName(), triggerId, eventBased).addToWorkflow(model);
    }
    deployedTriggers.put(triggerId, processes(model));
  }

  private List<String> deployedTriggerKeys(WorkflowDefinition definition) {
    return deployedTriggers.get(triggerId(definition)).stream().map(DeployedProcess::key).toList();
  }

  private static List<DeployedProcess> processes(BpmnModel model) {
    return model.getProcesses().stream()
        .map(process -> new DeployedProcess(process.getId(), () -> model))
        .toList();
  }

  private static String triggerId(WorkflowDefinition definition) {
    return TriggerFactory.getTriggerWorkflowId(definition.getFullyQualifiedName());
  }

  private static WorkflowDefinition withBatchMode(WorkflowDefinition definition, boolean batch) {
    String json =
        JsonUtils.pojoToJson(definition)
            .replace("\"batchMode\":true", "\"batchMode\":%s".formatted(batch));
    return JsonUtils.readValue(json, WorkflowDefinition.class);
  }

  private static WorkflowDefinition workflow(
      String name, String trigger, String checkNode, String sinkType, boolean batchMode) {
    String edges = checkNode.isEmpty() ? SINK_ONLY_EDGES : CHECK_EDGES;
    return JsonUtils.readValue(
        WORKFLOW.formatted(UUID.randomUUID(), name, trigger, checkNode, sinkType, batchMode, edges),
        WorkflowDefinition.class);
  }
}
