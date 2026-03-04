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
  @Getter @Setter private Long progress;
  @Getter @Setter private Long total;
  @Getter @Setter private String message;

  public BulkAssetsOperationMessage(
      String jobId, String status, BulkOperationResult result, String error) {
    this(jobId, status, result, error, null, null, null);
  }

  public BulkAssetsOperationMessage(
      String jobId,
      String status,
      BulkOperationResult result,
      String error,
      Long progress,
      Long total,
      String message) {
    this.jobId = jobId;
    this.status = status;
    this.result = result;
    this.error = error;
    this.progress = progress;
    this.total = total;
    this.message = message;
  }
}
