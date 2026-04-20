/*
 *  Copyright 2025 Collate
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

import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.PageHierarchy;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.type.EntityReference;

@Slf4j
public final class SearchUtils {

  private SearchUtils() {}

  @SuppressWarnings("unchecked")
  public static PageHierarchy getPageHierarchy(Map<String, Object> sourceMap) {
    String idStr = (String) sourceMap.get("id");
    String pageTypeStr = (String) sourceMap.get("pageType");
    String name = (String) sourceMap.get("name");
    String displayName = (String) sourceMap.get("displayName");
    String fullyQualifiedName = (String) sourceMap.get("fullyQualifiedName");
    Map<String, Object> parentMap = (Map<String, Object>) sourceMap.get("parent");
    EntityReference parent = null;

    if (parentMap != null) {
      parent = new EntityReference();
      parent.setId(UUID.fromString((String) parentMap.get("id")));
      parent.setType((String) parentMap.get("type"));
      parent.setName((String) parentMap.get("name"));
      parent.setFullyQualifiedName((String) parentMap.get("fullyQualifiedName"));
      parent.setDisplayName((String) parentMap.get("displayName"));
      parent.setDescription((String) parentMap.get("description"));
    }

    PageHierarchy page = new PageHierarchy();

    if (idStr != null) {
      page.withId(UUID.fromString(idStr));
    }

    if (pageTypeStr != null) {
      page.withPageType(PageType.fromValue(pageTypeStr));
    }

    page.withName(name)
        .withDisplayName(displayName)
        .withFullyQualifiedName(fullyQualifiedName)
        .withParent(parent);

    return page;
  }
}
