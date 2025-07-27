package org.openmetadata.service.util;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
public class MoveGlossaryTermMessage {
  @Getter @Setter private String jobId;
  @Getter @Setter private String status;
  @Getter @Setter private String entityName;
  @Getter @Setter private String error;
  @Getter @Setter private String fullyQualifiedName;

  public MoveGlossaryTermMessage(String jobId, String status, String error) {
    this.jobId = jobId;
    this.status = status;
    this.error = error;
  }

  public MoveGlossaryTermMessage(
      String jobId, String status, String entityName, String fullyQualifiedName, String error) {
    this.jobId = jobId;
    this.status = status;
    this.entityName = entityName;
    this.error = error;
    this.fullyQualifiedName = fullyQualifiedName;
  }
}
