/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Builder;
import lombok.Data;

/** Result object returned by sink providers after write operations. */
@Data
@Builder
public class SinkResult {

  /** Whether the overall operation was successful. */
  private boolean success;

  /** Number of entities successfully synced. */
  private int syncedCount;

  /** Number of entities that failed to sync. */
  private int failedCount;

  /** List of fully qualified names of successfully synced entities. */
  @Builder.Default private List<String> syncedEntities = new ArrayList<>();

  /** List of errors encountered during the operation. */
  @Builder.Default private List<SinkError> errors = new ArrayList<>();

  /** Additional metadata about the operation (e.g., commit SHA for git sinks). */
  @Builder.Default private Map<String, Object> metadata = new HashMap<>();

  /** Represents an error that occurred during a sink operation. */
  @Data
  @Builder
  public static class SinkError {

    /** The fully qualified name of the entity that failed. */
    private String entityFqn;

    /** Human-readable error message. */
    private String errorMessage;

    /** Error code for programmatic handling. */
    private String errorCode;

    /** The exception that caused the error, if any. */
    private Throwable cause;
  }

  /**
   * Creates a successful result for a single entity.
   *
   * @param entityFqn the fully qualified name of the synced entity
   * @return a successful SinkResult
   */
  public static SinkResult success(String entityFqn) {
    return SinkResult.builder()
        .success(true)
        .syncedCount(1)
        .failedCount(0)
        .syncedEntities(List.of(entityFqn))
        .build();
  }

  /**
   * Creates a successful result for multiple entities.
   *
   * @param entityFqns the fully qualified names of the synced entities
   * @return a successful SinkResult
   */
  public static SinkResult success(List<String> entityFqns) {
    return SinkResult.builder()
        .success(true)
        .syncedCount(entityFqns.size())
        .failedCount(0)
        .syncedEntities(new ArrayList<>(entityFqns)) // Defensive copy
        .build();
  }

  /**
   * Creates a failure result for a single entity.
   *
   * @param entityFqn the fully qualified name of the entity that failed
   * @param errorMessage the error message
   * @return a failure SinkResult
   */
  public static SinkResult failure(String entityFqn, String errorMessage) {
    return SinkResult.builder()
        .success(false)
        .syncedCount(0)
        .failedCount(1)
        .errors(
            List.of(SinkError.builder().entityFqn(entityFqn).errorMessage(errorMessage).build()))
        .build();
  }

  /**
   * Creates a failure result with an exception.
   *
   * @param entityFqn the fully qualified name of the entity that failed
   * @param cause the exception that caused the failure
   * @return a failure SinkResult
   */
  public static SinkResult failure(String entityFqn, Throwable cause) {
    return SinkResult.builder()
        .success(false)
        .syncedCount(0)
        .failedCount(1)
        .errors(
            List.of(
                SinkError.builder()
                    .entityFqn(entityFqn)
                    .errorMessage(cause.getMessage())
                    .cause(cause)
                    .build()))
        .build();
  }
}
