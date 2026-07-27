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

package org.openmetadata.service.events.lifecycle;

import org.openmetadata.service.events.lifecycle.OrderedLaneExecutor.OrderedTask;

/**
 * An {@link OrderedTask} that carries the locator of the entity whose search document it rewrites,
 * so that when the work fails on the lane the executor's failure handler can enqueue a durable retry
 * to the entity-keyed search-index retry outbox instead of losing the side-effect.
 *
 * @param work the async side-effect (ES index write, RDF SPARQL update, lineage-ES rewrite)
 * @param operation a short label of the operation, used in the retry-queue failure reason
 * @param entityId the entity id locator (may be {@code null} when only the FQN is known)
 * @param entityFqn the entity FQN locator (may be {@code null} when only the id is known)
 * @param entityType the entity type, or {@code null}/empty when unknown
 */
public record OrderedLaneTask(
    Runnable work, String operation, String entityId, String entityFqn, String entityType)
    implements OrderedTask {

  @Override
  public void run() {
    work.run();
  }
}
