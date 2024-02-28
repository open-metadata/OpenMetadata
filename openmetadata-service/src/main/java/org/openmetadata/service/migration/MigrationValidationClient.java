package org.openmetadata.service.migration;

import java.util.List;
import org.openmetadata.service.jdbi3.MigrationDAO;

public abstract class MigrationValidationClient {

  private final MigrationDAO migrationDAO;

  protected MigrationValidationClient(MigrationDAO migrationDAO) {
    this.migrationDAO = migrationDAO;
  }

  public abstract List<String> getExpectedMigrationList();

  public List<String> getCurrentVersions() {
    return migrationDAO.getMigrationVersions();
  }
}
