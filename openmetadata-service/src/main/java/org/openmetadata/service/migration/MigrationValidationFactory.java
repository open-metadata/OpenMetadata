package org.openmetadata.service.migration;

import java.lang.reflect.InvocationTargetException;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.MigrationDAO;

@Slf4j
public final class MigrationValidationFactory {
  private MigrationValidationFactory() {}

  @Getter private static MigrationValidationClient migrationValidationClient;

  public static MigrationValidationClient createMigrationValidationClient(
      MigrationConfiguration configuration, MigrationDAO migrationDAO) {
    if (migrationValidationClient != null) {
      return migrationValidationClient;
    }

    String migrationValidationClientClass = configuration.getMigrationValidationClass();
    LOG.debug("Registering MigrationValidationClient: {}", migrationValidationClientClass);

    try {
      migrationValidationClient =
          Class.forName(migrationValidationClientClass)
              .asSubclass(MigrationValidationClient.class)
              .getConstructor(MigrationDAO.class)
              .newInstance(migrationDAO);
      return migrationValidationClient;
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InvocationTargetException
        | InstantiationException
        | IllegalAccessException e) {
      throw new MigrationValidationClientException(
          String.format(
              "Error trying to load PipelineServiceClient %s: %s",
              migrationValidationClientClass, e));
    }
  }
}
