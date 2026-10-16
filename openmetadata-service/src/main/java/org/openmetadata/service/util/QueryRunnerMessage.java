package org.openmetadata.service.util;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
public class QueryRunnerMessage {
  @Getter @Setter private String jobId;
  @Getter @Setter private String status;
  @Getter @Setter private String workflowId;
  @Getter @Setter private String error;
  @Getter @Setter private String message;
  @Getter @Setter private Double duration;
  @Getter @Setter private String executedQuery;

  public QueryRunnerMessage(
      String jobId,
      String status,
      String workflowId,
      String error,
      String message,
      Double duration,
      String executedQuery) {
    this.jobId = jobId;
    this.status = status;
    this.workflowId = workflowId;
    this.error = error;
    this.message = message;
    this.duration = duration;
    this.executedQuery = executedQuery;
  }
}
