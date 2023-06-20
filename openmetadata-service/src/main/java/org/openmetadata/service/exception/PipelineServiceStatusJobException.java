package org.openmetadata.service.exception;

public class PipelineServiceStatusJobException extends RuntimeException {
  public PipelineServiceStatusJobException(String message) {
    super(message);
  }

  public PipelineServiceStatusJobException(Throwable throwable) {
    super(throwable);
  }
}
