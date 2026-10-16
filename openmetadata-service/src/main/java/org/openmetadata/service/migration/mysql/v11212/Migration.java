package org.openmetadata.service.migration.mysql.v11212;

import lombok.SneakyThrows;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v11212.MigrationUtil;

public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    initializeWorkflowHandler();
    MigrationUtil.repairStaleGlossaryApprovalFqns(handle, false);
  }
}
