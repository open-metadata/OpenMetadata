package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.QueryRunnerRequest;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowStatus;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionStepResult;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

@Isolated
class WorkflowRepositoryUpdateTest {
  private static final String STORED_PASSWORD = "fernet:stored-service-password";
  private WorkflowRepository repository;

  @BeforeEach
  void setUp() {
    Entity.setCollectionDAO(mock(CollectionDAO.class));
    repository = new WorkflowRepository();
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(null);
    Entity.cleanup();
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityRepository.Operation.class,
      names = {"PUT", "PATCH"})
  void updateCannotRetargetStoredConnection(EntityRepository.Operation operation) {
    final Workflow original = storedWorkflow();
    final Workflow updated =
        JsonUtils.deepCopy(original, Workflow.class)
            .withRequest(
                connectionRequest("other-service", "alternate.example.net:3306", STORED_PASSWORD))
            .withStatus(WorkflowStatus.RUNNING);

    applyUpdate(original, updated, operation);

    assertEquals(original.getRequest(), updated.getRequest());
    assertEquals(WorkflowType.TEST_CONNECTION, updated.getWorkflowType());
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityRepository.Operation.class,
      names = {"PUT", "PATCH"})
  void updateCannotSwitchWorkflowType(EntityRepository.Operation operation) {
    final Workflow original = storedWorkflow();
    final Workflow updated =
        JsonUtils.deepCopy(original, Workflow.class)
            .withWorkflowType(WorkflowType.QUERY_RUNNER)
            .withRequest(
                new QueryRunnerRequest().withUserId(UUID.randomUUID()).withQuery("SELECT 1"))
            .withStatus(WorkflowStatus.RUNNING);

    applyUpdate(original, updated, operation);

    assertEquals(WorkflowType.TEST_CONNECTION, updated.getWorkflowType());
    assertEquals(original.getRequest(), updated.getRequest());
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityRepository.Operation.class,
      names = {"PUT", "PATCH"})
  void runnerCanReportResultsWithDecryptedRequest(EntityRepository.Operation operation) {
    final Workflow original = storedWorkflow();
    final TestConnectionResult result =
        new TestConnectionResult()
            .withSteps(
                List.of(new TestConnectionStepResult().withName("Connect").withPassed(false)));
    final Workflow updated =
        JsonUtils.deepCopy(original, Workflow.class)
            .withRequest(
                connectionRequest("prod-mysql", "prod-mysql.internal:3306", "decrypted-password"))
            .withStatus(WorkflowStatus.FAILED)
            .withResponse(result);

    final ChangeDescription changes = applyUpdate(original, updated, operation);

    assertEquals(original.getRequest(), updated.getRequest());
    assertEquals(WorkflowStatus.FAILED, updated.getStatus());
    assertEquals(result, updated.getResponse());
    assertEquals(
        Set.of("status"),
        changes.getFieldsUpdated().stream().map(FieldChange::getName).collect(Collectors.toSet()));
    assertEquals("response", changes.getFieldsAdded().getFirst().getName());
  }

  private ChangeDescription applyUpdate(
      Workflow original, Workflow updated, EntityRepository.Operation operation) {
    final WorkflowRepository.WorkflowUpdater updater =
        repository.new WorkflowUpdater(original, updated, operation);
    updater.changeDescription = new ChangeDescription();
    updater.entitySpecificUpdate(false);
    return updater.changeDescription;
  }

  private Workflow storedWorkflow() {
    return JsonUtils.deepCopy(
        new Workflow()
            .withId(UUID.randomUUID())
            .withName("test-connection")
            .withFullyQualifiedName("test-connection")
            .withUpdatedBy("admin")
            .withWorkflowType(WorkflowType.TEST_CONNECTION)
            .withStatus(WorkflowStatus.PENDING)
            .withRequest(
                connectionRequest("prod-mysql", "prod-mysql.internal:3306", STORED_PASSWORD)),
        Workflow.class);
  }

  private TestServiceConnectionRequest connectionRequest(
      String serviceName, String hostPort, String password) {
    return new TestServiceConnectionRequest()
        .withServiceType(ServiceType.DATABASE)
        .withServiceName(serviceName)
        .withConnectionType("Mysql")
        .withConnection(
            new DatabaseConnection()
                .withConfig(
                    new MysqlConnection()
                        .withHostPort(hostPort)
                        .withUsername("etl")
                        .withAuthType(new basicAuth().withPassword(password))));
  }
}
