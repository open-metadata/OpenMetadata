package org.openmetadata.service.pipelineService;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
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

  @Test
  public void testGetQueuedPipelineStatusSwallowsInternalException() {
    MockPipelineServiceClient throwingClient =
        new MockPipelineServiceClient(enabledConfig()) {
          @Override
          public List<PipelineStatus> getQueuedPipelineStatusInternal(
              IngestionPipeline ingestionPipeline) {
            throw new UnsupportedOperationException(
                "ingestionRunner instance for 80c36f72-5b0d-4ec9-a883-d9a70c02ad4f not found");
          }
        };

    List<PipelineStatus> result =
        throwingClient.getQueuedPipelineStatus(
            new IngestionPipeline().withFullyQualifiedName("test.pipeline"));

    assertNotNull(result);
    assertTrue(result.isEmpty());
  }

  @Test
  public void testGetQueuedPipelineStatusReturnsMutableListEvenWhenInternalReturnsImmutable() {
    MockPipelineServiceClient immutableEmptyClient =
        new MockPipelineServiceClient(enabledConfig()) {
          @Override
          public List<PipelineStatus> getQueuedPipelineStatusInternal(
              IngestionPipeline ingestionPipeline) {
            return Collections.emptyList();
          }
        };

    List<PipelineStatus> result =
        immutableEmptyClient.getQueuedPipelineStatus(
            new IngestionPipeline().withFullyQualifiedName("test.pipeline"));

    assertNotNull(result);
    assertTrue(result.isEmpty());
    assertDoesNotThrow(() -> result.add(new PipelineStatus()));
  }

  @Test
  public void testGetQueuedPipelineStatusReturnsEmptyWhenDisabled() {
    PipelineServiceClientConfiguration disabledConfig =
        new PipelineServiceClientConfiguration()
            .withEnabled(false)
            .withClassName("")
            .withMetadataApiEndpoint("http://openmetadata-server:8585/api")
            .withApiEndpoint("http://ingestion:8080");
    MockPipelineServiceClient throwingIfInvoked =
        new MockPipelineServiceClient(disabledConfig) {
          @Override
          public List<PipelineStatus> getQueuedPipelineStatusInternal(
              IngestionPipeline ingestionPipeline) {
            throw new AssertionError("Should not be invoked when client is disabled");
          }
        };

    List<PipelineStatus> result =
        throwingIfInvoked.getQueuedPipelineStatus(
            new IngestionPipeline().withFullyQualifiedName("test.pipeline"));

    assertNotNull(result);
    assertTrue(result.isEmpty());
  }

  private static PipelineServiceClientConfiguration enabledConfig() {
    return new PipelineServiceClientConfiguration()
        .withEnabled(true)
        .withClassName("")
        .withMetadataApiEndpoint("http://openmetadata-server:8585/api")
        .withApiEndpoint("http://ingestion:8080");
  }
}
