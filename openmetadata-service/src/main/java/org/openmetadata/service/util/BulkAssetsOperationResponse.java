package org.openmetadata.service.util;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
public class BulkAssetsOperationResponse {
  @Getter @Setter private String jobId;
  @Getter @Setter private String message;

  public BulkAssetsOperationResponse(String jobId, String message) {
    this.jobId = jobId;
    this.message = message;
  }
}
