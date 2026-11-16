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

package org.openmetadata.it.bench;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Every case here is a real URL shape the SDK or the UI sends. */
class ApiRoutesTest {

  @Test
  void collapsesAnEntityIdToAPlaceholder() {
    assertThat(
            ApiRoutes.routeOf(
                "GET", "/api/v1/tables/1f0c6c6e-3c8b-4d4e-9a35-2b1bd0c5f0aa", "fields=columns"))
        .isEqualTo("GET /v1/tables/{id}");
  }

  @Test
  void collapsesTheSegmentAfterNameToAnFqn() {
    assertThat(ApiRoutes.routeOf("GET", "/api/v1/users/name/admin", null))
        .isEqualTo("GET /v1/users/name/{fqn}");
  }

  @Test
  void collapsesBothEndsOfALineageEdgeAddressedByName() {
    assertThat(
            ApiRoutes.routeOf(
                "PUT",
                "/api/v1/lineage/table/name/svc.db.sc.orders/table/name/svc.db.sc.stg_orders",
                null))
        .isEqualTo("PUT /v1/lineage/table/name/{fqn}/table/name/{fqn}");
  }

  @Test
  void collapsesVersionsAndNumericSegments() {
    assertThat(
            ApiRoutes.routeOf(
                "GET", "/api/v1/tables/1f0c6c6e-3c8b-4d4e-9a35-2b1bd0c5f0aa/versions/0.3", null))
        .isEqualTo("GET /v1/tables/{id}/versions/{n}");
  }

  @Test
  void treatsADottedOrEncodedSegmentAsAName() {
    assertThat(ApiRoutes.routeOf("GET", "/api/v1/columns/svc.db.sc.t1.c1/lineage", null))
        .isEqualTo("GET /v1/columns/{fqn}/lineage");
    assertThat(ApiRoutes.routeOf("GET", "/api/v1/glossaries/Business%20Terms/terms", null))
        .isEqualTo("GET /v1/glossaries/{fqn}/terms");
  }

  @Test
  void dropsTheQueryStringByDefault() {
    assertThat(ApiRoutes.routeOf("GET", "/api/v1/tables", "limit=10&fields=owners"))
        .isEqualTo("GET /v1/tables");
  }

  @Test
  void keepsTheSearchIndexBecauseEachIndexIsADifferentQuery() {
    assertThat(
            ApiRoutes.routeOf(
                "GET", "/api/v1/search/query", "q=orders&index=table_search_index&from=0"))
        .isEqualTo("GET /v1/search/query?index=table_search_index");
  }

  @Test
  void splitsTheSceneByBandAndByWhetherItIsFocused() {
    assertThat(
            ApiRoutes.routeOf(
                "GET", "/api/v1/lineage/scene", "lens=service&band=LAYER&upstreamDepth=1"))
        .isEqualTo("GET /v1/lineage/scene?band=LAYER");
    assertThat(
            ApiRoutes.routeOf(
                "GET",
                "/api/v1/lineage/scene",
                "focusFqn=svc.db.sc.orders&band=ASSET&entityType=table"))
        .isEqualTo("GET /v1/lineage/scene?band=ASSET&focusFqn");
  }

  @Test
  void decodesDiscriminatorValues() {
    assertThat(ApiRoutes.routeOf("GET", "/api/v1/search/query", "index=table%2Ctopic"))
        .isEqualTo("GET /v1/search/query?index=table,topic");
  }

  @Test
  void recognisesApiPathsOnly() {
    assertThat(ApiRoutes.isApiPath("/api/v1/tables")).isTrue();
    assertThat(ApiRoutes.isApiPath("/assets/app-entry.js")).isFalse();
    assertThat(ApiRoutes.isApiPath(null)).isFalse();
  }
}
