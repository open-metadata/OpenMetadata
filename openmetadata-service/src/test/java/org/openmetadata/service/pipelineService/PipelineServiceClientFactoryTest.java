package org.openmetadata.service.pipelineService;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import io.dropwizard.testing.ResourceHelpers;
import java.io.IOException;
import javax.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientProvider;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.pipelineServiceClient.PipelineServiceClientFactory;
import org.openmetadata.service.pipelineServiceClient.airflow.AirflowRESTClient;
import org.openmetadata.service.pipelineServiceClient.argo.ArgoServiceClient;

public class PipelineServiceClientFactoryTest {

  protected static final String CONFIG_PATH = ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml");
  private OpenMetadataApplicationConfig config;

  @BeforeEach
  void setup() throws IOException, ConfigurationException {
    // Get config object from test yaml file
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    Validator validator = Validators.newValidator();
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(OpenMetadataApplicationConfig.class, validator, objectMapper, "dw");
    config = factory.build(new FileConfigurationSourceProvider(), CONFIG_PATH);
  }

  @Test
  void testDefaultIsCreatedIfNullConfig() {
    config.getPipelineServiceClientConfiguration().setPipelineServiceClient(null);
    assertTrue(PipelineServiceClientFactory.createPipelineServiceClient(config) instanceof AirflowRESTClient);
  }

  @Test
  void testIsCreatedIfAirflowProvider() {
    config.getPipelineServiceClientConfiguration().setPipelineServiceClient(PipelineServiceClientProvider.AIRFLOW);
    assertTrue(PipelineServiceClientFactory.createPipelineServiceClient(config) instanceof AirflowRESTClient);
  }

  @Test
  void testIsCreatedIfArgoProvider() {
    config.getPipelineServiceClientConfiguration().setPipelineServiceClient(PipelineServiceClientProvider.ARGO);
    assertTrue(PipelineServiceClientFactory.createPipelineServiceClient(config) instanceof ArgoServiceClient);
  }
}
