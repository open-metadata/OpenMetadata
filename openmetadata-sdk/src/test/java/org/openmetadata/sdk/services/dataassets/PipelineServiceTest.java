package org.openmetadata.sdk.services.dataassets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.Pipelines;
import org.openmetadata.sdk.fluent.wrappers.FluentPipeline;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;
import org.openmetadata.sdk.testing.EmbeddedHttpServer;
import org.openmetadata.sdk.testing.EmbeddedHttpServer.ReceivedRequest;
import org.openmetadata.sdk.testing.EmbeddedHttpServer.StubResponse;

/**
 * Exercises {@link PipelineService#listPipelineStatuses} through a real {@link
 * OpenMetadataHttpClient} against an embedded HTTP server so JSON deserialization into concrete
 * {@link PipelineStatus} instances is verified end-to-end.
 */
class PipelineServiceTest {

  private static final int PAGE_SIZE = 1000;
  private static final UUID EXECUTED_BY_ID =
      UUID.fromString("00000000-0000-0000-0000-000000000101");

  private EmbeddedHttpServer server;

  @BeforeEach
  void startServer() throws IOException {
    server = EmbeddedHttpServer.start("/v1/pipelines");
  }

  @AfterEach
  void stopServer() {
    server.close();
  }

  @Test
  void listPipelineStatusesDeserializesTypedStatusesAndNestedFields() {
    String body =
        """
        {
          "data": [
            {
              "timestamp": 1700000002000,
              "executionStatus": "Successful",
              "executionId": "run-2",
              "endTime": 1700000002500,
              "executedBy": {
                "id": "%s",
                "type": "user",
                "name": "data_engineer"
              },
              "taskStatus": [
                {
                  "name": "extract_task",
                  "executionStatus": "Successful",
                  "startTime": 1700000002000,
                  "endTime": 1700000002200
                },
                {
                  "name": "load_task",
                  "executionStatus": "Failed",
                  "startTime": 1700000002200,
                  "endTime": 1700000002500
                }
              ],
              "unknownFutureField": "tolerated"
            },
            {
              "timestamp": 1700000001000,
              "executionStatus": "Failed"
            }
          ],
          "paging": {
            "total": 2
          }
        }
        """
            .formatted(EXECUTED_BY_ID);
    server.respond(200, body);

    ListResponse<PipelineStatus> response =
        newService().listPipelineStatuses("svc.\"my pipeline\"", 1000L, 2000L, null);

    assertEquals(1, server.requests().size());
    ReceivedRequest request = server.requests().getFirst();
    assertEquals("GET", request.method());
    assertTrue(
        request.rawPath().startsWith("/api/v1/pipelines/") && request.rawPath().endsWith("/status"),
        request.rawPath());
    Map<String, String> queryParams = request.query();
    assertEquals("1000", queryParams.get("startTs"));
    assertEquals("2000", queryParams.get("endTs"));

    assertEquals(2, response.getData().size());
    assertEquals(2, response.getTotal());
    List<Long> timestamps = new ArrayList<>();
    for (PipelineStatus status : response.getData()) {
      assertNotNull(status.getTimestamp());
      assertNotNull(status.getExecutionStatus());
      timestamps.add(status.getTimestamp());
    }
    assertEquals(List.of(1700000002000L, 1700000001000L), timestamps);

    PipelineStatus first = response.getData().getFirst();
    assertEquals(StatusType.Successful, first.getExecutionStatus());
    assertEquals("run-2", first.getExecutionId());
    assertEquals(1700000002500L, first.getEndTime());
    assertNotNull(first.getExecutedBy());
    assertEquals(EXECUTED_BY_ID, first.getExecutedBy().getId());
    assertEquals("data_engineer", first.getExecutedBy().getName());
    assertNotNull(first.getTaskStatus());
    assertEquals(2, first.getTaskStatus().size());
    Status extract = first.getTaskStatus().getFirst();
    assertEquals("extract_task", extract.getName());
    assertEquals(StatusType.Successful, extract.getExecutionStatus());
    Status load = first.getTaskStatus().getLast();
    assertEquals("load_task", load.getName());
    assertEquals(StatusType.Failed, load.getExecutionStatus());

    PipelineStatus second = response.getData().getLast();
    assertEquals(StatusType.Failed, second.getExecutionStatus());
  }

