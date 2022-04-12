package org.openmetadata.catalog.events.errors;

public class AtlasEntityNotFoundException extends EventPublisherException {
  private static final long serialVersionUID = 1L;

  public AtlasEntityNotFoundException(String message, Throwable cause) {
    super(message, cause);
  }

  public AtlasEntityNotFoundException(String message) {
    super(message);
  }
}
