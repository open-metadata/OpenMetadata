package org.openmetadata.service.socket.messages;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;

@Data
@NoArgsConstructor
public class ChartDataStreamMessage {

  public ChartDataStreamMessage(
      String sessionId,
      String status,
      Long timestamp,
      Map<String, DataInsightCustomChartResultList> data,
      String error,
      Long remainingTime,
      Long nextUpdate) {
    this.sessionId = sessionId;
    this.status = status;
    this.timestamp = timestamp;
    this.data = data;
    this.error = error;
    this.remainingTime = remainingTime;
    this.nextUpdate = nextUpdate;
  }

  @JsonProperty("sessionId")
  private String sessionId;

  @JsonProperty("status")
  private String status; // STARTED, DATA, COMPLETED, FAILED

  @JsonProperty("timestamp")
  private Long timestamp;

  @JsonProperty("data")
  private Map<String, DataInsightCustomChartResultList> data;

  @JsonProperty("error")
  private String error;

  @JsonProperty("remainingTime")
  private Long remainingTime; // milliseconds remaining

  @JsonProperty("nextUpdate")
  private Long nextUpdate; // milliseconds until next update
}
