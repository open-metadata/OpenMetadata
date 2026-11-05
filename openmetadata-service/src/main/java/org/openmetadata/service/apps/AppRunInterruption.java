package org.openmetadata.service.apps;

import java.net.InetAddress;
import java.net.UnknownHostException;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The failure recorded on an app run that ended without reporting its own status, because the
 * server executing it stopped or its job was abandoned. No exception ever reaches such a run, so
 * without this it shows as failed with no reason.
 */
public final class AppRunInterruption {
  private static final String UNKNOWN_HOST = "unknown";
  private static final String STILL_RUNNING_AT_STARTUP =
      "Still running when server '%s' started, so it was marked failed: a run ends when the server"
          + " executing it stops (restart, crash or redeploy), and that server's logs and restart"
          + " history show why. A run still executing on another server reports its own status.";

  private static final String LOCK_NO_LONGER_RENEWED =
      "Ended without reporting its status: server '%s' stopped renewing the lock this run held, so"
          + " server '%s' marked it failed. A run ends when the server executing it stops (restart,"
          + " crash or redeploy), and that server's logs and restart history show why.";

  private AppRunInterruption() {}

  /** The failure for runs this server finds still running as it starts. */
  public static String stillRunningAtStartup() {
    return failure(STILL_RUNNING_AT_STARTUP.formatted(localHostName()));
  }

  /** The failure for a run whose server stopped renewing the lock that marked it live. */
  public static String lockNoLongerRenewed(final String lockHolderServer) {
    return failure(LOCK_NO_LONGER_RENEWED.formatted(lockHolderServer, localHostName()));
  }

  /** The failure, as JSON, for a run that ended because of {@code reason}. */
  public static String failure(final String reason) {
    return JsonUtils.pojoToJson(
        new IndexingError().withErrorSource(IndexingError.ErrorSource.JOB).withMessage(reason));
  }

  private static String localHostName() {
    try {
      return InetAddress.getLocalHost().getHostName();
    } catch (UnknownHostException exception) {
      return UNKNOWN_HOST;
    }
  }
}
