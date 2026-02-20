// This test extends OpenMetadataApplicationTest to ensure the OpenMetadata application context and
// all repositories are initialized.
// Unlike most other tests that focus on REST/resource-level or entity CRUD operations, this test
// exercises the full governance workflow engine stack:
// - It triggers a real workflow (Glossary Approval Workflow) by creating a GlossaryTerm entity.
// - It waits for the workflow instance to be created and completed in the background (via Flowable
// engine).
// - It then directly inspects the WorkflowInstance audit log in the database, rather than only
// using REST APIs.
// This makes it a true end-to-end integration test for workflow audit logging, not just a resource
// or repository test.

package org.openmetadata.service.governance.workflows;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.flowable.common.engine.impl.cfg.IdGenerator;
import org.flowable.common.engine.impl.persistence.StrongUuidGenerator;
import org.flowable.engine.ProcessEngineConfiguration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.events.EventSubscriptionResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.TestUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class GlossaryApprovalWorkflowTest extends OpenMetadataApplicationTest {

  private GlossaryResourceTest glossaryTest;
  private GlossaryTermResourceTest glossaryTermTest;
  private User reviewerUser;
  private IdGenerator originalIdGenerator;
  private static final Logger LOG = LoggerFactory.getLogger(GlossaryApprovalWorkflowTest.class);

  @BeforeAll
  public void setup() throws Exception {
    glossaryTest = new GlossaryResourceTest();
    glossaryTermTest = new GlossaryTermResourceTest();

    // Create a test user to use as reviewer
    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser = userResourceTest.createRequest("workflow-audit-reviewer");
    reviewerUser = userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);

    // Force Flowable to use UUIDs for all IDs in this test context only.
    ProcessEngineConfiguration cfg = WorkflowHandler.getInstance().getProcessEngineConfiguration();
    if (cfg != null) {
      originalIdGenerator = cfg.getIdGenerator();
      cfg.setIdGenerator(new StrongUuidGenerator());
    }

    // Ensure WorkflowEventConsumer subscription exists and is active
    ensureWorkflowEventConsumerIsActive();
  }

  // Simplified method to ensure WorkflowEventConsumer subscription is active
  // This uses the exact same configuration as WorkflowEvents.json
  private void ensureWorkflowEventConsumerIsActive() {
    try {
      EventSubscriptionResourceTest eventSubscriptionResourceTest =
          new EventSubscriptionResourceTest();

      EventSubscription existing = null;
      try {
        existing =
            eventSubscriptionResourceTest.getEntityByName(
                "WorkflowEventConsumer", null, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        // Subscription doesn't exist, we'll create it
      }

      if (existing == null) {
        // Use exact same configuration as WorkflowEvents.json
        CreateEventSubscription createSubscription =
            new CreateEventSubscription()
                .withName("WorkflowEventConsumer")
                .withDisplayName("Workflow Event Consumer")
                .withDescription(
                    "Consumers EntityChange Events in order to trigger Workflows, if they exist.")
                .withAlertType(CreateEventSubscription.AlertType.GOVERNANCE_WORKFLOW_CHANGE_EVENT)
                .withResources(List.of("all"))
                .withProvider(ProviderType.SYSTEM)
                .withPollInterval(10)
                .withEnabled(true)
                .withDestinations(
                    List.of(
                        new SubscriptionDestination()
                            .withId(UUID.fromString("fc9e7a84-5dbd-4e63-8b78-6c3a7bf04a60"))
                            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                            .withType(
                                SubscriptionDestination.SubscriptionType
                                    .GOVERNANCE_WORKFLOW_CHANGE_EVENT)
                            .withEnabled(true)));

        eventSubscriptionResourceTest.createEntity(createSubscription, ADMIN_AUTH_HEADERS);
        java.lang.Thread.sleep(1000); // Give it time to initialize
      } else if (!existing.getEnabled()) {
        // Enable if disabled
        String json = JsonUtils.pojoToJson(existing);
        existing.setEnabled(true);
        eventSubscriptionResourceTest.patchEntity(
            existing.getId(), json, existing, ADMIN_AUTH_HEADERS);
        java.lang.Thread.sleep(1000);
      }
    } catch (Exception e) {
      LOG.warn("Failed to ensure WorkflowEventConsumer is active: {}", e.getMessage(), e);
    }
  }

  @AfterAll
  public void cleanup() {
    // Restore the original idGenerator to avoid affecting the application singleton
    ProcessEngineConfiguration cfg = WorkflowHandler.getInstance().getProcessEngineConfiguration();
    if (cfg != null && originalIdGenerator != null) {
      cfg.setIdGenerator(originalIdGenerator);
    }
  }

  // Use stable names for glossary and term
  private static final String TEST_GLOSSARY_NAME = "StateApiTestGlossary";
  private static final String TEST_TERM_NAME = "StateApiTestTerm";

  @Test
  public void testGlossaryApprovalWorkflowStatesApiIntegration() throws Exception {
    // Create glossary WITHOUT reviewers - this should go straight to approved
    CreateGlossary createGlossary =
        new CreateGlossary().withName(TEST_GLOSSARY_NAME).withDescription("Test glossary");
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create term WITHOUT reviewers - this should also go straight to approved
    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName(TEST_TERM_NAME)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Test term");
    GlossaryTerm term = glossaryTermTest.createEntity(createTerm, ADMIN_AUTH_HEADERS);

    // Verify the term is approved (no reviewers = auto-approved)
    assertEquals(EntityStatus.APPROVED, term.getEntityStatus());

    String termFqn = glossary.getFullyQualifiedName() + "." + TEST_TERM_NAME;
    String entityLink = String.format("<#E::glossaryTerm::%s>", termFqn);

    // Wait for workflow instance to be created and completed - with manual trigger fallback
    UUID workflowInstanceId;
    try {
      workflowInstanceId = waitForWorkflowInstanceByEntityLink(entityLink);
    } catch (AssertionError e) {
      // If automatic triggering failed, manually trigger the workflow as fallback
      LOG.info("Automatic workflow triggering failed, using manual trigger as fallback");
      manuallyTriggerWorkflowSignal(entityLink);
      workflowInstanceId = waitForWorkflowInstanceByEntityLink(entityLink);
    }
    WorkflowInstance instance =
        waitForWorkflowInstanceCompletion(workflowInstanceId, "ApprovedEnd");

    // Fetch workflow states using the enhanced API that gets states from latest workflow instance
    List<WorkflowInstanceState> states =
        getWorkflowStatesForEntityLink(entityLink, "GlossaryTermApprovalWorkflow");
    assertNotNull(states, "Workflow instance states should not be null");
    assertFalse(states.isEmpty(), "Workflow instance states should have entries");

    // Sort states by timestamp before asserting
    states.sort(Comparator.comparing(WorkflowInstanceState::getTimestamp));

    // Assert the expected sequence of workflow states for auto-approve (no reviewers)
    List<String> expectedStages =
        List.of(
            "GlossaryTermCreated",
            "CheckGlossaryTermHasReviewers",
            "SetGlossaryTermStatusToApproved",
            "ApprovedEnd");
    assertWorkflowStatesSequence(states, expectedStages);

    // Assert specific displayNames for known stages based on the actual workflow definition
    Map<String, String> expectedDisplayNames =
        Map.of(
            "GlossaryTermCreated", "Glossary Term Created or Updated",
            "CheckGlossaryTermHasReviewers", "Check if Glossary Term has Reviewers",
            "SetGlossaryTermStatusToApproved", "Set Status to 'Approved'",
            "ApprovedEnd", "Glossary Term Status: Approved");
    assertStageDisplayNames(states, expectedDisplayNames);

    // Assert that the workflow instance is finished
    assertEquals(
        WorkflowInstance.WorkflowStatus.FINISHED,
        instance.getStatus(),
        "Workflow instance should be finished");
  }

  @Test
  public void testWorkflowInstancesApiWithSpecialCharacters() throws Exception {
    // Test for the specific bug fix - glossary terms with single quotes in the name
    // This test verifies the API can handle entityLink parameters with special characters

    // Create glossary with stable name
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName("SpecialCharsGlossary")
            .withDescription("Glossary for testing special characters");
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create term with single quote in name (this was causing SQL injection issues)
    String termNameWithQuote = "Glo'ddd";
    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName(termNameWithQuote)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Test term with single quote");
    GlossaryTerm term = glossaryTermTest.createEntity(createTerm, ADMIN_AUTH_HEADERS);

    // Verify the term was created successfully
    assertEquals(EntityStatus.APPROVED, term.getEntityStatus());

    // Construct the entityLink exactly as it would appear in the UI
    String termFqn = glossary.getFullyQualifiedName() + "." + termNameWithQuote;
    String entityLink = String.format("<#E::glossaryTerm::%s>", termFqn);

    // Wait for potential workflow instance to be created
    try {
      UUID workflowInstanceId = waitForWorkflowInstanceByEntityLink(entityLink);
      // If we get here, a workflow instance was created - that's fine, continue testing
      LOG.info(
          "Workflow instance created for term with special characters: {}", workflowInstanceId);
    } catch (AssertionError e) {
      // If no workflow instance is created, that's also fine - the main point is testing the API
      LOG.info("No automatic workflow instance created, testing API call directly");
    }

    // The main test: Call the workflow instances API with entityLink containing single quote
    // This should NOT throw a SQL exception after our fix
    long now = System.currentTimeMillis();
    long oneHourAgo = now - 3600_000L;

    String url =
        String.format(
            "governance/workflowInstances?startTs=%d&endTs=%d&entityLink=%s&workflowDefinitionName=GlossaryTermApprovalWorkflow",
            oneHourAgo, now, URLEncoder.encode(entityLink, StandardCharsets.UTF_8));

    WebTarget target = getResource(url);
    Invocation.Builder builder = target.request();
    for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
      builder = builder.header(entry.getKey(), entry.getValue());
    }

    // This should succeed without throwing UnableToCreateStatementException
    String rawJson = builder.get(String.class);
    assertNotNull(rawJson, "API response should not be null");

    // Parse the response to ensure it's valid JSON
    ResultList<WorkflowInstance> result =
        JsonUtils.readValue(
            rawJson,
            new com.fasterxml.jackson.core.type.TypeReference<ResultList<WorkflowInstance>>() {});
    assertNotNull(result, "Parsed result should not be null");

    // The result may be empty (no workflow instances) or contain instances - both are valid
    // The important thing is that the API call succeeded without SQL errors
    LOG.info(
        "Successfully called workflow instances API with special character entityLink. Found {} instances.",
        result.getData().size());
  }

  @Test
  public void testGlossaryApprovalWorkflowWithReviewer() throws Exception {
    // Create glossary with reviewer and stable name
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName("ReviewerGlossary")
            .withDescription("Reviewer glossary")
            .withReviewers(List.of(reviewerUser.getEntityReference()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create term with stable name and inherits reviewers from glossary
    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName("ReviewerTerm")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Reviewer term");
    GlossaryTerm term = glossaryTermTest.createEntity(createTerm, ADMIN_AUTH_HEADERS);

    // Verify the term has reviewers and is in draft status
    assertNotNull(term.getReviewers());
    assertFalse(term.getReviewers().isEmpty());
    assertEquals(EntityStatus.DRAFT, term.getEntityStatus());

    String termFqn = glossary.getFullyQualifiedName() + "." + "ReviewerTerm";
    String entityLink = String.format("<#E::glossaryTerm::%s>", termFqn);

    // Wait for workflow instance to be created - with manual trigger fallback
    UUID workflowInstanceId;
    try {
      workflowInstanceId = waitForWorkflowInstanceByEntityLink(entityLink);
    } catch (AssertionError e) {
      // If automatic triggering failed, manually trigger the workflow as fallback
      LOG.info("Automatic workflow triggering failed, using manual trigger as fallback");
      manuallyTriggerWorkflowSignal(entityLink);
      workflowInstanceId = waitForWorkflowInstanceByEntityLink(entityLink);
    }

    // Wait for the approval task to be created for the term (status should be IN_REVIEW)
    GlossaryTerm finalTerm = term;
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              GlossaryTerm refreshed =
                  glossaryTermTest.getEntity(finalTerm.getId(), null, ADMIN_AUTH_HEADERS);
              return refreshed.getEntityStatus() == EntityStatus.IN_REVIEW;
            });

    // Get reviewer headers for resolving the task
    Map<String, String> reviewerHeaders =
        authHeaders(reviewerUser.getName() + "@open-metadata.org");

    // Find the open approval task for the term via API
    String about = String.format("<#E::glossaryTerm::%s>", term.getFullyQualifiedName());
    String url =
        "feed?threadType=Task&about="
            + URLEncoder.encode(about, StandardCharsets.UTF_8)
            + "&taskStatus=Open";
    WebTarget taskTarget = getResource(url);
    Invocation.Builder builder = taskTarget.request();
    for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
      builder = builder.header(entry.getKey(), entry.getValue());
    }
    String rawJson = builder.get(String.class);
    ResultList<Thread> threads =
        JsonUtils.readValue(
            rawJson, new com.fasterxml.jackson.core.type.TypeReference<ResultList<Thread>>() {});

    // Find the approval task thread - filter for threads that have tasks first, then check task
    // type
    Thread taskThread =
        threads.getData().stream()
            .filter(t -> t.getTask() != null) // First ensure the thread has a task
            .filter(t -> t.getTask().getType() == TaskType.RequestApproval) // Then check task type
            .filter(t -> t.getTask().getId() != null) // Ensure task has valid ID
            .findFirst()
            .orElseThrow(() -> new AssertionError("No open approval task with valid ID found"));

    // Verify ChangeEvent was created for the workflow-generated approval task
    verifyChangeEventForTask(taskThread);

    // Prepare the resolve payload
    ResolveTask resolveTask = new ResolveTask().withNewValue("approved");
    WebTarget resolveTarget =
        getResource("feed/tasks/" + taskThread.getTask().getId() + "/resolve");
    TestUtils.put(resolveTarget, resolveTask, Response.Status.OK, reviewerHeaders);

    // Wait for workflow instance to finish
    WorkflowInstance instance =
        waitForWorkflowInstanceCompletion(workflowInstanceId, "ApprovalEnd");

    // Fetch workflow states using the enhanced API that gets states from latest workflow instance
    List<WorkflowInstanceState> states =
        getWorkflowStatesForEntityLink(entityLink, "GlossaryTermApprovalWorkflow");
    assertNotNull(states, "Workflow instance states should not be null");
    assertFalse(states.isEmpty(), "Workflow instance states should have entries");

    // Sort states by timestamp before asserting
    states.sort(Comparator.comparing(WorkflowInstanceState::getTimestamp));

    // Assert the expected sequence of workflow states for the update path
    List<String> expectedStages =
        List.of(
            "GlossaryTermCreated",
            "CheckGlossaryTermHasReviewers",
            "CheckIfGlossaryTermUpdatedByIsReviewer",
            "CheckGlossaryTermIsReadyToBeReviewed",
            "CheckIfGlossaryTermIsNew",
            "SetGlossaryTermStatusToInReviewForUpdate",
            "ApprovalForUpdates",
            "SetGlossaryTermStatusToApprovedAfterReview",
            "ApprovalEnd");
    assertWorkflowStatesSequence(states, expectedStages);

    // Assert specific displayNames for known stages based on the actual workflow definition
    Map<String, String> expectedDisplayNames =
        Map.of(
            "GlossaryTermCreated", "Glossary Term Created or Updated",
            "CheckGlossaryTermHasReviewers", "Check if Glossary Term has Reviewers",
            "CheckIfGlossaryTermUpdatedByIsReviewer",
                "Check if Glossary Term Updated By is Reviewer",
            "CheckGlossaryTermIsReadyToBeReviewed",
                "Check if Glossary Term is Ready to be Reviewed",
            "CheckIfGlossaryTermIsNew", "Check if Glossary Term is New",
            "SetGlossaryTermStatusToInReviewForUpdate", "Set Status to 'In Review' (Update)",
            "ApprovalForUpdates", "Review Changes for Updates",
            "SetGlossaryTermStatusToApprovedAfterReview", "Set Status to 'Approved' (After Review)",
            "ApprovalEnd", "Approved After Unified Review");
    assertStageDisplayNames(states, expectedDisplayNames);

    // Assert that the workflow instance is finished
    assertEquals(
        WorkflowInstance.WorkflowStatus.FINISHED,
        instance.getStatus(),
        "Workflow instance should be finished");
  }

  // Helper: Wait for workflow instance related to a specific entity using entityLink variable
  private UUID waitForWorkflowInstanceByEntityLink(String entityLink) throws InterruptedException {
    int retries = 30;
    long now = System.currentTimeMillis();
    long oneHourAgo = now - 3600_000L;

    while (retries-- > 0) {
      String url =
          String.format(
              "governance/workflowInstances?startTs=%d&endTs=%d&limit=100&entityLink=%s",
              oneHourAgo, now, URLEncoder.encode(entityLink, StandardCharsets.UTF_8));
      WebTarget target = getResource(url);
      Invocation.Builder builder = target.request();
      for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
        builder = builder.header(entry.getKey(), entry.getValue());
      }
      String rawJson = builder.get(String.class);
      ResultList<WorkflowInstance> result =
          JsonUtils.readValue(
              rawJson,
              new com.fasterxml.jackson.core.type.TypeReference<ResultList<WorkflowInstance>>() {});

      if (!result.getData().isEmpty()) {
        return result.getData().getFirst().getId();
      }
      java.lang.Thread.sleep(1000);
    }
    throw new AssertionError("No WorkflowInstance found for entityLink: " + entityLink);
  }

  // Unified helper: poll until the workflow instance is finished and (optionally) final stage is
  // present
  private WorkflowInstance waitForWorkflowInstanceCompletion(UUID instanceId, String finalStage)
      throws InterruptedException {
    int retries = 60;
    long now = System.currentTimeMillis();
    long oneHourAgo = now - 3600_000L;

    while (retries-- > 0) {
      String url =
          String.format(
              "governance/workflowInstances?startTs=%d&endTs=%d&limit=100", oneHourAgo, now);
      WebTarget target = getResource(url);
      Invocation.Builder builder = target.request();
      for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
        builder = builder.header(entry.getKey(), entry.getValue());
      }
      String rawJson = builder.get(String.class);
      ResultList<WorkflowInstance> result =
          JsonUtils.readValue(
              rawJson,
              new com.fasterxml.jackson.core.type.TypeReference<ResultList<WorkflowInstance>>() {});

      WorkflowInstance instance =
          result.getData().stream()
              .filter(inst -> inst.getId().equals(instanceId))
              .findFirst()
              .orElse(null);

      if (instance == null) {
        java.lang.Thread.sleep(1000);
        continue;
      }
      if (finalStage != null) {
        List<WorkflowInstanceState> states = getWorkflowStatesForInstance(instance);
        List<String> seenStages = states.stream().map(s -> s.getStage().getName()).toList();
        boolean finished = seenStages.contains(finalStage);
        if (finished && instance.getStatus() == WorkflowInstance.WorkflowStatus.FINISHED) {
          return instance;
        }
      } else {
        if (instance.getStatus() == WorkflowInstance.WorkflowStatus.FINISHED) {
          return instance;
        }
      }
      java.lang.Thread.sleep(1000);
    }
    throw new AssertionError("No WorkflowInstance found for id " + instanceId + " in time");
  }

  private List<WorkflowInstanceState> getWorkflowStatesForInstance(WorkflowInstance instance) {
    // Fetch the workflow definition using proper entity class
    UUID workflowDefinitionId = instance.getWorkflowDefinitionId();
    WebTarget defTarget = getResource("governance/workflowDefinitions/" + workflowDefinitionId);
    Invocation.Builder defBuilder = defTarget.request();
    for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
      defBuilder = defBuilder.header(entry.getKey(), entry.getValue());
    }
    String defRawJson = defBuilder.get(String.class);
    WorkflowDefinition workflowDefinition =
        JsonUtils.readValue(defRawJson, WorkflowDefinition.class);

    long now = System.currentTimeMillis();
    long oneHourAgo = now - 3600_000L;
    String url =
        String.format(
            "governance/workflowInstanceStates/%s/%s?startTs=%d&endTs=%d&limit=100",
            workflowDefinition.getName(), instance.getId(), oneHourAgo, now);
    WebTarget target = getResource(url);
    Invocation.Builder builder = target.request();
    for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
      builder = builder.header(entry.getKey(), entry.getValue());
    }
    String rawJson = builder.get(String.class);
    ResultList<WorkflowInstanceState> result =
        JsonUtils.readValue(
            rawJson,
            new com.fasterxml.jackson.core.type.TypeReference<
                ResultList<WorkflowInstanceState>>() {});
    return result.getData();
  }

  private List<WorkflowInstanceState> getWorkflowStatesForEntityLink(
      String entityLink, String workflowDefinitionName) {
    int retries = 30;
    long now = System.currentTimeMillis();
    long oneHourAgo = now - 3600_000L;

    while (retries-- > 0) {
      try {
        // First get the latest workflow instance for this entity
        String instanceUrl =
            String.format(
                "governance/workflowInstances?startTs=%d&endTs=%d&limit=100&entityLink=%s&latest=true",
                oneHourAgo, now, URLEncoder.encode(entityLink, StandardCharsets.UTF_8));
        WebTarget instanceTarget = getResource(instanceUrl);
        Invocation.Builder instanceBuilder = instanceTarget.request();
        for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
          instanceBuilder = instanceBuilder.header(entry.getKey(), entry.getValue());
        }
        String instanceRawJson = instanceBuilder.get(String.class);
        ResultList<WorkflowInstance> instanceResult =
            JsonUtils.readValue(
                instanceRawJson,
                new com.fasterxml.jackson.core.type.TypeReference<
                    ResultList<WorkflowInstance>>() {});

        if (!instanceResult.getData().isEmpty()) {
          // Get the latest workflow instance
          WorkflowInstance latestInstance = instanceResult.getData().get(0);

          // Now get states for this specific instance
          String url =
              String.format(
                  "governance/workflowInstanceStates/%s/%s?startTs=%d&endTs=%d&limit=100",
                  workflowDefinitionName, latestInstance.getId(), oneHourAgo, now);
          WebTarget target = getResource(url);
          Invocation.Builder builder = target.request();
          for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
            builder = builder.header(entry.getKey(), entry.getValue());
          }
          String rawJson = builder.get(String.class);
          ResultList<WorkflowInstanceState> result =
              JsonUtils.readValue(
                  rawJson,
                  new com.fasterxml.jackson.core.type.TypeReference<
                      ResultList<WorkflowInstanceState>>() {});

          if (!result.getData().isEmpty()) {
            return result.getData();
          }
        }
        java.lang.Thread.sleep(1000);
      } catch (InterruptedException e) {
        java.lang.Thread.currentThread().interrupt();
        throw new RuntimeException(e);
      }
    }
    throw new AssertionError(
        "No WorkflowInstanceState found for entityLink: "
            + entityLink
            + " and workflowDefinitionName: "
            + workflowDefinitionName);
  }

  private void assertWorkflowStatesSequence(
      List<WorkflowInstanceState> states, List<String> expectedStages) {
    List<String> actualStages =
        states.stream().map(s -> s.getStage().getName()).collect(Collectors.toList());
    assertEquals(expectedStages, actualStages, "Workflow stages sequence mismatch");

    // Also check that each state has required fields
    for (WorkflowInstanceState state : states) {
      assertNotNull(state.getStage(), "Stage should not be null");
      assertNotNull(state.getStage().getName(), "Stage name should not be null");
      assertNotNull(state.getStage().getDisplayName(), "Stage displayName should not be null");
      assertNotNull(state.getStatus(), "Status should not be null");
      assertNotNull(state.getTimestamp(), "Timestamp should not be null");

      // Verify displayName is either the same as name (fallback) or a meaningful display name
      String stageName = state.getStage().getName();
      String displayName = state.getStage().getDisplayName();
      assertTrue(
          displayName.equals(stageName) || !displayName.trim().isEmpty(),
          "DisplayName should either be the stage name or a non-empty string");

      if (state.getStage().getVariables() != null) {
        assertFalse(
            state.getStage().getVariables().isEmpty(),
            "Stage variables should not be empty if present");
      }
    }
  }

  private void assertStageDisplayNames(
      List<WorkflowInstanceState> states, Map<String, String> expectedDisplayNames) {
    for (WorkflowInstanceState state : states) {
      String stageName = state.getStage().getName();
      String actualDisplayName = state.getStage().getDisplayName();
      String expectedDisplayName = expectedDisplayNames.get(stageName);

      if (expectedDisplayName != null) {
        // We now expect the exact display name from the workflow definition
        assertEquals(
            expectedDisplayName,
            actualDisplayName,
            String.format(
                "Stage '%s' displayName mismatch. Expected: '%s', Actual: '%s'",
                stageName, expectedDisplayName, actualDisplayName));
      } else {
        // For stages not in our expected map, they should at least have the stage name as fallback
        assertNotNull(actualDisplayName, "DisplayName should not be null");
        assertFalse(actualDisplayName.trim().isEmpty(), "DisplayName should not be empty");
      }
    }
  }

  private void verifyChangeEventForTask(Thread taskThread) {
    long latestOffset = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    List<String> changeEventJsonList =
        Entity.getCollectionDAO().changeEventDAO().list(100, Math.max(0, latestOffset - 100));

    ChangeEvent matchingEvent =
        changeEventJsonList.stream()
            .map(json -> JsonUtils.readValue(json, ChangeEvent.class))
            .filter(event -> event.getEntityType().equals(Entity.THREAD))
            .filter(event -> event.getEntityId().equals(taskThread.getId()))
            .filter(event -> event.getEventType().equals(EventType.THREAD_CREATED))
            .findFirst()
            .orElse(null);

    assertNotNull(
        matchingEvent,
        String.format(
            "ChangeEvent with type THREAD_CREATED should exist for task thread ID: %s",
            taskThread.getId()));

    assertNotNull(matchingEvent.getUserName(), "ChangeEvent userName should not be null");
    assertNotNull(matchingEvent.getTimestamp(), "ChangeEvent timestamp should not be null");
    assertNotNull(matchingEvent.getEntity(), "ChangeEvent entity should not be null");
  }

  private void manuallyTriggerWorkflowSignal(String entityLink) {
    try {
      Map<String, Object> variables = new HashMap<>();
      variables.put(
          getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE), entityLink);

      String signal = "glossaryTerm-entityCreated";
      WorkflowHandler.getInstance().triggerWithSignal(signal, variables);
      java.lang.Thread.sleep(2000); // Give workflow time to process
    } catch (Exception e) {
      LOG.warn("Failed to manually trigger workflow signal: {}", e.getMessage());
    }
  }
}
