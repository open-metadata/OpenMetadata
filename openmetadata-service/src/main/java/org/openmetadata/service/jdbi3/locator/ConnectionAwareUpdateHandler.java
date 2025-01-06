package org.openmetadata.service.jdbi3.locator;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Optional;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.extension.HandleSupplier;
import org.jdbi.v3.sqlobject.Handler;

/**
 * A custom handler that picks the correct SQL for MySQL or Postgres
 * from {@link ConnectionAwareSqlUpdateContainer} or {@link ConnectionAwareSqlUpdate}.
 */
public class ConnectionAwareUpdateHandler implements Handler {

  @Override
  public Object invoke(HandleSupplier handleSupplier, Object target, Object... args) {
    Method method = (Method) args[SqlObjectStatementConfiguration.METHOD_INDEX];
    Handle handle = handleSupplier.getHandle();
    String jdbcDriverClass = getDriverClassFromHandle(handle);

    String sql =
        locateSqlUpdate(method, jdbcDriverClass)
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "No matching @ConnectionAwareSqlUpdate found for method " + method));

    return handle.createUpdate(sql).execute();
  }

  private String getDriverClassFromHandle(Handle handle) {
    // Pseudocode: in reality, you'd retrieve it from your environment
    // or store it in a custom config. This is just a placeholder.
    return "org.postgresql.Driver"; // or "com.mysql.cj.jdbc.Driver"
  }

  /**
   * Find the matching {@link ConnectionAwareSqlUpdate} from {@link ConnectionAwareSqlUpdateContainer},
   * for the given driver class (MySQL vs Postgres).
   */
  private Optional<String> locateSqlUpdate(Method method, String jdbcDriverClass) {
    ConnectionType connectionType = ConnectionType.from(jdbcDriverClass);

    ConnectionAwareSqlUpdateContainer container =
        method.getAnnotation(ConnectionAwareSqlUpdateContainer.class);

    if (container != null) {
      return Arrays.stream(container.value())
          .filter(a -> a.connectionType() == connectionType)
          .findFirst()
          .map(ConnectionAwareSqlUpdate::value);
    }

    // Fallback: maybe there's a single annotation (not container) on the method
    ConnectionAwareSqlUpdate single = method.getAnnotation(ConnectionAwareSqlUpdate.class);
    if (single != null && single.connectionType() == connectionType) {
      return Optional.of(single.value());
    }

    return Optional.empty();
  }
}
