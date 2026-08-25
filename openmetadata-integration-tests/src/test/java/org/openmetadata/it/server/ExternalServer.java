package org.openmetadata.it.server;

import java.net.URI;
import java.util.Locale;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;

/**
 * Builds a {@link ServerHandle} from environment variables, for tests that connect to a
 * pre-running stack (started by {@code ./docker/run_local_docker.sh} or docker compose).
 *
 * <p>Required env vars:
 * <ul>
 *   <li>{@code OM_URL} — the server base URL, e.g. {@code http://localhost:8585}
 *   <li>{@code OM_ADMIN_TOKEN} — a JWT with admin role; grab one from the UI under
 *       Settings &rarr; Bots &rarr; ingestion-bot &rarr; Token
 * </ul>
 *
 * <p>Optional env vars (auto-derived if absent):
 * <ul>
 *   <li>{@code OM_SEARCH_HOST} — search engine hostname, defaults to the host of OM_URL
 *   <li>{@code OM_SEARCH_PORT} — search engine port, defaults to {@code 9200}
 *   <li>{@code OM_SEARCH_SCHEME} — defaults to {@code http}
 * </ul>
 */
public final class ExternalServer {

  private static final int DEFAULT_SEARCH_PORT = 9200;

  private ExternalServer() {}

  public static ServerHandle fromEnv() {
    final String baseUrl = require("OM_URL");
    final String adminToken = require("OM_ADMIN_TOKEN");
    final URI uri = URI.create(baseUrl.endsWith("/") ? baseUrl + "api" : baseUrl + "/api");

    final OpenMetadataConfig config =
        OpenMetadataConfig.builder()
            .serverUrl(uri.toString())
            .accessToken(adminToken)
            .readTimeout(120000)
            .writeTimeout(120000)
            .build();
    final OpenMetadataClient client = new OpenMetadataClient(config);

    final String searchHost = optional("OM_SEARCH_HOST", uri.getHost());
    final int searchPort = parseInt(optional("OM_SEARCH_PORT", null), DEFAULT_SEARCH_PORT);
    final String searchScheme = optional("OM_SEARCH_SCHEME", "http");

    return new ServerHandle(uri, client, searchHost, searchPort, searchScheme, true);
  }

  public static boolean isEnabled() {
    return "external".equalsIgnoreCase(System.getenv("JPW_MODE"))
        || "external".equalsIgnoreCase(System.getProperty("JPW_MODE", ""));
  }

  private static String require(final String name) {
    final String value = lookup(name);
    if (value == null || value.isBlank()) {
      throw new IllegalStateException(
          "External mode requires env var " + name + " (or system property of the same name).");
    }
    return value;
  }

  private static String optional(final String name, final String fallback) {
    final String value = lookup(name);
    return (value == null || value.isBlank()) ? fallback : value;
  }

  private static String lookup(final String name) {
    final String fromEnv = System.getenv(name);
    if (fromEnv != null && !fromEnv.isBlank()) {
      return fromEnv;
    }
    return System.getProperty(name);
  }

  private static int parseInt(final String value, final int fallback) {
    if (value == null) {
      return fallback;
    }
    try {
      return Integer.parseInt(value.trim().toLowerCase(Locale.ROOT));
    } catch (NumberFormatException ignored) {
      return fallback;
    }
  }
}
