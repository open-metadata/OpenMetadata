package org.openmetadata.service.exception;

import javax.ws.rs.core.Response;

public class PreconditionFailedException extends WebServiceException {
  private static final String BY_NAME_MESSAGE = "Entity %s was modified by another process. Please refresh and try again.";
  private static final String DEFAULT_MESSAGE = "Entity was modified by another process. Please refresh and try again.";

  public PreconditionFailedException(String message) {
    super(Response.Status.PRECONDITION_FAILED, PRECONDITION_FAILED, message);
  }

  public PreconditionFailedException(String entityType, String entityName) {
    this(String.format(BY_NAME_MESSAGE, String.format("%s [%s]", entityType, entityName)));
  }

  public PreconditionFailedException() {
    this(DEFAULT_MESSAGE);
  }

  private PreconditionFailedException(Response.Status status, String errorType, String message) {
    super(status, errorType, message);
  }

  public static final String PRECONDITION_FAILED = "PRECONDITION_FAILED";
}