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

package org.openmetadata.catalog.exception;

import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

public abstract class WebServiceException extends RuntimeException {
  private final Response response;

  protected WebServiceException(Response.Status status, String msg) {
    super(msg);
    response = Response.status(status)
            .entity(convertToErrorResponseMessage(msg))
            .type(MediaType.APPLICATION_JSON_TYPE)
            .build();
  }

  protected WebServiceException(Response.Status status, String msg, Throwable cause) {
    super(msg, cause);
    response = Response.status(status)
            .entity(convertToErrorResponseMessage(msg))
            .type(MediaType.APPLICATION_JSON_TYPE)
            .build();
  }

  private static ErrorResponse convertToErrorResponseMessage(String msg) {
    return new ErrorResponse(msg);
  }

  public Response getResponse() {
    return response;
  }

  private static class ErrorResponse {
    /**
     * Response message.
     */
    private final String responseMessage;

    ErrorResponse(String responseMessage) {
      this.responseMessage = responseMessage;
    }

    public String getResponseMessage() {
      return responseMessage;
    }
  }
}

