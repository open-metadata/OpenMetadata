package org.openmetadata.service.jdbi3.auth;

import com.zaxxer.hikari.HikariConfig;
import java.util.List;
import java.util.Properties;
import java.util.stream.Collectors;

/**
 * Resolves and applies exactly one database authentication strategy to a HikariCP config.
 *
 * <p>This is the only public type of the package: callers use {@link #select} and the interface
 * methods; the concrete strategies are package-private. Specific per-connection strategies (AWS RDS
 * IAM, file-based credential) are mutually exclusive — configuring more than one is a
 * misconfiguration that {@link #select} rejects, so exactly one strategy is ever applied.
 */
public sealed interface DatabaseAuthStrategy
    permits StandardAuthStrategy, AwsRdsIamAuthStrategy, FileCredentialAuthStrategy {

  /** The configuration needed to decide on and apply an authentication strategy. */
  record Context(String jdbcUrl, String username, String password, String dbPasswordFile) {}

  String name();

  /** Whether this strategy is explicitly configured for the given context. */
  boolean appliesTo(Context context);

  void apply(HikariConfig config, Properties dataSourceProperties, Context context);

  /**
   * Returns the single strategy that applies to the context, falling back to standard
   * username/password auth when no specific strategy is configured. Throws if more than one
   * specific strategy is configured.
   */
  static DatabaseAuthStrategy select(Context context) {
    List<DatabaseAuthStrategy> specific =
        List.of(new FileCredentialAuthStrategy(), new AwsRdsIamAuthStrategy());
    List<DatabaseAuthStrategy> matching =
        specific.stream().filter(strategy -> strategy.appliesTo(context)).toList();
    if (matching.size() > 1) {
      String names =
          matching.stream().map(DatabaseAuthStrategy::name).collect(Collectors.joining(" and "));
      throw new IllegalArgumentException(
          "Conflicting database authentication: "
              + names
              + " are both configured. Configure exactly one.");
    }
    return matching.isEmpty() ? new StandardAuthStrategy() : matching.getFirst();
  }
}
