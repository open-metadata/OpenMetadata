package org.openmetadata.catalog.jdbi3;

import java.util.Optional;
import org.jdbi.v3.core.statement.StatementException;
import org.jdbi.v3.sqlobject.SingleValue;
import org.jdbi.v3.sqlobject.statement.SqlQuery;

public interface MigrationDAO {
  @SqlQuery("SELECT MAX(version) FROM DATABASE_CHANGE_LOG")
  @SingleValue
  Optional<String> getMaxVersion() throws StatementException;
}
