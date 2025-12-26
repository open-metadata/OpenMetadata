package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowStatus;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for Workflow entity operations.
 *
 * <p>Tests workflow creation, listing, retrieval, and filtering. Workflows are automation units
 * that trigger API calls to the OpenMetadata server.
 *
 * <p>Migrated from: org.openmetadata.service.resources.automations.WorkflowResourceTest
 *
 * <p>Test isolation: Uses TestNamespace for unique entity names Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class WorkflowResourceIT {

  private static final Logger LOG = LoggerFactory.getLogger(WorkflowResourceIT.class);

  private CreateWorkflow createRequest(String name) {
    return new CreateWorkflow()
        .withName(name)
        .withDescription(name)
        .withWorkflowType(WorkflowType.TEST_CONNECTION)
        .withRequest(
            new TestServiceConnectionRequest()
                .withServiceType(ServiceType.DATABASE)
                .withConnectionType("Mysql")
                .withConnection(
                    new DatabaseConnection()
                        .withConfig(
                            new MysqlConnection()
                                .withHostPort("mysql:3306")
                                .withUsername("openmetadata_user")
                                .withAuthType(
                                    new basicAuth().withPassword("openmetadata_password")))));
  }

  @Test
  void post_workflowCreate_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = ns.prefix("workflow");

    CreateWorkflow createRequest = createRequest(workflowName);
    Workflow workflow = client.workflows().create(createRequest);

    assertNotNull(workflow);
    assertNotNull(workflow.getId());
    assertEquals(workflowName, workflow.getName());
    assertEquals(WorkflowType.TEST_CONNECTION, workflow.getWorkflowType());
    assertNotNull(workflow.getRequest());
    assertNotNull(workflow.getOpenMetadataServerConnection());
  }

  @Test
  void get_workflowById_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = ns.prefix("getById");

    CreateWorkflow createRequest = createRequest(workflowName);
    Workflow created = client.workflows().create(createRequest);

    Workflow fetched = client.workflows().get(created.getId().toString());
    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
    assertEquals(created.getWorkflowType(), fetched.getWorkflowType());
  }

  @Test
  void get_workflowByName_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = ns.prefix("getByName");

    CreateWorkflow createRequest = createRequest(workflowName);
    Workflow created = client.workflows().create(createRequest);

    Workflow fetched = client.workflows().getByName(created.getFullyQualifiedName());
    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
  }

  @Test
  void get_listWorkflows_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 3; i++) {
      String workflowName = ns.prefix("listWorkflow" + i);
      CreateWorkflow createRequest = createRequest(workflowName);
      client.workflows().create(createRequest);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Workflow> response = client.workflows().list(params);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void get_listWorkflowsFiltered_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String successfulName = ns.prefix("successfulWorkflow");
    CreateWorkflow successfulRequest =
        createRequest(successfulName).withStatus(WorkflowStatus.SUCCESSFUL);
    Workflow successfulWorkflow = client.workflows().create(successfulRequest);

    String runningName = ns.prefix("runningWorkflow");
    CreateWorkflow runningRequest = createRequest(runningName).withStatus(WorkflowStatus.RUNNING);
    Workflow runningWorkflow = client.workflows().create(runningRequest);

    ListParams successParams = new ListParams();
    successParams.setLimit(100);
    successParams.addFilter("workflowStatus", WorkflowStatus.SUCCESSFUL.value());
    ListResponse<Workflow> successResponse = client.workflows().list(successParams);

    assertNotNull(successResponse);
    assertNotNull(successResponse.getData());
    assertTrue(
        successResponse.getData().stream()
            .anyMatch(w -> w.getId().equals(successfulWorkflow.getId())),
        "Successful workflow should be in filtered list");

    ListParams runningParams = new ListParams();
    runningParams.setLimit(100);
    runningParams.addFilter("workflowStatus", WorkflowStatus.RUNNING.value());
    ListResponse<Workflow> runningResponse = client.workflows().list(runningParams);

    assertNotNull(runningResponse);
    assertNotNull(runningResponse.getData());
    assertTrue(
        runningResponse.getData().stream().anyMatch(w -> w.getId().equals(runningWorkflow.getId())),
        "Running workflow should be in filtered list");
  }

  @Test
  void get_workflowWithFields_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = ns.prefix("withFields");

    CreateWorkflow createRequest = createRequest(workflowName);
    Workflow created = client.workflows().create(createRequest);

    Workflow withoutOwners = client.workflows().get(created.getId().toString(), "");
    assertTrue(withoutOwners.getOwners() == null || withoutOwners.getOwners().isEmpty());

    Workflow withOwners = client.workflows().get(created.getId().toString(), "owners");
    assertNotNull(withOwners.getOwners());
  }

  @Test
  void put_workflowUpdate_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = ns.prefix("updateWorkflow");

    CreateWorkflow createRequest = createRequest(workflowName);
    Workflow created = client.workflows().create(createRequest);

    created.setDescription("Updated description");
    Workflow updated = client.workflows().update(created.getId().toString(), created);

    assertNotNull(updated);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void delete_workflow_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = ns.prefix("deleteWorkflow");

    CreateWorkflow createRequest = createRequest(workflowName);
    Workflow created = client.workflows().create(createRequest);

    client.workflows().delete(created.getId().toString());

    assertThrows(
        Exception.class,
        () -> client.workflows().get(created.getId().toString()),
        "Deleted workflow should not be retrievable");
  }

  @Test
  void post_workflowWithDifferentTypes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String workflowName = ns.prefix("testConnectionWorkflow");
    CreateWorkflow createRequest =
        createRequest(workflowName).withWorkflowType(WorkflowType.TEST_CONNECTION);
    Workflow workflow = client.workflows().create(createRequest);

    assertNotNull(workflow);
    assertEquals(WorkflowType.TEST_CONNECTION, workflow.getWorkflowType());
  }

  @Test
  void get_workflowVersion_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = ns.prefix("versionWorkflow");

    CreateWorkflow createRequest = createRequest(workflowName);
    Workflow created = client.workflows().create(createRequest);
    assertEquals(0.1, created.getVersion(), 0.001);

    created.setDescription("Updated description v1");
    Workflow v2 = client.workflows().update(created.getId().toString(), created);
    assertTrue(v2.getVersion() >= 0.1);
  }

  @Test
  void post_workflowWithStatus_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = ns.prefix("statusWorkflow");

    CreateWorkflow createRequest = createRequest(workflowName).withStatus(WorkflowStatus.PENDING);
    Workflow workflow = client.workflows().create(createRequest);

    assertNotNull(workflow);
    assertEquals(WorkflowStatus.PENDING, workflow.getStatus());
  }

  @Test
  void get_listWorkflowsPagination_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 5; i++) {
      String workflowName = ns.prefix("paginateWorkflow" + i);
      CreateWorkflow createRequest = createRequest(workflowName);
      client.workflows().create(createRequest);
    }

    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<Workflow> page1 = client.workflows().list(params);

    assertNotNull(page1);
    assertNotNull(page1.getData());
    assertEquals(2, page1.getData().size());
    assertNotNull(page1.getPaging());

    if (page1.getPaging().getAfter() != null) {
      params.setAfter(page1.getPaging().getAfter());
      ListResponse<Workflow> page2 = client.workflows().list(params);
      assertNotNull(page2.getData());
      assertTrue(page2.getData().size() > 0);
    }
  }

  @Test
  void post_workflowNameUniqueness_409(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = ns.prefix("uniqueWorkflow");

    CreateWorkflow createRequest = createRequest(workflowName);
    Workflow workflow1 = client.workflows().create(createRequest);
    assertNotNull(workflow1);

    CreateWorkflow duplicateRequest = createRequest(workflowName);
    assertThrows(
        Exception.class,
        () -> client.workflows().create(duplicateRequest),
        "Creating duplicate workflow with same name should fail");
  }

  @Test
  void get_workflowFQN_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = ns.prefix("fqnWorkflow");

    CreateWorkflow createRequest = createRequest(workflowName);
    Workflow workflow = client.workflows().create(createRequest);

    assertNotNull(workflow.getFullyQualifiedName());
    assertTrue(workflow.getFullyQualifiedName().contains(workflow.getName()));
  }

  @Test
  void get_workflowHref_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = ns.prefix("hrefWorkflow");

    CreateWorkflow createRequest = createRequest(workflowName);
    Workflow workflow = client.workflows().create(createRequest);

    assertNotNull(workflow.getHref());
  }
}
