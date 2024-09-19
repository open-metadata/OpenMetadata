package org.openmetadata.service.migration.mysql.v155;

import static org.openmetadata.service.migration.utils.v155.MigrationUtil.updateUserNameToEmailPrefixForLdapAuthProvider;

import lombok.SneakyThrows;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    updateUserNameToEmailPrefixForLdapAuthProvider(
        handle, collectionDAO, authenticationConfiguration, false);
  }
}
