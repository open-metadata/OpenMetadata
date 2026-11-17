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
import java.util.function.Predicate;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.governance.workflows.LifecycleConfiguration;
import org.openmetadata.schema.governance.workflows.LifecycleTransition;
import org.openmetadata.schema.governance.workflows.LifecycleTransitionTrigger;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class EntityStatusWorkflowsTest {
  private static final Predicate<String> ANY_CONDITIONS = conditions -> true;
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

  @Test
  void theStagesAUserCanRequestAreTheOnRequestTransitionsLeavingTheCurrentStage()
      throws IOException {
    WorkflowDefinition playbook = branchingPlaybook();

    assertEquals(
        List.of("Deprecated", "Rejected"),
        EntityStatusWorkflows.onRequestTargets(playbook, "In Review", ANY_CONDITIONS));
    assertEquals(
        List.of("Deprecated", "Draft"),
        EntityStatusWorkflows.onRequestTargets(playbook, "Rejected", ANY_CONDITIONS));
    assertEquals(
        List.of("Deprecated"),
        EntityStatusWorkflows.onRequestTargets(playbook, "Draft", ANY_CONDITIONS));
    assertEquals(
        List.of(), EntityStatusWorkflows.onRequestTargets(playbook, "Deprecated", ANY_CONDITIONS));
  }

  @Test
  void anOnRequestTransitionWhoseConditionsTheAssetDoesNotMeetIsNotOffered() throws IOException {
    WorkflowDefinition playbook = playbook("MetricLifecycle");
    String described = "{\"!!\":[{\"var\":\"description\"}]}";
    playbook
        .getConfig()
        .getLifecycle()
        .withTransitions(
            List.of(
                onRequest(EntityStatus.APPROVED, EntityStatus.IN_REVIEW).withConditions(described),
                onRequest(EntityStatus.DEPRECATED)));

    assertEquals(
        List.of("Deprecated"),
        EntityStatusWorkflows.onRequestTargets(playbook, "In Review", conditions -> false));
    assertEquals(
        List.of("Approved", "Deprecated"),
        EntityStatusWorkflows.onRequestTargets(playbook, "In Review", ANY_CONDITIONS));
    assertTrue(EntityStatusWorkflows.offersOnRequest(playbook, "In Review", "Approved"));
  }

  @Test
  void anOnRequestTransitionIsFoundOnlyFromTheStagesItLeaves() throws IOException {
    WorkflowDefinition playbook = branchingPlaybook();

    assertTrue(
        EntityStatusWorkflows.onRequestTransition(playbook, "In Review", "Rejected").isPresent());
    assertTrue(
        EntityStatusWorkflows.onRequestTransition(playbook, "Approved", "Rejected").isEmpty());
    assertTrue(
        EntityStatusWorkflows.onRequestTransition(playbook, "Approved", "Archived").isEmpty());
  }

  @Test
  void onlyTheLifecyclesTransitionsCountAsTransitionsNotItsOnboardingPath() throws IOException {
    WorkflowDefinition playbook = branchingPlaybook();

    assertTrue(EntityStatusWorkflows.makesTransition(playbook, "In Review", "Rejected"));
    assertTrue(EntityStatusWorkflows.makesTransition(playbook, "Approved", "Archived"));
    assertFalse(EntityStatusWorkflows.makesTransition(playbook, "Draft", "In Review"));
    assertFalse(EntityStatusWorkflows.makesTransition(playbook, "Archived", "Archived"));
  }

  @Test
  void noTransitionMovesAnAssetToUnprocessed() throws IOException {
    WorkflowDefinition playbook = playbook("MetricLifecycle");
    playbook
        .getConfig()
        .getLifecycle()
        .withTransitions(List.of(onRequest(EntityStatus.UNPROCESSED)));

    assertEquals(
        List.of(), EntityStatusWorkflows.onRequestTargets(playbook, "Approved", ANY_CONDITIONS));
    assertFalse(EntityStatusWorkflows.makesTransition(playbook, "Approved", "Unprocessed"));
  }

  @Test
  void aWorkflowWithoutLifecycleTransitionsHasNoRequestableStages() throws IOException {
    assertEquals(
        List.of(),
        EntityStatusWorkflows.onRequestTargets(
            playbook("MetricLifecycle"), "Draft", ANY_CONDITIONS));
    assertEquals(
        List.of(),
        EntityStatusWorkflows.onRequestTargets(
            workflow(metricApprovalWorkflow()), "Draft", ANY_CONDITIONS));
  }

  // Any stage to Deprecated and In Review to Rejected on request, Rejected back to Draft on
  // request, and any stage to Archived automatically.
  private static WorkflowDefinition branchingPlaybook() throws IOException {
    WorkflowDefinition playbook = playbook("MetricLifecycle");
    playbook
        .getConfig()
        .getLifecycle()
        .withTransitions(
            List.of(
                onRequest(EntityStatus.DEPRECATED),
                onRequest(EntityStatus.REJECTED, EntityStatus.IN_REVIEW),
                onRequest(EntityStatus.DRAFT, EntityStatus.REJECTED),
                new LifecycleTransition()
                    .withTo(EntityStatus.ARCHIVED)
                    .withTrigger(LifecycleTransitionTrigger.AUTOMATIC)
                    .withConditions("{\"==\":[1,1]}")));
    return playbook;
  }

  private static LifecycleTransition onRequest(EntityStatus to, EntityStatus... from) {
    return new LifecycleTransition()
        .withFrom(Set.of(from))
        .withTo(to)
        .withTrigger(LifecycleTransitionTrigger.ON_REQUEST);
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
