package org.openmetadata.service.util;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
public class DeleteEntityMessage {
  @Getter @Setter private String jobId;
  @Getter @Setter private String status;
  @Getter @Setter private String entityName;
  @Getter @Setter private String error;

  public DeleteEntityMessage(String jobId, String status, String error) {
    this.jobId = jobId;
    this.status = status;
    this.error = error;
  }

  public DeleteEntityMessage(String jobId, String status, String entityName, String error) {
    this.jobId = jobId;
    this.status = status;
    this.entityName = entityName;
    this.error = error;
  }
}
