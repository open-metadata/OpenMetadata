package org.openmetadata.jpw.auth;

import java.util.Locale;

/**
 * Resolves the JVM's active {@link AuthBackend} from the {@code jpw.auth} system property
 * (or {@code JPW_AUTH} env var). Defaults to {@link BasicJwtBackend} when nothing is set.
 *
 * <p>Add a new provider by implementing {@link AuthBackend}, listing it in the {@code switch}
 * below, and adding it to the sealed-interface permits clause.
 */
public final class AuthBackends {

  private AuthBackends() {}

  public static AuthBackend resolve() {
    final String name = lookup();
    return switch (name.toLowerCase(Locale.ROOT)) {
      case "", BasicJwtBackend.NAME -> new BasicJwtBackend();
      case GoogleConfidentialBackend.NAME -> new GoogleConfidentialBackend();
      default ->
          throw new IllegalArgumentException(
              "Unknown jpw.auth='" + name + "'. Known: basic, sso-google-confidential.");
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
