package org.openmetadata.catalog.exception;

import javax.ws.rs.core.Response.Status;

public class DeserializationException extends WebServiceException {

  private DeserializationException(String msg, Throwable cause) {
    super(Status.INTERNAL_SERVER_ERROR, msg, cause);
  }

  public static DeserializationException message(String msg, Throwable cause) {
    return new DeserializationException(msg, cause);
  }
}
