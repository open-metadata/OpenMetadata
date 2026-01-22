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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import java.util.List;
import org.openmetadata.schema.EntityInterface;

/**
 * Interface for sink providers that push entity data to external systems.
 *
 * <p>Implementations of this interface are registered with {@link SinkProviderRegistry} and are
 * invoked by workflow sink tasks to write entity data to destinations such as Git repositories,
 * webhooks, or HTTP endpoints.
 */
public interface SinkProvider {

  /**
   * Returns the sink type identifier that this provider handles.
   *
   * @return the sink type (e.g., "git", "webhook", "httpEndpoint")
   */
  String getSinkType();

  /**
   * Writes a single entity to the sink destination.
   *
   * @param context the sink context containing configuration and metadata
   * @param entity the entity to write
   * @return the result of the write operation
   */
  SinkResult write(SinkContext context, EntityInterface entity);

  /**
   * Writes multiple entities to the sink destination in a batch operation.
   *
   * <p>For sinks that support batch operations (e.g., Git with a single commit), this method
   * provides better efficiency than calling {@link #write} multiple times.
   *
   * @param context the sink context containing configuration and metadata
   * @param entities the list of entities to write
   * @return the result of the batch write operation
   */
  SinkResult writeBatch(SinkContext context, List<EntityInterface> entities);

  /**
   * Releases any resources held by the sink provider.
   *
   * <p>Called after sink operations are complete to clean up connections, file handles, etc.
   */
  void close();

  /**
   * Returns whether this sink supports batch operations.
   *
   * <p>If true, the sink task may call {@link #writeBatch} instead of individual {@link #write}
   * calls when batch mode is enabled.
   *
   * @return true if batch operations are supported
   */
  default boolean supportsBatch() {
    return false;
  }

  /**
   * Validates the sink configuration.
   *
   * <p>Called before write operations to ensure the configuration is valid.
   *
   * @param config the sink configuration to validate
   * @throws IllegalArgumentException if the configuration is invalid
   */
  default void validate(Object config) {
    // Default no-op validation
  }
}
