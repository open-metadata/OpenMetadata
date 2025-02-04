package org.openmetadata.service.util.jdbi;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class DatabaseAuthenticationProviderFactoryTest {

  @Test
  void testGet_withAzureTrueInJdbcUrl_returnsAzureDatabaseAuthenticationProvider() {
    String jdbcURL =
        "jdbc:postgresql://your-database.postgres.database.azure.com:5432/testdb?azure=true&sslmode=require";

    Optional<DatabaseAuthenticationProvider> provider =
        DatabaseAuthenticationProviderFactory.get(jdbcURL);
    assertTrue(provider.isPresent(), "Expected AzureDatabaseAuthenticationProvider to be present");
    assertTrue(
        provider.get() instanceof AzureDatabaseAuthenticationProvider,
        "Expected instance of AzureDatabaseAuthenticationProvider");
  }

  @Test
  void testGet_withoutAzureTrueInJdbcUrl_returnsEmptyOptional() {
    String jdbcURL =
        "jdbc:postgresql://your-database.postgres.database.azure.com:5432/testdb?sslmode=require";
    Optional<DatabaseAuthenticationProvider> provider =
        DatabaseAuthenticationProviderFactory.get(jdbcURL);
    assertFalse(provider.isPresent(), "Expected no provider to be present");
  }

  @Test
  void testGet_withAwsRdsParamsInJdbcUrl_returnsAwsRdsDatabaseAuthenticationProvider() {
    String jdbcURL =
        "jdbc:mysql://your-aws-db.rds.amazonaws.com:3306/testdb?awsRegion=us-west-2&allowPublicKeyRetrieval=true";
    Optional<DatabaseAuthenticationProvider> provider =
        DatabaseAuthenticationProviderFactory.get(jdbcURL);
    assertTrue(provider.isPresent(), "Expected AwsRdsDatabaseAuthenticationProvider to be present");
    assertTrue(
        provider.get() instanceof AwsRdsDatabaseAuthenticationProvider,
        "Expected instance of AwsRdsDatabaseAuthenticationProvider");
  }

  @Test
  void testGet_withInvalidUrl_returnsEmptyOptional() {
    String jdbcURL = "jdbc:invalidurl://your-db.test?someParam=true";
    Optional<DatabaseAuthenticationProvider> provider =
        DatabaseAuthenticationProviderFactory.get(jdbcURL);
    assertFalse(provider.isPresent(), "Expected no provider to be present for invalid URL");
  }
}
