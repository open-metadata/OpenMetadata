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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ConversationFilterType;
import org.openmetadata.service.exception.BadCursorException;

class ConversationFilterTest {

  @Test
  void buildsDomainlessVisibilityPredicate() {
    ConversationFilter.Sql sql =
        ConversationFilter.builder().applyDomainFilter(true).build().build(false);

    assertTrue(sql.condition().contains("NOT EXISTS"));
    assertTrue(sql.condition().contains("conversation_domain"));
  }

  @Test
  void buildsInheritedDomainVisibilityPredicate() {
    String domainFqnHash = "parentHash";
    ConversationFilter.Sql sql =
        ConversationFilter.builder()
            .applyDomainFilter(true)
            .domainFqnHashes(List.of(domainFqnHash))
            .build()
            .build(false);

    assertTrue(sql.condition().contains("conversation_domain"));
    assertTrue(sql.condition().contains("domain_entity"));
    assertTrue(sql.condition().contains("d.fqnHash LIKE :domainFqnPrefix0"));
    assertEquals(domainFqnHash, sql.params().get("domainFqnHash0"));
    assertEquals(domainFqnHash + ".%", sql.params().get("domainFqnPrefix0"));
  }

  @Test
  void omitsDomainPredicateForUnrestrictedSubjects() {
    ConversationFilter.Sql sql = ConversationFilter.builder().build().build(false);

    assertFalse(sql.condition().contains("conversation_domain"));
  }

  @Test
  void parameterizesResolutionAndTimeRange() {
    ConversationFilter.Sql sql =
        ConversationFilter.builder()
            .resolved(true)
            .startTs(1000L)
            .endTs(2000L)
            .build()
            .build(false);

    assertTrue(sql.condition().contains("c.resolved = :resolved"));
    assertTrue(sql.condition().contains("c.createdAt >= :startTs"));
    assertTrue(sql.condition().contains("c.createdAt <= :endTs"));
    assertEquals(true, sql.params().get("resolved"));
    assertEquals(1000L, sql.params().get("startTs"));
    assertEquals(2000L, sql.params().get("endTs"));
  }

  @Test
  void requiresFilterTypeForUserScopedListings() {
    assertThrows(
        IllegalArgumentException.class,
        () -> ConversationFilter.builder().userId(UUID.randomUUID()).build().build(false));
  }

  @Test
  void buildsOwnerFollowerAndMentionFilters() {
    UUID userId = UUID.randomUUID();
    UUID teamId = UUID.randomUUID();

    ConversationFilter.Sql owner = userFilter(userId, teamId, ConversationFilterType.OWNER);
    ConversationFilter.Sql follows = userFilter(userId, teamId, ConversationFilterType.FOLLOWS);
    ConversationFilter.Sql mentions = userFilter(userId, teamId, ConversationFilterType.MENTIONS);
    ConversationFilter.Sql combined =
        userFilter(userId, teamId, ConversationFilterType.OWNER_OR_FOLLOWS);

    assertTrue(owner.condition().contains("c.creatorId = :userId"));
    assertTrue(owner.condition().contains("conversation_reply"));
    assertTrue(owner.condition().contains("er.fromEntity = 'user'"));
    assertTrue(owner.condition().contains("er.fromEntity = 'team'"));
    assertTrue(owner.condition().contains(teamId.toString()));
    assertTrue(follows.condition().contains("er.relation = :followsRelation"));
    assertTrue(follows.condition().contains("er.fromEntity = 'user'"));
    assertTrue(follows.condition().contains("er.fromEntity = 'team'"));
    assertTrue(follows.condition().contains(teamId.toString()));
    assertTrue(mentions.condition().contains("conversation_mention"));
    assertTrue(mentions.condition().contains(teamId.toString()));
    assertTrue(combined.condition().contains(" OR "));
  }

  @Test
  void validatesAndBuildsKeysetCursors() {
    UUID id = UUID.randomUUID();
    String cursor = ConversationFilter.Cursor.encode(1234L, id);

    ConversationFilter.Sql after = ConversationFilter.builder().after(cursor).build().build(true);
    ConversationFilter.Sql before = ConversationFilter.builder().before(cursor).build().build(true);

    assertEquals(1234L, after.params().get("cursorUpdatedAt"));
    assertEquals(id.toString(), after.params().get("cursorId"));
    assertTrue(after.condition().contains("c.updatedAt < :cursorUpdatedAt"));
    assertEquals("c.updatedAt DESC, c.id DESC", after.order());
    assertTrue(before.condition().contains("c.updatedAt > :cursorUpdatedAt"));
    assertEquals("c.updatedAt ASC, c.id ASC", before.order());
    assertThrows(
        BadCursorException.class,
        () -> ConversationFilter.builder().after("not-a-cursor").build().build(true));
  }

  private ConversationFilter.Sql userFilter(
      UUID userId, UUID teamId, ConversationFilterType filterType) {
    return ConversationFilter.builder()
        .userId(userId)
        .teamIds(List.of(teamId))
        .filterType(filterType)
        .build()
        .build(false);
  }
}
