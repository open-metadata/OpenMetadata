package org.openmetadata.service.clients.pipeline;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.exception.PipelineServiceVersionException;

public class PipelineServiceClientTest {

  static MockPipelineServiceClient mockPipelineServiceClient;

  @BeforeAll
  static void setUp() {
    PipelineServiceClientConfiguration pipelineServiceClientConfiguration =
        new PipelineServiceClientConfiguration();
    pipelineServiceClientConfiguration.setHostIp("111.11.11.1");
    pipelineServiceClientConfiguration.setMetadataApiEndpoint("http://localhost:8585/api");

    mockPipelineServiceClient = new MockPipelineServiceClient(pipelineServiceClientConfiguration);
  }

  @Test
  public void testGetVersionFromString() {
    String version = mockPipelineServiceClient.getVersionFromString("0.12.0.dev0");
    assertEquals("0.12.0", version);
  }

  @Test
  public void testGetVersionFromStringRaises() {
    Exception exception =
        assertThrows(
            PipelineServiceVersionException.class,
            () -> mockPipelineServiceClient.getVersionFromString("random"));

    String expectedMessage = "Cannot extract version x.y.z from random";
    String actualMessage = exception.getMessage();

    assertEquals(expectedMessage, actualMessage);
  }
}
