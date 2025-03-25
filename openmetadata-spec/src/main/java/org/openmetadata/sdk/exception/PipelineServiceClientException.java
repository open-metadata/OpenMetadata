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

import jakarta.ws.rs.core.Response;

public class PipelineServiceClientException extends WebServiceException {
  private static final String BY_NAME_MESSAGE = "Pipeline Exception [%s] due to [%s].";
  private static final String ERROR_TYPE = "PIPELINE_SERVICE_ERROR";

  public PipelineServiceClientException(String message) {
    super(Response.Status.BAD_REQUEST, ERROR_TYPE, message);
  }

  private PipelineServiceClientException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static PipelineServiceClientException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new PipelineServiceClientException(status, buildMessageByName(name, errorMessage));
  }

  public static PipelineServiceClientException byMessage(String name, String errorMessage) {
    return new PipelineServiceClientException(
        Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