  @Test
  void listPipelineStatusesReadsEveryPageOfTheRange() {
    String firstPageBody = buildStatusPageJson(0, PAGE_SIZE, "cursor-page-2", PAGE_SIZE + 3);
    String secondPageBody = buildStatusPageJson(PAGE_SIZE, 3, "cursor-end", PAGE_SIZE + 3);
    server.respondWith(
        request ->
            "cursor-page-2".equals(request.query().get("after"))
                ? StubResponse.json(200, secondPageBody)
                : StubResponse.json(200, firstPageBody));

    ListResponse<PipelineStatus> response =
        newService().listPipelineStatuses("service.pipeline", 1L, 2L);

    List<ReceivedRequest> requests = server.requests();
    assertEquals(2, requests.size());
    assertEquals(
        Map.of("startTs", "1", "endTs", "2", "limit", "1000"), requests.getFirst().query());
    assertEquals(
        Map.of("startTs", "1", "endTs", "2", "limit", "1000", "after", "cursor-page-2"),
        requests.get(1).query());

    assertEquals(PAGE_SIZE + 3, response.getData().size());
    long expectedTimestamp = 0;
    for (PipelineStatus status : response.getData()) {
      assertEquals(expectedTimestamp++, status.getTimestamp());
      assertEquals(StatusType.Successful, status.getExecutionStatus());
    }
  }

  @Test
  void listPipelineStatusesStopsWhenAFullPageHasNoCursor() {
    String fullPageBody = buildStatusPageJson(0, PAGE_SIZE, null, PAGE_SIZE);
    server.respond(200, fullPageBody);

    ListResponse<PipelineStatus> response =
        newService().listPipelineStatuses("service.pipeline", 1L, 2L);

    assertEquals(1, server.requests().size());
    assertEquals(PAGE_SIZE, response.getData().size());
    for (PipelineStatus status : response.getData()) {
      assertEquals(StatusType.Successful, status.getExecutionStatus());
    }
  }

  @Test
  void listPipelineStatusesStopsOnBlankOrRepeatingCursor() {
    String blankCursorPage = buildStatusPageJson(0, PAGE_SIZE, "   ", PAGE_SIZE);
    server.respond(200, blankCursorPage);

    ListResponse<PipelineStatus> blankResponse =
        newService().listPipelineStatuses("service.pipeline", 1L, 2L);
    assertEquals(1, server.requests().size());
    assertEquals(PAGE_SIZE, blankResponse.getData().size());

    server.clearRequests();
    String repeatingCursorPage = buildStatusPageJson(0, PAGE_SIZE, "same-cursor", PAGE_SIZE * 2);
    server.respond(200, repeatingCursorPage);

    ListResponse<PipelineStatus> repeatingResponse =
        newService().listPipelineStatuses("service.pipeline", 1L, 2L);
    assertEquals(2, server.requests().size());
    assertEquals(PAGE_SIZE * 2, repeatingResponse.getData().size());
  }

  @Test
  void listPipelineStatusesHandlesEmptyDataAndEmptyBodyResponses() {
    server.respond(200, "{\"data\":[],\"paging\":{\"total\":0}}");
    ListResponse<PipelineStatus> emptyData =
        newService().listPipelineStatuses("service.pipeline", 1L, 2L);
    assertTrue(emptyData.getData().isEmpty());
    assertEquals(0, emptyData.getTotal());

    server.respondNoContent();
    ListResponse<PipelineStatus> noContent =
        newService().listPipelineStatuses("service.pipeline", 1L, 2L);
    assertNotNull(noContent.getData());
    assertTrue(noContent.getData().isEmpty());
    assertEquals(0, noContent.getTotal());

    server.respond(200, "{\"data\":null,\"paging\":{}}");
    ListResponse<PipelineStatus> nullDataAndTotal =
        newService().listPipelineStatuses("service.pipeline", 1L, 2L, new ListParams().setLimit(5));
    assertNotNull(nullDataAndTotal.getData());
    assertTrue(nullDataAndTotal.getData().isEmpty());
    assertEquals(0, nullDataAndTotal.getTotal());
  }

