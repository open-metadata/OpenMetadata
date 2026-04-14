package org.openmetadata.service.search;

import io.github.resilience4j.core.IntervalFunction;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public final class SearchRetryUtil {

  private static final RetryConfig RETRY_CONFIG =
      RetryConfig.custom()
          .maxAttempts(4)
          .intervalFunction(IntervalFunction.ofExponentialBackoff(100, 2))
          .retryOnException(SearchRetryUtil::isTooManyRequestsError)
          .build();

  private static final Retry RETRY = Retry.of("search-upsert", RETRY_CONFIG);

  private SearchRetryUtil() {}

  public static Retry getRetry() {
    return RETRY;
  }

  public static boolean isTooManyRequestsError(Throwable e) {
    if (e == null) return false;
    String message = e.getMessage();
    if (message == null) return false;
    return message.contains("429 Too Many Requests")
        || message.contains("\"status\":429")
        || message.contains("[429]");
  }

  @FunctionalInterface
  public interface IOOperation {
    void execute() throws IOException;
  }

  public static void executeWithRetry(IOOperation operation) throws IOException {
    try {
      Retry.decorateCheckedRunnable(RETRY, operation::execute).run();
    } catch (IOException | RuntimeException e) {
      throw e;
    } catch (Throwable e) {
      throw new IOException(e);
    }
  }
}
