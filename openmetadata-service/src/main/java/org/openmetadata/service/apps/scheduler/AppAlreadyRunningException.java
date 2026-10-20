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

package org.openmetadata.service.apps.scheduler;

import jakarta.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

/**
 * Thrown when an application is triggered while a run of it is still in progress. Maps to 409
 * CONFLICT: the caller can retry once the run has finished.
 */
public final class AppAlreadyRunningException extends WebServiceException {
  private static final String ERROR_TYPE = "APP_ALREADY_RUNNING";
  private static final String MESSAGE =
      "Job is already running for application %s, please wait for it to complete.";

  public AppAlreadyRunningException(String appName) {
    super(Response.Status.CONFLICT, ERROR_TYPE, String.format(MESSAGE, appName));
  }

  public AppAlreadyRunningException(String appName, Throwable cause) {
    super(Response.Status.CONFLICT, ERROR_TYPE, String.format(MESSAGE, appName), cause);
  }
}
