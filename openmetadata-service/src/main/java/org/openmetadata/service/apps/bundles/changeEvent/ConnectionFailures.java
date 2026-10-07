package org.openmetadata.service.apps.bundles.changeEvent;

import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.net.http.HttpConnectTimeoutException;

/** Failures that say a target could not be reached at all, as opposed to one that answered. */
final class ConnectionFailures {

  private static final int DEEPEST_CAUSE = 10;

  private ConnectionFailures() {}

  static boolean neverReachedTheTarget(Throwable failure) {
    boolean found = false;
    Throwable cause = failure;
    for (int depth = 0; cause != null && !found && depth < DEEPEST_CAUSE; depth++) {
      found = isConnectionLevel(cause);
      cause = cause.getCause();
    }
    return found;
  }

  private static boolean isConnectionLevel(Throwable cause) {
    return cause instanceof ConnectException
        || cause instanceof UnknownHostException
        || cause instanceof NoRouteToHostException
        || cause instanceof HttpConnectTimeoutException
        || isConnectTimeout(cause);
  }

  // A read timeout is the same class, and means the target was reached.
  private static boolean isConnectTimeout(Throwable cause) {
    return cause instanceof SocketTimeoutException
        && cause.getMessage() != null
        && cause.getMessage().toLowerCase().contains("connect");
  }
}
