package org.openmetadata.service.util.jdbi;

import java.util.Optional;

/** Factory class for {@link DatabaseAuthenticationProvider}. */
public class DatabaseAuthenticationProviderFactory {
  /** C'tor */
  private DatabaseAuthenticationProviderFactory() {}

  /**
   * Get auth provider based on the given jdbc url.
   */
  public static Optional<DatabaseAuthenticationProvider> get(String jdbcURL) {
    // Azure Entra ID auth is handled per-connection by the Azure JDBC authentication plugin
    // (configured in HikariCPDataSourceFactory), so it intentionally returns no static-token
    // provider here. Only AWS RDS IAM still uses a static-token provider.
    Optional<DatabaseAuthenticationProvider> provider = Optional.empty();
    if (jdbcURL.contains(AwsRdsDatabaseAuthenticationProvider.AWS_REGION)
        && jdbcURL.contains(AwsRdsDatabaseAuthenticationProvider.ALLOW_PUBLIC_KEY_RETRIEVAL)) {
      provider = Optional.of(new AwsRdsDatabaseAuthenticationProvider());
    }
    return provider;
  }
}
