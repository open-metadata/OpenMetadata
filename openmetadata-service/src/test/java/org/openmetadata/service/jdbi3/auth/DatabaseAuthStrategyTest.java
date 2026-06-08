package org.openmetadata.service.jdbi3.auth;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.zaxxer.hikari.HikariConfig;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.auth.DatabaseAuthStrategy.Context;

class DatabaseAuthStrategyTest {

  private static final String AWS_IAM_URL =
      "jdbc:postgresql://h:5432/db?awsRegion=us-east-1&allowPublicKeyRetrieval=true";

  @Test
  void selectsFileStrategyWhenPasswordFileConfigured() {
    DatabaseAuthStrategy strategy =
        DatabaseAuthStrategy.select(context(null, "/run/secrets/token"));
    assertInstanceOf(FileCredentialAuthStrategy.class, strategy);
  }

  @Test
  void selectsAwsStrategyForAwsIamUrl() {
    DatabaseAuthStrategy strategy = DatabaseAuthStrategy.select(context(AWS_IAM_URL, null));
    assertInstanceOf(AwsRdsIamAuthStrategy.class, strategy);
  }

  @Test
  void fallsBackToStandardWhenNeitherConfigured() {
    DatabaseAuthStrategy strategy =
        DatabaseAuthStrategy.select(context("jdbc:postgresql://h:5432/db", null));
    assertInstanceOf(StandardAuthStrategy.class, strategy);
  }

  @Test
  void rejectsFileAndAwsConfiguredTogether() {
    assertThrows(
        IllegalArgumentException.class,
        () -> DatabaseAuthStrategy.select(context(AWS_IAM_URL, "/run/secrets/token")));
  }

  @Test
  void fileStrategyRequiresAUsername() {
    Context noUser = new Context("jdbc:postgresql://h:5432/db", null, "pw", "/run/secrets/token");
    assertThrows(
        IllegalArgumentException.class,
        () -> new FileCredentialAuthStrategy().apply(new HikariConfig(), new Properties(), noUser));
  }

  private Context context(String jdbcUrl, String dbPasswordFile) {
    return new Context(jdbcUrl, "user", "password", dbPasswordFile);
  }
}
