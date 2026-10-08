/*
 *  Copyright 2026 Collate
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

package org.openmetadata.it.util;

import java.time.Duration;
import java.util.Objects;
import org.awaitility.Awaitility;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/** Materialization runs that tolerate the scheduled run holding the cluster-wide run lock. */
public final class RdfInferenceRuns {
  private static final int CONFLICT = 409;
  private static final Duration RUN_LOCK_WAIT = Duration.ofMinutes(3);
  private static final Duration RETRY_INTERVAL = Duration.ofSeconds(1);

  private RdfInferenceRuns() {}

  /**
   * The server schedules {@code RdfInferenceApp}, so an on-demand run can meet one in progress and
   * get a 409; retry until this run holds the lock.
   */
  public static InferenceMaterializationResult materializeWhenIdle(
      final boolean force, final String ruleName) {
    return Awaitility.await("inference materialization run")
        .atMost(RUN_LOCK_WAIT)
        .pollInterval(RETRY_INTERVAL)
        .ignoreExceptionsMatching(RdfInferenceRuns::isRunInProgress)
        .until(
            () -> SdkClients.adminClient().inferenceRules().materialize(force, ruleName),
            Objects::nonNull);
  }

  private static boolean isRunInProgress(final Throwable failure) {
    return failure instanceof OpenMetadataException exception
        && exception.getStatusCode() == CONFLICT;
  }
}
