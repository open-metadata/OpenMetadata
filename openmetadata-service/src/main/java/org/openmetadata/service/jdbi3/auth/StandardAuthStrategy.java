package org.openmetadata.service.jdbi3.auth;

import com.zaxxer.hikari.HikariConfig;
import java.util.Properties;

/** Standard username/password auth; the default applied when no specific strategy is configured. */
final class StandardAuthStrategy implements DatabaseAuthStrategy {

  @Override
  public String name() {
    return "standard username/password";
  }

  @Override
  public boolean appliesTo(Context context) {
    // The implicit default; never selected by detection, only used as the fallback.
    return false;
  }

  @Override
  public void apply(HikariConfig config, Properties dataSourceProperties, Context context) {
    if (context.username() != null) {
      config.setUsername(context.username());
    }
    if (context.password() != null) {
      config.setPassword(context.password());
    }
    if (!dataSourceProperties.isEmpty()) {
      config.setDataSourceProperties(dataSourceProperties);
    }
  }
}
