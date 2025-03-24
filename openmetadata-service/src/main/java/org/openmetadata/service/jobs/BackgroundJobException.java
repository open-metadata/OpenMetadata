package org.openmetadata.service.jobs;

public class BackgroundJobException extends RuntimeException {
  private final long jobId;

  public BackgroundJobException(long jobId, String message) {
    super(message);
    this.jobId = jobId;
  }

  public BackgroundJobException(long jobId, String message, Throwable cause) {
    super(message, cause);
    this.jobId = jobId;
  }

  public long getJobId() {
    return jobId;
  }
}
