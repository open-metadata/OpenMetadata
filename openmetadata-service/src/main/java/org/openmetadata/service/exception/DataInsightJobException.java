package org.openmetadata.service.exception;

public class DataInsightJobException extends RuntimeException {
  public DataInsightJobException(String message) {
    super(message);
  }

  public DataInsightJobException(Throwable throwable) {
    super(throwable);
  }
}
