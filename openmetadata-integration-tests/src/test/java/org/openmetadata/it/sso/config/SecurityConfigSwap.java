package org.openmetadata.it.sso.config;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.function.Executable;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
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

  private static String liveConfigJson() {
    return JsonUtils.pojoToJson(
        SecurityConfigurationManager.getInstance().getCurrentSecurityConfig());
  }
}
