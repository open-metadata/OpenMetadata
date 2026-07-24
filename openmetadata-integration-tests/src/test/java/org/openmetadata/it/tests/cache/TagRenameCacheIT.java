/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */
package org.openmetadata.it.tests.cache;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * End-to-end coverage for the search-based tag-rename cache invalidation (Bug A in the cache
 * audit). Renames a tag that's applied to a table; verifies the next GET on the table shows the
 * new tag FQN rather than the cached old one. Without the fix the cached entity bundle keeps the
 * old tag FQN until TTL expiry (default 48 h).
 *
 * <p>Tests are skipped without a Redis cache provider — the bundle/tag caches are no-ops without
 * one and there is nothing to assert.
 */
@ExtendWith(TestNamespaceExtension.class)
class TagRenameCacheIT {

  @BeforeAll
  static void requireRedis() {
    Assumptions.assumeTrue(
        TestSuiteBootstrap.isRedisEnabled(),
        "Tag rename cache invalidation tests require cacheProvider=redis (set by -Pcache-tests"
            + " or -Ppostgres-os-redis, or pass -DcacheProvider=redis directly)");
  }

  @Test
  void tagRename_updatesCachedEntityTags(TestNamespace ns) throws Exception {
    Classification classification = createClassification(ns, "rename_class");
    Tag tag = createTag(ns, classification, "rename_tag", "Original description");
    String oldFqn = tag.getFullyQualifiedName();

    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);

    Table table = createTableWithTag(ns, schema, "tag_rename_target", oldFqn);

    // Warm the bundle cache by reading the table once with tags expanded.
    Table beforeRename = SdkClients.adminClient().tables().get(table.getId().toString(), "tags");
    assertNotNull(beforeRename.getTags());
    assertTrue(
        beforeRename.getTags().stream().anyMatch(t -> oldFqn.equals(t.getTagFQN())),
        "Pre-rename read should see the original tag FQN");

    String newName = "renamed_" + System.currentTimeMillis();
    String patch = "[{\"op\":\"replace\",\"path\":\"/name\",\"value\":\"" + newName + "\"}]";
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/tags/" + tag.getId(),
            patch,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());

    String newFqn = classification.getFullyQualifiedName() + "." + newName;

    // Search index updates are async — allow a short window for the search-based invalidation
    // path to enumerate the affected entity, then re-fetch the table. The cached bundle must
    // have been invalidated; the next GET must hit the DB and surface the new tag FQN.
    Awaitility.await()
        .atMost(15, TimeUnit.SECONDS)
        .pollInterval(500, TimeUnit.MILLISECONDS)
        .untilAsserted(
            () -> {
              Table afterRename =
                  SdkClients.adminClient().tables().get(table.getId().toString(), "tags");
              List<TagLabel> tags = afterRename.getTags();
              assertNotNull(tags);
              assertFalse(
                  tags.stream().anyMatch(t -> oldFqn.equals(t.getTagFQN())),
                  "Cache must not return the stale tag FQN after rename");
              assertTrue(
                  tags.stream().anyMatch(t -> newFqn.equals(t.getTagFQN())),
                  "Post-rename read must show the new tag FQN");
            });
  }

  // -------------------------- Helpers --------------------------

  private static Classification createClassification(TestNamespace ns, String suffix) {
    CreateClassification request = new CreateClassification();
    request.setName(ns.shortPrefix(suffix));
    request.setDescription("Classification for cache rename IT");
    return SdkClients.adminClient().classifications().create(request);
  }

  private static Tag createTag(
      TestNamespace ns, Classification classification, String suffix, String description) {
    CreateTag request = new CreateTag();
    request.setName(ns.shortPrefix(suffix));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription(description);
    return SdkClients.adminClient().tags().create(request);
  }

  private static Table createTableWithTag(
      TestNamespace ns, DatabaseSchema schema, String suffix, String tagFqn) {
    TagLabel tagLabel = new TagLabel();
    tagLabel.setTagFQN(tagFqn);
    tagLabel.setSource(TagLabel.TagSource.CLASSIFICATION);
    tagLabel.setLabelType(TagLabel.LabelType.MANUAL);
    tagLabel.setState(TagLabel.State.CONFIRMED);

    Column column = new Column();
    column.setName("id");
    column.setDataType(ColumnDataType.INT);

    CreateTable createTable = new CreateTable();
    createTable.setName(ns.shortPrefix(suffix));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable.setColumns(List.of(column));
    createTable.setTags(List.of(tagLabel));
    return SdkClients.adminClient().tables().create(createTable);
  }
}
