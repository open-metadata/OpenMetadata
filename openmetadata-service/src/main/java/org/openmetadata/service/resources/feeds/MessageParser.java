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

package org.openmetadata.service.resources.feeds;

import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_ENTITY_LINK;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public final class MessageParser {

  private MessageParser() {}

  private static final String ENTITY_LINK_SEPARATOR = "::";
  // Pattern to match the following markdown entity links:
  // <#E::{entityType}::{entityFQN}>  -- <#E::table::bigquery_gcp.shopify.product>
  // <#E::{entityType}::{entityFQN}::{fieldName}> --
  // <#E::table::bigquery_gcp.shopify.product::description>
  // <#E::{entityType}::{entityFQN}::{fieldName}::{arrayFieldName}>
  // -- <#E::table::bigquery_gcp.shopify.product::columns::product_id>
  // <#E::{entityType}::{entityFQN}::{fieldName}::{arrayFieldName}::{arrayFieldValue}>
  // -- <#E::table::bigquery_gcp.shopify.product::columns::product_id::description>
  private static final Pattern ENTITY_LINK_PATTERN =
      Pattern.compile(
          "<#E"
              + ENTITY_LINK_SEPARATOR
              + // Match initial string <#E::
              "([^<>]+?)"
              + // Non-greedy collection group 1 for {entityType}
              ENTITY_LINK_SEPARATOR
              + "([^<>]+?)"
              + // Non-greedy collection group 2 for {entityFQN}
              "("
              + ENTITY_LINK_SEPARATOR
              + "([^<>]+?))?"
              + // Non-greedy collection group 3 for optional ::{fieldName} and 4 for fieldName
              "("
              + ENTITY_LINK_SEPARATOR
              + "([^<>]+?))?"
              + // Non-greedy collection group 5 for optional ::{arrayFieldName} // and 6 for
              // arrayFieldName
              "("
              + ENTITY_LINK_SEPARATOR
              + "([^<>]+?))?"
              + // Non-greedy collection group 7 for optional ::{arrayFieldValue} // and 8 for
              // arrayFieldValue
              ">"); // Match for end of link name

  public static class EntityLink {
    @Getter private final LinkType linkType;
    @Getter private final String entityType;
    @Getter private final String entityFQN;
    @Getter private final String fieldName;
    @Getter private final String arrayFieldName;
    @Getter private final String arrayFieldValue;
    @Getter private final String fullyQualifiedFieldType;
    @Getter private final String fullyQualifiedFieldValue;

    public enum LinkType {
      ENTITY,
      ENTITY_REGULAR_FIELD,
      ENTITY_ARRAY_FIELD
    }

    public EntityLink(String entityType, String entityFqn) {
      this(entityType, entityFqn, null, null, null);
    }

    public EntityLink(
        String entityType,
        String entityFqn,
        String fieldName,
        String arrayFieldName,
        String arrayFieldValue) {
      if (entityType == null || entityFqn == null) {
        throw new IllegalArgumentException(
            "Entity link must have both {entityType} and {entityFQN}");
      }
      this.entityType = entityType;
      this.entityFQN = entityFqn;
      this.fieldName = fieldName;
      this.arrayFieldName = arrayFieldName;
      this.arrayFieldValue = arrayFieldValue;

      if (arrayFieldValue != null) {
        if (arrayFieldName == null) {
          throw new IllegalArgumentException(INVALID_ENTITY_LINK);
        }
        // Entity link example:
        // <#E::table::bigquery_gcp.shopify.product::columns::product_id::description>
        // FullyQualifiedFieldType: table.columns.member
        // FullyQualifiedFieldValue: bigQuery_gcp.shopify.product.product_id.description
        this.linkType = LinkType.ENTITY_ARRAY_FIELD;
        this.fullyQualifiedFieldType = String.format("%s.%s.member", entityType, fieldName);
        this.fullyQualifiedFieldValue =
            String.format("%s.%s.%s", entityFqn, arrayFieldName, arrayFieldValue);
      } else if (arrayFieldName != null) {
        // Entity link example: <#E::table::bigquery_gcp.shopify.product::columns::product_id>
        // FullyQualifiedFieldType: table.columns.member
        // FullyQualifiedFieldValue: bigQuery_gcp.shopify.product.product_id
        this.linkType = LinkType.ENTITY_ARRAY_FIELD;
        this.fullyQualifiedFieldType = String.format("%s.%s.member", entityType, fieldName);
        this.fullyQualifiedFieldValue = String.format("%s.%s", entityFqn, arrayFieldName);
      } else if (fieldName != null) {
        // Entity link example: <#E::table::bigquery_gcp.shopify.product::description>
        // FullyQualifiedFieldType: table.description
        // FullyQualifiedFieldValue: bigQuery_gcp.shopify.product.description
        this.linkType = LinkType.ENTITY_REGULAR_FIELD;
        this.fullyQualifiedFieldType = String.format("%s.%s", entityType, fieldName);
        this.fullyQualifiedFieldValue = String.format("%s.%s", entityFqn, fieldName);
      } else {
        // Entity link example: <#E::table::bigquery_gcp.shopify.product>
        // FullyQualifiedFieldType: table
        // FullyQualifiedFieldValue: bigQuery_gcp.shopify.product
        this.linkType = LinkType.ENTITY;
        this.fullyQualifiedFieldType = entityType;
        this.fullyQualifiedFieldValue = entityFqn;
      }
    }

    public String getLinkString() {
      StringBuilder builder = new StringBuilder("<#E");
      builder
          .append(ENTITY_LINK_SEPARATOR)
          .append(entityType)
          .append(ENTITY_LINK_SEPARATOR)
          .append(entityFQN);
      if (linkType == LinkType.ENTITY_REGULAR_FIELD || linkType == LinkType.ENTITY_ARRAY_FIELD) {
        builder.append(ENTITY_LINK_SEPARATOR).append(fieldName);
      }
      if (linkType == LinkType.ENTITY_ARRAY_FIELD) {
        builder.append(ENTITY_LINK_SEPARATOR).append(arrayFieldName);
        if (StringUtils.isNotEmpty(arrayFieldValue)) {
          builder.append(ENTITY_LINK_SEPARATOR).append(arrayFieldValue);
        }
      }
      builder.append(">");
      return builder.toString();
    }

    public static EntityLink parse(String link) {
      // Entity links also have support for fallback texts with "|"
      // example: <#E::user::user1|[@User One](http://localhost:8585/user/user1)>
      // Extract the entity link alone if the string has a fallback text
      if (link.contains("|")) {
        link = link.substring(0, link.indexOf("|")) + ">";
      }
      Matcher matcher = ENTITY_LINK_PATTERN.matcher(link);
      EntityLink entityLink = null;
      while (matcher.find()) {
        if (entityLink == null) {
          String entityType = matcher.group(1);
          String entityFQN = matcher.group(2);
          if (entityFQN == null) {
            throw new IllegalArgumentException(
                "Invalid Entity Link. Entity FQN is missing in " + link);
          }
          if (entityType.equalsIgnoreCase(Entity.USER)
              || entityType.equalsIgnoreCase(Entity.TEAM)) {
            entityFQN = FullyQualifiedName.quoteName(entityFQN);
          }
          entityLink =
              new EntityLink(
                  entityType, entityFQN, matcher.group(4), matcher.group(6), matcher.group(8));
        } else {
          throw new IllegalArgumentException("Unexpected multiple entity links in " + link);
        }
      }
      if (entityLink == null) {
        throw new IllegalArgumentException("Entity link was not found in " + link);
      }
      return entityLink;
    }

    @Override
    public String toString() {
      return String.format(
          "EntityLink { type = %s, entityType = %s, entityFQN = %s, fieldName = %s, arrayFieldName = %s, arrayFieldValue = %s}",
          linkType, entityType, entityFQN, fieldName, arrayFieldName, arrayFieldValue);
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
      return linkType == that.linkType
          && Objects.equals(entityType, that.entityType)
          && Objects.equals(entityFQN, that.entityFQN)
          && Objects.equals(fieldName, that.fieldName)
          && Objects.equals(arrayFieldName, that.arrayFieldName)
          && Objects.equals(arrayFieldValue, that.arrayFieldValue);
    }

    @Override
    public int hashCode() {
      return Objects.hash(
          linkType, entityType, entityFQN, fieldName, arrayFieldName, arrayFieldValue);
    }
  }

  /** Parse the message and get the mentions */
  public static List<EntityLink> getEntityLinks(String message) {
    List<EntityLink> links = new ArrayList<>();
    Matcher matcher = ENTITY_LINK_PATTERN.matcher(message);
    while (matcher.find()) {
      links.add(EntityLink.parse(matcher.group()));
    }
    return links;
  }

  public static String replaceEntityLinks(String message) {
    String result = message;
    int length = result.length();
    Matcher matcher = ENTITY_LINK_PATTERN.matcher(result);
    while (matcher.find()) {
      EntityLink link = EntityLink.parse(matcher.group());
      result =
          result.substring(0, matcher.start())
              + String.format("@%s", link.getEntityFQN())
              + result.substring(matcher.end(), length);
      length = result.length();
      matcher = ENTITY_LINK_PATTERN.matcher(result);
    }
    return result;
  }
}
