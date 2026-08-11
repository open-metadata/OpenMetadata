/*
 *  Copyright 2026 Collate
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
package org.openmetadata.sdk.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Response shape returned with HTTP 202 Accepted for server-side async operations such as
 * restore (issue #4003) and delete. Contains a job id that can be used with the SDK
 * WebSocketListener to await completion notifications.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AsyncJobResponse {
  private String jobId;
  private String message;

  public AsyncJobResponse() {}

  public AsyncJobResponse(String jobId, String message) {
    this.jobId = jobId;
    this.message = message;
  }

  public String getJobId() {
    return jobId;
  }

  public void setJobId(String jobId) {
    this.jobId = jobId;
  }

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }
}
