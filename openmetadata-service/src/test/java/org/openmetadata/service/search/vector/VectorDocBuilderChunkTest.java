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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

/**
 * Unit test for the #4789 fix: {@link VectorDocBuilder#fromEntity} must emit one standalone
 * embedding document per body chunk (not just chunk 0), each carrying its own chunkIndex and the
 * KNN filter fields, so long articles are fully indexed and query-time ranking can pick the most
 * relevant chunk.
 */
class VectorDocBuilderChunkTest {

  private static final class MockEmbeddingClient extends EmbeddingClient {
    @Override
    protected float[] doEmbed(String text) {
      return new float[] {0.1f, 0.2f, 0.3f};
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
  void fromEntity_shortBodyProducesSingleChunk() {
    Table table = new Table().withId(UUID.randomUUID()).withName("t").withDescription("short body");
    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, new MockEmbeddingClient());
    assertEquals(1, docs.size());
    assertEquals(0, docs.get(0).get("chunkIndex"));
    assertEquals(1, docs.get(0).get("chunkCount"));
  }
}
