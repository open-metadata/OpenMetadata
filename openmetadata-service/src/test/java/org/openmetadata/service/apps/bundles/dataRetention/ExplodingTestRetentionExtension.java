package org.openmetadata.service.apps.bundles.dataRetention;

import java.util.List;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;

/**
 * A provider whose constructor throws, standing in for a distribution that ships a broken or
 * half-deployed extension. Registered by {@link DataRetentionExtensionRegistryTest} to prove that
 * such a provider is skipped instead of taking the whole DataRetention app down with it.
 */
public class ExplodingTestRetentionExtension implements DataRetentionExtension {

  public ExplodingTestRetentionExtension() {
    throw new IllegalStateException("this provider cannot be constructed");
  }

  @Override
  public String name() {
    return "explodingTestExtension";
  }

  @Override
  public List<RetentionStep> steps(DataRetentionConfiguration configuration) {
    return List.of();
  }
}
