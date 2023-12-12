package org.openmetadata.service.util.jdbi;

import java.util.Optional;

/** Factory class for {@link DatabaseAuthenticationProvider}. */
public class DatabaseAuthenticationProviderFactory {

  /** C'tor */
  private DatabaseAuthenticationProviderFactory() {}

  /**
   * Get auth provider based on the given jdbc url.
   *
   * @param jdbcURL the jdbc url.
   * @return instance of {@link DatabaseAuthenticationProvider}.
   */
  public static Optional<DatabaseAuthenticationProvider> get(String jdbcURL) {
    // Check
    if (
      jdbcURL.contains(AwsRdsDatabaseAuthenticationProvider.AWS_REGION) &&
      jdbcURL.contains(AwsRdsDatabaseAuthenticationProvider.ALLOW_PUBLIC_KEY_RETRIEVAL)
    ) {
      // Return AWS RDS Auth provider
      return Optional.of(new AwsRdsDatabaseAuthenticationProvider());
    }

    // Return empty
    return Optional.empty();
  }
}
