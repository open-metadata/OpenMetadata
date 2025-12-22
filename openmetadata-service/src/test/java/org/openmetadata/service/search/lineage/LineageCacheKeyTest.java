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

package org.openmetadata.service.search.lineage;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;

public class LineageCacheKeyTest {

  @Test
  public void testCacheKeyEquality_SameRequest() {
    SearchLineageRequest request =
        new SearchLineageRequest()
            .withFqn("table.db.schema.users")
            .withUpstreamDepth(3)
            .withDownstreamDepth(2)
            .withQueryFilter("owner.name:john")
            .withColumnFilter("id,name")
            .withPreservePaths(true)
            .withDirection(LineageDirection.UPSTREAM);

    LineageCacheKey key1 = LineageCacheKey.fromRequest(request);
    LineageCacheKey key2 = LineageCacheKey.fromRequest(request);

    assertEquals(key1, key2);
    assertEquals(key1.hashCode(), key2.hashCode());
  }

  @Test
  public void testCacheKeyEquality_DifferentFqn() {
    SearchLineageRequest request1 =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);

    SearchLineageRequest request2 =
        new SearchLineageRequest().withFqn("table2").withUpstreamDepth(3);

    LineageCacheKey key1 = LineageCacheKey.fromRequest(request1);
    LineageCacheKey key2 = LineageCacheKey.fromRequest(request2);

    assertNotEquals(key1, key2);
  }

  @Test
  public void testCacheKeyEquality_DifferentDepth() {
    SearchLineageRequest request1 =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);

    SearchLineageRequest request2 =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(5);

    LineageCacheKey key1 = LineageCacheKey.fromRequest(request1);
    LineageCacheKey key2 = LineageCacheKey.fromRequest(request2);

    assertNotEquals(key1, key2);
  }

  @Test
  public void testCacheKeyEquality_DifferentFilters() {
    SearchLineageRequest request1 =
        new SearchLineageRequest().withFqn("table1").withQueryFilter("owner:john");

    SearchLineageRequest request2 =
        new SearchLineageRequest().withFqn("table1").withQueryFilter("owner:jane");

    LineageCacheKey key1 = LineageCacheKey.fromRequest(request1);
    LineageCacheKey key2 = LineageCacheKey.fromRequest(request2);

    assertNotEquals(key1, key2);
  }

  @Test
  public void testNullHandling() {
    SearchLineageRequest request = new SearchLineageRequest().withFqn("table1");

    LineageCacheKey key = LineageCacheKey.fromRequest(request);

    assertNotNull(key);
    assertEquals("table1", key.getFqn());
    assertEquals(0, key.getUpstreamDepth());
    assertEquals(0, key.getDownstreamDepth());
    assertEquals("", key.getQueryFilter());
    assertEquals("", key.getColumnFilter());
    assertEquals(Boolean.TRUE, key.getPreservePaths());
  }

  @Test
  public void testToString() {
    SearchLineageRequest request =
        new SearchLineageRequest()
            .withFqn("table1")
            .withUpstreamDepth(3)
            .withDownstreamDepth(2)
            .withQueryFilter("owner:john")
            .withColumnFilter("id,name")
            .withPreservePaths(false);

    LineageCacheKey key = LineageCacheKey.fromRequest(request);
    String str = key.toString();

    assertTrue(str.contains("table1"));
    assertTrue(str.contains("up=3"));
    assertTrue(str.contains("down=2"));
    assertTrue(str.contains("owner:john"));
    assertTrue(str.contains("id,name"));
    assertTrue(str.contains("false"));
  }

  @Test
  public void testCacheKeyEquality_NullVsEmptyString() {
    SearchLineageRequest request1 =
        new SearchLineageRequest().withFqn("table1").withQueryFilter(null);

    SearchLineageRequest request2 =
        new SearchLineageRequest().withFqn("table1").withQueryFilter("");

    LineageCacheKey key1 = LineageCacheKey.fromRequest(request1);
    LineageCacheKey key2 = LineageCacheKey.fromRequest(request2);

    // Null and empty string should produce same cache key
    assertEquals(key1, key2);
    assertEquals(key1.hashCode(), key2.hashCode());
  }

  @Test
  public void testNullRequestThrowsException() {
    assertThrows(IllegalArgumentException.class, () -> LineageCacheKey.fromRequest(null));
  }
}
