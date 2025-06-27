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

package org.openmetadata.service.events.lifecycle;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Interface for handling entity lifecycle events.
 * Implementations can perform custom actions when entities are created, updated, or deleted.
 * This allows for extensible behavior without modifying core repository logic.
 */
public interface EntityLifecycleEventHandler {

  /**
   * Called after an entity is successfully created.
   *
   * @param entity The entity that was created
   * @param subjectContext The security context of the user who created the entity
   */
  default void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
    // Default empty implementation
  }

  /**
   * Called after an entity is successfully updated.
   *
   * @param entity The updated entity
   * @param changeDescription Description of changes made to the entity
   * @param subjectContext The security context of the user who updated the entity
   */
  default void onEntityUpdated(
      EntityInterface entity, ChangeDescription changeDescription, SubjectContext subjectContext) {
    // Default empty implementation
  }

  /**
   * Called after an entity is successfully updated.
   *
   * @param entityRef The updated entity reference
   * @param subjectContext The security context of the user who updated the entity
   */
  default void onEntityUpdated(EntityReference entityRef, SubjectContext subjectContext) {
    // Default empty implementation
  }

  /**
   * Called after an entity is successfully deleted.
   *
   * @param entity The entity that was deleted
   * @param subjectContext The security context of the user who deleted the entity
   */
  default void onEntityDeleted(EntityInterface entity, SubjectContext subjectContext) {
    // Default empty implementation
  }

  /**
   * Called after an entity is soft deleted or restored.
   *
   * @param entity The entity that was soft deleted or restored
   * @param isDeleted true if soft deleted, false if restored
   * @param subjectContext The security context of the user who performed the action
   */
  default void onEntitySoftDeletedOrRestored(
      EntityInterface entity, boolean isDeleted, SubjectContext subjectContext) {
    // Default empty implementation
  }

  /**
   * Returns the name/identifier for this handler.
   * Used for logging and configuration purposes.
   *
   * @return Handler name
   */
  String getHandlerName();

  /**
   * Returns the priority of this handler.
   * Handlers with lower priority values are executed first.
   * Default priority is 100.
   *
   * @return Handler priority
   */
  default int getPriority() {
    return 100;
  }

  /**
   * Indicates whether this handler should be executed asynchronously.
   * Async handlers don't block the main entity operation.
   * Default is true to avoid impacting performance.
   *
   * @return true if handler should be executed asynchronously
   */
  default boolean isAsync() {
    return true;
  }

  /**
   * Returns the entity types this handler is interested in.
   * If empty, handler will be called for all entity types.
   *
   * @return Set of entity types to handle, or empty for all types
   */
  default java.util.Set<String> getSupportedEntityTypes() {
    return java.util.Collections.emptySet();
  }
}
