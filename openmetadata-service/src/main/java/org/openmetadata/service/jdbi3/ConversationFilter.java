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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import org.openmetadata.schema.type.ConversationFilterType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.exception.BadCursorException;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

/** Builds parameterized SQL predicates for Conversation V2 root listing. */
@Builder
@Getter
public class ConversationFilter {
  private String entityLink;
  private UUID userId;
  private ConversationFilterType filterType;
  private Boolean resolved;
  private Long startTs;
  private Long endTs;
  private String before;
  private String after;
  private boolean applyDomainFilter;
  @Builder.Default private List<String> domainFqnHashes = List.of();
  @Builder.Default private List<UUID> teamIds = List.of();

  public Sql build(boolean includeCursor) {
    Map<String, Object> params = new HashMap<>();
    List<String> predicates = new ArrayList<>();
    predicates.add("c.source = 'User'");
    addResolvedPredicate(predicates, params);
    addEntityPredicate(predicates, params);
    addUserPredicate(predicates, params);
    addTimePredicate(predicates, params);
    addDomainPredicate(predicates, params);
    String order = "c.updatedAt DESC, c.id DESC";
    if (includeCursor) {
      order = addCursorPredicate(predicates, params);
    }
    return new Sql("WHERE " + String.join(" AND ", predicates), order, params);
  }

  private void addResolvedPredicate(List<String> predicates, Map<String, Object> params) {
    if (resolved != null) {
      predicates.add("c.resolved = :resolved");
      params.put("resolved", resolved);
    }
  }

  private void addEntityPredicate(List<String> predicates, Map<String, Object> params) {
    if (nullOrEmpty(entityLink)) {
      return;
    }
    MessageParser.EntityLink parsed = MessageParser.EntityLink.parse(entityLink);
    predicates.add("c.aboutFqnHash = :aboutFqnHash AND c.about = :entityLink");
    params.put("aboutFqnHash", FullyQualifiedName.buildHash(parsed.getEntityFQN()));
    params.put("entityLink", entityLink);
  }

  private void addUserPredicate(List<String> predicates, Map<String, Object> params) {
    if (userId == null) {
      return;
    }
    if (filterType == null) {
      throw new IllegalArgumentException("filterType is required when userId is provided");
    }
    params.put("userId", userId.toString());
    params.put("ownsRelation", Relationship.OWNS.ordinal());
    params.put("followsRelation", Relationship.FOLLOWS.ordinal());
    String owner = ownerPredicate();
    String follows = followsPredicate();
    String predicate =
        switch (filterType) {
          case OWNER -> owner;
          case FOLLOWS -> follows;
          case MENTIONS -> mentionsPredicate();
          case OWNER_OR_FOLLOWS -> "(" + owner + " OR " + follows + ")";
        };
    predicates.add(predicate);
  }

  private String ownerPredicate() {
    return "(c.creatorId = :userId OR EXISTS (SELECT 1 FROM conversation_reply cr "
        + "WHERE cr.conversationId = c.id AND cr.authorId = :userId) OR EXISTS (SELECT 1 "
        + "FROM entity_relationship er WHERE er.toId = c.entityId AND er.toEntity = c.entityType "
        + "AND er.relation = :ownsRelation AND "
        + relationshipPrincipalPredicate("er")
        + "))";
  }

  private String followsPredicate() {
    return "EXISTS (SELECT 1 FROM entity_relationship er WHERE "
        + relationshipPrincipalPredicate("er")
        + " AND er.toId = c.entityId AND er.toEntity = c.entityType "
        + "AND er.relation = :followsRelation)";
  }

  private String mentionsPredicate() {
    return "EXISTS (SELECT 1 FROM conversation_mention cm WHERE cm.conversationId = c.id "
        + "AND cm.mentionedEntityId IN ("
        + principalIds()
        + "))";
  }

  private String principalIds() {
    List<UUID> principals = new ArrayList<>();
    principals.add(userId);
    principals.addAll(teamIds);
    return uuidLiterals(principals);
  }

