/*
 *  Copyright 2022 Collate
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

public class SecretsManagerException extends WebServiceException {
  private static final String BY_NAME_MESSAGE =
      "SecretsManagerException for secret manager [%s] when using the secret name [%s] due to [%s].";

  public static final String SECRETS_MANAGER_ERROR = "SECRETS_MANAGER_ERROR";

  public SecretsManagerException(String message) {
    super(Response.Status.INTERNAL_SERVER_ERROR, SECRETS_MANAGER_ERROR, message);
  }

  public SecretsManagerException(Response.Status status, String message) {
    super(status.getStatusCode(), SECRETS_MANAGER_ERROR, message);
  }

  public SecretsManagerException(String message, Throwable cause) {
    super(Response.Status.INTERNAL_SERVER_ERROR, SECRETS_MANAGER_ERROR, message, cause);
  }

  public static SecretsManagerException byMessage(
      String secretManager, String connectionType, String errorMessage) {
    return new SecretsManagerException(
        buildMessageByName(secretManager, connectionType, errorMessage));
  }

  private static String buildMessageByName(
      String secretManager, String secretName, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, secretManager, secretName, errorMessage);
  }
}
