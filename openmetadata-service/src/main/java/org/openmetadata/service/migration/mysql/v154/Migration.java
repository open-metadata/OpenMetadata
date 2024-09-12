package org.openmetadata.service.migration.mysql.v154;

import static org.openmetadata.service.migration.utils.v154.MigrationUtil.updateUserNameToEmailPrefixForLdapAuthProvider;

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
