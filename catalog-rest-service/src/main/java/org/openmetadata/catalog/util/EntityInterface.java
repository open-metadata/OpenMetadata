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

package org.openmetadata.catalog.util;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;

/** Interface to be implemented by all entities to provide a way to access all the common fields. */
public abstract class EntityInterface<T> {
  protected final String entityType;
  protected final T entity;

  public EntityInterface(String entityType, T entity) {
    this.entity = entity;
    this.entityType = entityType;
  }

  public abstract UUID getId();

  public abstract String getDescription();

  public abstract String getDisplayName();

  public abstract String getName();

  public abstract Boolean isDeleted();

  public EntityReference getOwner() {
    return null;
  }

  public abstract String getFullyQualifiedName();

  public List<TagLabel> getTags() {
    return null;
  }

  public abstract Double getVersion();

  public abstract String getUpdatedBy();

  public abstract long getUpdatedAt();

  public abstract URI getHref();

  public List<EntityReference> getFollowers() {
    return null;
  }

  public abstract ChangeDescription getChangeDescription();

  public final EntityReference getEntityReference() {
    return new EntityReference()
        .withId(getId())
        .withName(getFullyQualifiedName())
        .withDescription(getDescription())
        .withDisplayName(getDisplayName())
        .withType(entityType)
        .withDeleted(isDeleted())
        .withHref(getHref());
  }

  public abstract T getEntity();

  public EntityReference getContainer() {
    return null;
  }

  public abstract void setId(UUID id);

  public abstract void setDescription(String description);

  public void setTags(List<TagLabel> tags) {
    return;
  };

  public abstract void setDisplayName(String displayName);

  public abstract void setName(String name);

  public abstract void setUpdateDetails(String updatedBy, long updatedAt);

  public abstract void setChangeDescription(Double newVersion, ChangeDescription changeDescription);

  public void setOwner(EntityReference owner) {
    return;
  };

  public abstract void setDeleted(boolean flag);

  public abstract T withHref(URI href);
}
