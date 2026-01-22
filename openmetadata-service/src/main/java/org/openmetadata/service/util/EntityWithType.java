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

package org.openmetadata.service.util;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.openmetadata.schema.EntityInterface;

/**
 * Wrapper class that combines an EntityInterface with its entity type. Uses @JsonUnwrapped to
 * flatten the entity fields alongside the entityType in JSON serialization.
 *
 * <p>Example JSON output: { "id": "...", "name": "...", "entityType": "table", ... }
 */
@NoArgsConstructor
public class EntityWithType {
  @Getter @Setter @JsonUnwrapped private EntityInterface entity;

  @Getter @Setter private String entityType;

  public EntityWithType(EntityInterface entity, String entityType) {
    this.entity = entity;
    this.entityType = entityType;
  }

  public static EntityWithType from(EntityInterface entity) {
    return new EntityWithType(entity, entity.getEntityReference().getType());
  }
}
