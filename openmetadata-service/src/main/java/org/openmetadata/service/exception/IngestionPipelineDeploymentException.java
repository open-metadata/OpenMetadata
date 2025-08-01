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

import jakarta.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

public class IngestionPipelineDeploymentException extends WebServiceException {

  private static final String BY_NAME_MESSAGE = "Failed to deploy pipeline [%s] due to [%s].";
  private static final String ERROR_TYPE = "DEPLOYMENT_ERROR";

  public IngestionPipelineDeploymentException(String message) {
    super(Response.Status.BAD_REQUEST, ERROR_TYPE, message);
  }

  private IngestionPipelineDeploymentException(
      Response.Status status, String errorType, String message) {
    super(status, errorType, message);
  }

  public static IngestionPipelineDeploymentException byMessage(
      String name, String errorType, String errorMessage, Response.Status status) {
    return new IngestionPipelineDeploymentException(
        status, errorType, buildMessageByName(name, errorMessage));
  }

  public static IngestionPipelineDeploymentException byMessage(
      String name, String errorType, String errorMessage) {
    return new IngestionPipelineDeploymentException(
        Response.Status.BAD_REQUEST, errorType, buildMessageByName(name, errorMessage));
  }

  public static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
