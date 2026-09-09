/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.dataRetention;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.ServiceConfigurationError;
import java.util.ServiceLoader;
import java.util.ServiceLoader.Provider;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;

/**
 * The {@link DataRetentionExtension} providers on the classpath and the steps they contribute.
 *
 * <p>Everything here is defensive on purpose. Providers are third-party code loaded off the
 * classpath, so neither discovering them nor asking them for steps may take the DataRetention job
 * down with them: a registration that cannot be loaded, a provider that cannot be instantiated and
 * a provider that throws while contributing are each skipped, and the built-in cleanups plus the
 * remaining providers still run.
 */
@Slf4j
public final class DataRetentionExtensionRegistry {

  /**
   * Caps how many malformed registrations discovery walks past. {@code ServiceLoader}'s iterator
   * throws instead of skipping one, and it does not promise the next call advances, so bound the
   * retries rather than risk spinning while the application boots.
   */
  private static final int MAX_DISCOVERY_ERRORS = 100;

  private final List<DataRetentionExtension> extensions;

  public DataRetentionExtensionRegistry(final List<DataRetentionExtension> extensions) {
    this.extensions = List.copyOf(extensions);
  }

  public static DataRetentionExtensionRegistry discover() {
    return discover(DataRetentionExtensionRegistry.class.getClassLoader());
  }

  static DataRetentionExtensionRegistry discover(final ClassLoader classLoader) {
    final List<DataRetentionExtension> discovered = loadProviders(classLoader);
    LOG.info("Discovered {} DataRetention extension(s).", discovered.size());
    return new DataRetentionExtensionRegistry(discovered);
  }

  /**
   * Steps from every registered extension, in registration order. A provider that throws while
   * contributing is skipped and its failure handed to {@code onFailure}; the rest still run, so one
   * bad distribution cannot stop the others from pruning.
   */
  public List<RetentionStep> resolveSteps(
      final DataRetentionConfiguration configuration, final Consumer<Throwable> onFailure) {
    final List<RetentionStep> steps = new ArrayList<>();
    for (final DataRetentionExtension extension : extensions) {
      steps.addAll(resolveSteps(extension, configuration, onFailure));
    }
    return List.copyOf(steps);
  }

  private static List<DataRetentionExtension> loadProviders(final ClassLoader classLoader) {
    final List<DataRetentionExtension> discovered = new ArrayList<>();
    final Iterator<Provider<DataRetentionExtension>> providers =
        ServiceLoader.load(DataRetentionExtension.class, classLoader).stream().iterator();
    int errors = 0;
    boolean exhausted = false;
    while (!exhausted && errors < MAX_DISCOVERY_ERRORS) {
      try {
        exhausted = !providers.hasNext();
        if (!exhausted) {
          instantiate(providers.next()).ifPresent(discovered::add);
        }
      } catch (ServiceConfigurationError | LinkageError | RuntimeException error) {
        errors++;
        LOG.error("Skipping a DataRetention extension registration that could not be read.", error);
      }
    }
    warnIfDiscoveryGaveUp(errors);
    return discovered;
  }

  private static void warnIfDiscoveryGaveUp(final int errors) {
    if (errors >= MAX_DISCOVERY_ERRORS) {
      LOG.error(
          "Gave up discovering DataRetention extensions after {} unreadable registrations. "
              + "Any provider registered after them will not run.",
          errors);
    }
  }

  private static Optional<DataRetentionExtension> instantiate(
      final Provider<DataRetentionExtension> provider) {
    Optional<DataRetentionExtension> extension = Optional.empty();
    try {
      extension = Optional.of(provider.get());
    } catch (ServiceConfigurationError | LinkageError | RuntimeException failure) {
      LOG.error(
          "DataRetention extension '{}' could not be instantiated and will be skipped.",
          provider.type().getName(),
          failure);
    }
    return extension;
  }

  private static List<RetentionStep> resolveSteps(
      final DataRetentionExtension extension,
      final DataRetentionConfiguration configuration,
      final Consumer<Throwable> onFailure) {
    List<RetentionStep> steps = List.of();
    try {
      steps = contributedSteps(extension, configuration);
    } catch (RuntimeException | LinkageError failure) {
      LOG.error(
          "DataRetention extension '{}' failed to contribute cleanup steps.",
          nameOf(extension),
          failure);
      onFailure.accept(failure);
    }
    return steps;
  }

  /** Drops the nulls a provider is free to hand back, so the job never trips over someone else's list. */
  private static List<RetentionStep> contributedSteps(
      final DataRetentionExtension extension, final DataRetentionConfiguration configuration) {
    final List<RetentionStep> contributed = extension.steps(configuration);
    return contributed == null ? List.of() : contributed.stream().filter(Objects::nonNull).toList();
  }

  /** {@code name()} is provider code too, so the failure path must not depend on it working. */
  private static String nameOf(final DataRetentionExtension extension) {
    String name = extension.getClass().getName();
    try {
      name = extension.name();
    } catch (RuntimeException | LinkageError failure) {
      LOG.debug("DataRetention extension {} could not report its name either.", name, failure);
    }
    return name;
  }
}
