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

package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.ListFilter;

/**
 * Pins down the {@code (entityType, ListFilter) -> cache field} mapping used by {@link
 * ListCountCache}. The cache stores all filter variants for an entity type as fields under one
 * Redis hash; the field name is the first 16 hex chars of a SHA-1 over the canonicalized filter
 * (Include enum + sorted query params, UTF-8). If a future refactor accidentally drops a query
 * param from the canonical form, or reverts to iterating an unordered HashMap, two semantically
 * different listings would collide on one cache entry — these tests guard against that
 * regression.
 */
class ListCountCacheTest {

  @Test
  void sameFilterHashesDeterministically() {
    ListFilter a = new ListFilter(Include.NON_DELETED).addQueryParam("service", "aws_s3");
    ListFilter b = new ListFilter(Include.NON_DELETED).addQueryParam("service", "aws_s3");
    assertEquals(ListCountCache.hashFilter(a), ListCountCache.hashFilter(b));
  }

  @Test
  void rootTrueHashesDifferentlyFromAbsent() {
    // Same service, but ?root=true must land in a separate cache field. ContainerDAO runs a
    // different SQL for root=true (NOT EXISTS anti-join vs base count(*)), so the two counts can
    // legitimately differ for the same service even when no containers exist beneath any.
    ListFilter base = new ListFilter(Include.NON_DELETED).addQueryParam("service", "aws_s3");
    ListFilter root =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("service", "aws_s3")
            .addQueryParam("root", "true");
    assertNotEquals(ListCountCache.hashFilter(base), ListCountCache.hashFilter(root));
  }

  @Test
  void rootTrueAndRootFalseHashDifferently() {
    ListFilter rootTrue = new ListFilter(Include.NON_DELETED).addQueryParam("root", "true");
    ListFilter rootFalse = new ListFilter(Include.NON_DELETED).addQueryParam("root", "false");
    assertNotEquals(ListCountCache.hashFilter(rootTrue), ListCountCache.hashFilter(rootFalse));
  }

  @Test
  void differentServicesHashDifferently() {
    ListFilter a = new ListFilter(Include.NON_DELETED).addQueryParam("service", "aws_s3");
    ListFilter b = new ListFilter(Include.NON_DELETED).addQueryParam("service", "gcs_bucket");
    assertNotEquals(ListCountCache.hashFilter(a), ListCountCache.hashFilter(b));
  }

  @Test
  void differentIncludeHashDifferently() {
    // The Include enum drives the deleted predicate at the SQL level, so it must end up in the
    // hash even though it isn't in queryParams.
    ListFilter nonDeleted = new ListFilter(Include.NON_DELETED);
    ListFilter deleted = new ListFilter(Include.DELETED);
    ListFilter all = new ListFilter(Include.ALL);
    assertNotEquals(ListCountCache.hashFilter(nonDeleted), ListCountCache.hashFilter(deleted));
    assertNotEquals(ListCountCache.hashFilter(nonDeleted), ListCountCache.hashFilter(all));
    assertNotEquals(ListCountCache.hashFilter(deleted), ListCountCache.hashFilter(all));
  }

  @Test
  void hashIs16HexChars() {
    // SHA-1 truncated to 16 hex chars (64 bits). Lock the format so the Redis field width is
    // stable; downstream tooling and dashboards expect a fixed-width key.
    String hash = ListCountCache.hashFilter(new ListFilter(Include.NON_DELETED));
    assertEquals(16, hash.length());
    assertTrue(hash.matches("[0-9a-f]{16}"), "expected 16 lowercase hex chars, got: " + hash);
  }

  @Test
  void userSuppliedEntityFqnHashAffectsHash() {
    // entityFQNHash is a user-supplied filter param (see ListFilter.getEntityFQNHashCondition).
    // Two listings filtered by different entityFQNHash values must NOT collide on a single cache
    // field — that would return the wrong paging.total. Earlier we filtered out any
    // *Hash-suffixed key as "derived", which was wrong: this test pins the correct behavior.
    ListFilter a = new ListFilter(Include.NON_DELETED).addQueryParam("entityFQNHash", "deadbeef");
    ListFilter b = new ListFilter(Include.NON_DELETED).addQueryParam("entityFQNHash", "cafef00d");
    assertNotEquals(ListCountCache.hashFilter(a), ListCountCache.hashFilter(b));
  }

  @Test
  void derivedBindParamsThatLeakIntoFilterDoChangeHash() {
    // Documented contract: hashFilter is called BEFORE filter.getCondition() runs (callers in
    // EntityRepository.listAfter / listBefore / listAfterWithOffset arrange this). If a derived
    // bind param ends up in queryParams (because getCondition was somehow called first), it WILL
    // change the hash. This test documents that — it's not a "wrong" hash, it's a sentinel that
    // the caller violated the ordering contract. Cache hit rate suffers but correctness doesn't.
    ListFilter pristine = new ListFilter(Include.NON_DELETED).addQueryParam("service", "aws_s3");
    ListFilter contaminated =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("service", "aws_s3")
            .addQueryParam("serviceHash", "deadbeef.%"); // simulates getCondition() side-effect
    assertNotEquals(ListCountCache.hashFilter(pristine), ListCountCache.hashFilter(contaminated));
  }

  @Test
  void userValuesContainingSeparatorCharsDoNotCauseCollisions() {
    // The earlier canonical-string approach concatenated entries with `|` and `=`. A user value
    // containing those characters could craft a string identical to a different filter map.
    // After switching to length-prefixed digest feeds, the hash is collision-resistant against
    // any character in keys or values.
    ListFilter twoKeyMap =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("nameFilter", "foo")
            .addQueryParam("service", "bar");
    ListFilter craftedSingleValue =
        new ListFilter(Include.NON_DELETED).addQueryParam("nameFilter", "foo|service=bar");
    assertNotEquals(
        ListCountCache.hashFilter(twoKeyMap), ListCountCache.hashFilter(craftedSingleValue));

    // Same shape with `=` injected
    ListFilter clean = new ListFilter(Include.NON_DELETED).addQueryParam("k", "v");
    ListFilter injected = new ListFilter(Include.NON_DELETED).addQueryParam("k=", "v");
    assertNotEquals(ListCountCache.hashFilter(clean), ListCountCache.hashFilter(injected));
  }

  @Test
  void queryParamOrderDoesNotAffectHash() {
    // Two filters with the same params added in different order should hit the same cache field;
    // the canonicalization sorts by key.
    ListFilter ab =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("service", "aws_s3")
            .addQueryParam("root", "true");
    ListFilter ba =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("root", "true")
            .addQueryParam("service", "aws_s3");
    assertEquals(ListCountCache.hashFilter(ab), ListCountCache.hashFilter(ba));
  }
}
