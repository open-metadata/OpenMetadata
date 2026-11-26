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

import java.util.Set;
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
    assertEquals(request.getUpstreamDepth(), key.getUpstreamDepth());
    assertEquals(request.getDownstreamDepth(), key.getDownstreamDepth());
    assertEquals("", key.getQueryFilter());
    assertEquals("", key.getColumnFilter());
    assertEquals(Boolean.TRUE, key.getPreservePaths());
    assertEquals("", key.getDirection());
    assertEquals(Boolean.FALSE, key.getIsConnectedVia());
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

  @Test
  public void testEntityCountCacheKeyDifferentFromSize() {
    LineageCacheKey key1 =
        new LineageCacheKey(
            "table1",
            0,
            3,
            "",
            "",
            Boolean.FALSE,
            "downstream",
            Boolean.FALSE,
            0,
            10,
            1,
            Boolean.FALSE,
            0,
            0,
            null,
            null,
            0,
            0,
            null,
            Set.of());
    LineageCacheKey key2 =
        new LineageCacheKey(
            "table1",
            0,
            3,
            "",
            "",
            Boolean.FALSE,
            "downstream",
            Boolean.FALSE,
            10,
            10,
            1,
            Boolean.FALSE,
            0,
            0,
            null,
            null,
            0,
            0,
            null,
            Set.of());

    assertNotEquals(key1, key2);
  }

  @Test
  public void testEntityCountCacheKeyDifferentNodeDepth() {
    LineageCacheKey key1 =
        new LineageCacheKey(
            "table1",
            0,
            3,
            "",
            "",
            Boolean.FALSE,
            "downstream",
            Boolean.FALSE,
            0,
            10,
            1,
            Boolean.FALSE,
            0,
            0,
            null,
            null,
            0,
            0,
            null,
            Set.of());
    LineageCacheKey key2 =
        new LineageCacheKey(
            "table1",
            0,
            3,
            "",
            "",
            Boolean.FALSE,
            "downstream",
            Boolean.FALSE,
            0,
            10,
            2,
            Boolean.FALSE,
            0,
            0,
            null,
            null,
            0,
            0,
            null,
            Set.of());

    assertNotEquals(key1, key2);
  }

  @Test
  public void testEntityCountCacheKeySameParams() {
    LineageCacheKey key1 =
        new LineageCacheKey(
            "table1",
            0,
            3,
            "",
            "",
            Boolean.FALSE,
            "downstream",
            Boolean.FALSE,
            0,
            10,
            1,
            Boolean.FALSE,
            0,
            0,
            null,
            null,
            0,
            0,
            null,
            Set.of());
    LineageCacheKey key2 =
        new LineageCacheKey(
            "table1",
            0,
            3,
            "",
            "",
            Boolean.FALSE,
            "downstream",
            Boolean.FALSE,
            0,
            10,
            1,
            Boolean.FALSE,
            0,
            0,
            null,
            null,
            0,
            0,
            null,
            Set.of());

    assertEquals(key1, key2);
    assertEquals(key1.hashCode(), key2.hashCode());
  }

  @Test
  public void testEntityCountCacheKeyDifferentPaginationInfoSettings() {
    LineageCacheKey key1 =
        new LineageCacheKey(
            "table1",
            0,
            3,
            "",
            "",
            Boolean.FALSE,
            "downstream",
            Boolean.FALSE,
            0,
            10,
            1,
            Boolean.FALSE,
            0,
            0,
            null,
            null,
            0,
            0,
            null,
            Set.of());
    LineageCacheKey key2 =
        new LineageCacheKey(
            "table1",
            0,
            3,
            "",
            "",
            Boolean.FALSE,
            "downstream",
            Boolean.FALSE,
            0,
            10,
            1,
            Boolean.TRUE,
            2,
            3,
            null,
            null,
            0,
            0,
            null,
            Set.of());

    assertNotEquals(key1, key2);
  }

  @Test
  public void testFromRequestDefaultsPaginationFields() {
    SearchLineageRequest request = new SearchLineageRequest().withFqn("table1");
    LineageCacheKey key = LineageCacheKey.fromRequest(request);

    assertEquals(0, key.getFrom());
    assertEquals(0, key.getSize());
    assertEquals(0, key.getNodeDepth());
    assertEquals(Boolean.FALSE, key.getIncludePaginationInfo());
    assertEquals(0, key.getPaginationUpstreamDepth());
    assertEquals(0, key.getPaginationDownstreamDepth());
    assertEquals(0, key.getLayerFrom());
    assertEquals(1000, key.getLayerSize());
    assertNull(key.getIncludeDeleted());
    assertTrue(key.getIncludeSourceFields().isEmpty());
  }

  @Test
  public void testFromRequestWiresLayerFrom() {
    SearchLineageRequest requestA =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3).withLayerFrom(0);
    SearchLineageRequest requestB =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3).withLayerFrom(100);

    LineageCacheKey keyA = LineageCacheKey.fromRequest(requestA);
    LineageCacheKey keyB = LineageCacheKey.fromRequest(requestB);

    assertNotEquals(keyA, keyB);
    assertNotEquals(keyA.hashCode(), keyB.hashCode());
  }

  @Test
  public void testFromRequestWiresLayerSize() {
    SearchLineageRequest requestA =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3).withLayerSize(100);
    SearchLineageRequest requestB =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3).withLayerSize(999);

    LineageCacheKey keyA = LineageCacheKey.fromRequest(requestA);
    LineageCacheKey keyB = LineageCacheKey.fromRequest(requestB);

    assertNotEquals(keyA, keyB);
    assertNotEquals(keyA.hashCode(), keyB.hashCode());
  }

  @Test
  public void testFromRequestWiresIncludeDeleted() {
    SearchLineageRequest requestA =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3).withIncludeDeleted(true);
    SearchLineageRequest requestB =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3).withIncludeDeleted(false);

    LineageCacheKey keyA = LineageCacheKey.fromRequest(requestA);
    LineageCacheKey keyB = LineageCacheKey.fromRequest(requestB);

    assertNotEquals(keyA, keyB);
    assertNotEquals(keyA.hashCode(), keyB.hashCode());
  }

  @Test
  public void testFromRequestIncludeDeletedNullDiffersFromFalse() {
    SearchLineageRequest requestNull =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3);
    SearchLineageRequest requestFalse =
        new SearchLineageRequest().withFqn("table1").withUpstreamDepth(3).withIncludeDeleted(false);

    LineageCacheKey keyNull = LineageCacheKey.fromRequest(requestNull);
    LineageCacheKey keyFalse = LineageCacheKey.fromRequest(requestFalse);

    assertNotEquals(keyNull, keyFalse);
    assertNotEquals(keyNull.hashCode(), keyFalse.hashCode());
  }

  @Test
  public void testFromRequestWiresIncludeSourceFields() {
    SearchLineageRequest requestA =
        new SearchLineageRequest()
            .withFqn("table1")
            .withUpstreamDepth(3)
            .withIncludeSourceFields(Set.of("columns"));
    SearchLineageRequest requestB =
        new SearchLineageRequest()
            .withFqn("table1")
            .withUpstreamDepth(3)
            .withIncludeSourceFields(Set.of("columns", "tags"));

    LineageCacheKey keyA = LineageCacheKey.fromRequest(requestA);
    LineageCacheKey keyB = LineageCacheKey.fromRequest(requestB);

    assertNotEquals(keyA, keyB);
    assertNotEquals(keyA.hashCode(), keyB.hashCode());
  }

  @Test
  public void testFromRequestIncludeSourceFieldsOrderIndependent() {
    SearchLineageRequest requestA =
        new SearchLineageRequest()
            .withFqn("table1")
            .withUpstreamDepth(3)
            .withIncludeSourceFields(Set.of("columns", "tags"));
    SearchLineageRequest requestB =
        new SearchLineageRequest()
            .withFqn("table1")
            .withUpstreamDepth(3)
            .withIncludeSourceFields(Set.of("tags", "columns"));

    LineageCacheKey keyA = LineageCacheKey.fromRequest(requestA);
    LineageCacheKey keyB = LineageCacheKey.fromRequest(requestB);

    assertEquals(keyA, keyB);
    assertEquals(keyA.hashCode(), keyB.hashCode());
  }

  @Test
  public void testFromRequestSameRequestProducesEqualKeys() {
    SearchLineageRequest request =
        new SearchLineageRequest()
            .withFqn("table1")
            .withUpstreamDepth(3)
            .withLayerFrom(10)
            .withLayerSize(50)
            .withIncludeDeleted(true)
            .withIncludeSourceFields(Set.of("columns"));

    LineageCacheKey key1 = LineageCacheKey.fromRequest(request);
    LineageCacheKey key2 = LineageCacheKey.fromRequest(request);

    assertEquals(key1, key2);
    assertEquals(key1.hashCode(), key2.hashCode());
  }
}
