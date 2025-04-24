package org.openmetadata.service.util;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
public class DeleteEntityResponse {
  @Getter @Setter private String jobId;
  @Getter @Setter private String message;
  @Getter @Setter private String entityName;
  @Getter @Setter private boolean hardDelete;
  @Getter @Setter private boolean recursive;

  public DeleteEntityResponse(String jobId, String message, boolean hardDelete, boolean recursive) {
    this.jobId = jobId;
    this.message = message;
    this.hardDelete = hardDelete;
    this.recursive = recursive;
  }

  public DeleteEntityResponse(
      String jobId, String message, String entityName, boolean hardDelete, boolean recursive) {
    this.jobId = jobId;
    this.message = message;
    this.entityName = entityName;
    this.hardDelete = hardDelete;
    this.recursive = recursive;
  }
}
