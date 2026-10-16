package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Shared raw-HTTP test helpers for integration tests that call an endpoint outside the SDK's fluent
 * surface. Consolidates what would otherwise be a per-file copy of URL-encoding and status-code
 * assertions: ColumnResourceIT and ColumnCustomPropertiesIT each already carry their own private
 * copy of the encoder, left in place because those files are frozen contracts.
 */
public final class UriTestUtils {

  private UriTestUtils() {}

  /** Percent-encodes a URL path segment (dots, quotes, spaces) for a raw REST call. */
  public static String encodeURIComponent(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
  }

  /** Asserts that the admin client's call to {@code url} fails with exactly {@code expectedStatus}. */
  public static void assertHttpStatus(
      int expectedStatus, HttpMethod method, String url, Object body) {
    assertHttpStatusFor(SdkClients.adminClient(), expectedStatus, method, url, body);
  }

  /** Same as {@link #assertHttpStatus} but against an arbitrary client, such as a denied principal. */
  public static void assertHttpStatusFor(
      OpenMetadataClient client, int expectedStatus, HttpMethod method, String url, Object body) {
    try {
      client.getHttpClient().executeForString(method, url, body);
      fail(
          "Expected HTTP "
              + expectedStatus
              + " for "
              + method
              + " "
              + url
              + " but the call succeeded");
    } catch (OpenMetadataException e) {
      assertEquals(expectedStatus, e.getStatusCode(), e.getMessage());
    }
  }
}
