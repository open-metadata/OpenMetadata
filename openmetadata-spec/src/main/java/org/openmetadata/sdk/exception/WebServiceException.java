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

package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.Getter;

@Getter
public abstract class WebServiceException extends RuntimeException {
  private final transient Response response;

  protected WebServiceException(Response response, String msg) {
    super(msg);
    this.response = response;
  }

  protected WebServiceException(Response.Status status, String errorType, String msg) {
    super(msg);
    response =
        Response.status(status)
            .entity(convertToErrorResponseMessage(errorType, msg))
            .type(MediaType.APPLICATION_JSON_TYPE)
            .build();
  }

  protected WebServiceException(int status, String errorType, String msg) {
    super(msg);
    response =
        Response.status(status)
            .entity(convertToErrorResponseMessage(errorType, msg))
            .type(MediaType.APPLICATION_JSON_TYPE)
            .build();
  }

  protected WebServiceException(
      Response.Status status, String errorType, String msg, Throwable cause) {
    super(msg, cause);
    response =
        Response.status(status)
            .entity(convertToErrorResponseMessage(errorType, msg))
            .type(MediaType.APPLICATION_JSON_TYPE)
            .build();
  }

  private static ErrorResponse convertToErrorResponseMessage(String errorType, String msg) {
    return new ErrorResponse(errorType, msg);
  }

  private static class ErrorResponse {
    /** Response message. */
    @Getter private final String responseMessage;

    @Getter private final String errorType;

    ErrorResponse(String errorType, String responseMessage) {
      this.responseMessage = responseMessage;
      this.errorType = errorType;
    }
  }
}
