package org.openmetadata.it.auth;

import java.util.Locale;
import org.openmetadata.it.server.sso.ClientType;
import org.openmetadata.it.server.sso.CustomOidcProfile;
import org.openmetadata.it.server.sso.GoogleProfile;
import org.openmetadata.it.server.sso.OktaProfile;

/**
 * Resolves the JVM's active {@link AuthBackend} from the {@code jpw.auth} system property
 * (or {@code JPW_AUTH} env var). Defaults to {@link BasicJwtBackend} when nothing is set.
 *
 * <p>Adding a new provider × client-type combination:
 * <ol>
 *   <li>Implement {@code SsoProfile} for the new provider (record).
 *   <li>Update {@code SsoProfile}'s {@code permits} clause.
 *   <li>Add a switch case below; the existing {@link OidcBackend} handles all OIDC flows.
 * </ol>
 *
 * <p>Names follow {@code sso-<provider>-<clienttype>} so they're greppable and obvious.
 */
public final class AuthBackends {

  private AuthBackends() {}

  public static AuthBackend resolve() {
    final String name = lookup().toLowerCase(Locale.ROOT);
    return switch (name) {
      case "", "basic" -> new BasicJwtBackend();
      case "sso-google-public" -> new OidcBackend(new GoogleProfile(ClientType.PUBLIC));
      case "sso-google-confidential" -> new OidcBackend(new GoogleProfile(ClientType.CONFIDENTIAL));
      case "sso-okta-public" -> new OidcBackend(new OktaProfile(ClientType.PUBLIC));
      case "sso-okta-confidential" -> new OidcBackend(new OktaProfile(ClientType.CONFIDENTIAL));
      case "sso-custom-oidc-public" -> new OidcBackend(new CustomOidcProfile(ClientType.PUBLIC));
      case "sso-custom-oidc-confidential" -> new OidcBackend(
          new CustomOidcProfile(ClientType.CONFIDENTIAL));
      default -> throw new IllegalArgumentException(
          "Unknown jpw.auth='"
              + name
              + "'. Known: basic, sso-google-public, sso-google-confidential, "
              + "sso-okta-public, sso-okta-confidential, "
              + "sso-custom-oidc-public, sso-custom-oidc-confidential.");
    };
  }

  private static String lookup() {
    final String prop = System.getProperty("jpw.auth");
    if (prop != null && !prop.isBlank()) {
      return prop;
    }
    final String env = System.getenv("JPW_AUTH");
    return (env != null && !env.isBlank()) ? env : "";
  }
}
