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
package org.openmetadata.service.rdf.rebuild;

/**
 * Who a write to the serving dataset is made for, which decides how it meets the maintenance pause
 * and who owns its failure. It is chosen once, where a writer is wired, and travels with the
 * storage handle that writer holds. See
 * ADR:2026-10-28-rdf-storage-maintenance-pauses-serving-writes-and-compacts-on-a-schedule.
 */
public sealed interface RdfWriteDelivery {
  /**
   * The live-write queue: a write is held back at once while paused, and the queue retries it.
   * The queue records its own failures, so they do not mark the projection degraded.
   */
  RdfWriteDelivery QUEUED = new Queued();

  /**
   * Any other writer: nothing retries it, so it waits for a pause up to the RDF request timeout,
   * and a write that still fails is lost and marks the projection degraded.
   */
  RdfWriteDelivery DIRECT = new Direct();

  /** The maintenance job holding the pause, which writes through it. */
  static RdfWriteDelivery pauseHolder(final String jobId) {
    return new PauseHolder(jobId);
  }

  /** Whether a paused write waits for the pause to end instead of being held back at once. */
  default boolean waitsForPause() {
    return this instanceof Direct;
  }

  /** Whether the live-write queue retries a failed write, and so owns its failure. */
  default boolean retriedByQueue() {
    return this instanceof Queued;
  }

  /** Whether the write is made by the maintenance job that holds the pause {@code holderJobId}. */
  default boolean holds(final String holderJobId) {
    return this instanceof PauseHolder holder && holder.jobId().equals(holderJobId);
  }

  record Queued() implements RdfWriteDelivery {}

  record Direct() implements RdfWriteDelivery {}

  record PauseHolder(String jobId) implements RdfWriteDelivery {}
}
