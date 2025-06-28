package org.openmetadata.service.apps;

import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.TimeUnit; // new import
import java.util.concurrent.locks.ReentrantLock;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppLogException;
import org.openmetadata.schema.entity.app.AppLogLevel;
import org.openmetadata.schema.entity.app.AppLogRecord;
import org.openmetadata.service.jdbi3.AppRepository;

/**
 * <p>
 * ApplicationLogger is used to log messages from the application. It uses the AppRepository to store the logs in the
 * database. The logs are stored with a timestamp, appId, appName, log level, and message. The log level can be set to
 * DEBUG, INFO, WARN, or ERROR.
 * </p>
 * <p>
 * The logger is blocking. It will wait for the log to be written to the database before returning. This is to ensure that the
 * logs are written in the order they are received (unlike a traditional logging handler).
 * The logger is also thread-safe, which means that it can be used by multiple threads at the same time without causing
 * any issues at the expense of performance.
 * </p>
 * <p>Example usage:</p>
 * <pre>
 *     ApplicationLogger logger = new ApplicationLogger(app, appRepository, runId);
 *     logger.setLogLevel(AppLogLevel.DEBUG);
 *     logger.debug("This is a debug message");
 *     logger.info("This is an info message");
 *     logger.warn("This is a warning message");
 *     logger.error("This is an error message", new Exception("Error occurred"));
 * </pre>
 */
@Slf4j
public class ApplicationLogger {
  private final AppRepository appRepository;
  private final App app;
  private final String runId;
  @Getter @Setter private AppLogLevel logLevel = AppLogLevel.INFO;
  private static final Map<AppLogLevel, Integer> logLevels =
      Map.of(
          AppLogLevel.DEBUG, 1,
          AppLogLevel.INFO, 2,
          AppLogLevel.WARN, 3,
          AppLogLevel.ERROR, 4);

  private final ReentrantLock lock = new ReentrantLock(); // Lock for thread safety

  public ApplicationLogger(App app, AppRepository appRepository, String runId) {
    this.appRepository = appRepository;
    this.app = app;
    this.runId = runId;
  }

  public void debug(String message, Exception e) {
    log(System.currentTimeMillis(), AppLogLevel.DEBUG, message, e);
  }

  public void info(String message, Exception e) {
    log(System.currentTimeMillis(), AppLogLevel.INFO, message, e);
  }

  public void warn(String message, Exception e) {
    log(System.currentTimeMillis(), AppLogLevel.WARN, message, e);
  }

  public void error(String message, Exception e) {
    log(System.currentTimeMillis(), AppLogLevel.ERROR, message, e);
  }

  public void error(String message) {
    error(message, null);
  }

  public void warn(String message) {
    warn(message, null);
  }

  public void info(String message) {
    info(message, null);
  }

  public void debug(String message) {
    debug(message, null);
  }

  // New helper method to encapsulate lock acquisition
  private void withLock(Runnable action) throws InterruptedException {
    boolean locked;
    try {
      locked = lock.tryLock(100, TimeUnit.MILLISECONDS);
      if (!locked) {
        lock.lock();
      }
      action.run();
    } finally {
      if (lock.isHeldByCurrentThread()) {
        lock.unlock();
      }
    }
  }

  public void log(Long timestamp, AppLogLevel level, String message, Exception e) {
    if (logLevels.get(level) > logLevels.get(logLevel)) {
      return;
    }
    AppLogRecord record =
        new AppLogRecord()
            .withRunId(runId)
            .withTimestamp(timestamp)
            .withAppId(app.getId())
            .withAppName(app.getName())
            .withLevel(level)
            .withMessage(message);
    if (e != null) {
      record.setException(
          new AppLogException()
              .withName(e.getClass().getName())
              .withMessage(e.getMessage())
              .withStackTrace(Arrays.toString(e.getStackTrace())));
    }
    try {
      withLock(
          () -> {
            appRepository.addAppLogEntry(record);
          });
    } catch (InterruptedException ex) {
      LOG.warn(
          "Error while trying to record log for app: {} {} {}",
          record.getAppName(),
          record.getLevel().toString(),
          record.getMessage());
      LOG.error("Error while acquiring lock for logging", ex);
    }
  }
}
