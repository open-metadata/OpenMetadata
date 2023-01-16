package org.openmetadata.service.pipelineService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.openmetadata.sdk.exception.PipelineServiceVersionException;

public class PipelineServiceClientTest {

  final MockPipelineServiceClient mockPipelineServiceClient =
      new MockPipelineServiceClient("user", "password", "https://endpoint.com", "111.11.11.1", 10);

  @Test
  public void testGetVersionFromString() {
    String version = mockPipelineServiceClient.getVersionFromString("0.12.0.dev0");
    assertEquals("0.12.0", version);
  }

  @Test
  public void testGetVersionFromStringRaises() {
    Exception exception =
        assertThrows(
            PipelineServiceVersionException.class, () -> mockPipelineServiceClient.getVersionFromString("random"));

    String expectedMessage = "Cannot extract version x.y.z from random";
    String actualMessage = exception.getMessage();

    assertEquals(expectedMessage, actualMessage);
  }
}
