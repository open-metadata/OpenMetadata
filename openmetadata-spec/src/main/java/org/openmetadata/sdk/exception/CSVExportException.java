package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;

public class CSVExportException extends WebServiceException {
  private static final String BY_NAME_MESSAGE = "CSVExport Exception [%s] due to [%s].";
  private static final String ERROR_TYPE = "CSV_EXPORT_ERROR";

  public CSVExportException(String message) {
    super(Response.Status.BAD_REQUEST, ERROR_TYPE, message);
  }

  public CSVExportException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static CSVExportException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new CSVExportException(status, buildMessageByName(name, errorMessage));
  }

  public static CSVExportException byMessage(String name, String errorMessage) {
    return new CSVExportException(
        Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
