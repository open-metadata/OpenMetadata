package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.catalog.jdbi3.locator.ConnectionType.POSTGRES;
import static org.openmetadata.catalog.jdbi3.locator.ConnectionType.SINGLESTORE;

import java.util.Optional;
import org.jdbi.v3.core.statement.StatementException;
import org.jdbi.v3.sqlobject.SingleValue;
import org.openmetadata.catalog.jdbi3.locator.ConnectionAwareSqlQuery;

public interface MigrationDAO {
  @ConnectionAwareSqlQuery(value = "SELECT MAX(version) FROM DATABASE_CHANGE_LOG", connectionType = MYSQL)
  @ConnectionAwareSqlQuery(value = "SELECT max(version) FROM \"DATABASE_CHANGE_LOG\"", connectionType = POSTGRES)
  @ConnectionAwareSqlQuery(value = "SELECT MAX(version) FROM DATABASE_CHANGE_LOG", connectionType = SINGLESTORE)
  @SingleValue
  Optional<String> getMaxVersion() throws StatementException;
}
