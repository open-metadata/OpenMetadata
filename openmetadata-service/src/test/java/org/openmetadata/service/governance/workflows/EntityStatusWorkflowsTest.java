package org.openmetadata.service.governance.workflows;

import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.common.util.concurrent.Uninterruptibles;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.governance.workflows.LifecycleConfiguration;
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
  void anEnforceWorkflowsApprovalPublishesTheHeldChangeAndOwnsNoStage() throws IOException {
    ObjectNode json = metricApprovalWorkflow();
    ArrayNode nodes = (ArrayNode) json.get("nodes");
    ArrayNode approvalOnly = nodes.arrayNode();
    for (JsonNode node : nodes) {
      if (!"setEntityAttributeTask".equals(node.path("subType").asText())) {
        approvalOnly.add(node);
      }
    }
    json.set("nodes", approvalOnly);
    ((ObjectNode) json.path("trigger").path("config")).put("approvalMode", "Enforce");

    assertFalse(EntityStatusWorkflows.ownsStage(workflow(json)));
    ((ObjectNode) json.path("trigger").path("config")).put("approvalMode", "Default");
    assertTrue(EntityStatusWorkflows.ownsStage(workflow(json)));
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
  void aLoadStillRunningWhenTheWorkflowsChangeIsNeverServedAfterIt()
      throws InterruptedException, ExecutionException, TimeoutException {
    final CountDownLatch loading = new CountDownLatch(1);
    final CountDownLatch release = new CountDownLatch(1);
    final AtomicInteger loads = new AtomicInteger();
    final EntityStatusWorkflows.InvalidatingCache<String> cache =
        new EntityStatusWorkflows.InvalidatingCache<>(
            Duration.ofMinutes(1),
            () -> {
              if (loads.getAndIncrement() > 0) {
                return "after";
              }
              loading.countDown();
              Uninterruptibles.awaitUninterruptibly(release);
              return "before";
            });

    final CompletableFuture<String> inFlight = CompletableFuture.supplyAsync(cache::get);
    assertTrue(loading.await(5, SECONDS));
    cache.invalidate();
    release.countDown();

    assertEquals("before", inFlight.get(5, SECONDS));
    assertEquals("after", cache.get());
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

  @Test
  void aLifecyclePlaybookOwnsTheStageOnlyWhenItIsTheApplicableOwner() throws IOException {
    WorkflowDefinition approval = workflow(metricApprovalWorkflow()).withName("B_MetricApproval");
    WorkflowDefinition playbook = playbook("C_MetricLifecycle");
    Metric metric = new Metric().withName("weekly_active_users");

    assertTrue(EntityStatusWorkflows.playbookOwnsStage(List.of(playbook), Entity.METRIC, metric));
    assertFalse(EntityStatusWorkflows.playbookOwnsStage(List.of(approval), Entity.METRIC, metric));
    assertFalse(
        EntityStatusWorkflows.playbookOwnsStage(
            List.of(playbook, approval), Entity.METRIC, metric));
    assertTrue(
        EntityStatusWorkflows.playbookOwnsStage(
            List.of(approval, playbook("A_MetricLifecycle")), Entity.METRIC, metric));
    assertFalse(
        EntityStatusWorkflows.playbookOwnsStage(List.of(playbook), Entity.GLOSSARY_TERM, metric));
  }

  @Test
  void aPlaybookOwnsNoStageForEntitiesItsTriggerFilterExcludes() throws IOException {
    ObjectNode json = metricApprovalWorkflow();
    ((ObjectNode) json.get("trigger").get("config"))
        .putObject("filter")
        .put(Entity.METRIC, "{\"==\":[{\"var\":\"name\"},\"" + EXCLUDED_METRIC + "\"]}");
    WorkflowDefinition playbook = asPlaybook(workflow(json).withName("MetricLifecycle"));

    assertFalse(
        EntityStatusWorkflows.playbookOwnsStage(
            List.of(playbook), Entity.METRIC, new Metric().withName(EXCLUDED_METRIC)));
  }

  @Test
  void onlyWorkflowsThatSetTheStageInANodeWriteItThemselves() throws IOException {
    ObjectNode approvalOnly = metricApprovalWorkflow();
    ArrayNode nodes = (ArrayNode) approvalOnly.get("nodes");
    ArrayNode withoutSetSteps = nodes.arrayNode();
    for (JsonNode node : nodes) {
      if (!"setEntityAttributeTask".equals(node.path("subType").asText())) {
        withoutSetSteps.add(node);
      }
    }
    approvalOnly.set("nodes", withoutSetSteps);

    assertTrue(EntityStatusWorkflows.writesStageInANode(workflow(metricApprovalWorkflow())));
    assertFalse(EntityStatusWorkflows.writesStageInANode(workflow(approvalOnly)));
  }

  private static WorkflowDefinition playbook(String name) throws IOException {
    return asPlaybook(workflow(metricApprovalWorkflow()).withName(name));
  }

  private static WorkflowDefinition asPlaybook(WorkflowDefinition workflow) {
    return workflow.withConfig(
        workflow
            .getConfig()
            .withLifecycle(
                new LifecycleConfiguration()
                    .withVersion(LifecycleConfiguration.Version._1)
                    .withEntityType(LifecycleConfiguration.EntityType.METRIC)
                    .withGates(List.of())));
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
