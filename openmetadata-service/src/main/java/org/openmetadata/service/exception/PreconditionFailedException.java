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

package org.openmetadata.service.exception;

import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;

/**
 * Exception thrown when a precondition specified in the request headers is not met.
 * This is typically used for ETag validation failures (HTTP 412 Precondition Failed).
 */
public class PreconditionFailedException extends ClientErrorException {

  private static final String DEFAULT_MESSAGE = "Precondition Failed";

  public PreconditionFailedException(String message) {
    super(message, Response.Status.PRECONDITION_FAILED);
  }

  public PreconditionFailedException() {
    super(DEFAULT_MESSAGE, Response.Status.PRECONDITION_FAILED);
  }

  public PreconditionFailedException(String message, Throwable cause) {
    super(message, Response.Status.PRECONDITION_FAILED, cause);
  }
}
