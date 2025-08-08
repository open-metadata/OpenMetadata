package org.openmetadata.service.socket.messages;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
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
      String serviceName,
      Long timestamp,
      Map<String, DataInsightCustomChartResultList> data,
      String error,
      Long remainingTime,
      Long nextUpdate,
      List<Map> ingestionPipelineStatus,
      List<Map> appStatus,
      List<Map> workflowInstances) {
    this.sessionId = sessionId;
    this.status = status;
    this.serviceName = serviceName;
    this.timestamp = timestamp;
    this.data = data;
    this.error = error;
    this.remainingTime = remainingTime;
    this.nextUpdate = nextUpdate;
    this.ingestionPipelineStatus = ingestionPipelineStatus;
    this.appStatus = appStatus;
    this.workflowInstances = workflowInstances;
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

  @JsonProperty("serviceName")
  private String serviceName;

  @JsonProperty("nextUpdate")
  private Long nextUpdate; // milliseconds until next update

  @JsonProperty("ingestionPipelineStatus")
  private List<Map> ingestionPipelineStatus;

  @JsonProperty("appStatus")
  private List<Map> appStatus;

  @JsonProperty("workflowInstances")
  private List<Map> workflowInstances;
}
