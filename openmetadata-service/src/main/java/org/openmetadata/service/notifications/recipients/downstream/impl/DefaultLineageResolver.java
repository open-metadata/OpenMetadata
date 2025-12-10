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

package org.openmetadata.service.notifications.recipients.downstream.impl;

import java.util.Collections;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.notifications.recipients.downstream.EntityLineageResolver;

/**
 * Default resolver for entities that participate directly in lineage.
 *
 * These entities don't need transformation; their own lineage is used directly.
 * This resolver acts as a catch-all for any entity types not explicitly mapped
 * to specific resolvers.
 */
public class DefaultLineageResolver implements EntityLineageResolver {

  @Override
  public Set<EntityReference> resolveTraversalEntities(ChangeEvent changeEvent) {
    // No transformation needed; return empty set to signal entity is lineage-capable
    return Collections.emptySet();
  }

  @Override
  public Set<EntityReference> resolveTraversalEntities(UUID entityId, String entityType) {
    // No transformation needed; return empty set to signal entity is lineage-capable
    return Collections.emptySet();
  }

  @Override
  public String getEntityType() {
    return "*";
  }
}
