package org.openmetadata.service.apps.bundles.dataRetention;

import java.util.List;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;

/**
 * A well-behaved provider for {@link DataRetentionExtensionRegistryTest} to register in a throwaway
 * {@code META-INF/services} directory, so discovery is exercised against the real ServiceLoader
 * rather than a hand-built list. Public with a no-arg constructor because ServiceLoader requires
 * both. Its step deletes nothing.
 */
public class InertTestRetentionExtension implements DataRetentionExtension {

  public static final String NAME = "inertTestExtension";
  public static final int DEFAULT_RETENTION_DAYS = 3;

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public List<RetentionStep> steps(DataRetentionConfiguration configuration) {
    int retentionDays = retentionPeriodDays(configuration, DEFAULT_RETENTION_DAYS);
    return List.of(new RetentionStep(NAME + "_" + retentionDays + "d", batchSize -> 0));
  }
}
