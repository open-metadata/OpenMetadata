package org.openmetadata.service.resources.automations;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.lang.reflect.Method;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMasker;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.Authorizer;

@ExtendWith(MockitoExtension.class)
class WorkflowResourceDecryptTest {

  @Mock private Authorizer authorizer;
  @Mock private Limits limits;
  @Mock private SecurityContext securityContext;
  @Mock private SecretsManager secretsManager;
  @Mock private EntityMasker entityMasker;

  private WorkflowResource workflowResource;

  @BeforeAll
  static void initEntityRegistry() {
    Entity.registerEntity(Workflow.class, Entity.WORKFLOW, mock(WorkflowRepository.class));
  }

  @BeforeEach
  void setUp() {
    workflowResource = new WorkflowResource(authorizer, limits);
    SecretsManagerFactory.setSecretsManager(secretsManager);
    EntityMaskerFactory.setEntityMasker(entityMasker);
  }

  @AfterEach
  void tearDown() {
    SecretsManagerFactory.setSecretsManager(null);
    EntityMaskerFactory.setEntityMasker(null);
  }

  @Test
  void decryptOrNullify_doesNotReturnOpenMetadataServerConnection() throws Exception {
    Workflow workflow = buildWorkflowWithConnection();
    Workflow decryptedWorkflow = buildWorkflowWithConnection();

    when(secretsManager.decryptWorkflow(workflow)).thenReturn(decryptedWorkflow);
    doNothing().when(authorizer).authorize(any(), any(), any());
    when(authorizer.shouldMaskPasswords(securityContext)).thenReturn(false);

    Workflow result = invokeDecryptOrNullify(workflow);

    assertNull(
        result.getOpenMetadataServerConnection(),
        "SECURITY: decryptOrNullify must NOT return openMetadataServerConnection to prevent JWT token exposure");
  }

  private Workflow invokeDecryptOrNullify(Workflow workflow) throws Exception {
    Method method =
        WorkflowResource.class.getDeclaredMethod(
            "decryptOrNullify", SecurityContext.class, Workflow.class);
    method.setAccessible(true);
    return (Workflow) method.invoke(workflowResource, securityContext, workflow);
  }

  private Workflow buildWorkflowWithConnection() {
    OpenMetadataConnection connection =
        new OpenMetadataConnection()
            .withHostPort("http://localhost:8585/api")
            .withAuthProvider(AuthProvider.OPENMETADATA)
            .withSecurityConfig(new OpenMetadataJWTClientConfig().withJwtToken("test-jwt-token"));
    return new Workflow()
        .withId(UUID.randomUUID())
        .withName("test-workflow")
        .withWorkflowType(WorkflowType.TEST_CONNECTION)
        .withOpenMetadataServerConnection(connection);
  }
}
