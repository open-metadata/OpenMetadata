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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.sdk.exception.SearchException;

/**
 * The rejected shapes below were confirmed against a live OpenSearch node to fail the search with
 * {@code x_content_parse_exception}, which is the second failure recorded on issue #27990.
 */
class QueryFilterShapeTest {

  @Test
  @DisplayName("a valid filter is unwrapped and forwarded unchanged")
  void unwrapsOuterQueryKey() {
    String filter = "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"entityType\":\"table\"}}]}}}";

    String queryDsl = QueryFilterShape.requireQueryDsl(filter);

    assertEquals("{\"bool\":{\"must\":[{\"term\":{\"entityType\":\"table\"}}]}}", queryDsl);
  }

  @Test
  @DisplayName("a filter without the outer query key is forwarded as-is")
  void acceptsFilterWithoutOuterQueryKey() {
    String filter = "{\"bool\":{\"filter\":[{\"term\":{\"tier.tagFQN\":\"Tier.Tier1\"}}]}}";

    assertEquals(filter, QueryFilterShape.requireQueryDsl(filter));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        // the shape behind [bool] failed to parse field [must]
        "{\"query\":{\"bool\":{\"must\":[[{\"term\":{\"entityType\":\"table\"}}]]}}}",
        "{\"query\":{\"bool\":{\"must\":\"tableauServiceName\"}}}",
        "{\"query\":{\"bool\":{\"must\":[null]}}}",
        "{\"query\":{\"bool\":{\"must\":[1]}}}",
        "{\"query\":{\"bool\":{\"should\":[\"table\"]}}}",
        "{\"query\":{\"bool\":{\"filter\":42}}}",
        "{\"query\":{\"bool\":{\"must_not\":[[]]}}}",
        // nested one level down, where the caller composed two filters
        "{\"query\":{\"bool\":{\"filter\":[{\"bool\":{\"must\":[[]]}}]}}}"
      })
  @DisplayName("a filter that is valid JSON but not query DSL is rejected as a 400")
  void rejectsMalformedBoolClause(String filter) {
    SearchException thrown =
        assertThrows(SearchException.class, () -> QueryFilterShape.requireQueryDsl(filter));

    assertEquals(
        Response.Status.BAD_REQUEST.getStatusCode(), thrown.getResponse().getStatus(), filter);
    assertTrue(thrown.getMessage().contains("queryFilter"), thrown.getMessage());
  }

  @Test
  @DisplayName("text that is not JSON is rejected as a 400, not swallowed")
  void rejectsNonJsonFilter() {
    SearchException thrown =
        assertThrows(SearchException.class, () -> QueryFilterShape.requireQueryDsl("not json{"));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), thrown.getResponse().getStatus());
  }

  @Test
  @DisplayName("a JSON scalar is not a query")
  void rejectsScalarFilter() {
    assertThrows(SearchException.class, () -> QueryFilterShape.requireQueryDsl("\"table\""));
  }

  /**
   * {@code must}/{@code should}/{@code filter}/{@code must_not} are boolean clauses only inside a
   * {@code bool}. As ordinary field names they take a scalar, and the engine accepts that — so
   * enforcing the clause shape everywhere would reject a valid filter.
   */
  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"query\":{\"term\":{\"filter\":\"dashboard\"}}}",
        "{\"query\":{\"match\":{\"must\":\"y\"}}}",
        "{\"query\":{\"term\":{\"must_not\":123}}}",
        "{\"query\":{\"bool\":{\"filter\":[{\"term\":{\"should\":\"x\"}}]}}}"
      })
  @DisplayName("a field literally named like a boolean clause is still a valid filter")
  void acceptsFieldNamedLikeBoolClause(String filter) {
    assertDoesNotThrow(() -> QueryFilterShape.requireQueryDsl(filter));
  }
}
