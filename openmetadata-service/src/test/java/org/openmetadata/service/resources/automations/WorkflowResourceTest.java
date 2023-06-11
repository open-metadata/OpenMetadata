package org.openmetadata.service.resources.automations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;

import java.io.IOException;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.automations.WorkflowResource.WorkflowList;

public class WorkflowResourceTest extends EntityResourceTest<Workflow, CreateWorkflow> {

  public WorkflowResourceTest() {
    super(Entity.WORKFLOW, Workflow.class, WorkflowList.class, "automations/workflows", WorkflowResource.FIELDS);
    supportsEmptyDescription = true;
  }

  @Override
  public CreateWorkflow createRequest(String name) {
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
                                    .withAuthType(new basicAuth().withPassword("openmetadata_password")))));
  }

  @Override
  public void validateCreatedEntity(Workflow createdEntity, CreateWorkflow request, Map<String, String> authHeaders) {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getWorkflowType(), createdEntity.getWorkflowType());
    assertNotNull(createdEntity.getRequest());
    assertNotNull(createdEntity.getOpenMetadataServerConnection());
  }

  @Override
  public void compareEntities(Workflow expected, Workflow updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getWorkflowType(), updated.getWorkflowType());
    assertEquals(expected.getStatus(), updated.getStatus());
  }

  @Override
  public Workflow validateGetWithDifferentFields(Workflow entity, boolean byName) throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwner());
    fields = "owner";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwner());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
