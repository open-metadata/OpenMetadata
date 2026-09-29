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

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;

/**
 * SPI for retention cleanups over tables that ship outside of OpenMetadata. Commercial
 * distributions and downstream forks register implementations via {@code
 * META-INF/services/org.openmetadata.service.apps.bundles.dataRetention.DataRetentionExtension} so
 * their tables are pruned by the same scheduled job, with the same batching, stats and failure
 * reporting, without OpenMetadata having to know those tables exist.
 *
 * <p>Extensions run after every built-in cleanup, so a job that fails partway still leaves
 * OpenMetadata's own tables pruned. A provider that throws is isolated by {@link
 * DataRetentionExtensionRegistry}: the run is marked {@code ACTIVE_ERROR} and the remaining
 * extensions still run.
 */
public interface DataRetentionExtension {

  /**
   * Stable identifier for this extension. Used as the key under {@code
   * DataRetentionConfiguration.extensions} and in logs, so it must be unique across providers and
   * must not change once operators have configured it.
   */
  String name();

  /**
   * The cleanups this extension contributes, in the order they must run. Called once per job run.
   *
   * @param configuration the DataRetention app's configuration, for reading this extension's
   *     retention period via {@link #retentionPeriodDays}
   * @return the steps to run; empty to sit out this run
   */
  List<RetentionStep> steps(DataRetentionConfiguration configuration);

  /**
   * The retention period the operator configured for this extension under {@code
   * extensions.<name()>}, or {@code defaultDays} when they configured none.
   */
  default int retentionPeriodDays(
      final DataRetentionConfiguration configuration, final int defaultDays) {
    final Map<String, Integer> configured =
        configuration == null ? null : configuration.getExtensions();
    final Integer period = configured == null ? null : configured.get(name());
    return period == null ? defaultDays : period;
  }
}
