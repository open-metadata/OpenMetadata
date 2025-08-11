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

  public CSVExportMessage(String jobId, String status, String data, String error) {
    this.jobId = jobId;
    this.status = status;
    this.data = data;
    this.error = error;
  }
}
