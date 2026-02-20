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

import com.fasterxml.jackson.annotation.JsonProperty;

public class CronOMJobSpec {

  @JsonProperty("schedule")
  private String schedule;

  @JsonProperty("timeZone")
  private String timeZone;

  @JsonProperty("suspend")
  private Boolean suspend;

  @JsonProperty("startingDeadlineSeconds")
  private Integer startingDeadlineSeconds;

  @JsonProperty("successfulJobsHistoryLimit")
  private Integer successfulJobsHistoryLimit;

  @JsonProperty("failedJobsHistoryLimit")
  private Integer failedJobsHistoryLimit;

  @JsonProperty("omJobSpec")
  private OMJobSpec omJobSpec;

  public CronOMJobSpec() {}

  public String getSchedule() {
    return schedule;
  }

  public void setSchedule(String schedule) {
    this.schedule = schedule;
  }

  public String getTimeZone() {
    return timeZone;
  }

  public void setTimeZone(String timeZone) {
    this.timeZone = timeZone;
  }

  public Boolean getSuspend() {
    return suspend;
  }

  public void setSuspend(Boolean suspend) {
    this.suspend = suspend;
  }

  public Integer getStartingDeadlineSeconds() {
    return startingDeadlineSeconds;
  }

  public void setStartingDeadlineSeconds(Integer startingDeadlineSeconds) {
    this.startingDeadlineSeconds = startingDeadlineSeconds;
  }

  public Integer getSuccessfulJobsHistoryLimit() {
    return successfulJobsHistoryLimit;
  }

  public void setSuccessfulJobsHistoryLimit(Integer successfulJobsHistoryLimit) {
    this.successfulJobsHistoryLimit = successfulJobsHistoryLimit;
  }

  public Integer getFailedJobsHistoryLimit() {
    return failedJobsHistoryLimit;
  }

  public void setFailedJobsHistoryLimit(Integer failedJobsHistoryLimit) {
    this.failedJobsHistoryLimit = failedJobsHistoryLimit;
  }

  public OMJobSpec getOmJobSpec() {
    return omJobSpec;
  }

  public void setOmJobSpec(OMJobSpec omJobSpec) {
    this.omJobSpec = omJobSpec;
  }
}
