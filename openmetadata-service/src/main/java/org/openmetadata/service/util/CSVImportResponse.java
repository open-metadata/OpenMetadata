package org.openmetadata.service.util;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
public class CSVImportResponse {
  @Getter @Setter private String jobId;
  @Getter @Setter private String message;

  public CSVImportResponse(String jobId, String message) {
    this.jobId = jobId;
    this.message = message;
  }
}
