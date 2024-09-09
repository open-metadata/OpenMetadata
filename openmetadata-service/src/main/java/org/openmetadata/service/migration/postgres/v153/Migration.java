package org.openmetadata.service.migration.postgres.v153;

import static org.openmetadata.service.migration.utils.v153.MigrationUtil.updateEmailTemplates;
import static org.openmetadata.service.migration.utils.v153.MigrationUtil.updateUserNameToEmailPrefixForLdapAuthProvider;

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
    updateEmailTemplates(collectionDAO);
    updateUserNameToEmailPrefixForLdapAuthProvider(collectionDAO, authenticationConfiguration);
  }
}
