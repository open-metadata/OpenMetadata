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
public interface EntityInterface<T> {
  UUID getId();

  String getDescription();

  String getDisplayName();

  Boolean isDeleted();

  default EntityReference getOwner() {
    return null;
  }

  String getFullyQualifiedName();

  default List<TagLabel> getTags() {
    return null;
  }

  Double getVersion();

  String getUpdatedBy();

  long getUpdatedAt();

  URI getHref();

  default List<EntityReference> getFollowers() {
    return null;
  }

  ChangeDescription getChangeDescription();

  EntityReference getEntityReference();

  T getEntity();

  default EntityReference getContainer() {
    return null;
  }

  void setId(UUID id);

  void setDescription(String description);

  default void setTags(List<TagLabel> tags) {
    return;
  };

  void setDisplayName(String displayName);

  void setUpdateDetails(String updatedBy, long updatedAt);

  void setChangeDescription(Double newVersion, ChangeDescription changeDescription);

  default void setOwner(EntityReference owner) {
    return;
  };

  void setDeleted(boolean flag);

  T withHref(URI href);
}
