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

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.Response;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.sdk.exception.SearchException;

class SearchEngineErrorsTest {

  private static final String ALL_SHARDS_FAILED = "all shards failed";

  @Test
  @DisplayName("a malformed query the engine rejected is the caller's error, not a server fault")
  void mapsEngineBadRequestToBadRequest() {
    SearchException thrown =
        SearchEngineErrors.searchFailure(
            400,
            ALL_SHARDS_FAILED,
            List.of("query_shard_exception: Failed to parse query [:foo*]"));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), thrown.getResponse().getStatus());
  }

  @ParameterizedTest
  @ValueSource(ints = {429, 500, 502, 503})
  @DisplayName("a failure the caller did not cause stays a 500")
  void keepsNonBadRequestAsServerError(int upstreamStatus) {
    SearchException thrown =
        SearchEngineErrors.searchFailure(upstreamStatus, ALL_SHARDS_FAILED, List.of());

    assertEquals(
        Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
        thrown.getResponse().getStatus(),
        "upstream " + upstreamStatus);
  }

  @Test
  @DisplayName("root causes stay in the message so the caller can see what was wrong")
  void rendersRootCauses() {
    SearchException thrown =
        SearchEngineErrors.searchFailure(
            400, ALL_SHARDS_FAILED, List.of("parse_exception: Encountered \":\"", "other: reason"));

    assertTrue(thrown.getMessage().contains("parse_exception: Encountered"), thrown.getMessage());
    assertTrue(thrown.getMessage().contains("other: reason"), thrown.getMessage());
  }

  @Test
  @DisplayName("no root causes leaves the engine message intact")
  void rendersMessageWithoutRootCauses() {
    SearchException thrown = SearchEngineErrors.searchFailure(500, ALL_SHARDS_FAILED, List.of());

    assertEquals("Search failed due to " + ALL_SHARDS_FAILED, thrown.getMessage());
  }
}