  private String relationshipPrincipalPredicate(String alias) {
    return "(("
        + alias
        + ".fromEntity = 'user' AND "
        + alias
        + ".fromId = :userId) OR ("
        + alias
        + ".fromEntity = 'team' AND "
        + alias
        + ".fromId IN ("
        + uuidLiterals(teamIds)
        + ")))";
  }

  private String uuidLiterals(List<UUID> ids) {
    return ids.stream()
        .distinct()
        .map(id -> "'" + id + "'")
        .reduce((a, b) -> a + "," + b)
        .orElse("''");
  }

  private void addTimePredicate(List<String> predicates, Map<String, Object> params) {
    if (startTs != null) {
      predicates.add("c.createdAt >= :startTs");
      params.put("startTs", startTs);
    }
    if (endTs != null) {
      predicates.add("c.createdAt <= :endTs");
      params.put("endTs", endTs);
    }
  }

  private void addDomainPredicate(List<String> predicates, Map<String, Object> params) {
    if (!applyDomainFilter) {
      return;
    }
    if (nullOrEmpty(domainFqnHashes)) {
      predicates.add(
          "NOT EXISTS (SELECT 1 FROM conversation_domain cd WHERE cd.conversationId = c.id)");
      return;
    }
    List<String> domainPredicates = new ArrayList<>();
    int index = 0;
    for (String fqnHash : domainFqnHashes.stream().distinct().toList()) {
      String exactKey = "domainFqnHash" + index;
      String prefixKey = "domainFqnPrefix" + index;
      domainPredicates.add("(d.fqnHash = :" + exactKey + " OR d.fqnHash LIKE :" + prefixKey + ")");
      params.put(exactKey, fqnHash);
      params.put(prefixKey, fqnHash + ".%");
      index++;
    }
    predicates.add(
        "EXISTS (SELECT 1 FROM conversation_domain cd JOIN domain_entity d ON d.id = cd.domainId "
            + "WHERE cd.conversationId = c.id AND ("
            + String.join(" OR ", domainPredicates)
            + "))");
  }

  private String addCursorPredicate(List<String> predicates, Map<String, Object> params) {
    RestUtil.validateCursors(before, after);
    if (before == null && after == null) {
      return "c.updatedAt DESC, c.id DESC";
    }
    Cursor cursor = Cursor.parse(before == null ? after : before);
    params.put("cursorUpdatedAt", cursor.updatedAt());
    params.put("cursorId", cursor.id());
    if (before != null) {
      predicates.add(
          "(c.updatedAt > :cursorUpdatedAt OR (c.updatedAt = :cursorUpdatedAt "
              + "AND c.id > :cursorId))");
      return "c.updatedAt ASC, c.id ASC";
    }
    predicates.add(
        "(c.updatedAt < :cursorUpdatedAt OR (c.updatedAt = :cursorUpdatedAt "
            + "AND c.id < :cursorId))");
    return "c.updatedAt DESC, c.id DESC";
  }

  public record Sql(String condition, String order, Map<String, Object> params) {}

  public record Cursor(long updatedAt, String id) {
    public static Cursor parse(String encoded) {
      try {
        String decoded = RestUtil.decodeCursor(encoded);
        int separator = decoded.indexOf('|');
        if (separator < 1 || separator == decoded.length() - 1) {
          throw new BadCursorException("Invalid conversation cursor");
        }
        long updatedAt = Long.parseLong(decoded.substring(0, separator));
        String id = UUID.fromString(decoded.substring(separator + 1)).toString();
        return new Cursor(updatedAt, id);
      } catch (BadCursorException exception) {
        throw exception;
      } catch (Exception exception) {
        throw new BadCursorException("Invalid conversation cursor");
      }
    }

    public static String encode(long updatedAt, UUID id) {
      return RestUtil.encodeCursor(updatedAt + "|" + id);
    }
  }
}
