package org.openmetadata.service.jobs;

import java.sql.Timestamp;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class BackgroundJob {
  /**
   * Unique identifier for the job. This field is auto-incremented.
   */
  private long id;

  /**
   * Type of the job (e.g., "PROPERTY_ENUM_CLEANUP").
   */
  private String jobType;

  /**
   * JobHandler name of the method that will be executed for this job.
   */
  private String methodName;

  /**
   * Json object containing the arguments for the job.
   */
  private Map<String, Object> jobArgs;

  /**
   * Current status of the job (e.g., "COMPLETED", "FAILED","PENDING").
   */
  private String status;

  /**
   *  User or Bot who triggered the background job.
   */
  private String createdBy;

  /**
   * Timestamp when the job was created.
   */
  private Timestamp createdAt;

  /**
   * Timestamp when the job was last updated.
   */
  private Timestamp updatedAt;
}
