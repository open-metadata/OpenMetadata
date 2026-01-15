/*
 *  Copyright 2021 Collate
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

package org.openmetadata.operator.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Represents the lifecycle phases of an OMJob execution.
 *
 * This enum defines the state machine for OMJob execution, ensuring
 * proper transitions and guaranteed exit handler execution.
 */
public enum OMJobPhase {
  /**
   * Initial state when OMJob is created but main pod hasn't been scheduled yet
   */
  PENDING("Pending"),

  /**
   * Main ingestion pod is running
   */
  RUNNING("Running"),

  /**
   * Main pod completed, exit handler pod is now running
   */
  EXIT_HANDLER_RUNNING("ExitHandlerRunning"),

  /**
   * Both main pod and exit handler completed successfully
   */
  SUCCEEDED("Succeeded"),

  /**
   * Either main pod or exit handler failed
   */
  FAILED("Failed");

  private final String value;

  OMJobPhase(String value) {
    this.value = value;
  }

  @JsonValue
  public String getValue() {
    return value;
  }

  /**
   * Check if this phase represents a terminal state
   */
  public boolean isTerminal() {
    return this == SUCCEEDED || this == FAILED;
  }

  /**
   * Check if this phase allows transition to the given phase
   */
  public boolean canTransitionTo(OMJobPhase newPhase) {
    return switch (this) {
      case PENDING -> newPhase == RUNNING || newPhase == FAILED;
      case RUNNING -> newPhase == EXIT_HANDLER_RUNNING || newPhase == FAILED;
      case EXIT_HANDLER_RUNNING -> newPhase == SUCCEEDED || newPhase == FAILED;
      case SUCCEEDED, FAILED -> false; // Terminal states
    };
  }

  /**
   * Get next expected phase in normal execution flow
   */
  public OMJobPhase getNextPhase() {
    return switch (this) {
      case PENDING -> RUNNING;
      case RUNNING -> EXIT_HANDLER_RUNNING;
      case EXIT_HANDLER_RUNNING -> SUCCEEDED;
      case SUCCEEDED, FAILED -> null; // Terminal states
    };
  }

  @Override
  public String toString() {
    return value;
  }
}
