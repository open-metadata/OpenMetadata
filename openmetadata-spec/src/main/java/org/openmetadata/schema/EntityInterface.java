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

package org.openmetadata.schema;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TagLabel;

/** Interface to be implemented by all entities to provide a way to access all the common fields. */
public interface EntityInterface {
  // Lower case entity name to canonical entity name map
  Map<String, String> CANONICAL_ENTITY_NAME_MAP = new HashMap<>();
  Map<String, Class<? extends EntityInterface>> ENTITY_TYPE_TO_CLASS_MAP = new HashMap<>();

  UUID getId();

  String getDescription();

  String getDisplayName();

  String getName();

  default Boolean getDeleted() {
    return null;
  }

  Double getVersion();

  String getUpdatedBy();

  Long getUpdatedAt();

  URI getHref();

  ChangeDescription getChangeDescription();

  default EntityReference getOwner() {
    return null;
  }

  default List<TagLabel> getTags() {
    return null;
  }

  default ProviderType getProvider() {
    return null;
  }

  default List<EntityReference> getFollowers() {
    return null;
  }

  String getFullyQualifiedName();

  default Object getExtension() {
    return null;
  }

  void setId(UUID id);

  void setDescription(String description);

  void setDisplayName(String displayName);

  void setName(String name);

  void setVersion(Double newVersion);

  void setChangeDescription(ChangeDescription changeDescription);

  void setFullyQualifiedName(String fullyQualifiedName);

  default void setDeleted(Boolean flag) {}

  void setUpdatedBy(String admin);

  void setUpdatedAt(Long updatedAt);

  void setHref(URI href);

  default void setTags(List<TagLabel> tags) {
    /* no-op implementation to be overridden */
  }

  default void setOwner(EntityReference owner) {
    /* no-op implementation to be overridden */
  }

  default void setExtension(Object extension) {
    /* no-op implementation to be overridden */
  }

  <T extends EntityInterface> T withHref(URI href);

  @JsonIgnore
  default EntityReference getEntityReference() {
    return new EntityReference()
        .withId(getId())
        .withName(getName())
        .withFullyQualifiedName(getFullyQualifiedName() == null ? getName() : getFullyQualifiedName())
        .withDescription(getDescription())
        .withDisplayName(getDisplayName())
        .withType(CANONICAL_ENTITY_NAME_MAP.get(this.getClass().getSimpleName().toLowerCase(Locale.ROOT)))
        .withDeleted(getDeleted())
        .withHref(getHref());
  }
}
