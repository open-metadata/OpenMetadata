package org.openmetadata.it.factories;

import java.net.URI;
import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.api.services.CreatePipelineService.PipelineServiceType;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.services.connections.pipeline.GluePipelineConnection;
import org.openmetadata.schema.type.PipelineConnection;

/**
 * Factory for creating PipelineService entities in integration tests.
 *
 * <p>Provides namespace-isolated entity creation with consistent patterns.
 */
public class PipelineServiceTestFactory {

  /**
   * Create an Airflow pipeline service with default settings. Each call creates a unique service to
   * avoid conflicts in parallel test execution.
   */
  public static PipelineService createAirflow(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("airflowService_" + uniqueId);

    AirflowConnection airflowConn =
        new AirflowConnection().withHostPort(URI.create("http://localhost:8080"));

    PipelineConnection conn = new PipelineConnection().withConfig(airflowConn);

    CreatePipelineService request =
        new CreatePipelineService()
            .withName(name)
            .withServiceType(PipelineServiceType.Airflow)
            .withConnection(conn)
            .withDescription("Test Airflow service");

    return SdkClients.adminClient().pipelineServices().create(request);
  }

  /**
   * Create a Glue pipeline service with default settings. Each call creates a unique service to
   * avoid conflicts in parallel test execution.
   */
  public static PipelineService createGlue(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("glueService_" + uniqueId);

    GluePipelineConnection glueConn =
        new GluePipelineConnection()
            .withAwsConfig(
                new org.openmetadata.schema.security.credentials.AWSCredentials()
                    .withAwsRegion("us-west-2"));

    PipelineConnection conn = new PipelineConnection().withConfig(glueConn);

    CreatePipelineService request =
        new CreatePipelineService()
            .withName(name)
            .withServiceType(PipelineServiceType.GluePipeline)
            .withConnection(conn)
            .withDescription("Test Glue service");

    return SdkClients.adminClient().pipelineServices().create(request);
  }

  /** Get pipeline service by ID. */
  public static PipelineService getById(String id) {
    return SdkClients.adminClient().pipelineServices().get(id);
  }
}
