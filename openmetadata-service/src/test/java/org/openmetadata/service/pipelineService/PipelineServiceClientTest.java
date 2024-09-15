package org.openmetadata.service.pipelineService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.sdk.exception.PipelineServiceVersionException;

public class PipelineServiceClientTest {

  final MockPipelineServiceClient mockPipelineServiceClient =
      new MockPipelineServiceClient(
          new PipelineServiceClientConfiguration()
              .withClassName("")
              .withMetadataApiEndpoint("http://openmetadata-server:8585/api")
              .withApiEndpoint("http://ingestion:8080"));

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

  @Test
  public void testBuildVersionMismatchErrorMessage() {
    String res = mockPipelineServiceClient.buildVersionMismatchErrorMessage("1.1.0.dev0", "1.0.0");
    assertEquals(
        "Server version [1.0.0] is older than Ingestion Version [1.1.0.dev0]. Please upgrade your server or downgrade the ingestion client.",
        res);

    res = mockPipelineServiceClient.buildVersionMismatchErrorMessage("1.0.0.dev0", "1.0.1");
    assertEquals(
        "Ingestion version [1.0.0.dev0] is older than Server Version [1.0.1]. Please upgrade your ingestion client.",
        res);
  }
}
