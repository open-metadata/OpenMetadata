package org.openmetadata.sdk.services.dataassets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.stream.LongStream;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

class PipelineServiceTest {
  private static final String STATUS_PATH =
      "/v1/pipelines/service.pipeline/status?startTs=1&endTs=2";
  private static final int PAGE_SIZE = 1000;

  @Test
  void listPipelineStatusesReadsEveryPageOfTheRange() {
    HttpClient httpClient = mock(HttpClient.class);
    ResultList<PipelineStatus> full = new ResultList<>(statuses(PAGE_SIZE), null, "1000", 1003);
    ResultList<PipelineStatus> last = new ResultList<>(statuses(3), null, "1003", 1003);
    when(httpClient.execute(
            eq(HttpMethod.GET), eq(STATUS_PATH), isNull(), any(), any(RequestOptions.class)))
        .thenReturn(full, last);

    ListResponse<PipelineStatus> response =
        new PipelineService(httpClient).listPipelineStatuses("service.pipeline", 1L, 2L);

    assertEquals(PAGE_SIZE + 3, response.getData().size());
    ArgumentCaptor<RequestOptions> requests = ArgumentCaptor.forClass(RequestOptions.class);
    verify(httpClient, times(2))
        .execute(eq(HttpMethod.GET), eq(STATUS_PATH), isNull(), any(), requests.capture());
    assertEquals(Map.of("limit", "1000"), requests.getAllValues().get(0).getQueryParams());
    assertEquals(
        Map.of("limit", "1000", "after", full.getPaging().getAfter()),
        requests.getAllValues().get(1).getQueryParams());
  }

  @Test
  void listPipelineStatusesStopsWhenAFullPageHasNoCursor() {
    HttpClient httpClient = mock(HttpClient.class);
    when(httpClient.execute(
            eq(HttpMethod.GET), eq(STATUS_PATH), isNull(), any(), any(RequestOptions.class)))
        .thenReturn(new ResultList<>(statuses(PAGE_SIZE), null, null, PAGE_SIZE));

    ListResponse<PipelineStatus> response =
        new PipelineService(httpClient).listPipelineStatuses("service.pipeline", 1L, 2L);

    assertEquals(PAGE_SIZE, response.getData().size());
    verify(httpClient, times(1))
        .execute(eq(HttpMethod.GET), eq(STATUS_PATH), isNull(), any(), any(RequestOptions.class));
  }

  private static List<PipelineStatus> statuses(int count) {
    return LongStream.range(0, count)
        .mapToObj(
            timestamp ->
                new PipelineStatus()
                    .withTimestamp(timestamp)
                    .withExecutionStatus(StatusType.Successful))
        .toList();
  }
}
