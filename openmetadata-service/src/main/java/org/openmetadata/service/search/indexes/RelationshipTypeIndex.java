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

package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.service.Entity;

public record RelationshipTypeIndex(RelationshipType relationshipType) implements SearchIndex {

  @Override
  public Object getEntity() {
    return relationshipType;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.RELATIONSHIP_TYPE;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(final Map<String, Object> document) {
    return document;
  }
}
