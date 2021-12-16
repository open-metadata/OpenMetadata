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

package org.openmetadata.catalog.resources.feeds;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MessageParser {

  private MessageParser() {

  }
  // Pattern to match the following markdown entity links:
  // <#E/{entityType}/{entityId}
  // <#E/{entityType}/{entityId}/{fieldName}
  // <#E/{entityType}/{entityId}/{fieldName}/{fieldValue}
  private static final Pattern ENTITY_LINK_PATTERN =
          Pattern.compile("<#E/" +  // Match initial string <#E/
                  "([^<>]+?)" +     // Non-greedy collection group 1 for {entityType}
                  "/([^<>]+?)" +    // Non-greedy collection group 2 for {entityId}
                  "(/([^<>]+?))?" + // Non-greedy collection group 3 for optional /{fieldName} and 4 for fieldName
                  "(/([^<>]+?))?" + // Non-greedy collection group 5 for optional /{fieldValue} and 6 for fieldValue
                  ">");             // Match for end of link name

  public static class EntityLink {
    private final LinkType linkType;
    private final String entityType;
    private final String entityId;
    private final String fieldName;
    private final String fieldValue;
    private final String fullyQualifiedFieldType;
    private final String fullyQualifiedFieldValue;

    public enum LinkType {
      ENTITY,
      ENTITY_REGULAR_FIELD,
      ENTITY_ARRAY_FIELD
    }

    public EntityLink(String entityType, String entityId, String fieldName, String fieldValue) {
      if (entityType == null || entityId == null) {
        throw new IllegalArgumentException("Entity link must have both {entityType} and {entityId}");
      }
      this.entityType = entityType;
      this.entityId = entityId;
      this.fieldName = fieldName;
      this.fieldValue = fieldValue;

      if (fieldValue != null) {
        this.linkType = LinkType.ENTITY_ARRAY_FIELD;
        this.fullyQualifiedFieldType = String.format("%s.%s.member", entityType, fieldName);
        this.fullyQualifiedFieldValue = String.format("%s.%s", entityId, fieldValue);
      } else if (fieldName != null) {
        this.fullyQualifiedFieldType = String.format("%s.%s", entityType, fieldName);
        this.fullyQualifiedFieldValue = String.format("%s.%s", entityId, fieldName);
        this.linkType = LinkType.ENTITY_REGULAR_FIELD;
      } else {
        this.fullyQualifiedFieldType = entityType;
        this.fullyQualifiedFieldValue = entityId;
        this.linkType = LinkType.ENTITY;
      }
    }

    public static EntityLink parse(String link) {
      Matcher matcher = ENTITY_LINK_PATTERN.matcher(link);
      EntityLink entityLink = null;
      while (matcher.find()) {
        if (entityLink == null) {
          entityLink = new EntityLink(matcher.group(1), matcher.group(2), matcher.group(4), matcher.group(6));
        } else {
          throw new IllegalArgumentException("Unexpected multiple entity links in " + link);
        }
      }
      if (entityLink == null) {
        throw new IllegalArgumentException("Entity link was not found in " + link);
      }
      return entityLink;
    }

    public LinkType getLinkType() {
      return linkType;
    }

    public String getEntityType() {
      return entityType;
    }

    public String getEntityId() {
      return entityId;
    }

    public String getFieldName() {
      return fieldName;
    }

    public String getFieldValue() {
      return fieldValue;
    }

    public String getFullyQualifiedFieldType() {
      return fullyQualifiedFieldType;
    }

    public String getFullyQualifiedFieldValue() {
      return fullyQualifiedFieldValue;
    }

    @Override
    public String toString() {
      return String.format("EntityLink { type = %s, entityType = %s, entityId = %s, fieldName = %s, fieldValue = %s}",
              linkType, entityType, entityType, fieldName, fieldName);
    }

    @Override
    public boolean equals(Object o) {
      if (this == o) {
        return true;
      }
      if (o == null || getClass() != o.getClass()) {
        return false;
      }
      EntityLink that = (EntityLink) o;
      return linkType == that.linkType && Objects.equals(entityType, that.entityType) && Objects.equals(entityId,
              that.entityId) && Objects.equals(fieldName, that.fieldName) && Objects.equals(fieldValue,
              that.fieldValue);
    }

    @Override
    public int hashCode() {
      return Objects.hash(linkType, entityType, entityId, fieldName, fieldValue);
    }
  }

  /**
   * Parse the message and get the mentions
   */
  public static List<EntityLink> getEntityLinks(String message) {
    List<EntityLink> links = new ArrayList<>();
    Matcher matcher = ENTITY_LINK_PATTERN.matcher(message);
    while (matcher.find()) {
      EntityLink link = new EntityLink(matcher.group(1), matcher.group(2), matcher.group(4), matcher.group(6));
      links.add(link);
    }
    return links;
  }
}
