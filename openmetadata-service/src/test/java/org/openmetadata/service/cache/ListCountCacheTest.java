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
    org.junit.jupiter.api.Assertions.assertEquals(16, hash.length());
    org.junit.jupiter.api.Assertions.assertTrue(
        hash.matches("[0-9a-f]{16}"), "expected 16 lowercase hex chars, got: " + hash);
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
