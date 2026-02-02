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

@JsonIgnoreProperties(ignoreUnknown = true)
public class CronOMJobStatus {

  @JsonProperty("lastScheduleTime")
  @JsonFormat(
      shape = JsonFormat.Shape.STRING,
      pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
      timezone = "UTC")
  private Instant lastScheduleTime;

  @JsonProperty("lastSuccessfulTime")
  @JsonFormat(
      shape = JsonFormat.Shape.STRING,
      pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
      timezone = "UTC")
  private Instant lastSuccessfulTime;

  @JsonProperty("lastOMJobName")
  private String lastOMJobName;

  @JsonProperty("message")
  private String message;

  public CronOMJobStatus() {}

  public Instant getLastScheduleTime() {
    return lastScheduleTime;
  }

  public void setLastScheduleTime(Instant lastScheduleTime) {
    this.lastScheduleTime = lastScheduleTime;
  }

  public Instant getLastSuccessfulTime() {
    return lastSuccessfulTime;
  }

  public void setLastSuccessfulTime(Instant lastSuccessfulTime) {
    this.lastSuccessfulTime = lastSuccessfulTime;
  }

  public String getLastOMJobName() {
    return lastOMJobName;
  }

  public void setLastOMJobName(String lastOMJobName) {
    this.lastOMJobName = lastOMJobName;
  }

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }
}
