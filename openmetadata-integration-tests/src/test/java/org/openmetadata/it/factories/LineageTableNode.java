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

package org.openmetadata.it.factories;

import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/**
 * The minimum of a seeded table the lineage benchmark needs to wire an edge.
 *
 * <p>Holding the full {@link org.openmetadata.schema.entity.data.Table} for every node costs
 * hundreds of MB at the cohort sizes this fixture targets, against the {@code -Xmx4096m} the
 * {@code scale-it} profile allows.
 */
public record LineageTableNode(UUID id, String fullyQualifiedName) {

  public EntityReference reference() {
    return new EntityReference()
        .withId(id)
        .withType(Entity.TABLE)
        .withFullyQualifiedName(fullyQualifiedName);
  }

  public String columnFqn(final String columnName) {
    return fullyQualifiedName + "." + columnName;
  }
}
