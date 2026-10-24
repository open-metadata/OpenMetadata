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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.migrateRepositoryTables;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.withDatabase;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class TagUsageDeletedFilterTest {

  private static final String TARGET_HASH = "entityHash";
  private static final String LIVE_TAG_FQN = "PII.Sensitive";
  private static final String DELETED_TAG_FQN = "PII.OldTag";
  private static final String ORPHAN_TAG_FQN = "PII.Orphan";
  private static final String LIVE_TERM_FQN = "Glossary.Customer";
  private static final String DELETED_TERM_FQN = "Glossary.OldTerm";

  private static final String LIVE_TAG_JSON =
      "{\"id\":\"11111111-1111-1111-1111-111111111111\",\"name\":\"Sensitive\","
          + "\"fullyQualifiedName\":\"PII.Sensitive\","
          + "\"deleted\":false,\"updatedAt\":1,\"updatedBy\":\"admin\","
          + "\"displayName\":\"Sensitive Display\",\"description\":\"Sensitive data\"}";

  private static final String DELETED_TAG_JSON =
      "{\"id\":\"22222222-2222-2222-2222-222222222222\",\"name\":\"OldTag\","
          + "\"fullyQualifiedName\":\"PII.OldTag\","
          + "\"deleted\":true,\"updatedAt\":1,\"updatedBy\":\"admin\","
          + "\"displayName\":\"Old Display\",\"description\":\"Old description\"}";

  private static final String LIVE_TERM_JSON =
      "{\"id\":\"33333333-3333-3333-3333-333333333333\",\"name\":\"Customer\","
          + "\"fullyQualifiedName\":\"Glossary.Customer\","
          + "\"deleted\":false,\"updatedAt\":1,\"updatedBy\":\"admin\","
          + "\"displayName\":\"Customer Display\",\"description\":\"A customer\"}";

  private static final String DELETED_TERM_JSON =
      "{\"id\":\"44444444-4444-4444-4444-444444444444\",\"name\":\"OldTerm\","
          + "\"fullyQualifiedName\":\"Glossary.OldTerm\","
          + "\"deleted\":true,\"updatedAt\":1,\"updatedBy\":\"admin\","
          + "\"displayName\":\"Old Term Display\",\"description\":\"Old term\"}";

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void getTagsInternalByTargetHashes_excludesSoftDeletedTagsAndTerms(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          seedData(handle, dialect);
          TagUsageDAO tagUsageDAO = handle.attach(CollectionDAO.class).tagUsageDAO();

          List<Pair<String, TagLabel>> rows =
              tagUsageDAO.getTagsInternalByTargetHashes(List.of(TARGET_HASH));
          Map<String, TagLabel> byFqn = labelsByFqn(rows);

          assertEquals(5, rows.size());
          assertEnriched(
              byFqn.get(LIVE_TAG_FQN),
              "Sensitive",
              "Sensitive Display",
              "Sensitive data",
              TagLabel.TagSource.CLASSIFICATION);
          assertUnenriched(byFqn.get(DELETED_TAG_FQN), TagLabel.TagSource.CLASSIFICATION);
          assertEnriched(
              byFqn.get(LIVE_TERM_FQN),
              "Customer",
              "Customer Display",
              "A customer",
              TagLabel.TagSource.GLOSSARY);
          assertUnenriched(byFqn.get(DELETED_TERM_FQN), TagLabel.TagSource.GLOSSARY);
          assertUnenriched(byFqn.get(ORPHAN_TAG_FQN), TagLabel.TagSource.CLASSIFICATION);
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void getTagsByTargetFQNHashes_excludesSoftDeletedTagsAndTerms(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          seedData(handle, dialect);
          TagUsageDAO tagUsageDAO = handle.attach(CollectionDAO.class).tagUsageDAO();

          Map<String, List<TagLabel>> result =
              tagUsageDAO.getTagsByTargetFQNHashes(List.of(TARGET_HASH));
          List<TagLabel> tags = result.get(TARGET_HASH);
          assertNotNull(tags);
          Map<String, TagLabel> byFqn =
              tags.stream()
                  .collect(Collectors.toMap(TagLabel::getTagFQN, Function.identity(), (a, b) -> a));

          assertEquals(5, tags.size());
          assertEnriched(
              byFqn.get(LIVE_TAG_FQN),
              "Sensitive",
              "Sensitive Display",
              "Sensitive data",
              TagLabel.TagSource.CLASSIFICATION);
          assertUnenriched(byFqn.get(DELETED_TAG_FQN), TagLabel.TagSource.CLASSIFICATION);
          assertEnriched(
              byFqn.get(LIVE_TERM_FQN),
              "Customer",
              "Customer Display",
              "A customer",
              TagLabel.TagSource.GLOSSARY);
          assertUnenriched(byFqn.get(DELETED_TERM_FQN), TagLabel.TagSource.GLOSSARY);
          assertUnenriched(byFqn.get(ORPHAN_TAG_FQN), TagLabel.TagSource.CLASSIFICATION);
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void getTagsByPrefix_excludesSoftDeletedTagsAndTerms(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          seedData(handle, dialect);
          TagUsageDAO tagUsageDAO = handle.attach(CollectionDAO.class).tagUsageDAO();

          Map<String, List<TagLabel>> result = tagUsageDAO.getTagsByPrefix("entity", "%", false);
          List<TagLabel> tags = result.get(TARGET_HASH);
          assertNotNull(tags);
          Map<String, TagLabel> byFqn =
              tags.stream()
                  .collect(Collectors.toMap(TagLabel::getTagFQN, Function.identity(), (a, b) -> a));

          assertEquals(5, tags.size());
          assertEnriched(
              byFqn.get(LIVE_TAG_FQN),
              "Sensitive",
              "Sensitive Display",
              "Sensitive data",
              TagLabel.TagSource.CLASSIFICATION);
          assertUnenriched(byFqn.get(DELETED_TAG_FQN), TagLabel.TagSource.CLASSIFICATION);
          assertEnriched(
              byFqn.get(LIVE_TERM_FQN),
              "Customer",
              "Customer Display",
              "A customer",
              TagLabel.TagSource.GLOSSARY);
          assertUnenriched(byFqn.get(DELETED_TERM_FQN), TagLabel.TagSource.GLOSSARY);
          assertUnenriched(byFqn.get(ORPHAN_TAG_FQN), TagLabel.TagSource.CLASSIFICATION);
        });
  }

  private static Map<String, TagLabel> labelsByFqn(List<Pair<String, TagLabel>> rows) {
    return rows.stream()
        .collect(
            Collectors.toMap(pair -> pair.getValue().getTagFQN(), Pair::getValue, (a, b) -> a));
  }

  private static void assertEnriched(
      TagLabel label,
      String name,
      String displayName,
      String description,
      TagLabel.TagSource source) {
    assertNotNull(label, "expected a tag label for source " + source);
    assertEquals(source, label.getSource());
    assertEquals(name, label.getName());
    assertEquals(displayName, label.getDisplayName());
    assertEquals(description, label.getDescription());
  }

  private static void assertUnenriched(TagLabel label, TagLabel.TagSource source) {
    assertNotNull(label, "expected a tag label for source " + source);
    assertEquals(source, label.getSource());
    assertNull(label.getName(), "soft-deleted or orphaned tag must not be enriched");
    assertNull(label.getDisplayName(), "soft-deleted or orphaned tag must not be enriched");
    assertNull(label.getDescription(), "soft-deleted or orphaned tag must not be enriched");
    assertNull(label.getStyle(), "soft-deleted or orphaned tag must not be enriched");
  }

  private static void seedData(Handle handle, ConnectionType dialect) {
    migrateRepositoryTables(handle, dialect);
    insertTag(handle, dialect, "liveTagHash", LIVE_TAG_JSON);
    insertTag(handle, dialect, "delTagHash", DELETED_TAG_JSON);
    insertTerm(handle, dialect, "liveTermHash", LIVE_TERM_JSON);
    insertTerm(handle, dialect, "delTermHash", DELETED_TERM_JSON);
    insertUsage(handle, 0, LIVE_TAG_FQN, "liveTagHash");
    insertUsage(handle, 0, DELETED_TAG_FQN, "delTagHash");
    insertUsage(handle, 1, LIVE_TERM_FQN, "liveTermHash");
    insertUsage(handle, 1, DELETED_TERM_FQN, "delTermHash");
    insertUsage(handle, 0, ORPHAN_TAG_FQN, "orphanTagHash");
  }

  private static void insertTag(
      Handle handle, ConnectionType dialect, String fqnHash, String json) {
    handle
        .createUpdate(
            "INSERT INTO tag (json, fqnHash) VALUES ("
                + (dialect == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)")
                + ", :fqnHash)")
        .bind("json", json)
        .bind("fqnHash", fqnHash)
        .execute();
  }

  private static void insertTerm(
      Handle handle, ConnectionType dialect, String fqnHash, String json) {
    handle
        .createUpdate(
            "INSERT INTO glossary_term_entity (json, fqnHash) VALUES ("
                + (dialect == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)")
                + ", :fqnHash)")
        .bind("json", json)
        .bind("fqnHash", fqnHash)
        .execute();
  }

  private static void insertUsage(Handle handle, int source, String tagFQN, String tagFQNHash) {
    handle
        .createUpdate(
            "INSERT INTO tag_usage (source, tagFQN, tagFQNHash, targetFQNHash, labelType, state)"
                + " VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state)")
        .bind("source", source)
        .bind("tagFQN", tagFQN)
        .bind("tagFQNHash", tagFQNHash)
        .bind("targetFQNHash", TARGET_HASH)
        .bind("labelType", TagLabel.LabelType.MANUAL.ordinal())
        .bind("state", TagLabel.State.CONFIRMED.ordinal())
        .execute();
  }
}