  @Test
  void listPipelineStatusesPropagatesHttpErrorsAndMalformedJson() {
    server.respond(403, "{\"code\":403,\"message\":\"Access denied\"}");
    ForbiddenException forbidden =
        assertThrows(
            ForbiddenException.class,
            () -> newService().listPipelineStatuses("service.pipeline", 1L, 2L));
    assertTrue(forbidden.getMessage().contains("Access denied"));

    server.respond(404, "{\"code\":404,\"message\":\"Pipeline not found\"}");
    ApiException notFound =
        assertThrows(
            ApiException.class,
            () -> newService().listPipelineStatuses("service.pipeline", 1L, 2L));
    assertEquals(404, notFound.getStatusCode());

    server.respond(500, "{\"code\":500,\"message\":\"Server failure\"}");
    ApiException serverError =
        assertThrows(
            ApiException.class,
            () -> newService().listPipelineStatuses("service.pipeline", 1L, 2L));
    assertEquals(500, serverError.getStatusCode());

    server.respond(200, "{not-valid-json");
    assertThrows(
        OpenMetadataException.class,
        () -> newService().listPipelineStatuses("service.pipeline", 1L, 2L));
  }

  @Test
  void fluentFacadesReturnTypedPipelineStatuses() {
    String body =
        """
        {
          "data": [
            {
              "timestamp": 1700000010000,
              "executionStatus": "Successful",
              "taskStatus": [{"name": "t1", "executionStatus": "Successful"}]
            }
          ],
          "paging": {"total": 1}
        }
        """;
    server.respond(200, body);
    OpenMetadataClient client = server.client();
    Pipeline pipeline = new Pipeline().withFullyQualifiedName("service.pipeline");

    ListResponse<PipelineStatus> wrapperResponse =
        new FluentPipeline(pipeline, client).listPipelineStatuses(1L, 2L);
    assertEquals(1, wrapperResponse.getData().size());
    for (PipelineStatus status : wrapperResponse.getData()) {
      assertEquals(1700000010000L, status.getTimestamp());
      assertEquals(StatusType.Successful, status.getExecutionStatus());
    }

    ListResponse<PipelineStatus> nestedFluentResponse =
        new Pipelines.FluentPipeline(pipeline, client).listPipelineStatuses(1L, 2L);
    assertEquals(1, nestedFluentResponse.getData().size());
    for (PipelineStatus status : nestedFluentResponse.getData()) {
      assertEquals("t1", status.getTaskStatus().getFirst().getName());
    }

    try {
      Pipelines.setDefaultClient(client);
      ListResponse<PipelineStatus> staticFacadeResponse =
          Pipelines.listPipelineStatuses("service.pipeline", 1L, 2L);
      assertEquals(1, staticFacadeResponse.getData().size());
      for (PipelineStatus status : staticFacadeResponse.getData()) {
        assertEquals(1700000010000L, status.getTimestamp());
      }
    } finally {
      Pipelines.setDefaultClient(null);
    }
  }

  private PipelineService newService() {
    return new PipelineService(server.httpClient());
  }

  private static String buildStatusPageJson(int start, int count, String after, int total) {
    StringBuilder sb = new StringBuilder("{\"data\":[");
    for (int i = 0; i < count; i++) {
      if (i > 0) {
        sb.append(',');
      }
      sb.append("{\"timestamp\":").append(start + i).append(",\"executionStatus\":\"Successful\"}");
    }
    sb.append("],\"paging\":{\"total\":").append(total);
    if (after != null) {
      sb.append(",\"after\":\"").append(after).append('"');
    }
    sb.append("}}");
    return sb.toString();
  }
}
