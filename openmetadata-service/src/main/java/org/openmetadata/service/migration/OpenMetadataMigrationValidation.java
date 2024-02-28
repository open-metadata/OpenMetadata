package org.openmetadata.service.migration;

import java.util.List;
import lombok.Getter;
import org.openmetadata.service.jdbi3.MigrationDAO;

public class OpenMetadataMigrationValidation extends MigrationValidationClient {

  public OpenMetadataMigrationValidation(MigrationDAO migrationDAO) {
    super(migrationDAO);
  }

  @Getter
  public final List<String> expectedMigrationList =
      List.of(
          "1.1.0", "1.1.1", "1.1.2", "1.1.5", "1.1.6", "1.1.7", "1.2.0", "1.2.1", "1.2.3", "1.2.4",
          "1.3.0", "1.3.1", "1.4.0");
}
