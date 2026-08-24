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
import java.util.List;
import java.util.ServiceLoader;
import java.util.function.Consumer;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;

/** The {@link DataRetentionExtension} providers on the classpath and the steps they contribute. */
@Slf4j
public final class DataRetentionExtensions {

  private final List<DataRetentionExtension> extensions;

  public DataRetentionExtensions(final List<DataRetentionExtension> extensions) {
    this.extensions = List.copyOf(extensions);
  }

  public static DataRetentionExtensions discover() {
    final List<DataRetentionExtension> discovered =
        StreamSupport.stream(ServiceLoader.load(DataRetentionExtension.class).spliterator(), false)
            .toList();
    LOG.info("Discovered {} DataRetention extension(s).", discovered.size());
    return new DataRetentionExtensions(discovered);
  }

  /**
   * Steps from every registered extension, in registration order. A provider that throws while
   * contributing is skipped and its exception handed to {@code onFailure}; the rest still run, so
   * one bad distribution cannot stop the others from pruning.
   */
  public List<RetentionStep> resolveSteps(
      final DataRetentionConfiguration configuration, final Consumer<RuntimeException> onFailure) {
    final List<RetentionStep> steps = new ArrayList<>();
    for (final DataRetentionExtension extension : extensions) {
      steps.addAll(resolveSteps(extension, configuration, onFailure));
    }
    return List.copyOf(steps);
  }

  private List<RetentionStep> resolveSteps(
      final DataRetentionExtension extension,
      final DataRetentionConfiguration configuration,
      final Consumer<RuntimeException> onFailure) {
    List<RetentionStep> steps = List.of();
    try {
      final List<RetentionStep> contributed = extension.steps(configuration);
      steps = contributed == null ? List.of() : contributed;
    } catch (RuntimeException ex) {
      LOG.error(
          "DataRetention extension '{}' failed to contribute cleanup steps.", extension.name(), ex);
      onFailure.accept(ex);
    }
    return steps;
  }
}
