package org.openmetadata.service.util;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
public class CSVExportMessage {
  @Getter @Setter private String jobId;
  @Getter @Setter private String status;
  @Getter @Setter private String data;
  @Getter @Setter private String error;
  @Getter @Setter private Integer progress;
  @Getter @Setter private Integer total;
  @Getter @Setter private String message;

  public CSVExportMessage(String jobId, String status, String data, String error) {
    this.jobId = jobId;
    this.status = status;
    this.data = data;
    this.error = error;
  }

  public CSVExportMessage(
      String jobId,
      String status,
      String data,
      String error,
      Integer progress,
      Integer total,
      String message) {
    this.jobId = jobId;
    this.status = status;
    this.data = data;
    this.error = error;
    this.progress = progress;
    this.total = total;
    this.message = message;
  }
}
