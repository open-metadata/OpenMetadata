package org.openmetadata.service.exception;

import jakarta.ws.rs.BadRequestException;

public class BadCursorException extends BadRequestException {
  public BadCursorException() {
    super();
  }

  public BadCursorException(String message) {
    super(message);
  }
}
