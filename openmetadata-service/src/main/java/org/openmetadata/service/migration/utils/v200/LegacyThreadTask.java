package org.openmetadata.service.migration.utils.v200;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.type.TagLabelRecognizerMetadata;

/** Reads pre-2.1 task rows without exposing the retired task facet in the public Thread schema. */
@JsonIgnoreProperties(ignoreUnknown = true)
record LegacyThreadTask(
    UUID id,
    String about,
    EntityReference entityRef,
    String message,
    String createdBy,
    Long threadTs,
    Long updatedAt,
    String updatedBy,
    List<Post> posts,
    Details task) {

  @JsonIgnoreProperties(ignoreUnknown = true)
  record Details(
      Integer id,
      TaskType type,
      List<EntityReference> assignees,
      TaskStatus status,
      String closedBy,
      Long closedAt,
      String oldValue,
      String suggestion,
      String newValue,
      UUID testCaseResolutionStatusId,
      RecognizerFeedback feedback,
      TagLabelRecognizerMetadata recognizer) {}

  enum TaskType {
    RequestDescription,
    UpdateDescription,
    RequestTag,
    UpdateTag,
    RequestApproval,
    RequestTestCaseFailureResolution,
    RecognizerFeedbackApproval,
    Generic
  }

  enum TaskStatus {
    Open,
    Closed
  }
}
