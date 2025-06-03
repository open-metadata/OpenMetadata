package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;

public class AssetServiceException extends WebServiceException {
  private static final String BY_NAME_MESSAGE = "AssetService Exception [%s] due to [%s].";
  private static final String ERROR_TYPE = "ASSET_SERVICE_ERROR";

  public AssetServiceException(String message) {
    super(Response.Status.BAD_REQUEST, ERROR_TYPE, message);
  }

  public AssetServiceException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static AssetServiceException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new AssetServiceException(status, buildMessageByName(name, errorMessage));
  }

  public static AssetServiceException byMessage(String name, String errorMessage) {
    return new AssetServiceException(
        Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
