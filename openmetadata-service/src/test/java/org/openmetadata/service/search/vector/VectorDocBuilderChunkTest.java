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
package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

/**
 * Unit test for the #4789 fix: {@link VectorDocBuilder#fromEntity} must emit one standalone
 * embedding document per body chunk (not just chunk 0), each carrying its own chunkIndex and the
 * KNN filter fields, so long articles are fully indexed and query-time ranking can pick the most
 * relevant chunk.
 */
class VectorDocBuilderChunkTest {

  private static final class MockEmbeddingClient extends EmbeddingClient {
    final AtomicInteger embedCalls = new AtomicInteger();

    @Override
    protected float[] doEmbed(String text) {
      embedCalls.incrementAndGet();
      // Vary the vector by text so reuse-vs-recompute can be told apart.
      float h = (text == null ? 0 : text.hashCode()) % 1000 / 1000f;
      return new float[] {0.1f + h, 0.2f, 0.3f};
    }

    @Override
    public int getDimension() {
      return 3;
    }

    @Override
    public String getModelId() {
      return "mock";
    }
  }

  @Test
  void fromEntity_emitsOneDocPerChunkForLongBody() {
    String longDescription = "revenue ".repeat(900);
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withDescription(longDescription);

    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, new MockEmbeddingClient());

    assertTrue(
        docs.size() > 1, "a >380-word body must yield multiple chunk docs, not just chunk 0");
    for (int i = 0; i < docs.size(); i++) {
      Map<String, Object> doc = docs.get(i);
      assertEquals(i, doc.get("chunkIndex"), "chunkIndex must be contiguous 0..N-1");
      assertEquals(docs.size(), doc.get("chunkCount"));
      assertEquals(table.getId().toString(), doc.get("parentId"), "all chunks share the parentId");
      assertNotNull(doc.get("embedding"), "each chunk must carry its own embedding");
      assertEquals(false, doc.get("deleted"), "filter field deleted must be materialized");
      assertEquals("svc.db.sch.orders", doc.get("fullyQualifiedName"));
    }
  }

  @Test
  void legacyEmbeddingFields_fromChunkZeroMatchBuildEmbeddingFields() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withDescription("revenue ".repeat(900));
    MockEmbeddingClient client = new MockEmbeddingClient();

    Map<String, Object> legacy = VectorDocBuilder.buildEmbeddingFields(table, client);
    Map<String, Object> fromChunkZero =
        OpenSearchVectorService.legacyEmbeddingFields(
            VectorDocBuilder.fromEntity(table, client).get(0));

    assertEquals(legacy.keySet(), fromChunkZero.keySet(), "legacy payload keys must match");
    for (String key : legacy.keySet()) {
      if (!"embedding".equals(key)) {
        assertEquals(legacy.get(key), fromChunkZero.get(key), "mismatch on " + key);
      }
    }
    assertTrue(
        !fromChunkZero.containsKey("tags") && !fromChunkZero.containsKey("entityType"),
        "chunk filter fields must not leak into the legacy entity-doc payload");
  }

  @Test
  void fromEntity_shortBodyProducesSingleChunk() {
    Table table = new Table().withId(UUID.randomUUID()).withName("t").withDescription("short body");
    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, new MockEmbeddingClient());
    assertEquals(1, docs.size());
    assertEquals(0, docs.get(0).get("chunkIndex"));
    assertEquals(1, docs.get(0).get("chunkCount"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void fromEntity_denormalizesLexicalAndFilterFieldsOnEveryChunk() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withDisplayName("Orders")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withDescription("revenue ".repeat(900))
            .withColumns(
                List.of(
                    new Column().withName("amount").withDataType(ColumnDataType.DOUBLE),
                    new Column().withName("country").withDataType(ColumnDataType.STRING)))
            .withOwners(List.of(new EntityReference().withName("finance").withType("team")))
            .withService(new EntityReference().withName("snowflake").withDisplayName("Snowflake"))
            .withDatabase(new EntityReference().withName("db"))
            .withDatabaseSchema(new EntityReference().withName("sch"));

    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, new MockEmbeddingClient());
    assertTrue(docs.size() > 1, "long body must yield multiple chunks");

    for (Map<String, Object> doc : docs) {
      assertEquals(VectorDocBuilder.CHUNK_DOC_VERSION, doc.get("docVersion"));
      // Lexical parity is present on EVERY chunk, not just chunk 0 — this is the #862 fix.
      assertNotNull(doc.get("description"), "description must be denormalized onto every chunk");
      assertTrue(doc.get("fqnParts") instanceof List, "fqnParts denormalized");
      assertTrue(((List<String>) doc.get("fqnParts")).containsAll(List.of("svc", "db", "sch")));
      List<Map<String, Object>> columns = (List<Map<String, Object>>) doc.get("columns");
      assertNotNull(columns);
      assertEquals("amount", columns.get(0).get("name"));
      // Filter parity so NLQ facet filters don't exclude chunk docs.
      assertEquals("Snowflake", ((Map<String, Object>) doc.get("service")).get("displayName"));
      assertEquals("db", ((Map<String, Object>) doc.get("database")).get("name"));
      assertEquals("sch", ((Map<String, Object>) doc.get("databaseSchema")).get("name"));
      List<Map<String, Object>> owners = (List<Map<String, Object>>) doc.get("owners");
      assertEquals("finance", owners.get(0).get("name"));
    }
  }

  @Test
  void addFilterFields_capsDenormalizedDescription() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("t")
            .withDescription("x".repeat(VectorDocBuilder.MAX_CHUNK_DESCRIPTION_CHARS + 5000));
    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, new MockEmbeddingClient());
    String description = (String) docs.get(0).get("description");
    assertEquals(VectorDocBuilder.MAX_CHUNK_DESCRIPTION_CHARS, description.length());
  }

  @Test
  void docVersion_doesNotChangeFingerprint_soNoReembedStorm() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withDescription("revenue report")
            .withOwners(List.of(new EntityReference().withName("finance").withType("team")));
    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, new MockEmbeddingClient());
    // The denormalized fields (owners, docVersion, ...) live outside the fingerprint, so a
    // docVersion bump never forces a re-embed of the whole catalog.
    assertEquals(
        VectorDocBuilder.computeFingerprintForEntity(table), docs.get(0).get("fingerprint"));
  }

  @Test
  void fromEntity_reuseOverloadDoesNotCallEmbeddingClient() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withDescription("revenue ".repeat(900));

    MockEmbeddingClient client = new MockEmbeddingClient();
    List<Map<String, Object>> original = VectorDocBuilder.fromEntity(table, client);
    int callsAfterOriginal = client.embedCalls.get();

    Map<Integer, float[]> reuse = new HashMap<>();
    for (int i = 0; i < original.size(); i++) {
      reuse.put(i, (float[]) original.get(i).get("embedding"));
    }

    List<Map<String, Object>> rebuilt = VectorDocBuilder.fromEntityReusingEmbeddings(table, reuse);

    assertEquals(callsAfterOriginal, client.embedCalls.get(), "reuse path must not call embed()");
    assertEquals(original.size(), rebuilt.size());
    for (int i = 0; i < original.size(); i++) {
      assertEquals(
          original.get(i).get("embedding"),
          rebuilt.get(i).get("embedding"),
          "reused vector must be the stored one");
      assertEquals(VectorDocBuilder.CHUNK_DOC_VERSION, rebuilt.get(i).get("docVersion"));
    }
    assertFalse(rebuilt.isEmpty());
  }
}
