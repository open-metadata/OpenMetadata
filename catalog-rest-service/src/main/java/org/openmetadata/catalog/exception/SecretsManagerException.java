package org.openmetadata.catalog.exception;

import javax.ws.rs.core.Response;

public class SecretsManagerException extends WebServiceException {
  private static final String BY_NAME_MESSAGE =
      "SecretsManagerException for secret manager [%s] when using the secret name [%s] due to [%s].";

  public SecretsManagerException(String message) {
    super(Response.Status.INTERNAL_SERVER_ERROR, message);
  }

  public static SecretsManagerException byMessage(String secretManager, String connectionType, String errorMessage) {
    return new SecretsManagerException(buildMessageByName(secretManager, connectionType, errorMessage));
  }

  private static String buildMessageByName(String secretManager, String secretName, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, secretManager, secretName, errorMessage);
  }
}
