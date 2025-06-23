package org.openmetadata.service.util;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
public class MoveEntityResponse {
  @Getter @Setter private String jobId;
  @Getter @Setter private String message;
  @Getter @Setter private String entityName;

  public MoveEntityResponse(String jobId, String message) {
    this.jobId = jobId;
    this.message = message;
  }

  public MoveEntityResponse(String jobId, String message, String entityName) {
    this.jobId = jobId;
    this.message = message;
    this.entityName = entityName;
  }
}
