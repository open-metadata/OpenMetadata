package org.openmetadata.service.apps.bundles.dataRetention;

import java.util.List;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;

/**
 * Registered in {@code src/test/resources/META-INF/services} so {@link
 * DataRetentionExtensions#discover()} can be tested against the real ServiceLoader rather than a
 * hand-built list. It is on the classpath of every test in this module, so its step deletes
 * nothing.
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
