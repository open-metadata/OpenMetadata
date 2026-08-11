/*
 *  Copyright 2024 Collate
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

import java.util.List;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Votes;

/**
 * Lightweight interface for named objects that don't need full entity semantics. Use this for
 * objects like Task, Workflow instances, etc. that need identity and versioning but not owners,
 * followers, votes, or other entity-specific features.
 *
 * <p>Extends EntityInterface to reuse existing repository infrastructure, but provides explicit
 * null/no-op defaults for features that don't apply to lightweight entities.
 */
@SuppressWarnings("unused")
public interface NamedEntityInterface extends EntityInterface {

  @Override
  default List<EntityReference> getOwners() {
    return null;
  }

  @Override
  default void setOwners(List<EntityReference> owners) {}

  @Override
  default List<EntityReference> getFollowers() {
    return null;
  }

  @Override
  default void setFollowers(List<EntityReference> followers) {}

  @Override
  default Votes getVotes() {
    return null;
  }

  @Override
  default void setVotes(Votes votes) {}

  @Override
  default List<EntityReference> getDataProducts() {
    return null;
  }

  @Override
  default void setDataProducts(List<EntityReference> dataProducts) {}

  @Override
  default List<TagLabel> getTags() {
    return null;
  }

  @Override
  default void setTags(List<TagLabel> tags) {}

  @Override
  default Object getExtension() {
    return null;
  }

  @Override
  default void setExtension(Object extension) {}

  @Override
  default Style getStyle() {
    return null;
  }

  @Override
  default void setStyle(Style style) {}

  @Override
  default LifeCycle getLifeCycle() {
    return null;
  }

  @Override
  default void setLifeCycle(LifeCycle lifeCycle) {}

  @Override
  default AssetCertification getCertification() {
    return null;
  }

  @Override
  default void setCertification(AssetCertification certification) {}

  @Override
  default List<EntityReference> getExperts() {
    return null;
  }

  @Override
  default void setExperts(List<EntityReference> experts) {}

  @Override
  default List<EntityReference> getChildren() {
    return null;
  }

  @Override
  default void setChildren(List<EntityReference> children) {}

  @Override
  default ChangeDescription getIncrementalChangeDescription() {
    return null;
  }

  @Override
  default void setIncrementalChangeDescription(ChangeDescription changeDescription) {}

  @Override
  default EntityReference getService() {
    return null;
  }
}
