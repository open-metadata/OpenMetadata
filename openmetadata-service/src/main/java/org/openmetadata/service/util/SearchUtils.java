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
      parent.setId(parseUuid((String) parentMap.get("id")));
      parent.setType((String) parentMap.get("type"));
      parent.setName((String) parentMap.get("name"));
      parent.setFullyQualifiedName((String) parentMap.get("fullyQualifiedName"));
      parent.setDisplayName((String) parentMap.get("displayName"));
      parent.setDescription((String) parentMap.get("description"));
    }

    PageHierarchy page = new PageHierarchy();

    UUID pageId = parseUuid(idStr);
    if (pageId != null) {
      page.withId(pageId);
    }

    PageType pageType = parsePageType(pageTypeStr);
    if (pageType != null) {
      page.withPageType(pageType);
    }

    page.withName(name)
        .withDisplayName(displayName)
        .withFullyQualifiedName(fullyQualifiedName)
        .withParent(parent);

    return page;
  }

  /**
   * Parse a UUID string safely — returns null for missing or malformed values so a single
   * bad hit does not break the entire hierarchy response.
   */
  private static UUID parseUuid(String value) {
    if (value == null || value.isEmpty()) {
      return null;
    }
    try {
      return UUID.fromString(value);
    } catch (IllegalArgumentException e) {
      LOG.warn("Ignoring malformed UUID in search hit: {}", value);
      return null;
    }
  }

  /**
   * Parse a PageType string safely — returns null for missing or unknown values (e.g. an
   * index written by a newer server version) so a single bad hit does not break the
   * entire hierarchy response.
   */
  private static PageType parsePageType(String value) {
    if (value == null || value.isEmpty()) {
      return null;
    }
    try {
      return PageType.fromValue(value);
    } catch (IllegalArgumentException e) {
      LOG.warn("Ignoring unknown pageType in search hit: {}", value);
      return null;
    }
  }
}
