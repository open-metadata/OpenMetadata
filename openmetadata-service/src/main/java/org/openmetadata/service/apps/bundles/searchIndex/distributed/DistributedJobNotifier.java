/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import java.util.UUID;
import java.util.function.Consumer;

/**
 * Interface for notifying servers about distributed job events.
 *
 * <p>This abstraction allows for different notification mechanisms:
 *
 * <ul>
 *   <li>Redis Pub/Sub - instant push notifications when Redis is available
 *   <li>Database polling - fallback when Redis is not configured
 * </ul>
 */
public interface DistributedJobNotifier {

  /**
   * Notify all servers that a job has started and they should participate.
   *
   * @param jobId The job ID that started
   * @param jobType The type of job (e.g., "SEARCH_INDEX")
   */
  void notifyJobStarted(UUID jobId, String jobType);

  /**
   * Notify all servers that a job has completed.
   *
   * @param jobId The job ID that completed
   */
  void notifyJobCompleted(UUID jobId);

  /**
   * Register a callback to be invoked when a job starts.
   *
   * @param callback Consumer that receives the job ID
   */
  void onJobStarted(Consumer<UUID> callback);

  /**
   * Start the notifier (begin listening for notifications).
   */
  void start();

  /**
   * Stop the notifier and release resources.
   */
  void stop();

  /**
   * Check if the notifier is currently running.
   *
   * @return true if running
   */
  boolean isRunning();

  /**
   * Get the type of notifier (for logging/debugging).
   *
   * @return notifier type name
   */
  String getType();
}
