package org.openmetadata.service.migration;

public class QueryStatus {
  public enum Status {
    SUCCESS,
    FAILURE
  }

  private final Status status;
  private final String message;

  public QueryStatus(Status status, String message) {
    this.status = status;
    this.message = message;
  }

  public Status getStatus() {
    return status;
  }

  public String getMessage() {
    return message;
  }
}
