package org.openmetadata.service.util;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.openmetadata.schema.type.api.BulkOperationResult;

@NoArgsConstructor
public class BulkAssetsOperationMessage {
  @Getter @Setter private String jobId;
  @Getter @Setter private String status;
  @Getter @Setter private BulkOperationResult result;
  @Getter @Setter private String error;

  public BulkAssetsOperationMessage(
      String jobId, String status, BulkOperationResult result, String error) {
    this.jobId = jobId;
    this.status = status;
    this.result = result;
    this.error = error;
  }
}
