/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.search.shape.mutations;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.it.search.shape.Rung;
import org.openmetadata.it.search.shape.ShapeMutation;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.search.SearchFieldLimits;

public final class OwnersCountMutation implements ShapeMutation {

  @Override
  public String dimension() {
    return "owners.count";
  }

  @Override
  public boolean appliesTo(final EntityInterface entity) {
    return true;
  }

  /**
   * {@code owners} is a nested field, so the engine rejects a document once its owner array exceeds
   * {@code index.mapping.nested_objects.limit}. That limit is server-controlled — its effective
   * value is {@link SearchFieldLimits#getNestedObjectsLimit()} — so the boundary rungs are derived
   * from it (not hardcoded) and stay correct if an operator retunes {@code searchIndexingLimits}.
   * The {@code aboveNestedLimit} rung is the one {@code AcceptedLimits} tolerates as REJECTED.
   */
  @Override
  public List<Rung> ladder() {
    final int nestedLimit = SearchFieldLimits.active().getNestedObjectsLimit();
    return List.of(
        Rung.of("50", 50),
        Rung.of("belowNestedLimit", nestedLimit - Math.max(1, nestedLimit / 10)),
        Rung.of("aboveNestedLimit", nestedLimit + Math.max(1, nestedLimit / 5)));
  }

  @Override
  public EntityInterface apply(final EntityInterface entity, final Rung rung) {
    final List<EntityReference> owners = new ArrayList<>(rung.magnitude());
    for (int i = 0; i < rung.magnitude(); i++) {
      owners.add(
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType("user")
              .withName("owner_" + i)
              .withDisplayName("Owner " + i));
    }
    entity.setOwners(owners);
    return entity;
  }
}
