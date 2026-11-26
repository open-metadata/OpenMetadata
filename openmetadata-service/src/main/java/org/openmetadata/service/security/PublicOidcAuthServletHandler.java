package org.openmetadata.service.security;

import com.nimbusds.oauth2.sdk.ParseException;
import com.nimbusds.oauth2.sdk.util.JSONObjectUtils;
import com.nimbusds.openid.connect.sdk.op.OIDCProviderMetadata;
import java.util.Objects;
import java.util.function.LongSupplier;
import net.minidev.json.JSONObject;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.util.ValidationHttpUtil;

/** Public web logins stay in the SPA. Only MCP needs a server-side code exchange for this client. */
final class PublicOidcAuthServletHandler extends NoopAuthServeletHandler {
  private static final String DISCOVERY_PATH = "/.well-known/openid-configuration";
  private final AuthenticationConfiguration authentication;
  private final AuthorizerConfiguration authorizer;
  private final SessionService sessions;
  private final LongSupplier nanoTime;
  private AuthenticationCodeFlowHandler handler;
  private String baseUrl;
  private RuntimeException initializationFailure;
  private long failedAt;

  PublicOidcAuthServletHandler(
      AuthenticationConfiguration authentication,
      AuthorizerConfiguration authorizer,
      SessionService sessions) {
    this(authentication, authorizer, sessions, System::nanoTime);
  }

  PublicOidcAuthServletHandler(
      AuthenticationConfiguration authentication,
      AuthorizerConfiguration authorizer,
      SessionService sessions,
      LongSupplier nanoTime) {
    this.authentication = authentication;
    this.authorizer = authorizer;
    this.sessions = sessions;
    this.nanoTime = nanoTime;
  }

  synchronized AuthenticationCodeFlowHandler forMcp(String configuredBaseUrl) {
    final String base = StringUtils.stripEnd(configuredBaseUrl, "/");
    if (!Objects.equals(baseUrl, base)) {
      baseUrl = base;
      handler = null;
      initializationFailure = null;
    }
    if (handler == null) {
      if (initializationFailure != null
          && nanoTime.getAsLong() - failedAt < PublicOidcConfiguration.DISCOVERY_INTERVAL_NANOS) {
        throw initializationFailure;
      }
      try {
        // Only public-client deployments that actually use MCP need backend discovery.
        final AuthenticationConfiguration effective =
            JsonUtils.deepCopy(authentication, AuthenticationConfiguration.class);
        effective.setOidcConfiguration(publicCodeFlow(authentication, base));
        handler = new AuthenticationCodeFlowHandler(effective, authorizer, sessions, true);
        initializationFailure = null;
      } catch (RuntimeException failure) {
        initializationFailure = failure;
        failedAt = nanoTime.getAsLong();
        throw failure;
      }
    }
    return handler;
  }

  static OidcClientConfig publicCodeFlow(AuthenticationConfiguration authentication, String base) {
    String authority =
        StringUtils.stripEnd(StringUtils.defaultString(authentication.getAuthority()).strip(), "/");
    if (authority.isBlank()
        || StringUtils.isBlank(authentication.getClientId())
        || StringUtils.isBlank(base)) {
      throw new IllegalArgumentException(
          "MCP public OIDC sign-in needs an authority, client ID and server URL");
    }
    if (authentication.getProvider() == AuthProvider.AZURE && !authority.endsWith("/v2.0")) {
      authority += "/v2.0";
    }
    final String discovery = authority + DISCOVERY_PATH;
    ValidationHttpUtil.validateUrl(discovery);
    return new OidcClientConfig()
        .withId(authentication.getClientId())
        .withDiscoveryUri(discovery)
        .withDisablePkce(false)
        .withServerUrl(base)
        .withCallbackUrl(base + AuthenticationCodeFlowHandler.MCP_CALLBACK_PATH);
  }

  static OIDCProviderMetadata parseDiscovery(String document, AuthProvider provider)
      throws ParseException {
    final JSONObject metadata = JSONObjectUtils.parse(document);
    if (provider == AuthProvider.AZURE) {
      // Entra's tenant-independent issuer contains braces, which Nimbus rejects in a URI.
      final String issuer = JSONObjectUtils.getString(metadata, "issuer");
      metadata.put(
          "issuer",
          issuer.replace(
              ProviderTokenValidator.TENANT_ID_PLACEHOLDER,
              ProviderTokenValidator.ENCODED_TENANT_ID_PLACEHOLDER));
    }
    return OIDCProviderMetadata.parse(metadata);
  }
}
