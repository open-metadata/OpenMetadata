package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.Optional;
import org.jdbi.v3.core.statement.StatementException;
import org.jdbi.v3.sqlobject.SingleValue;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;

public interface MigrationDAO {
  @ConnectionAwareSqlQuery(value = "SELECT MAX(version) FROM DATABASE_CHANGE_LOG", connectionType = MYSQL)
  @ConnectionAwareSqlQuery(value = "SELECT max(version) FROM \"DATABASE_CHANGE_LOG\"", connectionType = POSTGRES)
  @SingleValue
  Optional<String> getMaxVersion() throws StatementException;
}
