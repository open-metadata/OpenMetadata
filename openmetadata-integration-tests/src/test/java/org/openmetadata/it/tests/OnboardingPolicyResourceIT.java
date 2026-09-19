package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.governance.CreateOnboardingPlaybook;
import org.openmetadata.schema.api.governance.NudgeOnboarding;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.entity.governance.PlaybookEntityType;
import org.openmetadata.schema.governance.onboarding.OnboardingAssignment;
import org.openmetadata.schema.governance.onboarding.OnboardingBoard;
import org.openmetadata.schema.governance.onboarding.OnboardingCheckType;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingProgress;
import org.openmetadata.schema.governance.onboarding.OnboardingReassignPolicy;
import org.openmetadata.schema.governance.onboarding.OnboardingReminderKind;
import org.openmetadata.schema.governance.onboarding.OnboardingRules;
import org.openmetadata.schema.governance.onboarding.OnboardingStallPolicy;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult;
import org.openmetadata.schema.governance.onboarding.OnboardingSummary;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.RateLimitException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.onboarding.OnboardingStalls;
import org.openmetadata.service.governance.onboarding.OnboardingStore;
import org.openmetadata.service.governance.onboarding.OnboardingSummaryService;

/**
 * The parts of a playbook that decide what happens around a gate rather than at it: when a gate
 * refuses to block, when onboarding chases somebody, and what the board reports afterwards.
 */
@Isolated("One onboarding playbook per asset type is a storage invariant")
@ExtendWith(TestNamespaceExtension.class)
class OnboardingPolicyResourceIT {
  private static final String CONFIG_PATH = "/v1/governance/onboardingPlaybooks";
  private static final String ONBOARDING_PATH = "/v1/governance/onboarding/";
  private static final String STATUS_SETTING_WORKFLOW = "GlossaryTermApprovalWorkflow";
  private static final String NO_STATUS_WORKFLOW = "RequestApprovalTaskWorkflow";
  private static final long DAY = TimeUnit.DAYS.toMillis(1);

  private final List<UUID> playbooks = new ArrayList<>();
  private final List<String> instances = new ArrayList<>();
  private final List<String> seeded = new ArrayList<>();

