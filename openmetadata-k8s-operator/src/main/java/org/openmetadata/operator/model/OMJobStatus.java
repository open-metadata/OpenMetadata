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

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

/**
 * Status of OMJob execution.
 *
 * This tracks the current state and progress of the two-stage execution.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class OMJobStatus {

  @JsonProperty("phase")
  private OMJobPhase phase;

  @JsonProperty("mainPodName")
  private String mainPodName;

  @JsonProperty("exitHandlerPodName")
  private String exitHandlerPodName;

  @JsonProperty("startTime")
  @JsonFormat(
      shape = JsonFormat.Shape.STRING,
      pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
      timezone = "UTC")
  private Instant startTime;

  @JsonProperty("completionTime")
  @JsonFormat(
      shape = JsonFormat.Shape.STRING,
      pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
      timezone = "UTC")
  private Instant completionTime;

  @JsonProperty("message")
  private String message;

  @JsonProperty("mainPodExitCode")
  private Integer mainPodExitCode;

  @JsonProperty("lastTransitionTime")
  @JsonFormat(
      shape = JsonFormat.Shape.STRING,
      pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
      timezone = "UTC")
  private Instant lastTransitionTime;

  @JsonProperty("observedGeneration")
  private Long observedGeneration;

  // Constructors
  public OMJobStatus() {
    this.phase = OMJobPhase.PENDING;
    this.startTime = Instant.now();
    this.lastTransitionTime = this.startTime;
  }

  // Getters and setters
  public OMJobPhase getPhase() {
    return phase;
  }

  public void setPhase(OMJobPhase phase) {
    if (this.phase != phase) {
      this.phase = phase;
      this.lastTransitionTime = Instant.now();

      // Set completion time for terminal phases
      if (phase != null && phase.isTerminal() && this.completionTime == null) {
        this.completionTime = Instant.now();
      }
    }
  }

  public String getMainPodName() {
    return mainPodName;
  }

  public void setMainPodName(String mainPodName) {
    this.mainPodName = mainPodName;
  }

  public String getExitHandlerPodName() {
    return exitHandlerPodName;
  }

  public void setExitHandlerPodName(String exitHandlerPodName) {
    this.exitHandlerPodName = exitHandlerPodName;
  }

  public Instant getStartTime() {
    return startTime;
  }

  public void setStartTime(Instant startTime) {
    this.startTime = startTime;
  }

  public Instant getCompletionTime() {
    return completionTime;
  }

  public void setCompletionTime(Instant completionTime) {
    this.completionTime = completionTime;
  }

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }

  public Integer getMainPodExitCode() {
    return mainPodExitCode;
  }

  public void setMainPodExitCode(Integer mainPodExitCode) {
    this.mainPodExitCode = mainPodExitCode;
  }

  public Instant getLastTransitionTime() {
    return lastTransitionTime;
  }

  public void setLastTransitionTime(Instant lastTransitionTime) {
    this.lastTransitionTime = lastTransitionTime;
  }

  public Long getObservedGeneration() {
    return observedGeneration;
  }

  public void setObservedGeneration(Long observedGeneration) {
    this.observedGeneration = observedGeneration;
  }

  /**
   * Update status with phase transition validation
   */
  public boolean transitionTo(OMJobPhase newPhase, String message) {
    if (this.phase == null || this.phase.canTransitionTo(newPhase)) {
      setPhase(newPhase);
      setMessage(message);
      return true;
    }
    return false;
  }

  /**
   * Check if status represents a completed state
   */
  public boolean isCompleted() {
    return phase != null && phase.isTerminal();
  }

  /**
   * Get execution duration in seconds
   */
  public long getDurationSeconds() {
    if (startTime == null) {
      return 0;
    }

    Instant endTime = completionTime != null ? completionTime : Instant.now();
    return endTime.getEpochSecond() - startTime.getEpochSecond();
  }
}
