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
package org.openmetadata.service.rdf;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/** Replayable live hooks. Entity payloads stay in the authoritative metadata tables. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "operation")
@JsonSubTypes({
  @JsonSubTypes.Type(value = RdfLiveWrite.EntityUpdate.class, name = "entity"),
  @JsonSubTypes.Type(value = RdfLiveWrite.EntityDelete.class, name = "delete"),
  @JsonSubTypes.Type(value = RdfLiveWrite.RelationshipChange.class, name = "relationship"),
  @JsonSubTypes.Type(value = RdfLiveWrite.GlossaryRelationChange.class, name = "glossaryRelation")
})
public sealed interface RdfLiveWrite {
  void apply(RdfRepository repository);

  record EntityUpdate(String entityType, UUID entityId) implements RdfLiveWrite {
    public static EntityUpdate capture(final EntityInterface entity) {
      return new EntityUpdate(Entity.getEntityTypeFromObject(entity), entity.getId());
    }

    @Override
    public void apply(final RdfRepository repository) {
      repository.refreshEntity(entityType, entityId);
    }
  }

  record EntityDelete(String entityType, UUID entityId) implements RdfLiveWrite {
    @Override
    public void apply(final RdfRepository repository) {
      repository.delete(new EntityReference().withType(entityType).withId(entityId));
    }
  }

  record RelationshipChange(String relationshipJson, boolean remove) implements RdfLiveWrite {
    public static RelationshipChange capture(
        final EntityRelationship relationship, final boolean remove) {
      return new RelationshipChange(JsonUtils.pojoToJson(relationship), remove);
    }

    @Override
    public void apply(final RdfRepository repository) {
      final EntityRelationship relationship =
          JsonUtils.readValue(relationshipJson, EntityRelationship.class);
      if (remove) {
        repository.removeRelationship(relationship);
      } else {
        repository.addRelationship(relationship);
      }
    }
  }

  record GlossaryRelationChange(UUID fromId, UUID toId, String relationType, boolean remove)
      implements RdfLiveWrite {
    @Override
    public void apply(final RdfRepository repository) {
      if (remove) {
        repository.removeGlossaryTermRelation(fromId, toId, relationType);
      } else {
        repository.addGlossaryTermRelation(fromId, toId, relationType);
      }
    }
  }
}