  @AfterEach
  void removeFixtures() throws Exception {
    for (UUID id : playbooks) {
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.DELETE, CONFIG_PATH + "/" + id + "?hardDelete=true", null, Void.class);
    }
    Entity.getCollectionDAO()
        .useTransaction(
            dao -> {
              for (String id : instances) {
                dao.onboardingDAO().deleteStageHistory(id);
                dao.onboardingDAO().deleteReminders(id);
              }
              seeded.forEach(entityId -> dao.onboardingDAO().delete(entityId));
            });
  }

  @Test
  void enrolmentRecordsTheAssetsOwnCreationTime(TestNamespace namespace) throws Exception {
    publish(playbook(namespace, draftGate()));
    Metric asset = createMetric(namespace);

    OnboardingProgress progress = progress(asset.getId());

    assertEquals(
        asset.getUpdatedAt(),
        progress.getCreatedAt(),
        "The onboarding clock starts when the asset was first written, not when it was enrolled");
    assertEquals(progress.getCreatedAt(), progress.getEnteredAt());
  }

  /**
   * A gate whose handoff never sets a status would pass and then leave every asset behind it, which
   * is only discoverable by waiting. The publish call is where that has to be caught.
   */
  @Test
  void handoffWorkflowsAreCheckedBeforeTheyCanStrandAssets(TestNamespace namespace)
      throws Exception {
    OnboardingPlaybook unknown = playbook(namespace, draftGate());
    unknown
        .getOnboarding()
        .getGates()
        .getFirst()
        .setHandoffWorkflow(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.WORKFLOW_DEFINITION)
                .withName("NoSuchWorkflow"));
    assertThrows(InvalidRequestException.class, () -> publish(unknown));

    OnboardingPlaybook decisionOnly = playbook(namespace, draftGate());
    decisionOnly
        .getOnboarding()
        .getGates()
        .getFirst()
        .setHandoffWorkflow(workflowReference(NO_STATUS_WORKFLOW));
    assertThrows(InvalidRequestException.class, () -> publish(decisionOnly));

    OnboardingPlaybook terminal = playbook(namespace, draftGate());
    terminal.getOnboarding().getGates().getFirst().setStage("deprecated");
    terminal
        .getOnboarding()
        .getGates()
        .getFirst()
        .setHandoffWorkflow(workflowReference(STATUS_SETTING_WORKFLOW));
    assertThrows(InvalidRequestException.class, () -> publish(terminal));

    OnboardingPlaybook valid = playbook(namespace, draftGate());
    valid
        .getOnboarding()
        .getGates()
        .getFirst()
        .setHandoffWorkflow(
            new EntityReference()
                .withType(Entity.WORKFLOW_DEFINITION)
                .withId(workflowReference(STATUS_SETTING_WORKFLOW).getId()));

    var published = publish(valid);

    assertEquals(
        STATUS_SETTING_WORKFLOW,
        published.getOnboarding().getGates().getFirst().getHandoffWorkflow().getName(),
        "The handoff is started by name, so publish must complete the reference");
  }

  @Test
  void aNonBlockingGateReleasesTheAssetAndWarnsInstead(TestNamespace namespace) throws Exception {
    OnboardingPlaybook soft = playbook(namespace, draftGate().withBlockTransition(false));
    publish(soft);
    Metric asset = createMetric(namespace);

    OnboardingProgress open = progress(asset.getId());
    assertFalse(open.getCanAdvance(), "The check is still outstanding");
    assertFalse(open.getGateBlocking());
    assertEquals(List.of("Display name"), open.getWarnings());

    transition(asset.getId(), open.getEntityVersion());
    patchStatus(asset.getId(), "In Review");

    assertEquals("inReview", progress(asset.getId()).getStage());
    // A gate that let the asset past must not re-impose itself on every later write.
    patch(asset.getId(), "description", "Edited after a soft gate released it");
  }

  @Test
  void aBlockingGateStillRefusesTheSameTransition(TestNamespace namespace) throws Exception {
    publish(playbook(namespace, draftGate()));
    Metric asset = createMetric(namespace);

    OnboardingProgress open = progress(asset.getId());

    assertTrue(open.getGateBlocking());
    assertTrue(open.getWarnings().isEmpty());
    assertThrows(InvalidRequestException.class, () -> patchStatus(asset.getId(), "In Review"));
  }

  @Test
  void openWorkCarriesTheGatesDueDateAndCanBeChasedOncePerDay(TestNamespace namespace)
      throws Exception {
    OnboardingPlaybook chasing =
        playbook(
            namespace,
            draftGate()
                .withNotifyOnStall(new OnboardingStallPolicy().withEnabled(true).withAfterDays(5)));
    chasing.setOwners(
        List.of(SdkClients.adminClient().users().getByName("shared_user1").getEntityReference()));
    publish(chasing);
    Metric asset = createMetric(namespace);
    OnboardingStepResult step = awaitTask(asset.getId());

    var task = SdkClients.adminClient().tasks().get(step.getTaskId().toString());
    assertNotNull(task.getDueDate(), "A gate that chases people gives the work a due date");
    assertTrue(task.getDueDate() > System.currentTimeMillis() + 4 * DAY);

    OnboardingProgress nudged = nudge(SdkClients.adminClient(), asset.getId());
    assertNotNull(
        nudged.getSteps().stream()
            .filter(result -> "display-name".equals(result.getStep().getId()))
            .findFirst()
            .orElseThrow()
            .getLastReminderAt());
    // One reminder per check per day keeps the notification meaningful.
    var limited =
        assertThrows(
            RateLimitException.class, () -> nudge(SdkClients.adminClient(), asset.getId()));
    assertTrue(
        limited.getRetryAfterSeconds() > 0, "A caller told to wait must be told how long for");
    assertThrows(ForbiddenException.class, () -> nudge(consumer(), asset.getId()));
  }

  @Test
  void theBoardHydratesAKnownSetOfAssetsInOneRequest(TestNamespace namespace) throws Exception {
    publish(playbook(namespace, draftGate()));
    Metric first = createMetric(namespace);
    Metric second = createMetric(namespace);
    Metric absent = createMetric(namespace);
    progress(first.getId());
    progress(second.getId());

    OnboardingBoard board =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/governance/onboarding?entityType=metric&entityId="
                    + first.getId()
                    + "&entityId="
                    + second.getId(),
                null,
                OnboardingBoard.class);

    assertEquals(
        Set.of(first.getId(), second.getId()),
        board.getData().stream().map(row -> row.getEntity().getId()).collect(Collectors.toSet()),
        "A list page asks for exactly the rows it is showing");
    assertFalse(
        board.getData().stream().anyMatch(row -> absent.getId().equals(row.getEntity().getId())));
    assertNull(board.getAfter());
  }

  /**
   * Seeded with controlled timestamps and read at a fixed instant, so the numbers are exact rather
   * than "roughly what the suite happened to produce".
   */
  @Test
  void theSummaryMeasuresStageTimingsAndFollowUps() {
    long now = 1_600_000_000_000L;
    seedCohort(now - 20 * DAY, now - 18 * DAY);
    seedCohort(now - 20 * DAY, now - 16 * DAY);
    seedCohort(now - 20 * DAY, now - 14 * DAY);
    seedCohort(now - 20 * DAY, null);
    seedCohort(now - 50 * DAY, now - 49 * DAY);
    seedCohort(now - 50 * DAY, now - 40 * DAY);
    seedReminder(OnboardingReminderKind.MANUAL, now - DAY);
    seedReminder(OnboardingReminderKind.MANUAL, now - DAY);
    seedReminder(OnboardingReminderKind.MANUAL, now - 8 * DAY);
    seedReminder(OnboardingReminderKind.STALL_NOTICE, now - 2 * DAY);
    seedReminder(OnboardingReminderKind.STALL_REASSIGNMENT, now - 3 * DAY);

    OnboardingSummary summary = OnboardingSummaryService.compute(Entity.METRIC, now);

    assertEquals("draft", summary.getReachedReviewInTime().getStage());
    assertEquals(75.0, summary.getReachedReviewInTime().getShare());
    assertEquals(50.0, summary.getReachedReviewInTime().getPreviousShare());
    assertEquals(25.0, summary.getReachedReviewInTime().getDeltaPoints());
    assertEquals(4, summary.getReachedReviewInTime().getCohortSize());
    assertEquals(2, summary.getReachedReviewInTime().getPreviousCohortSize());
    assertEquals(4.0, summary.getDaysInEntryStage().getMedianDays());
    assertEquals(5.5, summary.getDaysInEntryStage().getPreviousMedianDays());
    assertEquals(1.5, summary.getDaysInEntryStage().getDeltaDays());
    assertEquals(3, summary.getDaysInEntryStage().getSampleSize());
    assertEquals(2, summary.getDaysInEntryStage().getPreviousSampleSize());
    assertEquals(2, summary.getFollowUps().getManual());
    assertEquals(1, summary.getFollowUps().getPreviousManual());
    assertEquals(1, summary.getFollowUps().getStallNotices());
    assertEquals(1, summary.getFollowUps().getReassignments());
  }

  @Test
  void theSummaryEndpointReportsTheConfiguredLifecycle() throws Exception {
    OnboardingSummary summary =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/governance/onboarding/summary?entityType=metric",
                null,
                OnboardingSummary.class);

    assertEquals(Entity.METRIC, summary.getEntityType());
    assertEquals("draft", summary.getReachedReviewInTime().getStage());
    assertEquals(7, summary.getReachedReviewInTime().getThresholdDays());
    assertEquals(7, summary.getFollowUps().getWindowDays());
  }

  @Test
  void stalledWorkIsReportedOnceAndHandedToAnotherRoleOnce(TestNamespace namespace)
      throws Exception {
    var steward = SdkClients.adminClient().users().getByName("shared_user2").getEntityReference();
    OnboardingPlaybook playbook =
        playbook(
            namespace,
            draftGate()
                .withNotifyOnStall(new OnboardingStallPolicy().withEnabled(true).withAfterDays(5))
                .withReassignOnStall(
                    new OnboardingReassignPolicy()
                        .withEnabled(true)
                        .withAfterDays(10)
                        .withRole(
                            new OnboardingAssignment()
                                .withRole(OnboardingAssignment.Role.EXPLICIT)
                                .withAssignees(List.of(steward)))));
    playbook.setOwners(
        List.of(SdkClients.adminClient().users().getByName("shared_user1").getEntityReference()));
    publish(playbook);
    Metric asset = createMetric(namespace);
    OnboardingStepResult step = awaitTask(asset.getId());
    instances.add(OnboardingStore.find(asset.getId()).getId().toString());

    long firstPass = System.currentTimeMillis() + 11 * DAY;
    OnboardingStalls.runPass(firstPass);
    OnboardingStalls.runPass(firstPass + DAY);

    var reminders =
        OnboardingStore.find(asset.getId()).getReminders().stream()
            .filter(reminder -> "display-name".equals(reminder.getStepId()))
            .toList();
    assertEquals(
        List.of(firstPass, firstPass),
        reminders.stream().map(reminder -> reminder.getSentAt()).toList(),
        "A repeated pass must not chase the same task again");
    assertEquals(
        List.of(OnboardingReminderKind.STALL_NOTICE, OnboardingReminderKind.STALL_REASSIGNMENT),
        reminders.stream().map(reminder -> reminder.getKind()).sorted().toList());
    var reassigned = SdkClients.adminClient().tasks().get(step.getTaskId().toString());
    assertEquals(
        List.of(steward.getId()),
        reassigned.getAssignees().stream().map(EntityReference::getId).toList());
  }

  /** A retired asset's onboarding row: enough for the aggregates, with no live asset behind it. */
  private String seedInstance(long createdAt) {
    UUID instanceId = UUID.randomUUID();
    UUID entityId = UUID.randomUUID();
    var instance =
        new OnboardingInstance()
            .withId(instanceId)
            .withEntity(
                new EntityReference()
                    .withId(entityId)
                    .withType(Entity.METRIC)
                    .withName("retired-" + entityId))
            .withConfiguration(
                new OnboardingPlaybook()
                    .withId(UUID.randomUUID())
                    .withEntityType(PlaybookEntityType.METRIC)
                    .withOnboarding(new OnboardingConfiguration().withEnabled(true)))
            .withStage("draft")
            .withCreatedAt(createdAt)
            .withEnteredAt(createdAt)
            .withRevision(0L);
    seeded.add(entityId.toString());
    Entity.getCollectionDAO()
        .useTransaction(
            dao ->
                dao.onboardingDAO()
                    .insert(
                        instanceId.toString(),
                        entityId.toString(),
                        Entity.METRIC,
                        instance.getConfiguration().getId().toString(),
                        instance.getStage(),
                        createdAt,
                        createdAt,
                        JsonUtils.pojoToJson(instance)));
    instances.add(instanceId.toString());
    return instanceId.toString();
  }

  private void seedCohort(long createdAt, Long exitedAt) {
    String instanceId = seedInstance(createdAt);
    if (exitedAt == null) return;
    Entity.getCollectionDAO()
        .useTransaction(
            dao ->
                dao.onboardingDAO()
                    .insertStageTiming(
                        UUID.randomUUID().toString(),
                        instanceId,
                        Entity.METRIC,
                        "draft",
                        createdAt,
                        exitedAt));
  }

  private void seedReminder(OnboardingReminderKind kind, long sentAt) {
    // Parked well outside every measurement window so the reminder's own instance never joins a
    // cohort it is only there to carry a foreign key for.
    String instanceId = seedInstance(sentAt - 400 * DAY);
    Entity.getCollectionDAO()
        .useTransaction(
            dao ->
                dao.onboardingDAO()
                    .insertReminder(
                        UUID.randomUUID().toString(),
                        instanceId,
                        Entity.METRIC,
                        "display-name",
                        null,
                        kind.value(),
                        sentAt,
                        "admin"));
  }

  private OnboardingGate draftGate() {
    return new OnboardingGate()
        .withStage("draft")
        .withSteps(
            List.of(
                new OnboardingStep()
                    .withId("display-name")
                    .withTitle("Display name")
                    .withType(OnboardingCheckType.ATTRIBUTE)
                    .withFieldPath("displayName")
                    .withRules(new OnboardingRules().withMinLength(5))));
  }

  private OnboardingPlaybook playbook(TestNamespace namespace, OnboardingGate gate) {
    return new OnboardingPlaybook()
        .withName(namespace.prefix("policy-" + UUID.randomUUID()))
        .withEntityType(PlaybookEntityType.METRIC)
        .withOnboarding(new OnboardingConfiguration().withEnabled(true).withGates(List.of(gate)));
  }

  private OnboardingPlaybook publish(OnboardingPlaybook playbook) throws Exception {
    var published =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.PUT,
                CONFIG_PATH,
                new CreateOnboardingPlaybook()
                    .withName(playbook.getName())
                    .withEntityType(playbook.getEntityType())
                    .withOwners(playbook.getOwners())
                    .withOnboarding(playbook.getOnboarding()),
                OnboardingPlaybook.class);
    playbooks.add(published.getId());
    return published;
  }

  private EntityReference workflowReference(String name) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/governance/workflowDefinitions/name/" + name,
            null,
            WorkflowDefinition.class)
        .getEntityReference();
  }

  private Metric createMetric(TestNamespace namespace) {
    return SdkClients.adminClient()
        .metrics()
        .create(new CreateMetric().withName(namespace.prefix("policy-" + UUID.randomUUID())));
  }

  private OnboardingProgress progress(UUID id) {
    return await()
        .atMost(Duration.ofSeconds(30))
        .ignoreExceptions()
        .until(
            () ->
                SdkClients.adminClient()
                    .getHttpClient()
                    .execute(
                        HttpMethod.GET,
                        ONBOARDING_PATH + "metric/" + id,
                        null,
                        OnboardingProgress.class),
            value -> value != null);
  }

  private OnboardingStepResult awaitTask(UUID id) {
    return await()
        .atMost(Duration.ofSeconds(60))
        .until(
            () ->
                progress(id).getSteps().stream()
                    .filter(result -> "display-name".equals(result.getStep().getId()))
                    .findFirst()
                    .orElseThrow(),
            result -> result.getTaskId() != null && !result.getAssignees().isEmpty());
  }

  private OnboardingProgress nudge(OpenMetadataClient client, UUID id) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            ONBOARDING_PATH + "metric/" + id + "/nudge",
            new NudgeOnboarding().withMessage("The review is waiting on this."),
            OnboardingProgress.class);
  }

  private void transition(UUID id, Double version) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            ONBOARDING_PATH + "metric/" + id + "/transition",
            Map.of("expectedVersion", version),
            OnboardingProgress.class);
  }

  private void patchStatus(UUID id, String status) throws Exception {
    patch(id, "entityStatus", status);
  }

  private void patch(UUID id, String field, String value) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/metrics/" + id,
            String.format("[{\"op\":\"add\",\"path\":\"/%s\",\"value\":\"%s\"}]", field, value),
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  private OpenMetadataClient consumer() {
    String name = "onboarding-policy-consumer-" + UUID.randomUUID();
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
}
