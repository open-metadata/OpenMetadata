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
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.flowable.common.engine.impl.cfg.IdGenerator;
import org.flowable.common.engine.impl.persistence.StrongUuidGenerator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm.Status;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.ResultList;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class WorkflowAuditLogTest extends OpenMetadataApplicationTest {

  private WorkflowInstanceRepository instanceRepo;
  private GlossaryResourceTest glossaryTest;
  private GlossaryTermResourceTest glossaryTermTest;
  private User reviewerUser;
  private IdGenerator originalIdGenerator;

  @BeforeAll
  public void setup() throws Exception {
    instanceRepo =
        (WorkflowInstanceRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);
    glossaryTest = new GlossaryResourceTest();
    glossaryTermTest = new GlossaryTermResourceTest();

    // Create a test user to use as reviewer
    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser = userResourceTest.createRequest("workflow-audit-reviewer");
    reviewerUser = userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);
    // Debug prints to verify reviewer reference and ID
    System.out.println("Reviewer entity reference: " + reviewerUser.getEntityReference());
    System.out.println(
        "Reviewer ID: " + reviewerUser.getEntityReference().getId()); // Should be a UUID
    System.out.println("Reviewer username: " + reviewerUser.getName());
    System.out.println("Reviewer FQN: " + reviewerUser.getFullyQualifiedName());

    // --- TEST-ONLY: Force Flowable to use UUIDs for all IDs ---
    // This ensures task/process IDs are UUIDs, not numeric, in this test context only.
    org.flowable.engine.ProcessEngineConfiguration cfg =
        org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
            .getProcessEngineConfiguration();
    if (cfg != null) {
      originalIdGenerator = cfg.getIdGenerator();
      cfg.setIdGenerator(new StrongUuidGenerator());
    }
    // ---------------------------------------------------------
  }

  @AfterAll
  public void cleanup() {
    // Restore the original idGenerator to avoid affecting the application singleton
    org.flowable.engine.ProcessEngineConfiguration cfg =
        org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
            .getProcessEngineConfiguration();
    if (cfg != null && originalIdGenerator != null) {
      cfg.setIdGenerator(originalIdGenerator);
    }
  }

  //  @Test
  //  public void testGlossaryApprovalWorkflowAuditLogIntegration()
  //      throws IOException, InterruptedException {
  //    // 1. Create a glossary with reviewers (to trigger approval workflow)
  //    List reviewers = List.of(reviewerUser.getEntityReference());
  //    System.out.println("Reviewers list for glossary: " + reviewers);
  //    CreateGlossary createGlossary =
  //        new CreateGlossary()
  //            .withName("AuditLogTestGlossary")
  //            .withDescription("Glossary for audit log integration test")
  //            // Always use getEntityReference() to ensure UUID is used
  //            .withReviewers(reviewers);
  //    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
  //
  //    // 2. Create a glossary term under this glossary (should trigger workflow in DRAFT)
  //    CreateGlossaryTerm createTerm =
  //        new CreateGlossaryTerm()
  //            .withName("AuditLogTestTerm")
  //            .withDescription("Term for audit log integration test")
  //            .withGlossary(glossary.getFullyQualifiedName());
  //    GlossaryTerm term = glossaryTermTest.createEntity(createTerm, ADMIN_AUTH_HEADERS);
  //    assertEquals(Status.DRAFT, term.getStatus());
  //
  //    // --- No manual workflow trigger: rely on event system as in production ---
  //    // The event system should trigger the workflow automatically when the GlossaryTerm is
  // created.
  //    // ---------------------------------------------------------------------------
  //
  //    // 3. Wait for any WorkflowInstance to be created (since business key is set after process
  // start)
  //    UUID workflowInstanceId = waitForAnyWorkflowInstanceCreated();
  //    WorkflowInstance instance = waitForWorkflowInstanceCompletion(workflowInstanceId);
  //
  //    // 4. Simulate reviewer approval (if possible)
  //    // NOTE: In a real integration test, you would fetch the user task for the reviewer and
  // complete it.
  //    // This may require direct Flowable API calls or simulating the approval event.
  //    // For now, document this step:
  //    // TODO: Simulate reviewer login and approval of the glossary term user task.
  //    // This will allow the workflow to traverse all nodes and reach completion.
  //
  //    // 5. Fetch workflow instance states using the repository (API uses same logic)
  //    String workflowDefinitionName = instance.getWorkflowDefinitionId().toString(); // You may
  // need to resolve name from ID
  //    // For demonstration, fetch all states for this instance
  //    org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository stateRepo =
  //        (org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository)
  // org.openmetadata.service.Entity.getEntityTimeSeriesRepository(org.openmetadata.service.Entity.WORKFLOW_INSTANCE_STATE);
  //    long startTs = instance.getStartedAt() != null ? instance.getStartedAt() : 0L;
  //    long endTs = instance.getEndedAt() != null ? instance.getEndedAt() :
  // System.currentTimeMillis();
  //    ResultList<WorkflowInstanceState> states = stateRepo.listWorkflowInstanceStatesForInstance(
  //        workflowDefinitionName, workflowInstanceId, null, startTs, endTs, 100, false);
  //
  //    // 6. Assert auditLog is present and has expected entries
  //    List<WorkflowInstanceState> auditLog = instance.getAuditLog();
  //    assertNotNull(auditLog, "Audit log should not be null");
  //    assertFalse(auditLog.isEmpty(), "Audit log should have entries");
  //
  //    // 7. Check that each entry has expected fields
  //    for (WorkflowInstanceState state : auditLog) {
  //      assertNotNull(state.getStage(), "Stage should not be null");
  //      assertNotNull(state.getStatus(), "Status should not be null");
  //      assertNotNull(state.getTimestamp(), "Timestamp should not be null");
  //      // Optionally, check variables, reviewer assignment, etc.
  //    }
  //
  //    // 8. Assert that the states fetched from the API/repo match the audit log
  //    assertEquals(auditLog.size(), states.getData().size(), "Audit log and API states should
  // match in size");
  //    // Optionally, compare contents in detail
  //  }

  @Test
  public void testGlossaryApprovalWorkflowStatesApiIntegration()
      throws IOException, InterruptedException {
    // 1. Create a glossary WITHOUT reviewers (to trigger auto-complete workflow)
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName("StateApiTestGlossary")
            .withDescription("Glossary for workflow state API test"); // No reviewers assigned
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // 2. Create a glossary term under this glossary (should trigger workflow in DRAFT)
    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName("StateApiTestTerm")
            .withDescription("Term for workflow state API test")
            .withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm term = glossaryTermTest.createEntity(createTerm, ADMIN_AUTH_HEADERS);
    assertEquals(Status.APPROVED, term.getStatus());

    // 3. Wait for any WorkflowInstance to be created and completed
    UUID workflowInstanceId = waitForAnyWorkflowInstanceCreated();
    WorkflowInstance instance = waitForWorkflowInstanceCompletion(workflowInstanceId);

    // 4. Fetch workflow instance states using the repository (API uses same logic)
    // Resolve workflow definition name from ID
    org.openmetadata.service.jdbi3.WorkflowDefinitionRepository workflowDefinitionRepository =
        (org.openmetadata.service.jdbi3.WorkflowDefinitionRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.WORKFLOW_DEFINITION);
    org.openmetadata.schema.governance.workflows.WorkflowDefinition workflowDefinition =
        workflowDefinitionRepository.get(
            null,
            instance.getWorkflowDefinitionId(),
            org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS);
    String workflowDefinitionName = workflowDefinition.getName();
    org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository stateRepo =
        (org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository)
            org.openmetadata.service.Entity.getEntityTimeSeriesRepository(
                org.openmetadata.service.Entity.WORKFLOW_INSTANCE_STATE);
    long startTs = instance.getStartedAt() != null ? instance.getStartedAt() : 0L;
    long endTs = instance.getEndedAt() != null ? instance.getEndedAt() : System.currentTimeMillis();
    ResultList<WorkflowInstanceState> states =
        stateRepo.listWorkflowInstanceStatesForInstance(
            workflowDefinitionName, workflowInstanceId, null, startTs, endTs, 100, false);

    // 5. Assert that the states list is present and has expected entries
    List<WorkflowInstanceState> stateList = states.getData();
    assertNotNull(stateList, "Workflow instance states should not be null");
    assertFalse(stateList.isEmpty(), "Workflow instance states should have entries");

    // Print all states for debugging
    System.out.println("Workflow instance states:");
    for (WorkflowInstanceState state : stateList) {
      System.out.println(state);
    }

    // 6. Check that each entry has expected fields
    for (WorkflowInstanceState state : stateList) {
      assertNotNull(state.getStage(), "Stage should not be null");
      assertNotNull(state.getStatus(), "Status should not be null");
      assertNotNull(state.getTimestamp(), "Timestamp should not be null");
      // Optionally, check variables, etc.
      // Check that variables are present (if expected for this stage)
      if (state.getStage().getVariables() != null) {
        // You can add more specific checks here if you know what variables to expect
        assertFalse(
            state.getStage().getVariables().isEmpty(),
            "Stage variables should not be empty if present");
      }
    }

    // 7. Assert that the workflow instance is finished
    assertEquals(
        WorkflowInstance.WorkflowStatus.FINISHED,
        instance.getStatus(),
        "Workflow instance should be finished");
  }

  @Test
  public void testGlossaryApprovalWorkflowWithReviewer() throws Exception {
    // 1. Assign reviewerUser as reviewer
    CreateGlossary createGlossary =
        new CreateGlossary().withName("ReviewerGlossary").withDescription("Glossary with reviewer");
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName("ReviewerTerm")
            .withDescription("Term for reviewer approval test")
            .withGlossary(glossary.getFullyQualifiedName())
            .withReviewers(List.of(reviewerUser.getEntityReference()));
    GlossaryTerm term = glossaryTermTest.createEntity(createTerm, ADMIN_AUTH_HEADERS);

    // 2. Wait for workflow instance to be created
    UUID workflowInstanceId = waitForAnyWorkflowInstanceCreated();
    WorkflowInstance instance = instanceRepo.getById(workflowInstanceId);

    // 3. Wait for the approval task to be created for the term
    GlossaryTerm finalTerm = term;
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              GlossaryTerm refreshed =
                  glossaryTermTest.getEntity(finalTerm.getId(), null, ADMIN_AUTH_HEADERS);
              return refreshed.getStatus() == Status.IN_REVIEW;
            });

    // 4. Approve the term as reviewerUser (reviewer)
    String json = org.openmetadata.schema.utils.JsonUtils.pojoToJson(term);
    term.setStatus(Status.APPROVED);
    term =
        glossaryTermTest.patchEntity(
            term.getId(), json, term, authHeaders(reviewerUser.getName() + "@open-metadata.org"));

    // 5. Wait for workflow instance to finish
    instance = waitForWorkflowInstanceCompletion(workflowInstanceId);

    // 6. Fetch and print all states
    org.openmetadata.service.jdbi3.WorkflowDefinitionRepository workflowDefinitionRepository =
        (org.openmetadata.service.jdbi3.WorkflowDefinitionRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.WORKFLOW_DEFINITION);
    org.openmetadata.schema.governance.workflows.WorkflowDefinition workflowDefinition =
        workflowDefinitionRepository.get(
            null,
            instance.getWorkflowDefinitionId(),
            org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS);
    String workflowDefinitionName = workflowDefinition.getName();
    org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository stateRepo =
        (org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository)
            org.openmetadata.service.Entity.getEntityTimeSeriesRepository(
                org.openmetadata.service.Entity.WORKFLOW_INSTANCE_STATE);
    long startTs = instance.getStartedAt() != null ? instance.getStartedAt() : 0L;
    long endTs = instance.getEndedAt() != null ? instance.getEndedAt() : System.currentTimeMillis();
    ResultList<WorkflowInstanceState> states =
        stateRepo.listWorkflowInstanceStatesForInstance(
            workflowDefinitionName, workflowInstanceId, null, startTs, endTs, 100, false);

    // Print all states for debugging
    System.out.println("Workflow instance states (with reviewer):");
    for (WorkflowInstanceState state : states.getData()) {
      System.out.println(state);
    }

    // Assert that the states list is present and has expected entries
    List<WorkflowInstanceState> stateList = states.getData();
    assertNotNull(stateList, "Workflow instance states should not be null");
    assertFalse(stateList.isEmpty(), "Workflow instance states should have entries");

    // Check that each entry has expected fields
    for (WorkflowInstanceState state : stateList) {
      assertNotNull(state.getStage(), "Stage should not be null");
      assertNotNull(state.getStatus(), "Status should not be null");
      assertNotNull(state.getTimestamp(), "Timestamp should not be null");
      if (state.getStage().getVariables() != null) {
        assertFalse(
            state.getStage().getVariables().isEmpty(),
            "Stage variables should not be empty if present");
      }
    }

    // Assert that the workflow instance is finished
    assertEquals(
        WorkflowInstance.WorkflowStatus.FINISHED,
        instance.getStatus(),
        "Workflow instance should be finished");
  }

  @Test
  public void testGlossaryApprovalWorkflowWithReviewerRejection() throws Exception {
    // 1. Assign reviewerUser as reviewer
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName("ReviewerGlossaryReject")
            .withDescription("Glossary with reviewer for rejection");
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName("ReviewerTermReject")
            .withDescription("Term for reviewer rejection test")
            .withGlossary(glossary.getFullyQualifiedName())
            .withReviewers(List.of(reviewerUser.getEntityReference()));
    GlossaryTerm term = glossaryTermTest.createEntity(createTerm, ADMIN_AUTH_HEADERS);

    // 2. Wait for workflow instance to be created
    UUID workflowInstanceId = waitForAnyWorkflowInstanceCreated();
    WorkflowInstance instance = instanceRepo.getById(workflowInstanceId);

    // 3. Wait for the approval task to be created for the term
    GlossaryTerm finalTerm = term;
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              GlossaryTerm refreshed =
                  glossaryTermTest.getEntity(finalTerm.getId(), null, ADMIN_AUTH_HEADERS);
              return refreshed.getStatus() == Status.IN_REVIEW;
            });

    // 4. Reject the term as reviewerUser (reviewer)
    String json = org.openmetadata.schema.utils.JsonUtils.pojoToJson(term);
    term.setStatus(Status.REJECTED);
    term =
        glossaryTermTest.patchEntity(
            term.getId(), json, term, authHeaders(reviewerUser.getName() + "@open-metadata.org"));

    // 5. Wait for workflow instance to finish
    instance = waitForWorkflowInstanceCompletion(workflowInstanceId);

    // 6. Fetch and print all states
    org.openmetadata.service.jdbi3.WorkflowDefinitionRepository workflowDefinitionRepository =
        (org.openmetadata.service.jdbi3.WorkflowDefinitionRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.WORKFLOW_DEFINITION);
    org.openmetadata.schema.governance.workflows.WorkflowDefinition workflowDefinition =
        workflowDefinitionRepository.get(
            null,
            instance.getWorkflowDefinitionId(),
            org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS);
    String workflowDefinitionName = workflowDefinition.getName();
    org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository stateRepo =
        (org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository)
            org.openmetadata.service.Entity.getEntityTimeSeriesRepository(
                org.openmetadata.service.Entity.WORKFLOW_INSTANCE_STATE);
    long startTs = instance.getStartedAt() != null ? instance.getStartedAt() : 0L;
    long endTs = instance.getEndedAt() != null ? instance.getEndedAt() : System.currentTimeMillis();
    ResultList<WorkflowInstanceState> states =
        stateRepo.listWorkflowInstanceStatesForInstance(
            workflowDefinitionName, workflowInstanceId, null, startTs, endTs, 100, false);

    // Print all states for debugging
    System.out.println("Workflow instance states (with reviewer rejection):");
    for (WorkflowInstanceState state : states.getData()) {
      System.out.println(state);
    }

    // Assert that the states list is present and has expected entries
    List<WorkflowInstanceState> stateList = states.getData();
    assertNotNull(stateList, "Workflow instance states should not be null");
    assertFalse(stateList.isEmpty(), "Workflow instance states should have entries");

    // Check that each entry has expected fields
    for (WorkflowInstanceState state : stateList) {
      assertNotNull(state.getStage(), "Stage should not be null");
      assertNotNull(state.getStatus(), "Status should not be null");
      assertNotNull(state.getTimestamp(), "Timestamp should not be null");
      if (state.getStage().getVariables() != null) {
        assertFalse(
            state.getStage().getVariables().isEmpty(),
            "Stage variables should not be empty if present");
      }
    }

    // Assert that the workflow instance is finished
    assertEquals(
        WorkflowInstance.WorkflowStatus.FINISHED,
        instance.getStatus(),
        "Workflow instance should be finished");
    // Assert that the term is rejected
    GlossaryTerm finalTermStatus =
        glossaryTermTest.getEntity(term.getId(), null, ADMIN_AUTH_HEADERS);
    assertEquals(Status.REJECTED, finalTermStatus.getStatus(), "Glossary term should be rejected");
  }

  // Helper: Wait for any WorkflowInstance to be created (since business key is set after process
  // start)
  private UUID waitForAnyWorkflowInstanceCreated() throws InterruptedException {
    int retries = 30;
    while (retries-- > 0) {
      // Use listWithOffset to get all WorkflowInstance objects (since listAll is not available)
      //      org.openmetadata.service.util.ResultList<WorkflowInstance> result =
      // instanceRepo.listWithOffset("0", new ListFilter(null), 100, false);
      ResultList<WorkflowInstance> result =
          instanceRepo.listWithOffset(null, new ListFilter(null), 100, false);
      List<WorkflowInstance> allInstances = result.getData();
      if (!allInstances.isEmpty()) {
        // Return the first instance (in a real test, you might filter by timestamp or other
        // criteria)
        return allInstances.getFirst().getId();
      }
      Thread.sleep(1000);
    }
    throw new AssertionError("No WorkflowInstance found in time");
  }

  // Helper: poll until the workflow instance is finished
  private WorkflowInstance waitForWorkflowInstanceCompletion(UUID instanceId)
      throws InterruptedException {
    int retries = 60;
    while (retries-- > 0) {
      WorkflowInstance instance = instanceRepo.getById(instanceId);
      if (instance != null && instance.getStatus() == WorkflowInstance.WorkflowStatus.FINISHED) {
        return instance;
      }
      Thread.sleep(1000);
    }
    throw new AssertionError("Workflow did not finish in time");
  }
}
