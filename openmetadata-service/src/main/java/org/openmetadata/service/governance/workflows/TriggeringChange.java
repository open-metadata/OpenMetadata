/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.governance.workflows;

import java.util.OptionalDouble;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.util.ApprovalCycleHistory;

/**
 * The change an event-triggered run judges: the change of the entity version the triggering event
 * produced. Another edit can be stored before the run reads the entity, and then the entity's own
 * change is that later edit's, not the one that started the run.
 */
@Slf4j
public final class TriggeringChange {
  private TriggeringChange() {}

  /**
   * Whether a run whose entity shows no change still has something to judge. Only a create carries
   * no change: an update that leaves none (an edit undone within its session reverts the entity to
   * a version without one) has nothing to judge. A run started before the event type was recorded
   * keeps treating a missing change as a create.
   */
  public static boolean mayCarryNoChange(Object triggeringEventType) {
    return triggeringEventType == null
        || EventType.ENTITY_CREATED.value().equals(triggeringEventType);
  }

  /**
   * The change of {@code triggeringVersion} on {@code entity}, or the entity's current change when
   * the run carries no version, the entity is still at it, or its history no longer has it.
   */
  public static ChangeDescription of(EntityInterface entity, Object triggeringVersion) {
    ChangeDescription change = entity.getChangeDescription();
    // Flowable hands process variables back as Object; the event consumer stores the version as
    // the ChangeEvent's Double.
    if (triggeringVersion instanceof Number version && isAnotherVersion(entity, version)) {
      change = changeAt(entity, version.toString(), change);
    }
    return change;
  }

  /**
   * The version the triggering edit was made from, where an approval cycle it opens begins; empty
   * when the run carries no triggering version. When the history no longer has the triggering
   * version (an edit undone within its session), the cycle begins at the version before it.
   */
  public static OptionalDouble baseVersion(EntityInterface entity, Object triggeringVersion) {
    OptionalDouble base = OptionalDouble.empty();
    if (triggeringVersion instanceof Number version) {
      ChangeDescription change =
          isAnotherVersion(entity, version)
              ? changeAt(entity, version.toString(), null)
              : entity.getChangeDescription();
      base = OptionalDouble.of(ApprovalCycleHistory.previousVersion(version.doubleValue(), change));
    }
    return base;
  }

  private static boolean isAnotherVersion(EntityInterface entity, Number version) {
    return !Double.valueOf(version.doubleValue()).equals(entity.getVersion());
  }

  private static ChangeDescription changeAt(
      EntityInterface entity, String version, ChangeDescription whenMissing) {
    ChangeDescription change = whenMissing;
    try {
      EntityInterface atVersion =
          Entity.getEntityRepository(Entity.getEntityTypeFromObject(entity))
              .getVersion(entity.getId(), version);
      change = atVersion.getChangeDescription();
    } catch (EntityNotFoundException e) {
      LOG.warn("Version {} of {} is not in its history", version, entity.getFullyQualifiedName());
    }
    return change;
  }
}
