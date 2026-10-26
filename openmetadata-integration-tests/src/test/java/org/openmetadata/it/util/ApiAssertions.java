package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.function.Executable;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/**
 * Assertions on how the server rejects a request made through the SDK. The SDK's entity update
 * wraps the server's error in its own, so the status may be on the cause.
 */
public final class ApiAssertions {
  private ApiAssertions() {}

  public static OpenMetadataException assertForbidden(Executable request, String message) {
    return assertRejected(Response.Status.FORBIDDEN, request, message);
  }

  public static OpenMetadataException assertBadRequest(Executable request, String message) {
    return assertRejected(Response.Status.BAD_REQUEST, request, message);
  }

  private static OpenMetadataException assertRejected(
      Response.Status status, Executable request, String message) {
    OpenMetadataException failure = assertThrows(OpenMetadataException.class, request, message);
    assertEquals(status.getStatusCode(), statusCodeOf(failure), message);
    return failure;
  }

  private static int statusCodeOf(OpenMetadataException failure) {
    int statusCode = failure.getStatusCode();
    if (statusCode < 0 && failure.getCause() instanceof OpenMetadataException cause) {
      statusCode = cause.getStatusCode();
    }
    return statusCode;
  }
}
