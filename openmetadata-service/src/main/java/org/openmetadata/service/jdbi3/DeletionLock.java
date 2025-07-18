package org.openmetadata.service.jdbi3;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entity representing a deletion lock that prevents concurrent modifications
 * during cascade deletion operations.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DeletionLock {

  private UUID id;
  private UUID entityId;
  private String entityType;
  private String entityFqn;
  private String lockType; // DELETE_IN_PROGRESS, DELETE_SCHEDULED
  private String lockedBy;
  private Instant lockedAt;
  private Instant expectedCompletion;
  private String deletionScope; // ENTITY_ONLY, CASCADE
  private JsonNode metadata;

  public enum LockType {
    DELETE_IN_PROGRESS("DELETE_IN_PROGRESS"),
    DELETE_SCHEDULED("DELETE_SCHEDULED");

    private final String value;

    LockType(String value) {
      this.value = value;
    }

    public String getValue() {
      return value;
    }
  }

  public enum DeletionScope {
    ENTITY_ONLY("ENTITY_ONLY"),
    CASCADE("CASCADE");

    private final String value;

    DeletionScope(String value) {
      this.value = value;
    }

    public String getValue() {
      return value;
    }
  }

  // Builder helper methods
  public DeletionLock withId(UUID id) {
    this.id = id;
    return this;
  }

  public DeletionLock withEntityId(UUID entityId) {
    this.entityId = entityId;
    return this;
  }

  public DeletionLock withEntityType(String entityType) {
    this.entityType = entityType;
    return this;
  }

  public DeletionLock withEntityFqn(String entityFqn) {
    this.entityFqn = entityFqn;
    return this;
  }

  public DeletionLock withLockType(String lockType) {
    this.lockType = lockType;
    return this;
  }

  public DeletionLock withLockedBy(String lockedBy) {
    this.lockedBy = lockedBy;
    return this;
  }

  public DeletionLock withLockedAt(Instant lockedAt) {
    this.lockedAt = lockedAt;
    return this;
  }

  public DeletionLock withExpectedCompletion(Instant expectedCompletion) {
    this.expectedCompletion = expectedCompletion;
    return this;
  }

  public DeletionLock withDeletionScope(String deletionScope) {
    this.deletionScope = deletionScope;
    return this;
  }

  public DeletionLock withMetadata(JsonNode metadata) {
    this.metadata = metadata;
    return this;
  }
}
