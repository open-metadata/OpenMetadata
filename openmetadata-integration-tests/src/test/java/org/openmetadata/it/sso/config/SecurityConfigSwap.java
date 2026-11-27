package org.openmetadata.it.sso.config;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.function.Executable;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.StoredSecurityConfiguration;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * Swaps the server's security configuration for the duration of a test class and puts the original
 * back. The original is captured in-process and unmasked: restoring a masked {@code GET} would keep
 * any secret a test changed, because the server fills masked values from what is stored.
 *
 * <p>Classes that use it change server-wide state, so they must run alone (the global-state lane,
 * {@code @Isolated}). Admin calls keep working throughout because the SDK's tokens are issued by
 * OpenMetadata itself, which every provider accepts.
 */
public final class SecurityConfigSwap implements AutoCloseable {
  private static final String SECURITY_CONFIG_PATH = "/v1/system/security/config";
  private static final String VALIDATE_PATH = "/v1/system/security/validate";
  private static final String ADMIN_EMAIL = "admin@open-metadata.org";
  private static final long ADMIN_TOKEN_TTL_SECONDS = 600;
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private final String originalJson;
  private SecurityConfiguration baseline;

  private SecurityConfigSwap(String originalJson) {
    this.originalJson = originalJson;
  }

  public static SecurityConfigSwap snapshotLiveConfig() {
    return new SecurityConfigSwap(liveConfigJson());
  }

  /** A fresh, mutable copy of the configuration that was live when the snapshot was taken. */
  public SecurityConfiguration originalCopy() {
    return JsonUtils.readValue(originalJson, SecurityConfiguration.class);
  }

  /** A fresh, mutable copy of the configuration every test of the class starts from. */
  public SecurityConfiguration baselineCopy() {
    return SsoConfigs.copyOf(baseline);
  }

  /** Puts the baseline back, after a test that changed the configuration on its own. */
  public void restoreBaseline() {
    apply(baseline);
  }

  /** How the server answered a request, whatever its status. */
  public record Answer(int status, String body) {}

  /** Saves {@code config} as the SSO page does for a new one, and reports the answer as is. */
  public static Answer attemptPut(SecurityConfiguration config) {
    return send("PUT", SECURITY_CONFIG_PATH, "application/json", JsonUtils.pojoToJson(config));
  }

  /** Sends a JSON Patch as the SSO page does for a saved configuration. */
  public static Answer attemptPatch(String jsonPatch) {
    return send("PATCH", SECURITY_CONFIG_PATH, "application/json-patch+json", jsonPatch);
  }

  public static Answer attemptValidate(SecurityConfiguration config) {
    return send("POST", VALIDATE_PATH, "application/json", JsonUtils.pojoToJson(config));
  }

  /** The configuration as an administrator reads it: what a JSON Patch is computed against. */
  public static SecurityConfiguration maskedLiveConfig() {
    Answer answer = send("GET", SECURITY_CONFIG_PATH, "application/json", null);
    if (answer.status() != 200) {
      throw new IllegalStateException("Reading the security configuration failed: " + answer);
    }
    return JsonUtils.readValue(answer.body(), SecurityConfiguration.class);
  }

  /** The configuration the server runs, as JSON, to compare before and after a refused save. */
  public static JsonNode liveConfig() {
    return JsonUtils.readTree(liveConfigJson());
  }

  /** The configuration in the database, which every server loads, as JSON. */
  public static JsonNode storedConfig() {
    StoredSecurityConfiguration stored =
        Entity.getSystemRepository().getStoredSecurityConfiguration();
    return stored == null ? null : JsonUtils.valueToTree(stored.configuration());
  }

  /** Applies {@code config} the way an administrator saves it, and checks it took effect. */
  public void apply(SecurityConfiguration config) {
    put(JsonUtils.pojoToJson(config));
    requireLive(config);
  }

  /** Applies {@code config} as the configuration every test of the class starts from. */
  public void applyBaseline(SecurityConfiguration config) {
    baseline = SsoConfigs.copyOf(config);
    apply(config);
  }

  /** Runs {@code body} under a variant of the baseline, then puts the baseline back. */
  public void withVariant(UnaryOperator<SecurityConfiguration> change, Executable body)
      throws Throwable {
    apply(change.apply(SsoConfigs.copyOf(baseline)));
    try {
      body.execute();
    } finally {
      apply(baseline);
    }
  }

  @Override
  public void close() {
    put(originalJson);
    requireRestored();
  }

  private static void put(String json) {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, SECURITY_CONFIG_PATH, json, RequestOptions.builder().build());
  }

  private static void requireLive(SecurityConfiguration wanted) {
    SecurityConfiguration live =
        SecurityConfigurationManager.getInstance().getCurrentSecurityConfig();
    boolean isLive =
        wanted.getAuthenticationConfiguration().getProvider()
                == live.getAuthenticationConfiguration().getProvider()
            && wanted.getAuthenticationConfiguration().getClientType()
                == live.getAuthenticationConfiguration().getClientType();
    if (!isLive) {
      throw new IllegalStateException(
          "The server did not apply the security configuration: " + JsonUtils.pojoToJson(live));
    }
  }

  private void requireRestored() {
    JsonNode restored = JsonUtils.readTree(liveConfigJson());
    if (!restored.equals(JsonUtils.readTree(originalJson))) {
      throw new IllegalStateException(
          "The security configuration was not restored. Expected "
              + originalJson
              + " but the server runs "
              + restored);
    }
  }

  private static Answer send(String method, String path, String contentType, String body) {
    String adminToken =
        JwtAuthProvider.tokenFor(
            ADMIN_EMAIL, ADMIN_EMAIL, new String[] {"admin"}, ADMIN_TOKEN_TTL_SECONDS);
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(SsoServer.url("/api" + path)))
            .timeout(Duration.ofSeconds(60))
            .header("Authorization", "Bearer " + adminToken)
            .header("Content-Type", contentType)
            .method(
                method,
                body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body))
            .build();
    try {
      HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
      return new Answer(response.statusCode(), response.body());
    } catch (IOException e) {
      throw new UncheckedIOException(method + " " + path + " failed", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted during " + method + " " + path, e);
    }
  }

  private static String liveConfigJson() {
    return JsonUtils.pojoToJson(
        SecurityConfigurationManager.getInstance().getCurrentSecurityConfig());
  }
}
