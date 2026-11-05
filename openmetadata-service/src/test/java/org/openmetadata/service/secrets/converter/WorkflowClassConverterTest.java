package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.secrets.converter.TestServiceConnectionRequestClassConverterTest.athenaConfig;
import static org.openmetadata.service.secrets.converter.TestServiceConnectionRequestClassConverterTest.testConnectionRequest;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.automations.QueryRunnerRequest;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.TestSparkEngineConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.metadataIngestion.ReverseIngestionPipeline;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.service.exception.InvalidServiceConnectionException;

class WorkflowClassConverterTest {

  private final ClassConverter converter = ClassConverterFactory.getConverter(Workflow.class);

  @Test
  void invalidTestConnectionRequestReportsItsOwnErrorInsteadOfAGenericOne() {
    Map<String, Object> workflow =
        workflow(
            WorkflowType.TEST_CONNECTION,
            testConnectionRequest("Athena", athenaConfig("s3://bucket/athena results/")));

    InvalidServiceConnectionException failure =
        assertThrows(InvalidServiceConnectionException.class, () -> converter.convert(workflow));

    assertEquals(
        "Invalid Athena connection: 's3StagingDir' must be a valid URI "
            + "(Illegal character in path at index 18)",
        failure.getMessage());
  }

  static Stream<Arguments> requestPerWorkflowType() {
    return Stream.of(
        Arguments.of(
            WorkflowType.TEST_CONNECTION,
            testConnectionRequest("Athena", athenaConfig("s3://bucket/results/")),
            TestServiceConnectionRequest.class),
        Arguments.of(
            WorkflowType.REVERSE_INGESTION,
            Map.of(
                "type", "ReverseIngestion",
                "service", Map.of("id", UUID.randomUUID().toString(), "type", "databaseService"),
                "operations", List.of()),
            ReverseIngestionPipeline.class),
        Arguments.of(
            WorkflowType.QUERY_RUNNER,
            Map.of(
                "connectionType", "Athena", "serviceName", "athena_service", "query", "SELECT 1"),
            QueryRunnerRequest.class),
        Arguments.of(
            WorkflowType.TEST_SPARK_ENGINE_CONNECTION,
            Map.of("sparkEngine", Map.of("type", "Spark", "remote", "sc://localhost:15002")),
            TestSparkEngineConnectionRequest.class));
  }

  @ParameterizedTest
  @MethodSource("requestPerWorkflowType")
  void eachWorkflowTypeConvertsToItsRequestClass(
      WorkflowType workflowType, Map<String, Object> request, Class<?> requestClass) {
    Workflow converted = (Workflow) converter.convert(workflow(workflowType, request));

    assertInstanceOf(requestClass, converted.getRequest());
  }

  /**
   * Its keys are a subset of a test-connection request's, so trying request classes in turn would
   * read it as a broken test connection.
   */
  @Test
  void minimalQueryRunnerRequestStaysAQueryRunnerRequest() {
    Map<String, Object> request =
        Map.of("connectionType", "Athena", "serviceName", "athena_service");

    Workflow converted = (Workflow) converter.convert(workflow(WorkflowType.QUERY_RUNNER, request));

    assertInstanceOf(QueryRunnerRequest.class, converted.getRequest());
  }

  @Test
  void workflowWithoutTypeStillResolvesItsRequest() {
    Map<String, Object> request =
        testConnectionRequest("Athena", athenaConfig("s3://bucket/results/"));

    Workflow converted = (Workflow) converter.convert(workflow(null, request));

    assertInstanceOf(TestServiceConnectionRequest.class, converted.getRequest());
  }

  @Test
  void workflowWithoutRequestKeepsItEmpty() {
    Workflow converted = (Workflow) converter.convert(workflow(WorkflowType.TEST_CONNECTION, null));

    assertNull(converted.getRequest());
  }

  @Test
  void serverConnectionNestedConfigIsTyped() {
    Map<String, Object> workflow =
        workflow(
            WorkflowType.TEST_CONNECTION,
            testConnectionRequest("Athena", athenaConfig("s3://bucket/results/")));
    workflow.put(
        "openMetadataServerConnection",
        Map.of(
            "hostPort",
            "http://localhost:8585/api",
            "sslConfig",
            Map.of("caCertificate", "/certs/ca.pem")));

    Workflow converted = (Workflow) converter.convert(workflow);

    assertInstanceOf(
        ValidateSSLClientConfig.class, converted.getOpenMetadataServerConnection().getSslConfig());
  }

  private static Map<String, Object> workflow(WorkflowType workflowType, Object request) {
    Map<String, Object> workflow = new HashMap<>();
    workflow.put("id", UUID.randomUUID().toString());
    workflow.put("name", "athena_test_connection");
    workflow.put("workflowType", workflowType == null ? null : workflowType.value());
    workflow.put("request", request);
    return workflow;
  }
}
