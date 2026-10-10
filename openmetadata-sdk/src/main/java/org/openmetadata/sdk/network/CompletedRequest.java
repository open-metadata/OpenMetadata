package org.openmetadata.sdk.network;

/**
 * One finished HTTP call, as reported to a {@link RequestListener}.
 *
 * @param method HTTP method, upper case
 * @param path encoded URL path including the server's base path, e.g. {@code /api/v1/tables}
 * @param query encoded query string without the leading {@code ?}, or {@code null}
 * @param statusCode final HTTP status, or {@code -1} when the call failed before a response
 * @param durationNanos from the call starting to its response body being consumed or the call
 *     failing — the time the caller actually waited
 */
public record CompletedRequest(
    String method, String path, String query, int statusCode, long durationNanos) {

  public static final int NO_RESPONSE = -1;

  public boolean failed() {
    return statusCode == NO_RESPONSE || statusCode >= 400;
  }
}
