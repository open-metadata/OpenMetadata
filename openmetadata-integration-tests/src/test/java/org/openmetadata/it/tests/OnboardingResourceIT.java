package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.governance.CreateIntakeForm;
import org.openmetadata.schema.api.governance.CreateIntakeForm.TargetEntityType;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.api.governance.TransitionOnboarding;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormField;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.onboarding.OnboardingAssignment;
import org.openmetadata.schema.governance.onboarding.OnboardingBackfill;
import org.openmetadata.schema.governance.onboarding.OnboardingCondition;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingProgress;
import org.openmetadata.schema.governance.onboarding.OnboardingRules;
import org.openmetadata.schema.governance.onboarding.OnboardingStage;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ConflictException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.onboarding.OnboardingService;
import org.openmetadata.service.jdbi3.EntityRepository;

@Isolated("Onboarding intake configurations apply to every asset of their type")
@ExtendWith(TestNamespaceExtension.class)
class OnboardingResourceIT {
  private static final String CONFIG_PATH = "/v1/governance/intakeForms";
  private static final String ONBOARDING_PATH = "/v1/governance/onboarding/";
  private final List<UUID> configurations = new ArrayList<>();
  private final List<UUID> workflows = new ArrayList<>();

  @AfterEach
  void removeConfigurations() throws Exception {
    for (UUID id : configurations) {
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.DELETE, CONFIG_PATH + "/" + id + "?hardDelete=true", null, Void.class);
    }
    for (UUID id : workflows)
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.DELETE,
              "/v1/governance/workflowDefinitions/" + id + "?hardDelete=true",
              null,
              Void.class);
  }

  @ParameterizedTest
  @ValueSource(strings = {"dataProduct", "domain", "glossaryTerm", "metric"})
  void versionCheckedSavesRespectFieldPermissions(String type, TestNamespace namespace)
      throws Exception {
    var consumer = delegatedConsumer();
    createConfiguration(type, namespace);
    var asset = createAsset(type, namespace);
    String path = "/v1/" + collection(type) + "/" + asset.getId();
    var options =
        RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();
    String patch =
        "[{\"op\":\"test\",\"path\":\"/version\",\"value\":"
            + asset.getVersion()
            + "},{\"op\":\"add\",\"path\":\"/description\",\"value\":\"Delegated description\"}]";
    String saved =
        consumer.getHttpClient().executeForString(HttpMethod.PATCH, path, patch, options);
    assertEquals("Delegated description", JsonUtils.readTree(saved).get("description").asText());
    String denied = "[{\"op\":\"add\",\"path\":\"/displayName\",\"value\":\"Unauthorized name\"}]";
    assertThrows(
        ForbiddenException.class,
        () -> consumer.getHttpClient().executeForString(HttpMethod.PATCH, path, denied, options));
    assertFalse(progress(type, asset.getId()).getCanAdvance());
  }

  @ParameterizedTest
  @ValueSource(strings = {"dataProduct", "domain", "glossaryTerm", "metric"})
  void everyApprovalRequiresItsWorkflowAndConcurrentRetriesReuseTasks(
      String type, TestNamespace namespace) throws Exception {
    var workflow = approvalWorkflow(namespace);
    var form = createConfiguration(type, namespace);
    var approvals =
        List.of(approvalStep("first-review", workflow), approvalStep("second-review", workflow));
    form.getOnboarding()
        .getGates()
        .add(new OnboardingGate().withStage(OnboardingStage.IN_REVIEW).withSteps(approvals));
    publish(form);
    var asset = createAsset(type, namespace);
    patch(type, asset.getId(), "displayName", "Ready for review");
    var draft = progress(type, asset.getId());
    transition(type, asset.getId(), draft.getEntityVersion(), EntityStatus.IN_REVIEW);
    var pending =
        await()
            .atMost(Duration.ofSeconds(30))
            .until(
                () -> progress(type, asset.getId()),
                value ->
                    value.getSteps().stream()
                        .filter(step -> step.getStep().getType() == OnboardingStep.Type.APPROVAL)
                        .allMatch(
                            step ->
                                step.getTaskId() != null && step.getWorkflowInstanceId() != null));
    UUID first = step(pending, "first-review").getTaskId();
    UUID second = step(pending, "second-review").getTaskId();
    assertNotEquals(first, second);
    var submissions =
        List.of(
            CompletableFuture.supplyAsync(() -> retry(type, asset.getId())),
            CompletableFuture.supplyAsync(() -> retry(type, asset.getId())));
    for (var submission : submissions) {
      assertEquals(first, step(submission.join(), "first-review").getTaskId());
      assertEquals(second, step(submission.join(), "second-review").getTaskId());
    }
    decide(first, true);
    assertFalse(progress(type, asset.getId()).getCompleted());
    assertThrows(
        InvalidRequestException.class,
        () -> patch(type, asset.getId(), "entityStatus", "Approved"));
    decide(second, false);
    assertEquals(
        OnboardingStepResult.State.REJECTED,
        step(progress(type, asset.getId()), "second-review").getState());
    var resubmission = retry(type, asset.getId());
    UUID replacement = step(resubmission, "second-review").getTaskId();
    assertNotEquals(second, replacement);
    assertEquals(first, step(resubmission, "first-review").getTaskId());
    decide(replacement, true);
    patch(
        type,
        asset.getId(),
        "metric".equals(type) ? "displayName" : "description",
        "Changed reviewed metadata");
    assertFalse(progress(type, asset.getId()).getCanAdvance());
    var revised = retry(type, asset.getId());
    UUID revisedFirst = step(revised, "first-review").getTaskId();
    assertNotEquals(first, revisedFirst);
    decide(revisedFirst, true);
    decide(step(revised, "second-review").getTaskId(), true);
    var ready = progress(type, asset.getId());
    assertTrue(ready.getCanAdvance());
    assertNotNull(step(ready, "first-review").getWorkflowInstanceId());
    assertTrue(
        transition(type, asset.getId(), ready.getEntityVersion(), EntityStatus.APPROVED)
            .getCompleted());
    patch(type, asset.getId(), "displayName", "Maintained after approval");
    var maintained = progress(type, asset.getId());
    assertEquals(OnboardingStepResult.State.COMPLETE, step(maintained, "first-review").getState());
    assertEquals(
        OnboardingStage.DEPRECATED,
        transition(type, asset.getId(), maintained.getEntityVersion(), EntityStatus.DEPRECATED)
            .getStage());
  }

  @Test
  void backfillNormalizesUnprocessedAndExcludesExistingReviews(TestNamespace namespace)
      throws Exception {
    var eligible = createAsset("metric", namespace);
    var reviewing = createAsset("metric", namespace);
    var approved = createAsset("metric", namespace);
    patch("metric", reviewing.getId(), "entityStatus", "In Review");
    patch("metric", approved.getId(), "entityStatus", "Approved");
    var existingTask =
        SdkClients.adminClient()
            .tasks()
            .create(
                new org.openmetadata.schema.api.tasks.CreateTask()
                    .withName(namespace.prefix("existing-review"))
                    .withType(org.openmetadata.schema.type.TaskEntityType.RequestApproval)
                    .withCategory(org.openmetadata.schema.type.TaskCategory.Approval)
                    .withAbout("<#E::metric::" + reviewing.getFullyQualifiedName() + ">")
                    .withAssignees(List.of("shared_user1")));
    var startedTask =
        await()
            .atMost(Duration.ofSeconds(30))
            .until(
                () -> SdkClients.adminClient().tasks().get(existingTask.getId().toString()),
                task -> task.getWorkflowInstanceId() != null);
    createConfiguration("metric", namespace);
    var enrolled = progress("metric", eligible.getId());
    assertEquals(OnboardingStage.DRAFT, enrolled.getStage());
    await()
        .atMost(Duration.ofSeconds(45))
        .untilAsserted(
            () ->
                assertEquals(
                    EntityStatus.DRAFT,
                    SdkClients.adminClient()
                        .metrics()
                        .get(eligible.getId().toString())
                        .getEntityStatus()));
    assertThrows(
        org.openmetadata.sdk.exceptions.ApiException.class,
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    ONBOARDING_PATH + "metric/" + reviewing.getId(),
                    null,
                    OnboardingProgress.class));
    assertEquals(
        EntityStatus.IN_REVIEW,
        SdkClients.adminClient().metrics().get(reviewing.getId().toString()).getEntityStatus());
    var backfill =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                ONBOARDING_PATH + "backfill/metric",
                null,
                OnboardingBackfill.class);
    assertNotNull(backfill.getConfigurationId());
    await()
        .atMost(Duration.ofSeconds(45))
        .until(
            () ->
                org.openmetadata.service.governance.onboarding.OnboardingBackfillService.get(
                        "metric")
                    .getComplete());
    assertTrue(
        org.openmetadata.service.governance.onboarding.OnboardingBackfillService.get("metric")
                .getScanned()
            > 0);
    assertEquals(
        EntityStatus.APPROVED,
        SdkClients.adminClient().metrics().get(approved.getId().toString()).getEntityStatus());
    assertEquals(
        null,
        org.openmetadata.service.governance.onboarding.OnboardingStore.find(approved.getId()));
    var preservedTask = SdkClients.adminClient().tasks().get(existingTask.getId().toString());
    assertEquals(startedTask.getWorkflowInstanceId(), preservedTask.getWorkflowInstanceId());
    assertEquals(startedTask.getStatus(), preservedTask.getStatus());
    var instance = progress("metric", eligible.getId());
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            ONBOARDING_PATH + "backfill/metric/retry",
            null,
            OnboardingBackfill.class);
    org.openmetadata.service.governance.onboarding.OnboardingBackfillService.runPage("metric");
    assertEquals(
        instance.getConfigurationVersion(),
        progress("metric", eligible.getId()).getConfigurationVersion());
    assertEquals(
        instance.getSteps().stream().map(OnboardingStepResult::getTaskId).toList(),
        progress("metric", eligible.getId()).getSteps().stream()
            .map(OnboardingStepResult::getTaskId)
            .toList());
  }

  @ParameterizedTest
  @ValueSource(strings = {"dataProduct", "domain", "glossaryTerm", "metric"})
  void creationRequirementsCannotBeBypassedOrMoved(String type, TestNamespace namespace)
      throws Exception {
    var form = createConfiguration(type, namespace);
    form.getOnboarding().getGates().getFirst().setStage(OnboardingStage.CREATION);
    form = publish(form);
    assertThrows(InvalidRequestException.class, () -> createAsset(type, namespace));
    form.getFormFields()
        .add(
            new IntakeFormField()
                .withFieldPath("name")
                .withFieldLabel("Name")
                .withFieldKind(IntakeFormField.FieldKind.NATIVE)
                .withRequired(true));
    form.getOnboarding()
        .getGates()
        .add(
            new OnboardingGate()
                .withStage(OnboardingStage.DRAFT)
                .withSteps(
                    List.of(
                        new OnboardingStep()
                            .withId("intrinsic-name")
                            .withType(OnboardingStep.Type.FIELD)
                            .withFieldPath("name"))));
    var invalid = form;
    assertThrows(InvalidRequestException.class, () -> publish(invalid));
  }

  @ParameterizedTest
  @ValueSource(strings = {"dataProduct", "domain", "glossaryTerm", "metric"})
  void conditionalRelationshipsAndDelegatedWorkBlockTheWholeGate(
      String type, TestNamespace namespace) throws Exception {
    var user1 = SdkClients.adminClient().users().getByName("shared_user1").getEntityReference();
    var user2 = SdkClients.adminClient().users().getByName("shared_user2").getEntityReference();
    var form = createConfiguration(type, namespace);
    var gate = form.getOnboarding().getGates().getFirst();
    gate.getSteps()
        .getFirst()
        .setAssignment(new OnboardingAssignment().withRole(OnboardingAssignment.Role.OWNERS));
    form.getFormFields()
        .add(
            new IntakeFormField()
                .withFieldPath("owners")
                .withFieldLabel("Owners")
                .withFieldKind(IntakeFormField.FieldKind.NATIVE)
                .withRequired(true));
    gate.getSteps()
        .add(
            new OnboardingStep()
                .withId("owners")
                .withType(OnboardingStep.Type.FIELD)
                .withFieldPath("owners")
                .withRules(new OnboardingRules().withMinItems(2))
                .withAssignment(
                    new OnboardingAssignment()
                        .withRole(OnboardingAssignment.Role.EXPLICIT)
                        .withAssignees(List.of(user2)))
                .withConditions(
                    List.of(
                        new OnboardingCondition()
                            .withFieldPath("displayName")
                            .withOperator(OnboardingCondition.Operator.EQUALS)
                            .withValue("Restricted"))));
    publish(form);
    var asset = createAsset(type, namespace);
    var initial = progress(type, asset.getId());
    assertEquals(OnboardingStepResult.State.BLOCKED, step(initial, "display-name").getState());
    assertEquals(OnboardingStepResult.State.NOT_APPLICABLE, step(initial, "owners").getState());
    patch(type, asset.getId(), "displayName", "Restricted");
    var required = retry(type, asset.getId());
    assertEquals(List.of("owners"), required.getBlockingSteps());
    var assignedTask =
        SdkClients.adminClient().tasks().get(step(required, "owners").getTaskId().toString());
    assertEquals(
        List.of(user2.getId()),
        assignedTask.getAssignees().stream().map(ref -> ref.getId()).toList());
    patch(type, asset.getId(), "owners", List.of(user1));
    assertFalse(progress(type, asset.getId()).getCanAdvance());
    assertThrows(
        InvalidRequestException.class,
        () -> patch(type, asset.getId(), "entityStatus", "In Review"));
    patch(type, asset.getId(), "owners", List.of(user1, user2));
    var ready = progress(type, asset.getId());
    assertTrue(ready.getCanAdvance());
    transition(type, asset.getId(), ready.getEntityVersion(), EntityStatus.IN_REVIEW);
    assertThrows(
        InvalidRequestException.class, () -> patch(type, asset.getId(), "owners", List.of(user1)));
  }

  @Test
  void suspendedAndDeletedWorkflowsRemainActionableBlockers(TestNamespace namespace)
      throws Exception {
    var workflow = approvalWorkflow(namespace);
    var form = createConfiguration("metric", namespace);
    form.getOnboarding()
        .getGates()
        .add(
            new OnboardingGate()
                .withStage(OnboardingStage.IN_REVIEW)
                .withSteps(List.of(approvalStep("review", workflow))));
    publish(form);
    var asset = createAsset("metric", namespace);
    patch("metric", asset.getId(), "displayName", "Ready for review");
    var pending = retry("metric", asset.getId());
    UUID task = step(pending, "review").getTaskId();
    var http = SdkClients.adminClient().getHttpClient();
    String workflowPath =
        "/v1/governance/workflowDefinitions/name/" + workflow.getFullyQualifiedName();
    http.execute(HttpMethod.PUT, workflowPath + "/suspend", Map.of(), Void.class);
    var suspended = retry("metric", asset.getId());
    assertEquals(OnboardingStepResult.State.FAILED, step(suspended, "review").getState());
    assertFalse(suspended.getCanAdvance());
    assertNotNull(step(suspended, "review").getMessage());
    http.execute(HttpMethod.PUT, workflowPath + "/resume", Map.of(), Void.class);
    assertEquals(task, step(retry("metric", asset.getId()), "review").getTaskId());
    http.execute(
        HttpMethod.DELETE,
        "/v1/governance/workflowDefinitions/" + workflow.getId() + "?hardDelete=true",
        null,
        Void.class);
    workflows.remove(workflow.getId());
    var deleted = retry("metric", asset.getId());
    assertEquals(OnboardingStepResult.State.FAILED, step(deleted, "review").getState());
    assertFalse(deleted.getCanAdvance());
  }

  @Test
  void customPropertiesUsePersistedValuesAndAcceptLegacyPaths(TestNamespace namespace)
      throws Exception {
    var http = SdkClients.adminClient().getHttpClient();
    var metricType =
        http.execute(
            HttpMethod.GET,
            "/v1/metadata/types/name/metric",
            null,
            org.openmetadata.schema.entity.Type.class);
    var stringType =
        http.execute(
            HttpMethod.GET,
            "/v1/metadata/types/name/string",
            null,
            org.openmetadata.schema.entity.Type.class);
    String property = "onboard" + UUID.randomUUID().toString().replace("-", "");
    http.execute(
        HttpMethod.PUT,
        "/v1/metadata/types/" + metricType.getId(),
        new org.openmetadata.schema.entity.type.CustomProperty()
            .withName(property)
            .withDescription("Onboarding integration test")
            .withPropertyType(stringType.getEntityReference()),
        org.openmetadata.schema.entity.Type.class);
    var form = createConfiguration("metric", namespace);
    form.getFormFields()
        .add(
            new IntakeFormField()
                .withFieldPath(property)
                .withFieldLabel("Justification")
                .withFieldKind(IntakeFormField.FieldKind.CUSTOM_PROPERTY)
                .withRequired(true));
    form.getOnboarding()
        .getGates()
        .getFirst()
        .getSteps()
        .add(
            new OnboardingStep()
                .withId("justification")
                .withType(OnboardingStep.Type.FIELD)
                .withFieldPath(property)
                .withRules(new OnboardingRules().withMinLength(10)));
    var published = publish(form);
    assertTrue(
        published.getFormFields().stream()
            .anyMatch(field -> ("extension." + property).equals(field.getFieldPath())));
    var asset = createAsset("metric", namespace);
    patch("metric", asset.getId(), "displayName", "Complete name");
    patch("metric", asset.getId(), "extension", Map.of(property, "short"));
    assertFalse(progress("metric", asset.getId()).getCanAdvance());
    patch(
        "metric", asset.getId(), "extension", Map.of(property, "Reviewed business justification"));
    var ready = progress("metric", asset.getId());
    assertTrue(ready.getCanAdvance());
    transition("metric", asset.getId(), ready.getEntityVersion(), EntityStatus.IN_REVIEW);
    assertThrows(
        InvalidRequestException.class, () -> patch("metric", asset.getId(), "extension", Map.of()));
  }

  @Test
  void unassignedWorkflowCannotApproveAndFailedExecutionCanBeResubmitted(TestNamespace namespace)
      throws Exception {
    var workflow = approvalWorkflow(namespace, 1, List.of());
    var form = createConfiguration("metric", namespace);
    form.getOnboarding()
        .getGates()
        .add(
            new OnboardingGate()
                .withStage(OnboardingStage.IN_REVIEW)
                .withSteps(List.of(approvalStep("review", workflow))));
    publish(form);
    var asset = createAsset("metric", namespace);
    patch("metric", asset.getId(), "displayName", "Ready for review");
    retry("metric", asset.getId());
    var started =
        await()
            .atMost(Duration.ofSeconds(30))
            .until(
                () -> progress("metric", asset.getId()),
                value -> step(value, "review").getWorkflowInstanceId() != null);
    var review = step(started, "review");
    assertEquals(OnboardingStepResult.State.BLOCKED, review.getState());
    assertTrue(review.getAssignees().isEmpty());
    assertFalse(started.getCanAdvance());
    assertThrows(
        InvalidRequestException.class,
        () -> patch("metric", asset.getId(), "entityStatus", "Approved"));
    assertEquals(review.getTaskId(), step(retry("metric", asset.getId()), "review").getTaskId());
    org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
        .terminateWorkflowInstance(
            review.getWorkflowInstanceId(),
            workflow.getFullyQualifiedName(),
            "Integration test workflow failure");
    assertEquals(
        OnboardingStepResult.State.FAILED,
        step(progress("metric", asset.getId()), "review").getState());
    var replacement = step(retry("metric", asset.getId()), "review");
    assertNotEquals(review.getTaskId(), replacement.getTaskId());
    assertFalse(progress("metric", asset.getId()).getCanAdvance());
  }

  @Test
  void configurationCannotShadowImplicitCreationChecksOrDuplicateRequirements(
      TestNamespace namespace) throws Exception {
    var form = createConfiguration("metric", namespace);
    form.getOnboarding().getGates().getFirst().getSteps().getFirst().setId("creation_name");
    assertThrows(InvalidRequestException.class, () -> publish(form));
    form.getOnboarding().getGates().getFirst().getSteps().getFirst().setId("display-name");
    form.getFormFields()
        .add(JsonUtils.deepCopy(form.getFormFields().getFirst(), IntakeFormField.class));
    assertThrows(InvalidRequestException.class, () -> publish(form));
  }

  private OnboardingStep approvalStep(String id, WorkflowDefinition workflow) {
    return new OnboardingStep()
        .withId(id)
        .withTitle(id)
        .withType(OnboardingStep.Type.APPROVAL)
        .withWorkflow(workflow.getEntityReference());
  }

  @Test
  void approvalThresholdRequiresDistinctWorkflowDecisions(TestNamespace namespace)
      throws Exception {
    var workflow = approvalWorkflow(namespace, 2);
    var form = createConfiguration("metric", namespace);
    form.getOnboarding()
        .getGates()
        .add(
            new OnboardingGate()
                .withStage(OnboardingStage.IN_REVIEW)
                .withSteps(List.of(approvalStep("review", workflow))));
    publish(form);
    var asset = createAsset("metric", namespace);
    patch("metric", asset.getId(), "displayName", "Threshold review");
    var draft = progress("metric", asset.getId());
    var reviewing =
        transition("metric", asset.getId(), draft.getEntityVersion(), EntityStatus.IN_REVIEW);
    UUID task = step(reviewing, "review").getTaskId();
    decide(task, true);
    assertFalse(progress("metric", asset.getId()).getCanAdvance());
    SdkClients.user2Client()
        .tasks()
        .resolve(
            task.toString(),
            new ResolveTask()
                .withTransitionId("approve")
                .withResolutionType(TaskResolutionType.Approved)
                .withComment("Second independent decision"));
    assertTrue(progress("metric", asset.getId()).getCanAdvance());
  }

  private WorkflowDefinition approvalWorkflow(TestNamespace namespace) throws Exception {
    return approvalWorkflow(namespace, 1);
  }

  private WorkflowDefinition approvalWorkflow(TestNamespace namespace, int threshold)
      throws Exception {
    return approvalWorkflow(
        namespace,
        threshold,
        List.of(
            SdkClients.adminClient().users().getByName("shared_user1").getEntityReference(),
            SdkClients.adminClient().users().getByName("shared_user2").getEntityReference()));
  }

  private WorkflowDefinition approvalWorkflow(
      TestNamespace namespace,
      int threshold,
      List<org.openmetadata.schema.type.EntityReference> assignees)
      throws Exception {
    var http = SdkClients.adminClient().getHttpClient();
    var seed =
        http.execute(
            HttpMethod.GET,
            "/v1/governance/workflowDefinitions/name/RequestApprovalTaskWorkflow",
            null,
            WorkflowDefinition.class);
    ObjectNode json = (ObjectNode) JsonUtils.valueToTree(seed);
    for (var node : json.withArray("nodes")) {
      if (!"userApprovalTask".equals(node.path("subType").asText())) continue;
      var config = (ObjectNode) node.path("config");
      config.put("assigneeStrategy", "reviewers-and-assignees");
      config.put("approvalThreshold", threshold);
      config.set(
          "assignees",
          JsonUtils.valueToTree(
              Map.of("addReviewers", false, "addOwners", false, "candidates", assignees)));
    }
    var template = JsonUtils.convertValue(json, WorkflowDefinition.class);
    var request =
        new CreateWorkflowDefinition()
            .withName("onboard_" + UUID.randomUUID())
            .withDescription("Onboarding approval integration test")
            .withTrigger(template.getTrigger())
            .withNodes(template.getNodes())
            .withEdges(template.getEdges());
    var workflow =
        http.execute(
            HttpMethod.POST,
            "/v1/governance/workflowDefinitions",
            request,
            WorkflowDefinition.class);
    workflows.add(workflow.getId());
    return workflow;
  }

  private IntakeForm publish(IntakeForm form) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            CONFIG_PATH,
            new CreateIntakeForm()
                .withName(form.getName())
                .withEntityType(TargetEntityType.fromValue(form.getEntityType().value()))
                .withEnabled(form.getEnabled())
                .withFormFields(form.getFormFields())
                .withOnboarding(form.getOnboarding()),
            IntakeForm.class);
  }

  private OnboardingStepResult step(OnboardingProgress progress, String id) {
    return progress.getSteps().stream()
        .filter(item -> id.equals(item.getStep().getId()))
        .findFirst()
        .orElseThrow();
  }

  private OnboardingProgress retry(String type, UUID id) {
    try {
      var progress = progress(type, id);
      return SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.POST,
              ONBOARDING_PATH + type + "/" + id + "/transition",
              new TransitionOnboarding()
                  .withExpectedVersion(progress.getEntityVersion())
                  .withTargetStatus(progress.getNextStatus())
                  .withRetry(true),
              OnboardingProgress.class);
    } catch (Exception exception) {
      throw new RuntimeException(exception);
    }
  }

  private Task decide(UUID taskId, boolean approved) {
    return SdkClients.user1Client()
        .tasks()
        .resolve(
            taskId.toString(),
            new ResolveTask()
                .withTransitionId(approved ? "approve" : "reject")
                .withResolutionType(
                    approved ? TaskResolutionType.Approved : TaskResolutionType.Rejected)
                .withComment("Reviewed onboarding metadata"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"dataProduct", "domain", "glossaryTerm", "metric"})
  void incrementalWritesAndDirectTransitionsUseTheSameGate(String type, TestNamespace namespace)
      throws Exception {
    createConfiguration(type, namespace);
    EntityInterface asset = createAsset(type, namespace);
    assertEquals(EntityStatus.DRAFT, asset.getEntityStatus());
    OnboardingProgress initial = progress(type, asset.getId());
    assertTrue(initial.getBlockingSteps().contains("display-name"));
    patch(type, asset.getId(), "displayName", "x");
    assertFalse(progress(type, asset.getId()).getCanAdvance());
    assertThrows(
        InvalidRequestException.class,
        () -> patch(type, asset.getId(), "entityStatus", "In Review"));
    assertThrows(
        InvalidRequestException.class,
        () -> patch(type, asset.getId(), "entityStatus", "Approved"));
    patch(type, asset.getId(), "displayName", "Complete metadata");
    OnboardingProgress ready = progress(type, asset.getId());
    assertTrue(ready.getCanAdvance());
    var snapshot =
        org.openmetadata.service.governance.onboarding.OnboardingService.entity(
            type, asset.getId());
    var review = transition(type, asset.getId(), ready.getEntityVersion(), EntityStatus.IN_REVIEW);
    org.openmetadata.service.governance.onboarding.OnboardingService.synchronize(
        snapshot, type, false);
    assertEquals(
        OnboardingStage.IN_REVIEW,
        org.openmetadata.service.governance.onboarding.OnboardingStore.find(asset.getId())
            .getStage());
    assertEquals(OnboardingStage.IN_REVIEW, review.getStage());
    assertThrows(
        InvalidRequestException.class, () -> patch(type, asset.getId(), "displayName", ""));
    var approved =
        transition(type, asset.getId(), review.getEntityVersion(), EntityStatus.APPROVED);
    assertTrue(approved.getCompleted());
    assertTrue(progress(type, asset.getId()).getCompleted());
  }

  @Test
  void configurationVersionsRemainPinnedAndLegacyUpdatesPreserveGates(TestNamespace namespace)
      throws Exception {
    IntakeForm form = createConfiguration("metric", namespace);
    EntityInterface first = createAsset("metric", namespace);
    var pinned = progress("metric", first.getId());
    var legacy =
        new CreateIntakeForm()
            .withName(form.getName())
            .withEntityType(TargetEntityType.METRIC)
            .withEnabled(true)
            .withFormFields(
                List.of(
                    new IntakeFormField()
                        .withFieldPath("displayName")
                        .withFieldLabel("Name")
                        .withFieldKind(IntakeFormField.FieldKind.NATIVE)
                        .withRequired(false)));
    var updated =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.PUT, CONFIG_PATH, legacy, IntakeForm.class);
    assertNotNull(updated.getOnboarding());
    assertEquals(
        pinned.getConfigurationVersion(),
        progress("metric", first.getId()).getConfigurationVersion());
    EntityInterface second = createAsset("metric", namespace);
    assertEquals(
        updated.getVersion(), progress("metric", second.getId()).getConfigurationVersion());
    assertNotEquals(
        pinned.getConfigurationVersion(),
        progress("metric", second.getId()).getConfigurationVersion());
    assertThrows(
        ConflictException.class,
        () -> transition("metric", first.getId(), -1.0, EntityStatus.IN_REVIEW));
  }

  @Test
  void metricLegacyIntakeStillEnforcesCreation(TestNamespace namespace) throws Exception {
    var request =
        new CreateIntakeForm()
            .withName(namespace.prefix("legacy"))
            .withEntityType(TargetEntityType.METRIC)
            .withFormFields(
                List.of(
                    new IntakeFormField()
                        .withFieldPath("displayName")
                        .withFieldLabel("Display name")
                        .withFieldKind(IntakeFormField.FieldKind.NATIVE)
                        .withRequired(true)))
            .withEnabled(true);
    var form =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.POST, CONFIG_PATH, request, IntakeForm.class);
    configurations.add(form.getId());
    assertThrows(
        InvalidRequestException.class,
        () ->
            SdkClients.adminClient()
                .metrics()
                .create(new CreateMetric().withName(namespace.prefix("missing"))));
    assertNotNull(
        SdkClients.adminClient()
            .metrics()
            .create(
                new CreateMetric()
                    .withName(namespace.prefix("complete"))
                    .withDisplayName("Ready")));
  }

  @ParameterizedTest
  @ValueSource(strings = {"dataProduct", "domain", "glossaryTerm", "metric"})
  void putUsesPinnedRequirementsAndBulkImportsCannotBypassGates(
      String type, TestNamespace namespace) throws Exception {
    var form = createConfiguration(type, namespace);
    var asset = createAsset(type, namespace);
    form.getOnboarding().getGates().getFirst().setStage(OnboardingStage.CREATION);
    publish(form);

    putAsset(type, asset);
    assertEquals(
        EntityStatus.DRAFT, OnboardingService.entity(type, asset.getId()).getEntityStatus());
    assertEquals(form.getVersion(), progress(type, asset.getId()).getConfigurationVersion());
    patch(type, asset.getId(), "displayName", "Complete metadata");
    var ready = progress(type, asset.getId());
    transition(type, asset.getId(), ready.getEntityVersion(), EntityStatus.IN_REVIEW);
    putAsset(type, OnboardingService.entity(type, asset.getId()));
    assertEquals(
        EntityStatus.IN_REVIEW, OnboardingService.entity(type, asset.getId()).getEntityStatus());
    assertImportsCannotBypassGates(Entity.getEntityRepository(type), type, asset.getId());
  }

  private <T extends EntityInterface> void assertImportsCannotBypassGates(
      EntityRepository<T> repository, String type, UUID id) {
    T original = repository.getEntityClass().cast(OnboardingService.entity(type, id));
    T invalid = JsonUtils.deepCopy(original, repository.getEntityClass());
    invalid.setDisplayName("");
    assertThrows(
        IllegalArgumentException.class,
        () -> repository.updateManyEntitiesForImport(List.of(original), List.of(invalid), "admin"));
    assertEquals("Complete metadata", OnboardingService.entity(type, id).getDisplayName());
    invalid.setId(UUID.randomUUID());
    invalid.setName("invalid-import-" + UUID.randomUUID());
    assertThrows(
        IllegalArgumentException.class,
        () -> repository.createManyEntitiesForImport(List.of(invalid)));
  }

  private void putAsset(String type, EntityInterface asset) throws Exception {
    var values = JsonUtils.valueToTree(asset);
    Map<String, Object> request = new HashMap<>();
    for (String path : List.of("name", "description", "displayName", "domainType")) {
      if (values.hasNonNull(path)) request.put(path, values.get(path));
    }
    if (type.equals("dataProduct"))
      request.put(
          "domains",
          asset.getDomains().stream().map(domain -> domain.getFullyQualifiedName()).toList());
    if (type.equals("glossaryTerm"))
      request.put("glossary", values.path("glossary").path("fullyQualifiedName").asText());
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(HttpMethod.PUT, "/v1/" + collection(type), request);
  }

  private IntakeForm createConfiguration(String type, TestNamespace namespace) throws Exception {
    var step =
        new OnboardingStep()
            .withId("display-name")
            .withTitle("Display name")
            .withType(OnboardingStep.Type.FIELD)
            .withFieldPath("displayName")
            .withRules(new OnboardingRules().withMinLength(5));
    var request =
        new CreateIntakeForm()
            .withName(namespace.prefix("onboarding"))
            .withEntityType(TargetEntityType.fromValue(type))
            .withEnabled(true)
            .withFormFields(
                List.of(
                    new IntakeFormField()
                        .withFieldPath("displayName")
                        .withFieldLabel("Display name")
                        .withFieldKind(IntakeFormField.FieldKind.NATIVE)
                        .withRequired(true)))
            .withOnboarding(
                new OnboardingConfiguration()
                    .withEnabled(true)
                    .withGates(
                        List.of(
                            new OnboardingGate()
                                .withStage(OnboardingStage.DRAFT)
                                .withSteps(List.of(step)))));
    var form =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.POST, CONFIG_PATH, request, IntakeForm.class);
    configurations.add(form.getId());
    return form;
  }

  private OpenMetadataClient delegatedConsumer() {
    String name = "onboarding-consumer-" + UUID.randomUUID();
    String email = name + "@test.openmetadata.org";
    var admin = SdkClients.adminClient();
    admin
        .users()
        .create(
            new CreateUser()
                .withName(name)
                .withEmail(email)
                .withIsAdmin(false)
                .withRoles(List.of(admin.roles().getByName("DataConsumer").getId())));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private EntityInterface createAsset(String type, TestNamespace namespace) {
    var client = SdkClients.adminClient();
    String name = namespace.prefix("asset-" + UUID.randomUUID());
    return switch (type) {
      case "metric" -> client.metrics().create(new CreateMetric().withName(name));
      case "domain" -> client
          .domains()
          .create(
              new CreateDomain()
                  .withName(name)
                  .withDescription("Description")
                  .withDomainType(CreateDomain.DomainType.AGGREGATE));
      case "glossaryTerm" -> {
        var glossary =
            client
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(namespace.prefix("glossary"))
                        .withDescription("Description"));
        yield client
            .glossaryTerms()
            .create(
                new CreateGlossaryTerm()
                    .withName(name)
                    .withDescription("Description")
                    .withGlossary(glossary.getFullyQualifiedName()));
      }
      case "dataProduct" -> {
        var domain =
            client
                .domains()
                .create(
                    new CreateDomain()
                        .withName(namespace.prefix("domain"))
                        .withDescription("Description")
                        .withDomainType(CreateDomain.DomainType.AGGREGATE));
        yield client
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(name)
                    .withDescription("Description")
                    .withDomains(List.of(domain.getFullyQualifiedName())));
      }
      default -> throw new IllegalArgumentException(type);
    };
  }

  private OnboardingProgress progress(String type, UUID id) {
    return await()
        .atMost(Duration.ofSeconds(30))
        .ignoreExceptions()
        .until(
            () ->
                SdkClients.adminClient()
                    .getHttpClient()
                    .execute(
                        HttpMethod.GET,
                        ONBOARDING_PATH + type + "/" + id,
                        null,
                        OnboardingProgress.class),
            value -> value != null);
  }

  private OnboardingProgress transition(String type, UUID id, Double version, EntityStatus status)
      throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            ONBOARDING_PATH + type + "/" + id + "/transition",
            new TransitionOnboarding().withExpectedVersion(version).withTargetStatus(status),
            OnboardingProgress.class);
  }

  private void patch(String type, UUID id, String field, Object value) throws Exception {
    String json =
        "[{\"op\":\"add\",\"path\":\"/"
            + field
            + "\",\"value\":"
            + JsonUtils.pojoToJson(value)
            + "}]";
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/" + collection(type) + "/" + id,
            json,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  private String collection(String type) {
    return switch (type) {
      case "dataProduct" -> "dataProducts";
      case "glossaryTerm" -> "glossaryTerms";
      case "metric" -> "metrics";
      default -> "domains";
    };
  }
}
