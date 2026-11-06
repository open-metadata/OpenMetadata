package org.openmetadata.service.security.session;

import java.util.concurrent.TimeUnit;
import lombok.Getter;

@Getter
public class SessionRefreshInProgressException extends RuntimeException {
  private final int retryAfterSeconds;

  public SessionRefreshInProgressException(long retryAfterMillis) {
    super("Session refresh already in progress");
    this.retryAfterSeconds =
        (int) Math.max(1L, TimeUnit.MILLISECONDS.toSeconds(Math.max(0L, retryAfterMillis) + 999L));
  }
}
