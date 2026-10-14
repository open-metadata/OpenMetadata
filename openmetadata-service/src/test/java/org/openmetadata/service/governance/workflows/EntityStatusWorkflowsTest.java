package org.openmetadata.service.governance.workflows;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class EntityStatusWorkflowsTest {
  private static final String METRIC_APPROVAL_WORKFLOW =
      "/json/data/governance/workflows/MetricApprovalWorkflow.json";
  private static final Set<String> APPROVAL_STEPS =
      Set.of("userApprovalTask", "rollbackEntityTask");
  private static final String EXCLUDED_METRIC = "internal_metric";

  @Test
  void approvalWorkflowOwnsTheStageOfTheTypeItStartsOn() throws IOException {
    WorkflowDefinition workflow = workflow(metricApprovalWorkflow());

    assertTrue(EntityStatusWorkflows.ownsStage(workflow));
    assertTrue(EntityStatusWorkflows.startsOn(workflow, Entity.METRIC));
    assertFalse(EntityStatusWorkflows.startsOn(workflow, Entity.TABLE));
  }

  @Test
  void suspendedWorkflowOwnsNoStage() throws IOException {
    WorkflowDefinition workflow = workflow(metricApprovalWorkflow()).withSuspended(true);

    assertFalse(EntityStatusWorkflows.ownsStage(workflow));
  }

  @Test
  void workflowThatNeverSetsTheStageOwnsNone() throws IOException {
    ObjectNode json = metricApprovalWorkflow();
    ArrayNode nodes = (ArrayNode) json.get("nodes");
    ArrayNode withoutStageSteps = nodes.arrayNode();
    for (JsonNode node : nodes) {
      if (!APPROVAL_STEPS.contains(node.path("subType").asText())) {
        if (node.has("config") && node.get("config").has("fieldName")) {
          ((ObjectNode) node.get("config")).put("fieldName", "description");
        }
        withoutStageSteps.add(node);
      }
    }
    json.set("nodes", withoutStageSteps);

    assertFalse(EntityStatusWorkflows.ownsStage(workflow(json)));
  }

  @Test
  void deprecatedSingleEntityTypeTriggerStillCounts() throws IOException {
    ObjectNode json = metricApprovalWorkflow();
    ObjectNode config = (ObjectNode) json.get("trigger").get("config");
    config.remove("entityTypes");
    config.put("entityType", Entity.METRIC);

    assertTrue(EntityStatusWorkflows.startsOn(workflow(json), Entity.METRIC));
  }

  @Test
  void workflowDoesNotApplyToEntitiesItsTriggerFilterExcludes() throws IOException {
    ObjectNode json = metricApprovalWorkflow();
    ObjectNode filter = ((ObjectNode) json.get("trigger").get("config")).putObject("filter");
    filter.put(Entity.METRIC, "{\"==\":[{\"var\":\"name\"},\"" + EXCLUDED_METRIC + "\"]}");
    WorkflowDefinition workflow = workflow(json);

    assertFalse(
        EntityStatusWorkflows.appliesTo(
            workflow, Entity.METRIC, new Metric().withName(EXCLUDED_METRIC)));
    assertTrue(
        EntityStatusWorkflows.appliesTo(
            workflow, Entity.METRIC, new Metric().withName("weekly_active_users")));
  }

  @Test
  void onlyTheGovernanceBotChangesAStageAsTheWorkflow() {
    assertTrue(
        EntityStatusWorkflows.isWorkflowChange(
            new Metric().withUpdatedBy(WorkflowEventConsumer.GOVERNANCE_BOT)));
    assertTrue(
        EntityStatusWorkflows.isWorkflowChange(
            new Metric()
                .withUpdatedBy("alice")
                .withImpersonatedBy(WorkflowEventConsumer.GOVERNANCE_BOT)));
    assertFalse(EntityStatusWorkflows.isWorkflowChange(new Metric().withUpdatedBy("alice")));
  }

  @Test
  void nothingOwnsAStageWhileTheWorkflowEngineIsDown() {
    EntityStatusWorkflows.invalidate();

    assertTrue(EntityStatusWorkflows.ACTIVE.owningStageOf(Entity.METRIC).isEmpty());
    assertTrue(
        EntityStatusWorkflows.ACTIVE
            .owningStageOf(Entity.METRIC, new Metric().withName("weekly"))
            .isEmpty());
  }

  private static ObjectNode metricApprovalWorkflow() throws IOException {
    try (InputStream in =
        EntityStatusWorkflowsTest.class.getResourceAsStream(METRIC_APPROVAL_WORKFLOW)) {
      return (ObjectNode) JsonUtils.readTree(new String(in.readAllBytes(), UTF_8));
    }
  }

  private static WorkflowDefinition workflow(ObjectNode json) {
    return JsonUtils.treeToValue(json, WorkflowDefinition.class);
  }
}
